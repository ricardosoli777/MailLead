import { NextResponse } from "next/server";
import { readFooter, saveFooter } from "@/lib/marketing/footer";
import { requireMarketing } from "@/lib/marketing/server";

export async function GET(request: Request) {
	const access = await requireMarketing(request);
	if (access.error) return access.error;
	return NextResponse.json({ footer: await readFooter(access.db) });
}

export async function PUT(request: Request) {
	const access = await requireMarketing(request);
	if (access.error) return access.error;
	const result = await saveFooter(access.db, await request.json().catch(() => null));
	return "error" in result ? NextResponse.json({ error: result.error }, { status: 400 }) : NextResponse.json(result);
}
