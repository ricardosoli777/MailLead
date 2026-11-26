import { NextResponse } from "next/server";
import { getAwsConfig } from "@/lib/aws/config";
import { dropSetting, readSetting } from "@/lib/marketing/engine";
import type { SenderSettings } from "@/lib/marketing/sending-types";
import { requireMarketing } from "@/lib/marketing/server";
import { setupSesFeed } from "@/lib/marketing/ses-marketing";

/** Creates the SES configuration set and event feed in the configured AWS account. */
export async function POST(request: Request) {
	const access = await requireMarketing(request);
	if (access.error) return access.error;
	const sender = await readSetting<SenderSettings>(access.db, "sender");
	if (!sender) return NextResponse.json({ error: "Salve o remetente primeiro." }, { status: 409 });
	const config = await getAwsConfig(access.env);
	if (!config) return NextResponse.json({ error: "Cadastre as credenciais da AWS primeiro." }, { status: 409 });
	try {
		await setupSesFeed(config, access.db, sender.origin);
	} catch (error) {
		return NextResponse.json({ error: error instanceof Error ? error.message : "A AWS recusou a configuração." }, { status: 502 });
	}
	await dropSetting(access.db, "checks_passed_at");
	return NextResponse.json({ ok: true });
}
