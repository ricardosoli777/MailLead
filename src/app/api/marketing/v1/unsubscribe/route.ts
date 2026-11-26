/** Marketing API (I2): removes an address from every list, for good. */
import { NextResponse } from "next/server";
import { getEnv } from "@/lib/cloudflare";
import { authenticateKey, unsubscribeEmail } from "@/lib/marketing/capture";
import { overLimit, readSmallBody } from "@/lib/marketing/capture-public";

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

export async function POST(request: Request) {
	const env = getEnv();
	const db = env.MARKETING_DB;
	// Read before answering: a refused request must not leave its body on the connection.
	const body = await readSmallBody(request);
	if (!db || !(await authenticateKey(db, request.headers.get("Authorization")))) {
		return (await overLimit(env, request, "api")) ? fail("Too many requests", 429) : fail("Invalid API key", 401);
	}
	let email: unknown;
	try { email = (JSON.parse(body ?? "") as { email?: unknown } | null)?.email; } catch { return fail("Send a JSON body", 400); }
	return typeof email === "string" && (await unsubscribeEmail(db, email)) ? NextResponse.json({ ok: true }) : fail("Invalid email", 400);
}
