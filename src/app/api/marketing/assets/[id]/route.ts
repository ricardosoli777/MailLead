import { getEnv } from "@/lib/cloudflare";

/** Public on purpose: mail apps fetch template images without a session. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	if (!/^[\w-]{20,120}$/.test(id)) return new Response("Not found", { status: 404 });
	const object = await getEnv().BUCKET.get(`marketing/assets/${id}`);
	if (!object) return new Response("Not found", { status: 404 });
	return new Response(object.body, {
		headers: {
			"Content-Type": object.httpMetadata?.contentType ?? "application/octet-stream",
			"Cache-Control": "public, max-age=31536000, immutable",
			"X-Content-Type-Options": "nosniff",
			"Cross-Origin-Resource-Policy": "cross-origin",
		},
	});
}
