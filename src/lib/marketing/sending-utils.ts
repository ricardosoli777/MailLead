import type { BreakerStats, Provider, SenderSettings } from "./sending-types";

export const DAY_MS = 24 * 60 * 60 * 1000;
/** Rolling window the circuit breaker looks at (R5). */
export const BREAKER_WINDOW_MS = 7 * DAY_MS;
export const BREAKER_MIN_SAMPLE = 50;
export const BOUNCE_LIMIT = 0.02;
export const COMPLAINT_LIMIT = 0.0008;

/** R8: campaigns one person may get in seven days; 0 means no limit. */
export const DEFAULT_WEEKLY_LIMIT = 3;

export const DEFAULT_HOURLY: Record<Provider, number> = { gmail: 600, outlook: 300, yahoo: 300, other: 1000 };

/** Daily ceiling for the n-th day of sending, day 1 being the first (R4). */
export function warmupLimit(day: number): number {
	if (day <= 3) return 50;
	if (day <= 7) return 150;
	if (day <= 14) return 500;
	if (day <= 21) return 1000;
	if (day <= 30) return 2000;
	return Math.floor(2000 * 1.3 ** Math.ceil((day - 30) / 7));
}

/** Why sending must stop, or null. A single event in a tiny sample is not enough to judge. */
export function breakerReason({ sent, bounced, complained }: BreakerStats): string | null {
	if (sent < BREAKER_MIN_SAMPLE) return null;
	const percent = (value: number) => `${((value / sent) * 100).toFixed(2).replace(".", ",")}%`;
	if (complained / sent >= COMPLAINT_LIMIT) return `Reclamações de spam em ${percent(complained)} (limite 0,08%).`;
	if (bounced / sent >= BOUNCE_LIMIT) return `Devoluções permanentes em ${percent(bounced)} (limite 2%).`;
	return null;
}

export function readHourly(input: unknown): Record<Provider, number> {
	const value = (input ?? {}) as Record<string, unknown>;
	const read = (key: Provider) => {
		const number = Number(value[key]);
		return value[key] !== undefined && Number.isInteger(number) && number >= 0 && number <= 100_000 ? number : DEFAULT_HOURLY[key];
	};
	return { gmail: read("gmail"), outlook: read("outlook"), yahoo: read("yahoo"), other: read("other") };
}

const ADDRESS = /^[^\s@<>",]+@[a-z0-9.-]+\.[a-z]{2,}$/;

export function readSenderSettings(input: unknown): { settings: SenderSettings } | { error: string } {
	const value = (input ?? {}) as Record<string, unknown>;
	const text = (key: string, max = 200) => (typeof value[key] === "string" ? (value[key] as string).trim().slice(0, max) : "");
	const fromName = text("fromName", 80).replace(/[\r\n"<>\\]/g, "");
	const fromEmail = text("fromEmail").toLowerCase();
	const replyTo = text("replyTo").toLowerCase();
	const origin = text("origin").replace(/\/+$/, "");
	if (!fromName) return { error: "Informe o nome do remetente." };
	if (!ADDRESS.test(fromEmail)) return { error: "Informe um e-mail de remetente válido." };
	if (replyTo && !ADDRESS.test(replyTo)) return { error: "O e-mail de resposta não é válido." };
	if (!/^https:\/\/[^\s/]+$/i.test(origin)) return { error: "O endereço público precisa começar com https://." };
	const weekly = value.weeklyLimit === undefined ? DEFAULT_WEEKLY_LIMIT : Number(value.weeklyLimit);
	if (!Number.isInteger(weekly) || weekly < 0 || weekly > 100) return { error: "O limite por pessoa vai de 0 a 100 por semana." };
	return { settings: { fromName, fromEmail, replyTo, origin, weeklyLimit: weekly, hourlyByProvider: readHourly(value.hourlyByProvider) } };
}

/** `"Name" <address>`, with the name encoded when it is not plain ASCII (RFC 2047). */
export function formatFrom(name: string, email: string): string {
	if (/^[\x20-\x7e]*$/.test(name)) return `"${name}" <${email}>`;
	return `=?UTF-8?B?${btoa(String.fromCharCode(...new TextEncoder().encode(name)))}?= <${email}>`;
}
