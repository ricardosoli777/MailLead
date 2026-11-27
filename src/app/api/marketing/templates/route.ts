import { NextResponse } from "next/server";
import { newId } from "@/lib/ids";
import { withFooter } from "@/lib/marketing/footer";
import { readTemplateInput, requireMarketing, toTemplate } from "@/lib/marketing/server";

export async function GET(request: Request) {
	const access = await requireMarketing(request);
	if (access.error) return access.error;
	const { results } = await access.db.prepare("SELECT id, name, subject, design, updated_at FROM marketing_templates ORDER BY updated_at DESC LIMIT 200").all<Parameters<typeof toTemplate>[0]>();
	return NextResponse.json({ templates: results.map(toTemplate) });
}

export async function POST(request: Request) {
	const access = await requireMarketing(request);
	if (access.error) return access.error;
	const input = await readTemplateInput(request);
	if (input.error) return input.error;
	const id = newId("tpl");
	const now = Date.now();
	const design = await withFooter(access.db, input.design);
	await access.db.prepare("INSERT INTO marketing_templates (id, name, subject, design, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
		.bind(id, input.name, input.subject, JSON.stringify(design), now, now).run();
	return NextResponse.json({ template: { id, name: input.name, subject: input.subject, design, updatedAt: now } }, { status: 201 });
}
