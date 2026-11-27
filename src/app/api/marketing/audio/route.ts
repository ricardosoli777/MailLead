/** Audio of funnel steps. It is private: only the administrator and the WhatsApp server get it. */
import { NextResponse } from "next/server";
import { newId } from "@/lib/ids";
import { requireMarketing } from "@/lib/marketing/server";
import { MAX_AUDIO_BYTES } from "@/lib/marketing/whatsapp";

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });
const TYPES: Record<string, string> = { ogg: "audio/ogg", opus: "audio/ogg", mp3: "audio/mpeg", m4a: "audio/mp4", wav: "audio/wav", webm: "audio/webm" };

export async function POST(request: Request) {
	const access = await requireMarketing(request);
	if (access.error) return access.error;
	const file = (await request.formData().catch(() => null))?.get("file");
	if (!(file instanceof File) || !file.size) return fail("Escolha um áudio.", 400);
	if (file.size > MAX_AUDIO_BYTES) return fail("O áudio pode ter no máximo 16 MB.", 413);
	const type = file.type.startsWith("audio/") ? file.type : TYPES[file.name.split(".").pop()!.toLowerCase()];
	if (!type) return fail("Use um arquivo de áudio.", 415);
	const id = newId("aud");
	await access.env.BUCKET.put(`marketing/audio/${id}`, await file.arrayBuffer(), { httpMetadata: { contentType: type } });
	await access.db.prepare("INSERT INTO marketing_audio (id, name, content_type, size, created_at) VALUES (?, ?, ?, ?, ?)").bind(id, file.name.slice(0, 120), type, file.size, Date.now()).run();
	return NextResponse.json({ id }, { status: 201 });
}
