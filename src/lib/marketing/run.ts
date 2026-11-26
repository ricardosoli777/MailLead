/** What the five-minute cron runs. */
import { getAwsConfig } from "@/lib/aws/config";
import { sendSesEmail } from "@/lib/aws/ses";
import { sendSystemEmail } from "@/lib/email/system-mail";
import { confirmationMessage } from "./capture-page";
import { checkBreaker, dropSetting, readSetting, runEngine, writeSetting } from "./engine";
import type { SenderSettings } from "./sending-types";
import { formatFrom } from "./sending-utils";
import { CONFIGURATION_SET, checkSender, getQuota } from "./ses-marketing";

const CHECK_TTL_MS = 60 * 60 * 1000;

export async function runMarketingSending(env: CloudflareEnv): Promise<void> {
	const db = env.MARKETING_DB;
	if (!db) return;
	if (!(await db.prepare("SELECT 1 AS ok FROM marketing_campaigns WHERE status = 'running' OR (status = 'scheduled' AND (scheduled_at IS NULL OR scheduled_at <= ?)) LIMIT 1").bind(Date.now()).first())) return;
	const config = await getAwsConfig(env);
	if (!config) return;
	const result = await runEngine(db, {
		quota: () => getQuota(config),
		preflight: () => preflight(env, db),
		send: async (message) => {
			const { messageId } = await sendSesEmail(config, { ...message, to: [message.to], replyTo: message.replyTo || undefined, configurationSet: CONFIGURATION_SET });
			// Events carry the bare SES id, without the Message-ID wrapping.
			return { messageId: messageId.slice(1, messageId.indexOf("@")) };
		},
	});
	if (result.blocked) console.log("Marketing sending blocked", result.blocked);
	await notifyBreaker(env, db);
}

/** The domain checks, remembered for an hour once everything passes. */
async function preflight(env: CloudflareEnv, db: D1Database): Promise<string | null> {
	const passed = await readSetting<number>(db, "checks_passed_at");
	if (passed && Date.now() - passed < CHECK_TTL_MS) return null;
	const settings = (await readSetting<SenderSettings>(db, "sender"))!;
	const failed = (await checkSender(env, db, settings)).find((check) => !check.ok);
	if (failed) return `${failed.label}: ${failed.detail}`;
	await writeSetting(db, "checks_passed_at", Date.now());
	return null;
}

/** The double opt-in message (R6). It leaves under the same protections as campaigns. */
export async function sendConfirmationMail(env: CloudflareEnv, db: D1Database, to: string, formName: string, token: string): Promise<void> {
	const settings = await readSetting<SenderSettings>(db, "sender");
	const config = await getAwsConfig(env);
	if (!settings || !config) throw new Error("O remetente de marketing não está configurado.");
	const blocked = (await checkBreaker(db)) ?? (await preflight(env, db));
	if (blocked) throw new Error(blocked);
	const message = confirmationMessage(settings.fromName, formName, `${settings.origin}/api/marketing/k/${token}`);
	await sendSesEmail(config, { ...message, from: formatFrom(settings.fromName, settings.fromEmail), to: [to], replyTo: settings.replyTo || undefined, configurationSet: CONFIGURATION_SET });
}

/** R5: the primary administrator is told once when the breaker opens. */
async function notifyBreaker(env: CloudflareEnv, db: D1Database): Promise<void> {
	const breaker = await readSetting<{ reason: string; at: number }>(db, "breaker");
	if (!breaker) return dropSetting(db, "breaker_notified").then(() => {});
	const to = await readSetting<string>(db, "notify_email");
	if (!to || (await readSetting<number>(db, "breaker_notified")) === breaker.at) return;
	await writeSetting(db, "breaker_notified", breaker.at);
	await sendSystemEmail(env, { to, subject: "MailLead: envio de marketing pausado", text: `O envio de marketing foi pausado para proteger a reputação.\n\n${breaker.reason}\n\nAbra Marketing > Envio para revisar e retomar.`, html: `<p>O envio de marketing foi pausado para proteger a reputação.</p><p>${breaker.reason}</p><p>Abra <strong>Marketing &gt; Envio</strong> para revisar e retomar.</p>` });
}
