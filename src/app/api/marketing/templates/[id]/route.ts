import { NextResponse } from "next/server";
import { readTemplateInput, requireMarketing } from "@/lib/marketing/server";

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Context) {
	const access = await requireMarketing(request);
	if (access.error) return access.error;
	const input = await readTemplateInput(request);
	if (input.error) return input.error;
	const { id } = await params;
	const now = Date.now();
	const result = await access.db.prepare("UPDATE marketing_templates SET name = ?, subject = ?, design = ?, updated_at = ? WHERE id = ?")
		.bind(input.name, input.subject, JSON.stringify(input.design), now, id).run();
	if (!result.meta.changes) return NextResponse.json({ error: "Modelo não encontrado." }, { status: 404 });
	return NextResponse.json({ template: { id, name: input.name, subject: input.subject, design: input.design, updatedAt: now } });
}

export async function DELETE(request: Request, { params }: Context) {
	const access = await requireMarketing(request);
	if (access.error) return access.error;
	const { id } = await params;
	const result = await access.db.prepare("DELETE FROM marketing_templates WHERE id = ?").bind(id).run();
	if (!result.meta.changes) return NextResponse.json({ error: "Modelo não encontrado." }, { status: 404 });
	return NextResponse.json({ ok: true });
}
