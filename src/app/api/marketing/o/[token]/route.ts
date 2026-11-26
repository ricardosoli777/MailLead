import { getEnv } from "@/lib/cloudflare";
import { readOpenToken, recordOpen } from "@/lib/marketing/tracking";
import { getSigningSecret } from "@/lib/marketing/unsubscribe";

export const dynamic = "force-dynamic";

const GIF = Uint8Array.from(atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"), (char) => char.charCodeAt(0));

/** Public open pixel of marketing messages. Always the same image, whatever the token. */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
	const db = getEnv().MARKETING_DB;
	if (db) {
		const sendId = await readOpenToken(await getSigningSecret(db), (await params).token);
		if (sendId) await recordOpen(db, sendId);
	}
	return new Response(GIF, { headers: { "Content-Type": "image/gif", "Cache-Control": "no-store" } });
}
