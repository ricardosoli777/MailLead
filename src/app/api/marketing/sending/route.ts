import { NextResponse } from "next/server";
import { getAwsConfig } from "@/lib/aws/config";
import { breakerStats, dropSetting, readSetting, resetBreaker, warmupState, writeSetting } from "@/lib/marketing/engine";
import type { SenderSettings } from "@/lib/marketing/sending-types";
import { DEFAULT_HOURLY, DEFAULT_WEEKLY_LIMIT, readSenderSettings } from "@/lib/marketing/sending-utils";
import { requireMarketing } from "@/lib/marketing/server";
import { checkSender, getQuota } from "@/lib/marketing/ses-marketing";

export async function GET(request: Request) {
	const access = await requireMarketing(request);
	if (access.error) return access.error;
	const { env, db } = access;
	const sender = await readSetting<SenderSettings>(db, "sender");
	const config = await getAwsConfig(env);
	const [checks, quota, warmup, stats, breaker] = await Promise.all([
		sender ? checkSender(env, db, sender) : [],
		config ? getQuota(config).catch(() => null) : null,
		warmupState(db),
		breakerStats(db, Date.now()),
		readSetting<{ reason: string; at: number }>(db, "breaker"),
	]);
	return NextResponse.json({
		sender: sender ?? { fromName: "", fromEmail: "", replyTo: "", origin: new URL(request.url).origin, hourlyByProvider: DEFAULT_HOURLY, weeklyLimit: DEFAULT_WEEKLY_LIMIT },
		saved: !!sender,
		checks,
		quota,
		warmup,
		stats,
		breaker,
	});
}

export async function PUT(request: Request) {
	const access = await requireMarketing(request);
	if (access.error) return access.error;
	const input = readSenderSettings(await request.json().catch(() => null));
	if ("error" in input) return NextResponse.json({ error: input.error }, { status: 400 });
	await writeSetting(access.db, "sender", input.settings);
	await writeSetting(access.db, "notify_email", access.user.email);
	await dropSetting(access.db, "checks_passed_at");
	return NextResponse.json({ ok: true });
}

/** Resumes sending after the breaker paused it. */
export async function DELETE(request: Request) {
	const access = await requireMarketing(request);
	if (access.error) return access.error;
	await resetBreaker(access.db);
	return NextResponse.json({ ok: true });
}
