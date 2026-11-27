import { NextResponse } from "next/server";
import { currentFlowTest, startFlowTest, stopFlowTest } from "@/lib/marketing/flow-test";
import { requireMarketing } from "@/lib/marketing/server";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
	const access = await requireMarketing(request);
	if (access.error) return access.error;
	return NextResponse.json({ current: await currentFlowTest(access.db, (await params).id) });
}

export async function DELETE(request: Request, { params }: Context) {
	const access = await requireMarketing(request);
	if (access.error) return access.error;
	await stopFlowTest(access.db, (await params).id);
	return NextResponse.json({ ok: true });
}

export async function POST(request: Request, { params }: Context) {
	const access = await requireMarketing(request);
	if (access.error) return access.error;
	const input = (await request.json().catch(() => null)) as { name?: unknown; email?: unknown; phone?: unknown; own?: unknown } | null;
	// A test sends real messages, so it is only for the administrator's own address and number.
	if (!input || input.own !== true) return NextResponse.json({ error: "Confirme que o e-mail e o número são seus." }, { status: 400 });
	const result = await startFlowTest(access.db, (await params).id, input);
	return result.error ? NextResponse.json({ error: result.error }, { status: 422 }) : NextResponse.json({ ok: true });
}
