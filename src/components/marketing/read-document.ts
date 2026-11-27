/** Turns a chosen file into material for the AI, in the browser. */
import type { AiDocument } from "@/lib/marketing/ai-types";
import { MAX_PDF_BYTES } from "@/lib/marketing/ai-utils";
import { docxText } from "@/lib/marketing/docx";

export const ACCEPTED_FILES = ".pdf,.docx,.txt,.md,.csv,image/png,image/jpeg,image/gif";

function base64(bytes: Uint8Array): string {
	let binary = "";
	for (let at = 0; at < bytes.length; at += 0x8000) binary += String.fromCharCode(...bytes.subarray(at, at + 0x8000));
	return btoa(binary);
}

export async function readDocument(file: File): Promise<AiDocument> {
	const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
	if (!["pdf", "docx", "txt", "md", "csv"].includes(extension)) throw new Error(`Não sei ler "${file.name}". Use PDF, Word (.docx), TXT ou imagem.`);
	if (file.size > MAX_PDF_BYTES) throw new Error("Cada documento pode ter no máximo 10 MB.");
	if (extension === "pdf") return { name: file.name, kind: "pdf", data: base64(new Uint8Array(await file.arrayBuffer())) };
	const text = extension === "docx" ? await docxText(new Uint8Array(await file.arrayBuffer())) : await file.text();
	if (!text.trim()) throw new Error(`"${file.name}" não tem texto.`);
	return { name: file.name, kind: "text", text };
}
