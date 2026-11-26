/** Campaigns: audience, scheduling, pause and cancel, and their numbers (K1, K3, R7). */
import type { CampaignReport, CampaignStatus } from "./campaigns-types";
import { parseDesign } from "./render";

/** R7: how long without an open or a click makes someone inactive. */
export const INACTIVE_MS = 180 * 24 * 60 * 60 * 1000;

const PROVIDER_SQL = `CASE
	WHEN substr(c.email, instr(c.email, '@') + 1) IN ('gmail.com', 'googlemail.com') THEN 'gmail'
	WHEN substr(c.email, instr(c.email, '@') + 1) LIKE 'outlook.%' OR substr(c.email, instr(c.email, '@') + 1) LIKE 'hotmail.%' OR substr(c.email, instr(c.email, '@') + 1) LIKE 'live.%' THEN 'outlook'
	WHEN substr(c.email, instr(c.email, '@') + 1) LIKE 'yahoo.%' THEN 'yahoo'
	ELSE 'other' END`;

/** Consented, still on the list, never blocked, and carrying the tag when one was chosen. */
const AUDIENCE = `FROM marketing_list_members m JOIN marketing_contacts c ON c.id = m.contact_id
	WHERE m.list_id = ?1 AND m.unsubscribed_at IS NULL
	AND EXISTS (SELECT 1 FROM marketing_consents k WHERE k.contact_id = c.id)
	AND NOT EXISTS (SELECT 1 FROM marketing_suppressions s WHERE s.email_hash = c.email_hash)
	AND (?2 = '' OR EXISTS (SELECT 1 FROM marketing_contact_tags t WHERE t.contact_id = c.id AND t.tag = ?2))`;

/** Mailed for longer than the window (?3 is its start) and silent inside it. */
const INACTIVE = `(EXISTS (SELECT 1 FROM marketing_sends o WHERE o.contact_id = c.id AND o.sent_at < ?3)
	AND NOT EXISTS (SELECT 1 FROM marketing_sends a WHERE a.contact_id = c.id AND (a.opened_at >= ?3 OR a.clicked_at >= ?3)))`;

export async function countAudience(db: D1Database, listId: string, tag: string, now = Date.now()) {
	const row = await db.prepare(`SELECT COUNT(*) AS total, COALESCE(SUM(${INACTIVE}), 0) AS inactive ${AUDIENCE}`).bind(listId, tag, now - INACTIVE_MS).first<{ total: number; inactive: number }>();
	return row!;
}

type Stored = { id: string; list_id: string; tag: string; include_inactive: number };

/** Queues the audience of a campaign that is due. Safe to repeat: one row per person (K2). */
async function materialize(db: D1Database, campaign: Stored, now: number): Promise<number> {
	const queued = await db.prepare(`INSERT OR IGNORE INTO marketing_sends (id, campaign_id, contact_id, provider)
		SELECT lower(hex(randomblob(16))), ?4, c.id, ${PROVIDER_SQL} ${AUDIENCE}
		AND (?5 = 1 OR NOT ${INACTIVE})`).bind(campaign.list_id, campaign.tag, now - INACTIVE_MS, campaign.id, campaign.include_inactive).run();
	await db.prepare("UPDATE marketing_campaigns SET status = 'running', started_at = ? WHERE id = ? AND status = 'scheduled'").bind(now, campaign.id).run();
	return queued.meta.changes;
}

/** Freezes the content now; the audience is read when the campaign starts. */
export async function createCampaign(db: D1Database, input: { name: string; listId: string; subject: string; design: unknown; tag?: string; includeInactive?: boolean; scheduledAt?: number | null }, now = Date.now()) {
	const parsed = parseDesign(input.design);
	if ("error" in parsed) throw new Error(parsed.error);
	const id = crypto.randomUUID();
	const scheduledAt = input.scheduledAt && input.scheduledAt > now ? input.scheduledAt : null;
	await db.prepare("INSERT INTO marketing_campaigns (id, name, list_id, subject, design, status, created_at, scheduled_at, tag, include_inactive) VALUES (?, ?, ?, ?, ?, 'scheduled', ?, ?, ?, ?)")
		.bind(id, input.name, input.listId, input.subject, JSON.stringify(parsed.design), now, scheduledAt, input.tag ?? "", input.includeInactive ? 1 : 0).run();
	const queued = scheduledAt ? 0 : await materialize(db, { id, list_id: input.listId, tag: input.tag ?? "", include_inactive: input.includeInactive ? 1 : 0 }, now);
	return { id, queued };
}

export async function startDueCampaigns(db: D1Database, now = Date.now()): Promise<void> {
	const { results } = await db.prepare("SELECT id, list_id, tag, include_inactive FROM marketing_campaigns WHERE status = 'scheduled' AND (scheduled_at IS NULL OR scheduled_at <= ?)").bind(now).all<Stored>();
	for (const campaign of results) await materialize(db, campaign, now);
}

const MOVES: Record<"pause" | "resume" | "cancel", { from: CampaignStatus[]; to: string }> = {
	pause: { from: ["running", "scheduled"], to: "'paused'" },
	// A campaign paused before it started goes back to waiting for its time.
	resume: { from: ["paused"], to: "CASE WHEN started_at IS NULL THEN 'scheduled' ELSE 'running' END" },
	cancel: { from: ["running", "scheduled", "paused"], to: "'cancelled'" },
};

export type CampaignAction = keyof typeof MOVES;
export const isCampaignAction = (value: unknown): value is CampaignAction => typeof value === "string" && Object.hasOwn(MOVES, value);

export async function changeCampaign(db: D1Database, id: string, action: CampaignAction): Promise<boolean> {
	const move = MOVES[action];
	const changed = await db.prepare(`UPDATE marketing_campaigns SET status = ${move.to} WHERE id = ? AND status IN (${move.from.map((status) => `'${status}'`).join(", ")})`).bind(id).run();
	if (!changed.meta.changes) return false;
	if (action === "cancel") await db.prepare("UPDATE marketing_sends SET status = 'skipped', error = 'campanha cancelada' WHERE campaign_id = ? AND status = 'pending'").bind(id).run();
	return true;
}

export async function listCampaigns(db: D1Database): Promise<CampaignReport[]> {
	const { results } = await db.prepare(`SELECT p.id, p.name, p.subject, p.status, l.name AS listName, p.tag, p.created_at AS createdAt, p.scheduled_at AS scheduledAt,
		COUNT(s.id) AS total,
		COALESCE(SUM(s.status IN ('pending', 'sending')), 0) AS pending,
		COUNT(s.sent_at) AS sent,
		COUNT(s.delivered_at) AS delivered,
		COUNT(s.bounced_at) AS bounced,
		COUNT(s.complained_at) AS complained,
		COUNT(s.unsubscribed_at) AS unsubscribed,
		COUNT(s.opened_at) AS opened,
		COUNT(s.clicked_at) AS clicked,
		COALESCE(SUM(s.status = 'skipped'), 0) AS skipped,
		COALESCE(SUM(s.status IN ('failed', 'unknown')), 0) AS failed
		FROM marketing_campaigns p
		LEFT JOIN marketing_lists l ON l.id = p.list_id
		LEFT JOIN marketing_sends s ON s.campaign_id = p.id
		GROUP BY p.id ORDER BY p.created_at DESC LIMIT 100`).all<CampaignReport>();
	return results;
}

/** Credits an unsubscribe to the campaign whose link was used. */
export async function markUnsubscribed(db: D1Database, contactId: string, campaignId: string, now = Date.now()): Promise<void> {
	await db.prepare("UPDATE marketing_sends SET unsubscribed_at = COALESCE(unsubscribed_at, ?) WHERE contact_id = ? AND campaign_id = ?").bind(now, contactId, campaignId).run();
}
