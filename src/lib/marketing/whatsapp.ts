/**
 * Sending through the owner's own Evolution Go server. Only the token of one instance is used, and
 * only to ask its status and to send: nothing here creates, connects or changes an instance.
 */
export type WhatsAppConfig = { url: string; token: string };

export class WhatsAppError extends Error {}

// About an hour of voice at the quality the recorder uses.
export const MAX_AUDIO_BYTES = 16 * 1024 * 1024;

/** The server's address: https only, since the token travels with every request. */
export function readServerUrl(value: unknown): string | null {
	try {
		const url = new URL(String(value ?? "").trim());
		return url.protocol === "https:" && !url.username && !url.password ? `${url.origin}${url.pathname.replace(/\/(manager.*)?$/, "")}` : null;
	} catch {
		return null;
	}
}

/** Digits with the country code. A Brazilian number typed without it gets 55. */
export function readPhone(value: unknown): string | null {
	const typed = String(value ?? "").trim();
	let digits = typed.replace(/\D/g, "");
	if (!typed.startsWith("+") && (digits.length === 10 || digits.length === 11)) digits = `55${digits}`;
	return digits.length >= 11 && digits.length <= 15 ? digits : null;
}

async function call(config: WhatsAppConfig, path: string, init: RequestInit, request: typeof fetch): Promise<unknown> {
	let response: Response;
	try {
		// A redirect is refused so the token never follows it to another address.
		response = await request(`${config.url}${path}`, { ...init, headers: { ...init.headers, apikey: config.token }, redirect: "manual", signal: AbortSignal.timeout(180_000) });
	} catch {
		throw new WhatsAppError("O servidor do WhatsApp não respondeu. Confira o endereço.");
	}
	const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
	if (response.status === 401 || response.status === 403) throw new WhatsAppError("O servidor recusou o token. Use o token da instância, não a chave geral.");
	if (!response.ok || !body) {
		const detail = typeof body?.error === "string" ? body.error.slice(0, 200) : `resposta ${response.status}`;
		throw new WhatsAppError(`O servidor do WhatsApp recusou o pedido: ${detail}`);
	}
	return body;
}

export async function whatsAppStatus(config: WhatsAppConfig, request: typeof fetch = fetch): Promise<{ connected: boolean; name: string }> {
	const body = (await call(config, "/instance/status", { method: "GET" }, request)) as { data?: { Connected?: boolean; LoggedIn?: boolean; Name?: string } };
	return { connected: !!body.data?.Connected && !!body.data.LoggedIn, name: body.data?.Name ?? "" };
}

export async function sendWhatsAppText(config: WhatsAppConfig, number: string, text: string, request: typeof fetch = fetch): Promise<void> {
	await call(config, "/send/text", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ number, text }) }, request);
}

/** The server converts what it receives to a voice message (OGG/Opus). */
export async function sendWhatsAppAudio(config: WhatsAppConfig, number: string, audio: File, request: typeof fetch = fetch): Promise<void> {
	const form = new FormData();
	form.set("number", number);
	form.set("type", "audio");
	form.set("file", audio, audio.name || "audio.ogg");
	await call(config, "/send/media", { method: "POST", body: form }, request);
}
