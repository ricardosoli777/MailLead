/** Forms, webhooks and API keys, managed by the primary administrator. */
import { NextResponse } from "next/server";
import { createApiKey, createForm, createHook, deleteCapture, isCaptureKind, listCapture, readFormExtras, readTarget, updateForm } from "@/lib/marketing/capture";
import { requireMarketing } from "@/lib/marketing/server";

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

export async function GET(request: Request) {
	const access = await requireMarketing(request);
	if (access.error) return access.error;
	return NextResponse.json(await listCapture(access.db));
}

export async function POST(request: Request) {
	const access = await requireMarketing(request);
	if (access.error) return access.error;
	const input = (await request.json().catch(() => null)) as { kind?: unknown; name?: unknown; doubleOptIn?: unknown } | null;
	if (!input || !isCaptureKind(input.kind)) return fail("Pedido inválido.", 400);
	if (input.kind === "key") {
		const name = typeof input.name === "string" ? input.name.trim().slice(0, 100) : "";
		if (!name) return fail("Dê um nome.", 400);
		return NextResponse.json({ key: await createApiKey(access.db, name) }, { status: 201 });
	}
	const target = await readTarget(access.db, input);
	if (target.error !== null) return fail(target.error, 400);
	const id = input.kind === "form" ? await createForm(access.db, { ...target, ...readFormExtras(input), doubleOptIn: input.doubleOptIn !== false }) : await createHook(access.db, target);
	return NextResponse.json({ id }, { status: 201 });
}

/** Saves the form editor. Code already pasted on a site keeps its old fields until copied again. */
export async function PATCH(request: Request) {
	const access = await requireMarketing(request);
	if (access.error) return access.error;
	const input = (await request.json().catch(() => null)) as { id?: unknown; doubleOptIn?: unknown } | null;
	if (!input || typeof input.id !== "string") return fail("Pedido inválido.", 400);
	const target = await readTarget(access.db, input);
	if (target.error !== null) return fail(target.error, 400);
	return (await updateForm(access.db, input.id, { ...target, ...readFormExtras(input), doubleOptIn: input.doubleOptIn !== false })) ? NextResponse.json({ id: input.id }) : fail("Não encontrado.", 404);
}

export async function DELETE(request: Request) {
	const access = await requireMarketing(request);
	if (access.error) return access.error;
	const query = new URL(request.url).searchParams;
	const kind = query.get("kind");
	if (!isCaptureKind(kind)) return fail("Pedido inválido.", 400);
	return (await deleteCapture(access.db, kind, query.get("id") ?? "")) ? NextResponse.json({ ok: true }) : fail("Não encontrado.", 404);
}
