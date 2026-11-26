/** Signed unsubscribe links: no personal data in the URL, and they never expire. */

const base64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/**
 * Kept in MARKETING_DB rather than derived from deployment credentials: rotating a Cloudflare
 * token must not break the links in mail already delivered.
 */
export async function getSigningSecret(db: D1Database): Promise<string> {
	const read = () => db.prepare("SELECT value FROM marketing_settings WHERE key = 'unsubscribe_secret'").first<{ value: string }>();
	const stored = await read();
	if (stored) return stored.value;
	await db.prepare("INSERT OR IGNORE INTO marketing_settings (key, value) VALUES ('unsubscribe_secret', ?)").bind(base64url(crypto.getRandomValues(new Uint8Array(32)))).run();
	return (await read())!.value;
}

export async function hmac(secret: string, value: string): Promise<string> {
	const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
	return base64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value))));
}

export async function createUnsubscribeToken(secret: string, contactId: string): Promise<string> {
	return `${contactId}.${await hmac(secret, `unsubscribe:${contactId}`)}`;
}

/** The contact id, or null when the token was not made by this installation. */
export async function readUnsubscribeToken(secret: string, token: string): Promise<string | null> {
	const [contactId, signature, extra] = token.split(".");
	if (!contactId || !signature || extra !== undefined || token.length > 200) return null;
	const expected = await hmac(secret, `unsubscribe:${contactId}`);
	if (expected.length !== signature.length) return null;
	let difference = 0;
	for (let index = 0; index < expected.length; index++) difference |= expected.charCodeAt(index) ^ signature.charCodeAt(index);
	return difference === 0 ? contactId : null;
}

export const unsubscribeUrl = (origin: string, token: string) => `${origin.replace(/\/+$/, "")}/api/marketing/u/${token}`;

/** RFC 8058 one-click unsubscribe. The sender must make sure DKIM covers both headers. */
export function unsubscribeHeaders(url: string): Record<string, string> {
	return { "List-Unsubscribe": `<${url}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" };
}
