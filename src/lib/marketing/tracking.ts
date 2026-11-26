/**
 * Opens and clicks. A link only redirects to a destination this installation signed, so it cannot
 * be used to send people somewhere else. Both numbers are approximate: mail providers and security
 * scanners open and follow links on their own.
 */
import { hmac } from "./unsubscribe";

const unescapeAttribute = (value: string) => value.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

const same = (a: string, b: string) => {
	if (a.length !== b.length) return false;
	let difference = 0;
	for (let index = 0; index < a.length; index++) difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
	return difference === 0;
};

export async function clickUrl(secret: string, origin: string, sendId: string, destination: string): Promise<string> {
	return `${origin}/api/marketing/c/${sendId}.${await hmac(secret, `click:${sendId}:${destination}`)}?u=${encodeURIComponent(destination)}`;
}

export async function openUrl(secret: string, origin: string, sendId: string): Promise<string> {
	return `${origin}/api/marketing/o/${sendId}.${await hmac(secret, `open:${sendId}`)}`;
}

/** Rewrites web links and appends the open pixel. The unsubscribe link is left direct. */
export async function addTracking(html: string, options: { secret: string; origin: string; sendId: string; unsubscribeUrl: string }): Promise<string> {
	const { secret, origin, sendId, unsubscribeUrl } = options;
	const replacements = new Map<string, string>();
	for (const [, attribute] of html.matchAll(/<a [^>]*?href="(https?:\/\/[^"]+)"/gi)) {
		const destination = unescapeAttribute(attribute);
		if (destination !== unsubscribeUrl) replacements.set(attribute, await clickUrl(secret, origin, sendId, destination));
	}
	const tracked = html.replace(/(<a [^>]*?href=")(https?:\/\/[^"]+)(")/gi, (whole, before: string, attribute: string, after: string) => {
		const url = replacements.get(attribute);
		return url ? `${before}${url.replace(/&/g, "&amp;")}${after}` : whole;
	});
	const pixel = `<img src="${await openUrl(secret, origin, sendId)}" width="1" height="1" alt="" style="display:block;border:0">`;
	return tracked.includes("</body>") ? tracked.replace("</body>", `${pixel}</body>`) : tracked + pixel;
}

export async function readOpenToken(secret: string, token: string): Promise<string | null> {
	const [sendId, signature, extra] = token.split(".");
	if (!sendId || !signature || extra !== undefined || token.length > 200) return null;
	return same(await hmac(secret, `open:${sendId}`), signature) ? sendId : null;
}

export async function readClickToken(secret: string, token: string, destination: string): Promise<string | null> {
	const [sendId, signature, extra] = token.split(".");
	if (!sendId || !signature || extra !== undefined || token.length > 200 || !/^https?:\/\//i.test(destination)) return null;
	return same(await hmac(secret, `click:${sendId}:${destination}`), signature) ? sendId : null;
}

export async function recordOpen(db: D1Database, sendId: string, now = Date.now()): Promise<void> {
	await db.prepare("UPDATE marketing_sends SET opened_at = COALESCE(opened_at, ?) WHERE id = ?").bind(now, sendId).run();
}

export async function recordClick(db: D1Database, sendId: string, now = Date.now()): Promise<void> {
	// A click proves the message was opened, even when images are off.
	await db.prepare("UPDATE marketing_sends SET clicked_at = COALESCE(clicked_at, ?1), opened_at = COALESCE(opened_at, ?1) WHERE id = ?2").bind(now, sendId).run();
}
