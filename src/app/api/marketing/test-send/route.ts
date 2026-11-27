import { NextResponse } from "next/server";
import { readSetting } from "@/lib/marketing/engine";
import { sendSystemEmail } from "@/lib/email/system-mail";
import { renderHtml, renderText } from "@/lib/marketing/render";
import type { SenderSettings } from "@/lib/marketing/sending-types";
import { createUnsubscribeToken, getSigningSecret, unsubscribeUrl } from "@/lib/marketing/unsubscribe";
import { readTemplateInput, requireMarketing } from "@/lib/marketing/server";

export async function POST(request: Request) {
	const access = await requireMarketing(request);
	if (access.error) return access.error;
	const to = ((await request.clone().json().catch(() => null)) as { to?: unknown } | null)?.to;
	// One recipient per test: no commas, spaces or angle brackets that could smuggle a list.
	if (typeof to !== "string" || !/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(to)) {
		return NextResponse.json({ error: "Informe um único e-mail para o teste." }, { status: 400 });
	}
	const input = await readTemplateInput(request);
	if (input.error) return input.error;
	const variables = { nome: access.user.name ?? "" };
	// The same footer a lead gets. This link belongs to nobody, so clicking it removes no one.
	const sender = await readSetting<SenderSettings>(access.db, "sender");
	const url = sender ? unsubscribeUrl(sender.origin, await createUnsubscribeToken(await getSigningSecret(access.db), "teste")) : "";
	try {
		const sent = await sendSystemEmail(access.env, {
			to,
			subject: `[Teste] ${input.subject || input.name}`,
			html: renderHtml(input.design, variables, url),
			text: renderText(input.design, variables, url),
		});
		if (!sent) return NextResponse.json({ error: "Nenhum domínio pode enviar e-mail." }, { status: 409 });
	} catch (error) {
		return NextResponse.json({ error: error instanceof Error ? error.message : "Falha no envio." }, { status: 502 });
	}
	return NextResponse.json({ ok: true });
}
