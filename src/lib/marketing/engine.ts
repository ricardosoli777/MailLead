/**
 * Sends pending campaign messages. Rules that must hold: a person gets a campaign at most once (K2),
 * a late unsubscribe still counts (U3), and nothing leaves while the breaker is open (R5).
 */
import { canReceive } from "./contacts";
import { parseDesign, renderMarketingEmail } from "./render";
import type { EngineDeps, Provider, RunResult, SenderSettings } from "./sending-types";
import { BREAKER_WINDOW_MS, DAY_MS, breakerReason, formatFrom, warmupLimit } from "./sending-utils";
import { createUnsubscribeToken, getSigningSecret, unsubscribeUrl } from "./unsubscribe";

export const BATCH_SIZE = 50;
/** A send left claimed this long was interrupted; whether it left is unknown, so it is not repeated. */
const STALE_CLAIM_MS = 15 * 60 * 1000;
const LEASE_MS = 4 * 60 * 1000;
const BREAKER_EVERY = 10;

export async function readSetting<T>(db: D1Database, key: string): Promise<T | null> {
	const row = await db.prepare("SELECT value FROM marketing_settings WHERE key = ?").bind(key).first<{ value: string }>();
	return row ? (JSON.parse(row.value) as T) : null;
}

export async function writeSetting(db: D1Database, key: string, value: unknown): Promise<void> {
	await db.prepare("INSERT INTO marketing_settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value").bind(key, JSON.stringify(value)).run();
}

export const dropSetting = (db: D1Database, key: string) => db.prepare("DELETE FROM marketing_settings WHERE key = ?").bind(key).run();

const PROVIDER_SQL = `CASE
	WHEN substr(c.email, instr(c.email, '@') + 1) IN ('gmail.com', 'googlemail.com') THEN 'gmail'
	WHEN substr(c.email, instr(c.email, '@') + 1) LIKE 'outlook.%' OR substr(c.email, instr(c.email, '@') + 1) LIKE 'hotmail.%' OR substr(c.email, instr(c.email, '@') + 1) LIKE 'live.%' THEN 'outlook'
	WHEN substr(c.email, instr(c.email, '@') + 1) LIKE 'yahoo.%' THEN 'yahoo'
	ELSE 'other' END`;

/** Freezes the content and the audience. Only people allowed to receive right now are queued. */
export async function createCampaign(db: D1Database, input: { name: string; listId: string; subject: string; design: unknown }, now = Date.now()) {
	const parsed = parseDesign(input.design);
	if ("error" in parsed) throw new Error(parsed.error);
	const id = crypto.randomUUID();
	await db.prepare("INSERT INTO marketing_campaigns (id, name, list_id, subject, design, status, created_at) VALUES (?, ?, ?, ?, ?, 'running', ?)")
		.bind(id, input.name, input.listId, input.subject, JSON.stringify(parsed.design), now).run();
	const queued = await db.prepare(`INSERT OR IGNORE INTO marketing_sends (id, campaign_id, contact_id, provider)
		SELECT lower(hex(randomblob(16))), ?, c.id, ${PROVIDER_SQL}
		FROM marketing_list_members m JOIN marketing_contacts c ON c.id = m.contact_id
		WHERE m.list_id = ? AND m.unsubscribed_at IS NULL
		AND EXISTS (SELECT 1 FROM marketing_consents k WHERE k.contact_id = c.id)
		AND NOT EXISTS (SELECT 1 FROM marketing_suppressions s WHERE s.email_hash = c.email_hash)`).bind(id, input.listId).run();
	return { id, queued: queued.meta.changes };
}

export async function breakerStats(db: D1Database, now: number) {
	const resetAt = (await readSetting<number>(db, "breaker_reset_at")) ?? 0;
	const row = await db.prepare("SELECT COUNT(*) AS sent, COUNT(bounced_at) AS bounced, COUNT(complained_at) AS complained FROM marketing_sends WHERE sent_at > ?")
		.bind(Math.max(resetAt, now - BREAKER_WINDOW_MS)).first<{ sent: number; bounced: number; complained: number }>();
	return row!;
}

/** Opens the breaker when the numbers say so; once open only a person closes it. */
export async function checkBreaker(db: D1Database, now = Date.now()): Promise<string | null> {
	const open = await readSetting<{ reason: string }>(db, "breaker");
	if (open) return open.reason;
	const reason = breakerReason(await breakerStats(db, now));
	if (reason) await writeSetting(db, "breaker", { reason, at: now });
	return reason;
}

export async function resetBreaker(db: D1Database, now = Date.now()): Promise<void> {
	await writeSetting(db, "breaker_reset_at", now);
	await dropSetting(db, "breaker");
}

export async function warmupState(db: D1Database, now = Date.now()) {
	const startedAt = await readSetting<number>(db, "warmup_started_at");
	const day = startedAt ? Math.floor((now - startedAt) / DAY_MS) + 1 : 1;
	const row = await db.prepare("SELECT COUNT(*) AS sent FROM marketing_sends WHERE sent_at > ?").bind(now - DAY_MS).first<{ sent: number }>();
	return { day, limit: warmupLimit(day), sentLast24Hours: row!.sent };
}

/** Only one run at a time, otherwise two overlapping runs would each spend the same allowance. */
async function takeLease(db: D1Database, now: number): Promise<boolean> {
	const taken = await db.prepare("INSERT INTO marketing_settings (key, value) VALUES ('engine_lease', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value WHERE CAST(marketing_settings.value AS INTEGER) < ?")
		.bind(String(now + LEASE_MS), now).run();
	return taken.meta.changes > 0;
}

type Pending = { id: string; campaign_id: string; contact_id: string; provider: Provider; list_id: string; subject: string; design: string; email: string; name: string; fields: string };

const errorInfo = (error: unknown) => {
	const value = error as { status?: number; code?: string; message?: string };
	return { status: value?.status, code: value?.code ?? "", message: String(value?.message ?? error).slice(0, 300) };
};

export async function runEngine(db: D1Database, deps: EngineDeps, batchSize = BATCH_SIZE): Promise<RunResult> {
	const now = deps.now ?? Date.now;
	const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
	const result: RunResult = { sent: 0, skipped: 0, failed: 0, blocked: null };
	const stop = (blocked: string) => ({ ...result, blocked });

	await db.prepare("UPDATE marketing_sends SET status = 'unknown', error = 'envio interrompido' WHERE status = 'sending' AND claimed_at < ?").bind(now() - STALE_CLAIM_MS).run();
	await db.prepare("UPDATE marketing_campaigns SET status = 'done' WHERE status = 'running' AND NOT EXISTS (SELECT 1 FROM marketing_sends s WHERE s.campaign_id = marketing_campaigns.id AND s.status IN ('pending', 'sending'))").run();
	if (!(await db.prepare("SELECT 1 AS ok FROM marketing_sends s JOIN marketing_campaigns p ON p.id = s.campaign_id WHERE s.status = 'pending' AND p.status = 'running' LIMIT 1").first())) return result;

	const settings = await readSetting<SenderSettings>(db, "sender");
	if (!settings) return stop("O remetente de marketing não está configurado.");
	const breaker = await checkBreaker(db, now());
	if (breaker) return stop(breaker);
	if (!(await takeLease(db, now()))) return stop("Outra execução está em andamento.");

	try {
		const refused = await deps.preflight?.();
		if (refused) return stop(refused);
		const quota = await deps.quota();
		if (!quota.sendingEnabled) return stop("O envio está desativado na conta do Amazon SES.");
		const warmup = await warmupState(db, now());
		let allowance = Math.min(batchSize, warmup.limit - warmup.sentLast24Hours, quota.max24Hour - quota.sentLast24Hours);
		if (allowance <= 0) return stop("Limite diário atingido; o restante sai depois.");

		const hourly = await db.prepare("SELECT provider, COUNT(*) AS sent FROM marketing_sends WHERE sent_at > ? GROUP BY provider").bind(now() - 60 * 60 * 1000).all<{ provider: Provider; sent: number }>();
		const room: Record<Provider, number> = { ...settings.hourlyByProvider };
		for (const row of hourly.results) room[row.provider] -= row.sent;
		const providers = (Object.keys(room) as Provider[]).filter((provider) => room[provider] > 0);
		if (!providers.length) return stop("Ritmo por hora atingido; o restante sai depois.");

		const pending: Pending[] = [];
		// One query per provider so a full Gmail hour does not hold back everyone else.
		for (const provider of providers) {
			const { results } = await db.prepare(`SELECT s.id, s.campaign_id, s.contact_id, s.provider, p.list_id, p.subject, p.design, c.email, c.name, c.fields
				FROM marketing_sends s JOIN marketing_campaigns p ON p.id = s.campaign_id JOIN marketing_contacts c ON c.id = s.contact_id
				WHERE s.status = 'pending' AND p.status = 'running' AND s.provider = ? ORDER BY p.created_at, s.id LIMIT ?`)
				.bind(provider, Math.min(room[provider], allowance)).all<Pending>();
			pending.push(...results);
		}

		const secret = await getSigningSecret(db);
		const from = formatFrom(settings.fromName, settings.fromEmail);
		const gap = Math.ceil(1000 / Math.max(1, quota.maxPerSecond));
		let attempted = 0;

		for (const item of pending) {
			if (allowance <= 0) break;
			if (attempted > 0 && attempted % BREAKER_EVERY === 0) {
				const tripped = await checkBreaker(db, now());
				if (tripped) return stop(tripped);
			}
			const claim = await db.prepare("UPDATE marketing_sends SET status = 'sending', claimed_at = ? WHERE id = ? AND status = 'pending'").bind(now(), item.id).run();
			if (!claim.meta.changes) continue;
			const finish = (status: string, error = "") => db.prepare("UPDATE marketing_sends SET status = ?, error = ? WHERE id = ?").bind(status, error, item.id).run();

			if (!(await canReceive(db, item.contact_id, item.list_id))) {
				await finish("skipped", "não pode mais receber");
				result.skipped++;
				continue;
			}

			let message;
			try {
				const parsed = parseDesign(JSON.parse(item.design));
				if ("error" in parsed) throw new Error(parsed.error);
				const url = unsubscribeUrl(settings.origin, await createUnsubscribeToken(secret, item.contact_id));
				const fields = JSON.parse(item.fields || "{}") as Record<string, string>;
				const rendered = renderMarketingEmail(parsed.design, item.subject, { ...fields, nome: item.name, email: item.email }, url);
				message = { to: item.email, from, replyTo: settings.replyTo, ...rendered };
			} catch (error) {
				await finish("failed", errorInfo(error).message);
				result.failed++;
				continue;
			}

			if (attempted > 0) await sleep(gap);
			attempted++;
			try {
				const { messageId } = await deps.send(message);
				await db.prepare("UPDATE marketing_sends SET status = 'sent', message_id = ?, sent_at = ? WHERE id = ?").bind(messageId, now(), item.id).run();
				await db.prepare("INSERT OR IGNORE INTO marketing_settings (key, value) VALUES ('warmup_started_at', ?)").bind(String(now())).run();
				result.sent++;
				allowance--;
			} catch (error) {
				const { status, code, message: detail } = errorInfo(error);
				// Refused for now, nothing left: keep it queued and try on a later run.
				if (status === 429 || /Throttl|TooManyRequests|LimitExceeded|SendingPaused|AccountSuspended|AccessDenied|NotAuthorized|SignatureDoesNotMatch|UnrecognizedClient/i.test(code)) {
					await finish("pending", detail);
					return stop(`O Amazon SES recusou o envio: ${detail}`);
				}
				// A 4xx means this message was rejected. Anything else may have been accepted: never resend.
				await finish(status && status >= 400 && status < 500 ? "failed" : "unknown", detail);
				result.failed++;
			}
		}
		return result;
	} finally {
		await dropSetting(db, "engine_lease");
	}
}
