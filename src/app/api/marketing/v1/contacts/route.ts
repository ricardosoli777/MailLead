/** Marketing API (I2): adds one person. Every call states how that person consented. */
import { NextResponse } from "next/server";
import { getEnv } from "@/lib/cloudflare";
import { authenticateKey } from "@/lib/marketing/capture";
import { overLimit, readSmallBody } from "@/lib/marketing/capture-public";
import { importContacts } from "@/lib/marketing/contacts";
import { cleanFields, normalizeTags, readConsent } from "@/lib/marketing/contacts-utils";
import { checkMailDomain } from "@/lib/marketing/domain-check";

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

export async function POST(request: Request) {
	const env = getEnv();
	const db = env.MARKETING_DB;
	// Read before answering: a refused request must not leave its body on the connection.
	const body = await readSmallBody(request);
	if (!db || !(await authenticateKey(db, request.headers.get("Authorization")))) {
		return (await overLimit(env, request, "api")) ? fail("Too many requests", 429) : fail("Invalid API key", 401);
	}
	if (body === null) return fail("Payload too large", 413);
	let input: { email?: unknown; name?: unknown; listId?: unknown; tags?: unknown; consent?: unknown; fields?: unknown };
	try { input = JSON.parse(body) ?? {}; } catch { return fail("Send a JSON body", 400); }
	const consent = readConsent(input.consent);
	if (!consent) return fail("consent.source, consent.text and consent.date (not in the future) are required", 400);
	const listId = typeof input.listId === "string" ? input.listId : "";
	if (!(await db.prepare("SELECT 1 AS ok FROM marketing_lists WHERE id = ?").bind(listId).first())) return fail("Unknown listId", 400);
	const report = await importContacts(db, [{ line: 1, email: typeof input.email === "string" ? input.email : "", name: typeof input.name === "string" ? input.name.trim().slice(0, 200) : "", fields: cleanFields(input.fields) }], {
		listId,
		consent,
		tags: normalizeTags(input.tags),
		origin: "API",
		checkDomain: checkMailDomain,
	});
	if (report.rejected.length) return fail(report.rejected[0].reason, 422);
	return NextResponse.json({ ok: true, added: report.added, updated: report.updated }, { status: report.added ? 201 : 200 });
}
