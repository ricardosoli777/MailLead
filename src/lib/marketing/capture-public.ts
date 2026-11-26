/** Shared by the public capture routes, which have no session. */
import { getClientIp } from "@/lib/auth/client-ip";

const MAX_BODY = 10_000;

/** True when this caller has used up its allowance. A missing limiter never blocks. */
export async function overLimit(env: CloudflareEnv, request: Request, scope: string): Promise<boolean> {
	const limit = await env.MARKETING_RATE_LIMIT?.limit({ key: `${scope}:${getClientIp(request) ?? "unknown"}` }).catch(() => null);
	return !!limit && !limit.success;
}

/** The raw text of a small request, or null when it is larger than any real one. */
export async function readSmallBody(request: Request): Promise<string | null> {
	if (Number(request.headers.get("Content-Length") ?? 0) > MAX_BODY) return null;
	const body = await request.text();
	return body.length > MAX_BODY ? null : body;
}
