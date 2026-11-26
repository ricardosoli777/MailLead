import { NextResponse } from "next/server";
import { getAwsConfig } from "@/lib/aws/config";
import { sendSesEmail } from "@/lib/aws/ses";
import { emailHash, isValidEmail, normalizeEmail } from "@/lib/marketing/contacts-utils";
import { readSetting } from "@/lib/marketing/engine";
import { renderMarketingEmail } from "@/lib/marketing/render";
import type { SenderSettings } from "@/lib/marketing/sending-types";
import { formatFrom } from "@/lib/marketing/sending-utils";
import { requireMarketing, toTemplate } from "@/lib/marketing/server";
import { CONFIGURATION_SET, checkSender } from "@/lib/marketing/ses-marketing";
import { createUnsubscribeToken, getSigningSecret, unsubscribeUrl } from "@/lib/marketing/unsubscribe";

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

/** One message to one address through the real marketing path, so headers and DKIM can be checked. */
export async function POST(request: Request) {
	const access = await requireMarketing(request);
	if (access.error) return access.error;
	const { env, db } = access;
	const input = (await request.json().catch(() => null)) as { to?: unknown; templateId?: unknown } | null;
	const to = typeof input?.to === "string" ? normalizeEmail(input.to) : "";
	if (!isValidEmail(to) || /[,;<>\s]/.test(to)) return fail("Informe um único e-mail.", 400);
	const sender = await readSetting<SenderSettings>(db, "sender");
	const config = await getAwsConfig(env);
	if (!sender || !config) return fail("Salve o remetente e as credenciais da AWS primeiro.", 409);
	const problem = (await checkSender(env, db, sender)).find((check) => !check.ok);
	if (problem) return fail(`${problem.label}: ${problem.detail}`, 409);
	const row = await db.prepare("SELECT id, name, subject, design, updated_at FROM marketing_templates WHERE id = ?").bind(String(input?.templateId ?? "")).first<Parameters<typeof toTemplate>[0]>();
	if (!row) return fail("Escolha um modelo.", 404);
	if (await db.prepare("SELECT 1 AS ok FROM marketing_suppressions WHERE email_hash = ?").bind(await emailHash(to)).first()) return fail("Este endereço está bloqueado para marketing.", 409);
	const template = toTemplate(row);
	// A contact gets a working unsubscribe link; any other address gets one that points to nobody.
	const contact = await db.prepare("SELECT id, name FROM marketing_contacts WHERE email = ?").bind(to).first<{ id: string; name: string }>();
	const url = unsubscribeUrl(sender.origin, await createUnsubscribeToken(await getSigningSecret(db), contact?.id ?? "teste"));
	const message = renderMarketingEmail(template.design, `[Teste] ${template.subject || template.name}`, { nome: contact?.name ?? "", email: to }, url);
	try {
		await sendSesEmail(config, { ...message, from: formatFrom(sender.fromName, sender.fromEmail), to: [to], replyTo: sender.replyTo || undefined, configurationSet: CONFIGURATION_SET });
	} catch (error) {
		return fail(error instanceof Error ? error.message : "Falha no envio.", 502);
	}
	return NextResponse.json({ ok: true });
}
