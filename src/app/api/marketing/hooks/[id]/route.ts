/** Signed incoming webhook (I3): adds the person to the list and tags chosen when it was created. */
import { NextResponse } from "next/server";
import { getEnv } from "@/lib/cloudflare";
import { getHook, verifyHookSignature } from "@/lib/marketing/capture";
import { overLimit, readSmallBody } from "@/lib/marketing/capture-public";
import { importContacts } from "@/lib/marketing/contacts";
import { cleanFields } from "@/lib/marketing/contacts-utils";
import { checkMailDomain } from "@/lib/marketing/domain-check";

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const env = getEnv();
	const db = env.MARKETING_DB;
	const body = await readSmallBody(request);
	if (body === null) return fail("Payload too large", 413);
	const hook = db ? await getHook(db, (await params).id) : null;
	if (!db || !hook || !(await verifyHookSignature(hook.secret, body, request.headers.get("X-MailLead-Signature")))) {
		// Only failures are limited, so a burst of real purchases is not dropped.
		return (await overLimit(env, request, "hook")) ? fail("Too many requests", 429) : fail("Invalid signature", 401);
	}
	let input: { email?: unknown; name?: unknown; fields?: unknown };
	try { input = JSON.parse(body) ?? {}; } catch { return fail("Send a JSON body", 400); }
	const report = await importContacts(db, [{ line: 1, email: typeof input.email === "string" ? input.email : "", name: typeof input.name === "string" ? input.name.trim().slice(0, 200) : "", fields: cleanFields(input.fields) }], {
		listId: hook.listId,
		consent: { source: `webhook ${hook.name}`, text: hook.consentText, consentedAt: Date.now() },
		tags: hook.tags,
		origin: "webhook",
		checkDomain: checkMailDomain,
	});
	if (report.rejected.length) return fail(report.rejected[0].reason, 422);
	return NextResponse.json({ ok: true, added: report.added, updated: report.updated });
}
