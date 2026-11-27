import { NextResponse } from "next/server";
import { newId } from "@/lib/ids";
import { requireMarketing, sniffImageType } from "@/lib/marketing/server";

const MAX_BYTES = 2 * 1024 * 1024;

export async function POST(request: Request) {
	const access = await requireMarketing(request);
	if (access.error) return access.error;
	const file = (await request.formData().catch(() => null))?.get("file");
	if (!(file instanceof File)) return NextResponse.json({ error: "Escolha uma imagem." }, { status: 400 });
	if (file.size > MAX_BYTES) return NextResponse.json({ error: "A imagem pode ter no máximo 2 MB." }, { status: 413 });
	const bytes = new Uint8Array(await file.arrayBuffer());
	const type = sniffImageType(bytes);
	if (!type) return NextResponse.json({ error: "Use PNG, JPG ou GIF." }, { status: 415 });
	// The id is the only secret of a public asset URL, so it must not be guessable.
	const id = `${newId("img")}-${crypto.randomUUID()}`;
	await access.env.BUCKET.put(`marketing/assets/${id}`, bytes, { httpMetadata: { contentType: type } });
	await access.db.prepare("INSERT INTO marketing_assets (id, content_type, size, created_at) VALUES (?, ?, ?, ?)").bind(id, type, bytes.length, Date.now()).run();
	// Recipients load the image from outside, so the URL must be absolute.
	const origin = access.env.APP_URL?.trim() || new URL(request.url).origin;
	return NextResponse.json({ url: new URL(`/api/marketing/assets/${id}`, origin).toString() }, { status: 201 });
}
