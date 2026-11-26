/**
 * Public unsubscribe and preferences. The signed token is the only credential, so there is no
 * session and no Origin check: mail providers POST here themselves (RFC 8058).
 * GET never changes anything, because security scanners open the links in mail (U7).
 */
import { getClientIp } from "@/lib/auth/client-ip";
import { getEnv } from "@/lib/cloudflare";
import { markUnsubscribed } from "@/lib/marketing/campaigns";
import { getContact, saveListPreferences, unsubscribeAll } from "@/lib/marketing/contacts";
import { getSigningSecret, readUnsubscribeToken } from "@/lib/marketing/unsubscribe";
import { invalidLinkPage, preferencesPage, removedPage } from "@/lib/marketing/unsubscribe-page";

type Context = { params: Promise<{ token: string }> };

async function resolve(request: Request, { params }: Context) {
	const env = getEnv();
	const db = env.MARKETING_DB;
	if (!db) return { response: invalidLinkPage() } as const;
	const id = await readUnsubscribeToken(await getSigningSecret(db), (await params).token);
	if (id) return { db, id } as const;
	// Only failed tokens are limited: real one-click requests all arrive from a few provider addresses.
	const limit = await env.MARKETING_RATE_LIMIT?.limit({ key: `unsubscribe:${getClientIp(request) ?? "unknown"}` }).catch(() => null);
	return { response: limit && !limit.success ? new Response("Too many requests", { status: 429 }) : invalidLinkPage() } as const;
}

export async function GET(request: Request, context: Context) {
	const access = await resolve(request, context);
	if ("response" in access) return access.response;
	const contact = await getContact(access.db, access.id);
	// A deleted contact already receives nothing.
	if (!contact || contact.status === "unsubscribed" || contact.status === "blocked") return removedPage();
	return preferencesPage(contact);
}

export async function POST(request: Request, context: Context) {
	const access = await resolve(request, context);
	if ("response" in access) return access.response;
	const form = await request.formData().catch(() => null);
	// The campaign whose link was used, only to count it in that campaign's report.
	const campaignId = new URL(request.url).searchParams.get("c") ?? "";
	const leaving = form?.get("List-Unsubscribe") === "One-Click" || form?.get("action") === "all";
	if (leaving && campaignId) await markUnsubscribed(access.db, access.id, campaignId);
	if (form?.get("List-Unsubscribe") === "One-Click") {
		await unsubscribeAll(access.db, access.id, "um clique");
		return removedPage();
	}
	if (form?.get("action") === "all") {
		await unsubscribeAll(access.db, access.id, "página de preferências");
		return removedPage();
	}
	if (form?.get("action") === "save") {
		await saveListPreferences(access.db, access.id, form.getAll("list").map(String));
		const contact = await getContact(access.db, access.id);
		return contact && contact.status !== "unsubscribed" && contact.status !== "blocked" ? preferencesPage(contact, true) : removedPage();
	}
	return new Response("Bad request", { status: 400 });
}
