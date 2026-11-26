import { NextResponse } from "next/server";
import { createFlow, listFlows, readFlowInput } from "@/lib/marketing/flows";
import { requireMarketing } from "@/lib/marketing/server";

export async function GET(request: Request) {
	const access = await requireMarketing(request);
	if (access.error) return access.error;
	const tags = await access.db.prepare("SELECT DISTINCT tag FROM marketing_contact_tags ORDER BY tag LIMIT 200").all<{ tag: string }>();
	return NextResponse.json({ flows: await listFlows(access.db), tags: tags.results.map((row) => row.tag) });
}

export async function POST(request: Request) {
	const access = await requireMarketing(request);
	if (access.error) return access.error;
	const input = readFlowInput(await request.json().catch(() => null));
	if ("error" in input) return NextResponse.json({ error: input.error }, { status: 400 });
	return NextResponse.json({ id: await createFlow(access.db, input) }, { status: 201 });
}
