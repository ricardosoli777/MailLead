/** The words of a Word file (.docx is a zip holding word/document.xml). Runs in the browser. */
export async function docxText(bytes: Uint8Array): Promise<string> {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const u16 = (at: number) => view.getUint16(at, true);
	const u32 = (at: number) => view.getUint32(at, true);
	let end = bytes.length - 22;
	while (end >= 0 && u32(end) !== 0x06054b50) end--;
	if (end < 0) throw new Error("Arquivo do Word inválido.");
	let at = u32(end + 16);
	for (let entry = 0; entry < u16(end + 10) && u32(at) === 0x02014b50; entry++) {
		const nameLength = u16(at + 28);
		if (new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLength)) === "word/document.xml") {
			const local = u32(at + 42);
			const start = local + 30 + u16(local + 26) + u16(local + 28);
			const packed = bytes.slice(start, start + u32(at + 20));
			const xml = u16(at + 10) === 0
				? new TextDecoder().decode(packed)
				: await new Response(new Blob([packed]).stream().pipeThrough(new DecompressionStream("deflate-raw") as ReadableWritablePair<Uint8Array, Uint8Array>)).text();
			const entities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
			return xml
				.replace(/<w:tab\/>/g, "\t")
				.replace(/<w:br[^>]*\/>|<\/w:p>/g, "\n")
				.replace(/<[^>]*>/g, "")
				.replace(/&(amp|lt|gt|quot|apos);/g, (_, name: string) => entities[name])
				.replace(/\n{3,}/g, "\n\n")
				.trim();
		}
		at += 46 + nameLength + u16(at + 30) + u16(at + 32);
	}
	throw new Error("Arquivo do Word inválido.");
}
