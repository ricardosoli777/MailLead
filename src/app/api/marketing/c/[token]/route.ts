import { getEnv } from "@/lib/cloudflare";
import { readClickToken, recordClick } from "@/lib/marketing/tracking";
import { getSigningSecret } from "@/lib/marketing/unsubscribe";

export const dynamic = "force-dynamic";

/** Public click redirect. Only a destination signed by this installation is followed. */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
	const db = getEnv().MARKETING_DB;
	const destination = new URL(request.url).searchParams.get("u") ?? "";
	const sendId = db ? await readClickToken(await getSigningSecret(db), (await params).token, destination) : null;
	if (!db || !sendId) return new Response("Link inválido", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
	await recordClick(db, sendId);
	return new Response(null, { status: 302, headers: { Location: new URL(destination).href, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}
