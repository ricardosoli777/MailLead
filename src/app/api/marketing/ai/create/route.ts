import { NextResponse } from "next/server";
import { newId } from "@/lib/ids";
import { funnelGraph, readFunnel } from "@/lib/marketing/ai-utils";
import { createFlow } from "@/lib/marketing/flows";
import { parseDesign } from "@/lib/marketing/render";
import { requireMarketing } from "@/lib/marketing/server";
import { STARTERS } from "@/lib/marketing/starters";

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

/** Turns an approved proposal into templates and a draft funnel. Nothing is activated or sent. */
export async function POST(request: Request) {
	const access = await requireMarketing(request);
	if (access.error) return access.error;
	const input = (await request.json().catch(() => null)) as { funnel?: unknown; listId?: unknown } | null;
	const funnel = readFunnel(input?.funnel);
	if (!funnel) return fail("A proposta está vazia.", 400);

	// The signature the owner already wrote, if any.
	const latest = await access.db.prepare("SELECT design FROM marketing_templates ORDER BY updated_at DESC LIMIT 1").first<{ design: string }>();
	const base = latest ? (JSON.parse(latest.design) as (typeof STARTERS)[number]["design"]) : STARTERS[0].design;

	const now = Date.now();
	const inserts: D1PreparedStatement[] = [];
	let problem = "";
	const graph = funnelGraph(funnel, (email) => {
		const id = newId("tpl");
		const parsed = parseDesign({ accent: base.accent, footer: base.footer, preheader: email.preheader, blocks: email.blocks });
		if ("error" in parsed) problem = `${email.name}: ${parsed.error}`;
		else inserts.push(access.db.prepare("INSERT INTO marketing_templates (id, name, subject, design, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
			.bind(id, `${funnel.name} · ${email.name}`.slice(0, 120), email.subject, JSON.stringify(parsed.design), now, now));
		return id;
	});
	if (problem) return fail(problem, 400);
	if (inserts.length) await access.db.batch(inserts);
	const listId = typeof input?.listId === "string" ? input.listId.slice(0, 80) : "";
	const id = await createFlow(access.db, { name: funnel.name, listId, triggerTag: funnel.triggerTag, goalTag: funnel.goalTag, graph }, now);
	return NextResponse.json({ id }, { status: 201 });
}
