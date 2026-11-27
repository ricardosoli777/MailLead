import { NextResponse } from "next/server";
import { newId } from "@/lib/ids";
import { requireMarketing, sniffImageType } from "@/lib/marketing/server";

const MAX_IMAGE = 2 * 1024 * 1024;
const MAX_PDF = 10 * 1024 * 1024;

export async function POST(request: Request) {
	const access = await requireMarketing(request);
	if (access.error) return access.error;
	const form = await request.formData().catch(() => null);
	const file = form?.get("file");
	const pdfAllowed = form?.get("allow") === "pdf";
	if (!(file instanceof File)) return NextResponse.json({ error: "Escolha um arquivo." }, { status: 400 });
	if (file.size > (pdfAllowed ? MAX_PDF : MAX_IMAGE)) return NextResponse.json({ error: pdfAllowed ? "O arquivo pode ter no máximo 10 MB." : "A imagem pode ter no máximo 2 MB." }, { status: 413 });
	const bytes = new Uint8Array(await file.arrayBuffer());
	// "%PDF-"
	const pdf = pdfAllowed && [0x25, 0x50, 0x44, 0x46, 0x2d].every((byte, index) => bytes[index] === byte);
	const type = pdf ? "application/pdf" : sniffImageType(bytes);
	if (!type) return NextResponse.json({ error: pdfAllowed ? "Use PNG, JPG, GIF ou PDF." : "Use PNG, JPG ou GIF." }, { status: 415 });
	if (!pdf && bytes.length > MAX_IMAGE) return NextResponse.json({ error: "A imagem pode ter no máximo 2 MB." }, { status: 413 });
	// The id is the only secret of a public asset URL, so it must not be guessable.
	const id = `${newId(pdf ? "pdf" : "img")}-${crypto.randomUUID()}`;
	await access.env.BUCKET.put(`marketing/assets/${id}`, bytes, { httpMetadata: { contentType: type } });
	await access.db.prepare("INSERT INTO marketing_assets (id, content_type, size, created_at) VALUES (?, ?, ?, ?)").bind(id, type, bytes.length, Date.now()).run();
	// Recipients load the image from outside, so the URL must be absolute.
	const origin = access.env.APP_URL?.trim() || new URL(request.url).origin;
	return NextResponse.json({ url: new URL(`/api/marketing/assets/${id}`, origin).toString() }, { status: 201 });
}
