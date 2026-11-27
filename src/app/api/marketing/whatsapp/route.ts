import { NextResponse } from "next/server";
import { dropSetting, readSetting, writeSetting } from "@/lib/marketing/engine";
import { requireMarketing } from "@/lib/marketing/server";
import { readServerUrl, WhatsAppError, whatsAppStatus, type WhatsAppConfig } from "@/lib/marketing/whatsapp";

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

/** The token is written and used, never sent back to the browser. */
export async function GET(request: Request) {
	const access = await requireMarketing(request);
	if (access.error) return access.error;
	const config = await readSetting<WhatsAppConfig>(access.db, "whatsapp");
	if (!config) return NextResponse.json({ url: "", saved: false, status: null, problem: "" });
	try {
		return NextResponse.json({ url: config.url, saved: true, status: await whatsAppStatus(config), problem: "" });
	} catch (error) {
		if (!(error instanceof WhatsAppError)) throw error;
		return NextResponse.json({ url: config.url, saved: true, status: null, problem: error.message });
	}
}

export async function PUT(request: Request) {
	const access = await requireMarketing(request);
	if (access.error) return access.error;
	const input = (await request.json().catch(() => null)) as { url?: unknown; token?: unknown } | null;
	const url = readServerUrl(input?.url);
	if (!url) return fail("Informe o endereço começando com https://", 400);
	const current = await readSetting<WhatsAppConfig>(access.db, "whatsapp");
	const typed = typeof input?.token === "string" ? input.token.trim().slice(0, 500) : "";
	// A saved token is never carried over to a different address.
	const token = typed || (current?.url === url ? current.token : "");
	if (!token) return fail("Cole o token da instância.", 400);
	await writeSetting(access.db, "whatsapp", { url, token });
	return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
	const access = await requireMarketing(request);
	if (access.error) return access.error;
	await dropSetting(access.db, "whatsapp");
	return NextResponse.json({ ok: true });
}
