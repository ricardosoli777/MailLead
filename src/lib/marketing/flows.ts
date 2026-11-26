/**
 * Funnels (F1-F6). Each e-mail step is a hidden campaign, so the sending engine applies consent,
 * unsubscribe, warm-up, breaker, tracking and feedback to it exactly as to any campaign.
 */
import { newId } from "@/lib/ids";
import { PROVIDER_SQL } from "./campaigns";
import type { Flow, FlowDraft, FlowStatus, FlowStep } from "./flows-types";
import { parseSteps, stepErrors, successors, walk, type Node } from "./flows-utils";
import { parseDesign } from "./render";

const RUNS_PER_TICK = 100;
const MAX_MOVES_PER_RUN = 20;
const HOUR = 60 * 60 * 1000;

const campaignId = (flowId: string, stepId: string) => `flow:${flowId}:${stepId}`;
const prefixed = "substr(id, 1, length(?1)) = ?1";

type Row = { id: string; name: string; list_id: string; trigger_tag: string; goal_tag: string; steps: string; status: FlowStatus; activated_at: number | null };

const getRow = (db: D1Database, id: string) => db.prepare("SELECT * FROM marketing_flows WHERE id = ?").bind(id).first<Row>();

export async function createFlow(db: D1Database, input: FlowDraft, now = Date.now()): Promise<string> {
	const id = newId("flw");
	await db.prepare("INSERT INTO marketing_flows (id, name, list_id, trigger_tag, goal_tag, steps, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
		.bind(id, input.name, input.listId, input.triggerTag, input.goalTag ?? "", JSON.stringify(input.steps), now).run();
	return id;
}

/** An active funnel is paused before it is changed, so nobody walks a half-edited path. */
export async function saveFlow(db: D1Database, id: string, input: FlowDraft): Promise<boolean> {
	return (await db.prepare("UPDATE marketing_flows SET name = ?, list_id = ?, trigger_tag = ?, goal_tag = ?, steps = ? WHERE id = ? AND status <> 'active'")
		.bind(input.name, input.listId, input.triggerTag, input.goalTag ?? "", JSON.stringify(input.steps), id).run()).meta.changes > 0;
}

export function readFlowInput(input: unknown): FlowDraft | { error: string } {
	const value = (input ?? {}) as { name?: unknown; listId?: unknown; triggerTag?: unknown; goalTag?: unknown; steps?: unknown };
	const name = typeof value.name === "string" ? value.name.trim().slice(0, 100) : "";
	if (!name) return { error: "Dê um nome ao funil." };
	const parsed = parseSteps(value.steps ?? []);
	if ("error" in parsed) return parsed;
	return {
		name,
		listId: typeof value.listId === "string" ? value.listId.slice(0, 80) : "",
		triggerTag: typeof value.triggerTag === "string" ? value.triggerTag.trim().toLowerCase().slice(0, 40) : "",
		goalTag: typeof value.goalTag === "string" ? value.goalTag.trim().toLowerCase().slice(0, 40) : "",
		steps: parsed.steps,
	};
}

const cancelSteps = async (db: D1Database, flowId: string, keep: Set<string>) => {
	const { results } = await db.prepare(`SELECT id FROM marketing_campaigns WHERE kind = 'flow' AND ${prefixed}`).bind(`flow:${flowId}:`).all<{ id: string }>();
	for (const { id } of results.filter((row) => !keep.has(row.id))) {
		await db.batch([
			db.prepare("UPDATE marketing_campaigns SET status = 'cancelled' WHERE id = ?").bind(id),
			db.prepare("UPDATE marketing_sends SET status = 'skipped', error = 'passo removido' WHERE campaign_id = ? AND status = 'pending'").bind(id),
		]);
	}
};

/** Checks everything and freezes the content of each e-mail. Returns why it cannot start, or null. */
export async function activateFlow(db: D1Database, id: string, now = Date.now()): Promise<string | null> {
	const flow = await getRow(db, id);
	if (!flow) return "Funil não encontrado.";
	const list = await db.prepare("SELECT 1 AS ok FROM marketing_lists WHERE id = ?").bind(flow.list_id).first();
	if (!list) return "Escolha a lista que inicia o funil.";
	const steps = JSON.parse(flow.steps) as FlowStep[];
	if (!steps.length) return "Adicione pelo menos um passo.";
	const [problem] = Object.values(stepErrors(steps));
	if (problem) return problem;

	const mails: { id: string; subject: string; design: string }[] = [];
	for (const step of walk(steps)) {
		if (step.type !== "email") continue;
		const template = await db.prepare("SELECT name, subject, design FROM marketing_templates WHERE id = ?").bind(step.templateId).first<{ name: string; subject: string; design: string }>();
		if (!template) return "Um modelo usado no funil foi apagado.";
		const subject = step.subject.trim() || template.subject.trim();
		if (!subject) return `Informe o assunto do e-mail "${template.name}".`;
		const parsed = parseDesign(JSON.parse(template.design));
		if ("error" in parsed) return `${template.name}: ${parsed.error}`;
		mails.push({ id: campaignId(id, step.id), subject, design: JSON.stringify(parsed.design) });
	}
	for (const mail of mails) {
		await db.prepare(`INSERT INTO marketing_campaigns (id, name, list_id, subject, design, status, created_at, kind) VALUES (?, ?, ?, ?, ?, 'running', ?, 'flow')
			ON CONFLICT (id) DO UPDATE SET name = excluded.name, list_id = excluded.list_id, subject = excluded.subject, design = excluded.design, status = 'running'`)
			.bind(mail.id, flow.name, flow.list_id, mail.subject, mail.design, now).run();
	}
	await cancelSteps(db, id, new Set(mails.map((mail) => mail.id)));
	await db.prepare("UPDATE marketing_flows SET status = 'active', activated_at = COALESCE(activated_at, ?) WHERE id = ?").bind(now, id).run();
	return null;
}

export async function pauseFlow(db: D1Database, id: string): Promise<boolean> {
	const changed = await db.prepare("UPDATE marketing_flows SET status = 'paused' WHERE id = ? AND status = 'active'").bind(id).run();
	if (changed.meta.changes) await db.prepare(`UPDATE marketing_campaigns SET status = 'paused' WHERE kind = 'flow' AND status = 'running' AND ${prefixed}`).bind(`flow:${id}:`).run();
	return changed.meta.changes > 0;
}

/** The sends stay, hidden, so bounces and unsubscribes that arrive later are still understood. */
export async function deleteFlow(db: D1Database, id: string): Promise<boolean> {
	await cancelSteps(db, id, new Set());
	await db.prepare("DELETE FROM marketing_flow_runs WHERE flow_id = ?").bind(id).run();
	return (await db.prepare("DELETE FROM marketing_flows WHERE id = ?").bind(id).run()).meta.changes > 0;
}

/** Consented, still on the list and not blocked: the same rule campaigns follow. */
const ELIGIBLE = `m.unsubscribed_at IS NULL
	AND EXISTS (SELECT 1 FROM marketing_consents k WHERE k.contact_id = c.id)
	AND NOT EXISTS (SELECT 1 FROM marketing_suppressions s WHERE s.email_hash = c.email_hash)`;

/** F3: whoever can no longer receive leaves every funnel of that list. */
async function exitIneligible(db: D1Database): Promise<void> {
	await db.prepare(`UPDATE marketing_flow_runs SET status = 'exited' WHERE status = 'active' AND NOT EXISTS (
		SELECT 1 FROM marketing_flows f
		JOIN marketing_list_members m ON m.list_id = f.list_id AND m.contact_id = marketing_flow_runs.contact_id
		JOIN marketing_contacts c ON c.id = m.contact_id
		WHERE f.id = marketing_flow_runs.flow_id AND ${ELIGIBLE})`).run();
}

/** F1: who joined the list, or got the tag, since the funnel was first activated. */
async function enroll(db: D1Database, flow: Row, now: number): Promise<void> {
	const first = (JSON.parse(flow.steps) as FlowStep[])[0]?.id;
	if (!first) return;
	const since = flow.trigger_tag
		? "EXISTS (SELECT 1 FROM marketing_contact_tags t WHERE t.contact_id = c.id AND t.tag = ?5 AND t.created_at >= ?6)"
		: "?5 = '' AND m.created_at >= ?6";
	await db.prepare(`INSERT OR IGNORE INTO marketing_flow_runs (flow_id, contact_id, step_id, status, next_check_at, created_at)
		SELECT ?1, c.id, ?2, 'active', ?3, ?3 FROM marketing_list_members m JOIN marketing_contacts c ON c.id = m.contact_id
		WHERE m.list_id = ?4 AND ${ELIGIBLE} AND ${since}`)
		.bind(flow.id, first, now, flow.list_id, flow.trigger_tag, flow.activated_at ?? now).run();
}

/** Reaching the goal ends the passage and drops what was still queued for that person. */
async function reachGoals(db: D1Database): Promise<void> {
	await db.prepare(`UPDATE marketing_sends SET status = 'skipped', error = 'objetivo atingido' WHERE status = 'pending' AND EXISTS (
		SELECT 1 FROM marketing_flows f JOIN marketing_contact_tags t ON t.tag = f.goal_tag
		WHERE f.goal_tag <> '' AND t.contact_id = marketing_sends.contact_id
		AND substr(marketing_sends.campaign_id, 1, length(f.id) + 6) = 'flow:' || f.id || ':')`).run();
	await db.prepare(`UPDATE marketing_flow_runs SET status = 'goal' WHERE status = 'active' AND EXISTS (
		SELECT 1 FROM marketing_flows f JOIN marketing_contact_tags t ON t.tag = f.goal_tag
		WHERE f.id = marketing_flow_runs.flow_id AND f.goal_tag <> '' AND t.contact_id = marketing_flow_runs.contact_id)`).run();
}

type Run = { flow_id: string; contact_id: string; step_id: string | null; wake_at: number | null; last_send_id: string | null };

/** Walks one person forward until a step has to wait. */
async function advance(db: D1Database, run: Run, nodes: Map<string, Node>, now: number): Promise<void> {
	let { step_id: stepId, wake_at: wakeAt, last_send_id: lastSend } = run;
	let nextCheck = now;
	for (let moves = 0; moves < MAX_MOVES_PER_RUN && stepId; moves++) {
		const node = nodes.get(stepId);
		// The step was removed while the funnel was paused.
		if (!node) { stepId = null; break; }
		const { step } = node;
		if (step.type === "email") {
			const id = campaignId(run.flow_id, step.id);
			const send = await db.prepare("SELECT id, status FROM marketing_sends WHERE campaign_id = ? AND contact_id = ?").bind(id, run.contact_id).first<{ id: string; status: string }>();
			if (!send) {
				await db.prepare(`INSERT OR IGNORE INTO marketing_sends (id, campaign_id, contact_id, provider)
					SELECT lower(hex(randomblob(16))), ?1, c.id, ${PROVIDER_SQL} FROM marketing_contacts c WHERE c.id = ?2`).bind(id, run.contact_id).run();
				break;
			}
			// What follows counts from when the message really left, which warm-up may delay.
			if (send.status === "pending" || send.status === "sending") break;
			lastSend = send.id;
			stepId = node.next;
		} else if (step.type === "wait") {
			if (wakeAt === null) wakeAt = now + step.amount * (step.unit === "hours" ? HOUR : 24 * HOUR);
			if (now < wakeAt) { nextCheck = wakeAt; break; }
			wakeAt = null;
			stepId = node.next;
		} else if (step.type === "condition") {
			const met = step.test === "tag"
				? !!(await db.prepare("SELECT 1 AS ok FROM marketing_contact_tags WHERE contact_id = ? AND tag = ?").bind(run.contact_id, step.tag).first())
				: !!(await db.prepare(`SELECT 1 AS ok FROM marketing_sends WHERE id = ? AND ${step.test === "opened" ? "opened_at" : "clicked_at"} IS NOT NULL`).bind(lastSend).first());
			stepId = met ? node.yes : node.no;
		} else if (step.type === "tag") {
			if (step.action === "add") await db.prepare("INSERT OR IGNORE INTO marketing_contact_tags (contact_id, tag, created_at) VALUES (?, ?, ?)").bind(run.contact_id, step.tag, now).run();
			else await db.prepare("DELETE FROM marketing_contact_tags WHERE contact_id = ? AND tag = ?").bind(run.contact_id, step.tag).run();
			stepId = node.next;
		} else {
			stepId = null;
		}
	}
	await db.prepare("UPDATE marketing_flow_runs SET step_id = ?, status = ?, wake_at = ?, last_send_id = ?, next_check_at = ? WHERE flow_id = ? AND contact_id = ? AND status = 'active'")
		.bind(stepId, stepId ? "active" : "done", wakeAt, lastSend, nextCheck, run.flow_id, run.contact_id).run();
}

/** One pass of the five-minute cron, before the sending engine. */
export async function runFlows(db: D1Database, now = Date.now(), limit = RUNS_PER_TICK): Promise<void> {
	await exitIneligible(db);
	const { results: flows } = await db.prepare("SELECT * FROM marketing_flows WHERE status = 'active'").all<Row>();
	if (!flows.length) return;
	for (const flow of flows) await enroll(db, flow, now);
	await reachGoals(db);
	const trees = new Map(flows.map((flow) => [flow.id, successors(JSON.parse(flow.steps) as FlowStep[])]));
	const { results: runs } = await db.prepare(`SELECT r.flow_id, r.contact_id, r.step_id, r.wake_at, r.last_send_id FROM marketing_flow_runs r JOIN marketing_flows f ON f.id = r.flow_id
		WHERE r.status = 'active' AND f.status = 'active' AND r.next_check_at <= ? ORDER BY r.next_check_at, r.created_at LIMIT ?`).bind(now, limit).all<Run>();
	for (const run of runs) await advance(db, run, trees.get(run.flow_id)!, now);
}

export async function listFlows(db: D1Database): Promise<Flow[]> {
	const [flows, runs, here, mails] = await Promise.all([
		db.prepare("SELECT * FROM marketing_flows ORDER BY created_at DESC LIMIT 50").all<Row>(),
		db.prepare("SELECT flow_id, status, COUNT(*) AS n FROM marketing_flow_runs GROUP BY flow_id, status").all<{ flow_id: string; status: "active" | "done" | "goal" | "exited"; n: number }>(),
		db.prepare("SELECT flow_id, step_id, COUNT(*) AS n FROM marketing_flow_runs WHERE status = 'active' GROUP BY flow_id, step_id").all<{ flow_id: string; step_id: string; n: number }>(),
		db.prepare(`SELECT s.campaign_id, COUNT(s.sent_at) AS sent, COUNT(s.opened_at) AS opened, COUNT(s.clicked_at) AS clicked
			FROM marketing_sends s JOIN marketing_campaigns p ON p.id = s.campaign_id WHERE p.kind = 'flow' GROUP BY s.campaign_id`).all<{ campaign_id: string; sent: number; opened: number; clicked: number }>(),
	]);
	return flows.results.map((row) => {
		const steps = JSON.parse(row.steps) as FlowStep[];
		const counts = { active: 0, done: 0, goal: 0, exited: 0 };
		for (const item of runs.results) if (item.flow_id === row.id) counts[item.status] = item.n;
		const stats: Flow["stats"] = {};
		for (const step of walk(steps)) {
			const mail = mails.results.find((item) => item.campaign_id === campaignId(row.id, step.id));
			stats[step.id] = {
				here: here.results.find((item) => item.flow_id === row.id && item.step_id === step.id)?.n ?? 0,
				sent: mail?.sent ?? 0,
				opened: mail?.opened ?? 0,
				clicked: mail?.clicked ?? 0,
			};
		}
		return { id: row.id, name: row.name, listId: row.list_id, triggerTag: row.trigger_tag, goalTag: row.goal_tag, steps, status: row.status, counts, stats };
	});
}
