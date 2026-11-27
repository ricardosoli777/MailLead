import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { domains, mailboxes, users } from "@/db/schema";
import { getEnv } from "@/lib/cloudflare";
import { requireSessionUser } from "@/lib/api/auth";
import { isPrimaryAdmin } from "@/lib/auth/admin";
import { hasValidSessionMutationOrigin } from "@/lib/auth/origin";
import { getSessionTokenFromRequestHeaders } from "@/lib/auth/session";
import { authorizeSecurityChange } from "@/lib/auth/webauthn/authorize";
import { bumpSecurityVersion } from "@/lib/auth/webauthn/grants";
import { authError } from "@/lib/http/auth-error";
import { createAuditLog } from "@/lib/mailboxes/audit";

// The primary admin changes their own sign-in address. Only a personal inbox they
// already own can be chosen: it becomes the primary inbox (name, photo, recovery
// email), and the address is one they can receive mail at.

const schema = z.object({
	email: z.string().trim().toLowerCase().email(),
	stepUpToken: z.string().min(8).max(200),
});

async function ownAddresses(env: CloudflareEnv, userId: string): Promise<string[]> {
	const rows = await getDb(env)
		.select({ localPart: mailboxes.localPart, hostname: domains.hostname })
		.from(mailboxes)
		.innerJoin(domains, eq(mailboxes.domainId, domains.id))
		.where(and(eq(mailboxes.userId, userId), eq(mailboxes.type, "personal")));
	return rows.map((row) => `${row.localPart}@${row.hostname}`.toLowerCase()).sort();
}

export async function GET(request: Request) {
	const env = getEnv();
	const auth = await requireSessionUser(env, request);
	if (auth.error) return auth.error;
	if (!isPrimaryAdmin(auth.user)) return Response.json({ error: "Forbidden" }, { status: 403 });
	return Response.json(
		{ email: auth.user.email, addresses: await ownAddresses(env, auth.user.id) },
		{ headers: { "Cache-Control": "no-store" } },
	);
}

export async function PUT(request: Request) {
	const env = getEnv();
	const auth = await requireSessionUser(env, request);
	if (auth.error) return auth.error;
	if (!hasValidSessionMutationOrigin(request)) return Response.json({ error: "Invalid origin" }, { status: 403 });
	if (!isPrimaryAdmin(auth.user)) return Response.json({ error: "Forbidden" }, { status: 403 });
	const parsed = schema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
	const { email, stepUpToken } = parsed.data;
	if (!(await ownAddresses(env, auth.user.id)).includes(email)) {
		return Response.json({ error: "Choose one of your own personal inboxes" }, { status: 400 });
	}
	const db = getDb(env);
	const [taken] = await db.select({ id: users.id }).from(users).where(and(eq(users.email, email), ne(users.id, auth.user.id))).limit(1);
	if (taken) return Response.json({ error: "Another account already uses this address" }, { status: 409 });
	if (!(await authorizeSecurityChange(env, auth.user, getSessionTokenFromRequestHeaders(request), { stepUpToken }, "admin.login_email"))) {
		return authError("verification_required", 401);
	}
	await db.update(users).set({ email }).where(eq(users.id, auth.user.id));
	// Proofs issued for the old address no longer apply.
	await bumpSecurityVersion(db, auth.user.id);
	await createAuditLog(env, {
		actorUserId: auth.user.id,
		targetUserId: auth.user.id,
		action: "auth.login_email_changed",
		metadata: { previous: auth.user.email, ipAddress: request.headers.get("cf-connecting-ip") ?? "unknown" },
	});
	return Response.json({ email });
}
