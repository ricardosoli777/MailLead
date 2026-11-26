import { NextResponse } from "next/server";
import { readCampaignInput, reviewCampaign } from "@/lib/marketing/campaign-review";
import { requireMarketing } from "@/lib/marketing/server";

export async function POST(request: Request) {
	const access = await requireMarketing(request);
	if (access.error) return access.error;
	const { review } = await reviewCampaign(access.env, access.db, readCampaignInput(await request.json().catch(() => null)));
	return NextResponse.json({ review });
}
