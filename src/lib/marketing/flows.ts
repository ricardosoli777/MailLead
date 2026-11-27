/**
 * Funnels (F1-F6). Each e-mail step is a hidden campaign, so the sending engine applies consent,
 * unsubscribe, warm-up, breaker, tracking and feedback to it exactly as to any campaign.
 */
import { newId } from "@/lib/ids";
import { PROVIDER_SQL } from "./campaigns";
import type { Flow, FlowDraft, FlowStatus } from "./flows-types";
import { emptyGraph, firstStep, graphErrors, parseGraph, readGraph, successors, WAIT_UNITS, type Node } from "./flows-utils";
import { parseDesign } from "./render";

const RUNS_PER_TICK = 100;
const MAX_MOVES_PER_RUN = 20;
const HOUR = 60 * 60 * 1000;
// Waits this short happen inside the pass; longer ones are picked up by a later one.
const INLINE_WAIT_MS = 45_000;
type Sleeper = { sleep: ((ms: number) => Promise<unknown>) | null; left: number };

// A number that sends in bursts gets blocked by WhatsApp, so audio leaves slowly and in daytime.
export const WHATSAPP_PER_5_MINUTES = 5;
export const WHATSAPP_PER_DAY = 100;
const STALE_CLAIM_MS = 15 * 60 * 1000;

/** What the funnel needs to send audio. Without it, people wait at the audio step. */
export type WhatsAppSender = { connected: () => Promise<boolean>; send: (phone: string, audioId: string) => Promise<void> };

/** 8h to 20h in Brasília (UTC-3, no daylight saving). */
const daytime = (now: number) => {
	const hour = new Date(now - 3 * HOUR).getUTCHours();
	return hour >= 8 && hour < 20;
};

type Audio = { sender: WhatsAppSender | null; left: number; connected?: boolean };

const campaignId = (flowId: string, stepId: string) => `flow:${flowId}:${stepId}`;
const prefixed = "substr(id, 1, length(?1)) = ?1";

type Row = { id: string; name: string; list_id: string; trigger_tag: string; goal_tag: string; steps: string; status: FlowStatus; activated_at: number | null };

const getRow = (db: D1Database, id: string) => db.prepare("SELECT * FROM marketing_flows WHERE id = ?").bind(id).first<Row>();

export async function createFlow(db: D1Database, input: FlowDraft, now = Date.now()): Promise<string> {
	const id = newId("flw");
	await db.prepare("INSERT INTO marketing_flows (id, name, list_id, trigger_tag, goal_tag, steps, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
		.bind(id, input.name, input.listId, input.triggerTag, input.goalTag ?? "", JSON.stringify(input.graph), now).run();
	return id;
}

/** An active funnel is paused before it is changed, so nobody walks a half-edited path. */
export async function saveFlow(db: D1Database, id: string, input: FlowDraft): Promise<boolean> {
	return (await db.prepare("UPDATE marketing_flows SET name = ?, list_id = ?, trigger_tag = ?, goal_tag = ?, steps = ? WHERE id = ? AND status <> 'active'")
		.bind(input.name, input.listId, input.triggerTag, input.goalTag ?? "", JSON.stringify(input.graph), id).run()).meta.changes > 0;
}

export function readFlowInput(input: unknown): FlowDraft | { error: string } {
	const value = (input ?? {}) as { name?: unknown; listId?: unknown; triggerTag?: unknown; goalTag?: unknown; graph?: unknown };
	const name = typeof value.name === "string" ? value.name.trim().slice(0, 100) : "";
	if (!name) return { error: "Dê um nome ao funil." };
	const parsed = parseGraph(value.graph ?? emptyGraph());
	if ("error" in parsed) return parsed;
	return {
		name,
		listId: typeof value.listId === "string" ? value.listId.slice(0, 80) : "",
		triggerTag: typeof value.triggerTag === "string" ? value.triggerTag.trim().toLowerCase().slice(0, 40) : "",
		goalTag: typeof value.goalTag === "string" ? value.goalTag.trim().toLowerCase().slice(0, 40) : "",
		graph: parsed.graph,
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
	const graph = readGraph(flow.steps);
	if (!graph.nodes.length) return "Adicione pelo menos um passo.";
	const [problem] = Object.values(graphErrors(graph));
	if (problem) return problem;

	const mails: { id: string; subject: string; design: string }[] = [];
	for (const step of graph.nodes) {
		if (step.type !== "email") continue;
		const template = await db.prepare("SELECT name, subject, design FROM marketing_templates WHERE id = ?").bind(step.templateId).first<{ name: string; subject: string; design: string }>();
		if (!template) return "Um modelo usado no funil foi apagado.";
		const subject = step.subject.trim() || template.subject.trim();
		if (!subject) return `Informe o assunto do e-mail "${template.name}".`;
		const parsed = parseDesign(JSON.parse(template.design));
		if ("error" in parsed) return `${template.name}: ${parsed.error}`;
		mails.push({ id: campaignId(id, step.id), subject, design: JSON.stringify(parsed.design) });
	}
	const audios = graph.nodes.flatMap((step) => (step.type === "whatsapp" ? [step.audioId] : []));
	if (audios.length && !(await db.prepare("SELECT 1 AS ok FROM marketing_settings WHERE key = 'whatsapp'").first())) return "Conecte o WhatsApp em Configurações > WhatsApp antes de ativar.";
	for (const audioId of audios) {
		if (!(await db.prepare("SELECT 1 AS ok FROM marketing_audio WHERE id = ?").bind(audioId).first())) return "Um áudio usado no funil não foi encontrado. Grave de novo.";
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
	const first = firstStep(readGraph(flow.steps));
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

/** True when the person may move on; false keeps them at this step for a later pass. */
async function sendAudio(db: D1Database, run: Run, step: { id: string; audioId: string }, audio: Audio, now: number): Promise<boolean> {
	const key = [run.flow_id, step.id, run.contact_id] as const;
	const done = await db.prepare("SELECT status, claimed_at FROM marketing_whatsapp_sends WHERE flow_id = ? AND step_id = ? AND contact_id = ?").bind(...key).first<{ status: string; claimed_at: number }>();
	// A send cut in the middle may have left, so it is never repeated.
	if (done) return done.status !== "sending" || now - done.claimed_at > STALE_CLAIM_MS;
	const claim = (status: string, error = "") => db.prepare("INSERT OR IGNORE INTO marketing_whatsapp_sends (flow_id, step_id, contact_id, status, error, claimed_at) VALUES (?, ?, ?, ?, ?, ?)").bind(...key, status, error, now).run();
	const who = await db.prepare("SELECT phone FROM marketing_whatsapp WHERE contact_id = ? AND opted_out_at IS NULL").bind(run.contact_id).first<{ phone: string }>();
	// Only whoever authorised WhatsApp receives; the others follow the funnel without it.
	if (!who) {
		await claim("skipped", "sem autorização de WhatsApp");
		return true;
	}
	if (!audio.sender || audio.left <= 0 || !daytime(now)) return false;
	audio.connected ??= await audio.sender.connected().catch(() => false);
	if (!audio.connected) return false;
	if (!(await claim("sending")).meta.changes) return false;
	audio.left--;
	const finish = (status: string, error: string, sentAt: number | null) => db.prepare("UPDATE marketing_whatsapp_sends SET status = ?, error = ?, sent_at = ? WHERE flow_id = ? AND step_id = ? AND contact_id = ?").bind(status, error, sentAt, ...key).run();
	try {
		await audio.sender.send(who.phone, step.audioId);
		await finish("sent", "", now);
	} catch (error) {
		console.error("WhatsApp funnel audio failed", error);
		await finish("failed", String((error as Error).message).slice(0, 300), null);
	}
	return true;
}

/** Walks one person forward until a step has to wait. */
async function advance(db: D1Database, run: Run, nodes: Map<string, Node>, audio: Audio, sleeper: Sleeper, now: number): Promise<void> {
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
		} else if (step.type === "whatsapp") {
			if (!(await sendAudio(db, run, step, audio, now))) break;
			stepId = node.next;
		} else if (step.type === "wait") {
			if (wakeAt === null) wakeAt = now + step.amount * WAIT_UNITS[step.unit].ms;
			if (now < wakeAt) {
				const gap = wakeAt - now;
				if (!sleeper.sleep || gap > sleeper.left) { nextCheck = wakeAt; break; }
				sleeper.left -= gap;
				await sleeper.sleep(gap);
				now = nextCheck = wakeAt;
			}
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

/** One pass of the every-minute cron, before the sending engine. */
export async function runFlows(db: D1Database, now = Date.now(), limit = RUNS_PER_TICK, sender: WhatsAppSender | null = null, sleep: Sleeper["sleep"] = null): Promise<void> {
	await exitIneligible(db);
	const { results: flows } = await db.prepare("SELECT * FROM marketing_flows WHERE status = 'active'").all<Row>();
	if (!flows.length) return;
	for (const flow of flows) await enroll(db, flow, now);
	await reachGoals(db);
	const trees = new Map(flows.map((flow) => [flow.id, successors(readGraph(flow.steps))]));
	const { results: runs } = await db.prepare(`SELECT r.flow_id, r.contact_id, r.step_id, r.wake_at, r.last_send_id FROM marketing_flow_runs r JOIN marketing_flows f ON f.id = r.flow_id
		WHERE r.status = 'active' AND f.status = 'active' AND r.next_check_at <= ? ORDER BY r.next_check_at, r.created_at LIMIT ?`).bind(now, limit).all<Run>();
	const recent = await db.prepare("SELECT COUNT(*) AS day, COALESCE(SUM(claimed_at > ?1), 0) AS burst FROM marketing_whatsapp_sends WHERE claimed_at > ?2 AND status <> 'skipped'")
		.bind(now - 5 * 60 * 1000, now - 24 * HOUR).first<{ day: number; burst: number }>();
	const audio: Audio = { sender, left: Math.min(WHATSAPP_PER_5_MINUTES - recent!.burst, WHATSAPP_PER_DAY - recent!.day) };
	const sleeper: Sleeper = { sleep, left: INLINE_WAIT_MS };
	for (const run of runs) await advance(db, run, trees.get(run.flow_id)!, audio, sleeper, now);
}

export async function listFlows(db: D1Database): Promise<Flow[]> {
	const [flows, runs, here, mails, audios] = await Promise.all([
		db.prepare("SELECT * FROM marketing_flows ORDER BY created_at DESC LIMIT 50").all<Row>(),
		db.prepare("SELECT flow_id, status, COUNT(*) AS n FROM marketing_flow_runs GROUP BY flow_id, status").all<{ flow_id: string; status: "active" | "done" | "goal" | "exited"; n: number }>(),
		db.prepare("SELECT flow_id, step_id, COUNT(*) AS n FROM marketing_flow_runs WHERE status = 'active' GROUP BY flow_id, step_id").all<{ flow_id: string; step_id: string; n: number }>(),
		db.prepare(`SELECT s.campaign_id, COUNT(s.sent_at) AS sent, COUNT(s.opened_at) AS opened, COUNT(s.clicked_at) AS clicked
			FROM marketing_sends s JOIN marketing_campaigns p ON p.id = s.campaign_id WHERE p.kind = 'flow' GROUP BY s.campaign_id`).all<{ campaign_id: string; sent: number; opened: number; clicked: number }>(),
		db.prepare("SELECT flow_id, step_id, COUNT(*) AS sent FROM marketing_whatsapp_sends WHERE status = 'sent' GROUP BY flow_id, step_id").all<{ flow_id: string; step_id: string; sent: number }>(),
	]);
	return flows.results.map((row) => {
		const graph = readGraph(row.steps);
		const counts = { active: 0, done: 0, goal: 0, exited: 0 };
		for (const item of runs.results) if (item.flow_id === row.id) counts[item.status] = item.n;
		const stats: Flow["stats"] = {};
		for (const step of graph.nodes) {
			const mail = mails.results.find((item) => item.campaign_id === campaignId(row.id, step.id));
			stats[step.id] = {
				here: here.results.find((item) => item.flow_id === row.id && item.step_id === step.id)?.n ?? 0,
				sent: mail?.sent ?? audios.results.find((item) => item.flow_id === row.id && item.step_id === step.id)?.sent ?? 0,
				opened: mail?.opened ?? 0,
				clicked: mail?.clicked ?? 0,
			};
		}
		return { id: row.id, name: row.name, listId: row.list_id, triggerTag: row.trigger_tag, goalTag: row.goal_tag, graph, status: row.status, counts, stats };
	});
}
