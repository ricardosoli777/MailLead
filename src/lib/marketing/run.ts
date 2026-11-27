/** What the every-minute cron runs. */
import { getAwsConfig } from "@/lib/aws/config";
import { sendSesEmail } from "@/lib/aws/ses";
import { sendSystemEmail } from "@/lib/email/system-mail";
import { confirmationMessage } from "./capture-page";
import { checkBreaker, dropSetting, readSetting, runEngine, writeSetting } from "./engine";
import { runFlows, type WhatsAppSender } from "./flows";
import type { SenderSettings } from "./sending-types";
import { formatFrom } from "./sending-utils";
import { CONFIGURATION_SET, checkSender, getQuota } from "./ses-marketing";
import { sendWhatsAppAudio, sendWhatsAppText, whatsAppStatus, type WhatsAppConfig } from "./whatsapp";

const CHECK_TTL_MS = 60 * 60 * 1000;
// A pass each minute with a fifth of the batch keeps the same pace as before.
const BATCH_PER_MINUTE = 10;
const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function runMarketingSending(env: CloudflareEnv): Promise<void> {
	const db = env.MARKETING_DB;
	if (!db) return;
	// Funnels first, so what they queue can leave in this same pass.
	await runFlows(db, Date.now(), undefined, await whatsAppSender(env, db), pause).catch((error) => console.error("Marketing funnels failed", error));
	if (!(await db.prepare("SELECT 1 AS ok FROM marketing_sends s JOIN marketing_campaigns p ON p.id = s.campaign_id WHERE s.status = 'pending' AND p.status = 'running' UNION ALL SELECT 1 FROM marketing_campaigns WHERE kind = 'campaign' AND (status = 'running' OR (status = 'scheduled' AND (scheduled_at IS NULL OR scheduled_at <= ?))) LIMIT 1").bind(Date.now()).first())) return;
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
	}, BATCH_PER_MINUTE);
	if (result.blocked) console.log("Marketing sending blocked", result.blocked);
	await notifyBreaker(env, db);
}

/** The funnel's WhatsApp, with a few seconds between one sending and the next. */
async function whatsAppSender(env: CloudflareEnv, db: D1Database): Promise<WhatsAppSender | null> {
	const config = await readSetting<WhatsAppConfig>(db, "whatsapp");
	if (!config) return null;
	let sent = 0;
	const pace = async () => {
		if (sent++) await pause(3000 + Math.random() * 5000);
	};
	return {
		connected: async () => (await whatsAppStatus(config)).connected,
		send: async (phone, audioId) => {
			const object = await env.BUCKET.get(`marketing/audio/${audioId}`);
			if (!object) throw new Error("Áudio não encontrado.");
			await pace();
			const type = object.httpMetadata?.contentType ?? "audio/ogg";
			const name = `audio.${type.includes("webm") ? "webm" : type.includes("mp4") ? "m4a" : type.includes("mpeg") ? "mp3" : type.includes("wav") ? "wav" : "ogg"}`;
			await sendWhatsAppAudio(config, phone, new File([await object.arrayBuffer()], name, { type }));
		},
		text: async (phone, message) => {
			await pace();
			await sendWhatsAppText(config, phone, message);
		},
	};
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
