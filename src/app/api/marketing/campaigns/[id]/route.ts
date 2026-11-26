import { NextResponse } from "next/server";
import { changeCampaign, isCampaignAction } from "@/lib/marketing/campaigns";
import { requireMarketing } from "@/lib/marketing/server";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const access = await requireMarketing(request);
	if (access.error) return access.error;
	const action = ((await request.json().catch(() => null)) as { action?: unknown } | null)?.action;
	if (!isCampaignAction(action)) return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
	if (!(await changeCampaign(access.db, (await params).id, action))) return NextResponse.json({ error: "A campanha não permite mais essa ação." }, { status: 409 });
	return NextResponse.json({ ok: true });
}
