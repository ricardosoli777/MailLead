import { NextResponse } from "next/server";
import { readCampaignInput, reviewCampaign } from "@/lib/marketing/campaign-review";
import { createCampaign, listCampaigns } from "@/lib/marketing/campaigns";
import { requireMarketing } from "@/lib/marketing/server";

export async function GET(request: Request) {
	const access = await requireMarketing(request);
	if (access.error) return access.error;
	const [campaigns, tags] = await Promise.all([
		listCampaigns(access.db),
		access.db.prepare("SELECT DISTINCT tag FROM marketing_contact_tags ORDER BY tag LIMIT 200").all<{ tag: string }>(),
	]);
	return NextResponse.json({ campaigns, tags: tags.results.map((row) => row.tag) });
}

export async function POST(request: Request) {
	const access = await requireMarketing(request);
	if (access.error) return access.error;
	const input = readCampaignInput(await request.json().catch(() => null));
	// Reviewed again here: the screen's review may be stale or skipped.
	const { review, template, subject } = await reviewCampaign(access.env, access.db, input);
	if (review.blockers.length || !template) return NextResponse.json({ error: review.blockers[0] ?? "Escolha um modelo." }, { status: 409 });
	const campaign = await createCampaign(access.db, { name: input.name, listId: input.listId, subject, design: template.design, tag: input.tag, includeInactive: input.includeInactive, scheduledAt: input.scheduledAt });
	return NextResponse.json({ campaign }, { status: 201 });
}
