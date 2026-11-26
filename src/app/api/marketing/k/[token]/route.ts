/** Double opt-in confirmation (R6). Only the POST records consent: scanners open the links in mail. */
import { getEnv } from "@/lib/cloudflare";
import { confirmSubscription, findPending } from "@/lib/marketing/capture";
import { confirmPage, confirmedPage, notFoundPage } from "@/lib/marketing/capture-page";
import { overLimit } from "@/lib/marketing/capture-public";

type Context = { params: Promise<{ token: string }> };

const missing = async (env: CloudflareEnv, request: Request) =>
	(await overLimit(env, request, "confirm")) ? new Response("Too many requests", { status: 429 }) : notFoundPage();

export async function GET(request: Request, { params }: Context) {
	const env = getEnv();
	const pending = env.MARKETING_DB ? await findPending(env.MARKETING_DB, (await params).token) : null;
	if (!pending) return missing(env, request);
	return pending.confirmed_at ? confirmedPage() : confirmPage();
}

export async function POST(request: Request, { params }: Context) {
	const env = getEnv();
	if (env.MARKETING_DB && (await confirmSubscription(env.MARKETING_DB, (await params).token))) return confirmedPage();
	return missing(env, request);
}
