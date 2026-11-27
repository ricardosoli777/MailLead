import { NextResponse } from "next/server";
import { readSetting } from "@/lib/marketing/engine";
import { requireMarketing } from "@/lib/marketing/server";
import { MAX_AUDIO_BYTES, readPhone, sendWhatsAppAudio, sendWhatsAppText, WhatsAppError, type WhatsAppConfig } from "@/lib/marketing/whatsapp";

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

/** One message to one number the administrator typed: a recorded audio, or a short fixed text. */
export async function POST(request: Request) {
	const access = await requireMarketing(request);
	if (access.error) return access.error;
	const form = await request.formData().catch(() => null);
	const number = readPhone(form?.get("phone"));
	if (!number) return fail("Informe o número com DDD, por exemplo 11 99999-9999.", 400);
	const audio = form?.get("audio");
	if (audio instanceof File && audio.size > MAX_AUDIO_BYTES) return fail("O áudio pode ter no máximo 16 MB.", 413);
	const config = await readSetting<WhatsAppConfig>(access.db, "whatsapp");
	if (!config) return fail("Salve o endereço e o token primeiro.", 409);
	try {
		if (audio instanceof File && audio.size) await sendWhatsAppAudio(config, number, audio);
		else await sendWhatsAppText(config, number, "Teste do MailLead: a conexão do WhatsApp está funcionando.");
	} catch (error) {
		if (error instanceof WhatsAppError) return fail(error.message, 502);
		throw error;
	}
	return NextResponse.json({ ok: true });
}
