import { requireMarketing } from "@/lib/marketing/server";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const access = await requireMarketing(request);
	if (access.error) return access.error;
	const { id } = await params;
	const object = /^[\w-]{5,80}$/.test(id) ? await access.env.BUCKET.get(`marketing/audio/${id}`) : null;
	if (!object) return new Response("Not found", { status: 404 });
	return new Response(object.body, {
		headers: {
			"Content-Type": object.httpMetadata?.contentType ?? "application/octet-stream",
			"Cache-Control": "private, max-age=3600",
			"X-Content-Type-Options": "nosniff",
		},
	});
}
