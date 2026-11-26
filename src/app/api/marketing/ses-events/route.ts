import { NextResponse } from "next/server";
import { safeEqual, type SnsEnvelope } from "@/lib/aws/ses-notification";
import { verifySnsSignature } from "@/lib/aws/sns-signature";
import { getEnv } from "@/lib/cloudflare";
import { MAX_EVENT_BYTES } from "@/lib/deliverability/provider-events";
import { assertRequestSize } from "@/lib/http/request";
import { readSetting, writeSetting } from "@/lib/marketing/engine";
import { recordSesEvent } from "@/lib/marketing/feedback";
import type { SesFeed } from "@/lib/marketing/ses-marketing";

export const dynamic = "force-dynamic";

const reply = (body: Record<string, unknown>, status = 200) => NextResponse.json(body, { status });

/** SES events of marketing messages over SNS. Public; URL token, topic and SNS signature are checked. */
export async function POST(request: Request) {
	try { assertRequestSize(request, MAX_EVENT_BYTES); } catch { return reply({ error: "Body too large" }, 413); }
	const db = getEnv().MARKETING_DB;
	const feed = db ? await readSetting<SesFeed>(db, "ses_feed") : null;
	if (!db || !feed || !safeEqual(new URL(request.url).searchParams.get("token") ?? "", feed.token)) return reply({ error: "Forbidden" }, 403);
	const body = await request.text();
	if (body.length > MAX_EVENT_BYTES) return reply({ error: "Body too large" }, 413);
	let envelope: SnsEnvelope;
	try { envelope = JSON.parse(body) as SnsEnvelope; } catch { return reply({ error: "Invalid body" }, 400); }
	if (envelope.TopicArn !== feed.topicArn || !await verifySnsSignature(envelope)) return reply({ error: "Forbidden" }, 403);

	if (envelope.Type === "SubscriptionConfirmation") {
		let url: URL | null = null;
		try { url = new URL(envelope.SubscribeURL ?? ""); } catch { url = null; }
		if (!url || url.protocol !== "https:" || !/^sns\.[a-z0-9-]+\.amazonaws\.com$/.test(url.hostname)) return reply({ error: "Invalid subscription URL" }, 400);
		const confirmed = await fetch(url);
		if (confirmed.ok) await writeSetting(db, "ses_feed", { ...feed, confirmed: true });
		return reply({ confirmed: confirmed.ok }, confirmed.ok ? 200 : 502);
	}
	if (envelope.Type !== "Notification") return reply({ ignored: true });
	return reply({ blocked: await recordSesEvent(db, envelope.Message ?? "") });
}
