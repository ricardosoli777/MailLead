import { NextResponse } from "next/server";
import { activateFlow, deleteFlow, pauseFlow, readFlowInput, saveFlow } from "@/lib/marketing/flows";
import { requireMarketing } from "@/lib/marketing/server";

type Context = { params: Promise<{ id: string }> };
const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

export async function PUT(request: Request, { params }: Context) {
	const access = await requireMarketing(request);
	if (access.error) return access.error;
	const input = readFlowInput(await request.json().catch(() => null));
	if ("error" in input) return fail(input.error, 400);
	return (await saveFlow(access.db, (await params).id, input)) ? NextResponse.json({ ok: true }) : fail("Pause o funil antes de editar.", 409);
}

export async function PATCH(request: Request, { params }: Context) {
	const access = await requireMarketing(request);
	if (access.error) return access.error;
	const { id } = await params;
	const input = (await request.json().catch(() => null)) as { action?: unknown } | null;
	if (input?.action === "pause") return (await pauseFlow(access.db, id)) ? NextResponse.json({ ok: true }) : fail("O funil não está ativo.", 409);
	if (input?.action !== "activate") return fail("Pedido inválido.", 400);
	const problem = await activateFlow(access.db, id);
	return problem ? fail(problem, 422) : NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: Context) {
	const access = await requireMarketing(request);
	if (access.error) return access.error;
	return (await deleteFlow(access.db, (await params).id)) ? NextResponse.json({ ok: true }) : fail("Funil não encontrado.", 404);
}
