import { MAX_BLOCKS, MAX_TEXT, type Block, type Design } from "./types";

const escapes: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (value: string) => value.replace(/[&<>"']/g, (char) => escapes[char]);

/** Only absolute web and mail links reach the message; anything else (javascript:, data:, relative) is dropped. */
export function safeUrl(value: string | undefined, { images = false } = {}): string {
	const url = (value ?? "").trim();
	const allowed = images ? /^https?:\/\/[^\s]+$/i : /^(https?:\/\/[^\s]+|mailto:[^\s]+)$/i;
	return allowed.test(url) ? url : "";
}

/** Replaces `{{name}}` and `{{name|fallback}}`; a variable without a value never reaches the reader raw. */
export function applyVariables(value: string, variables: Record<string, string> = {}): string {
	return value.replace(/\{\{\s*([\w.-]+)\s*(?:\|([^{}]*))?\}\}/g, (_match, name: string, fallback?: string) =>
		(Object.hasOwn(variables, name) && variables[name].trim()) || (fallback ?? "").trim());
}

const font = "font-family:Arial,Helvetica,sans-serif";

function row(content: string, padding = "10px 32px"): string {
	return `<tr><td style="padding:${padding};${font};font-size:15px;line-height:1.6;color:#202124">${content}</td></tr>`;
}

function image(url: string, alt: string): string {
	return `<img src="${esc(url)}" alt="${esc(alt)}" width="536" style="display:block;width:100%;max-width:536px;height:auto;border:0;border-radius:8px">`;
}

function button(label: string, url: string, accent: string): string {
	return `<a href="${esc(url)}" style="display:inline-block;background-color:${accent};color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 28px;border-radius:8px">${esc(label)}</a>`;
}

function renderBlock(block: Block, accent: string, fill: (value: string) => string): string {
	switch (block.type) {
		case "heading":
			return row(`<h1 style="margin:0;font-size:24px;line-height:1.3;color:#202124">${esc(fill(block.text))}</h1>`);
		case "text":
			return row(esc(fill(block.text)).replace(/\n/g, "<br>"));
		case "image": {
			const src = safeUrl(block.url, { images: true });
			if (!src) return "";
			const link = safeUrl(block.link);
			const img = image(src, fill(block.alt));
			return row(link ? `<a href="${esc(link)}">${img}</a>` : img);
		}
		case "button": {
			const url = safeUrl(block.url);
			return url && block.label.trim() ? row(`<div style="text-align:center">${button(fill(block.label), url, accent)}</div>`, "16px 32px") : "";
		}
		case "media": {
			const url = safeUrl(block.url);
			if (!url) return "";
			const label = fill(block.label) || (block.kind === "video" ? "Assistir ao vídeo" : "Ouvir o áudio");
			const cover = safeUrl(block.imageUrl, { images: true });
			const picture = cover ? `<a href="${esc(url)}">${image(cover, label)}</a><br>` : "";
			return row(`<div style="text-align:center">${picture}${button(`▶ ${label}`, url, accent)}</div>`, "16px 32px");
		}
		case "divider":
			return row(`<hr style="border:0;border-top:1px solid #dadce0;margin:0">`);
	}
}

const accentOf = (design: Design) => (/^#[0-9a-f]{6}$/i.test(design.accent) ? design.accent : "#0b57d0");

export function renderHtml(design: Design, variables: Record<string, string> = {}): string {
	const fill = (value: string) => applyVariables(value, variables);
	const accent = accentOf(design);
	const preheader = design.preheader ? `<div style="display:none;max-height:0;overflow:hidden">${esc(fill(design.preheader))}</div>` : "";
	const { company, contact, disclaimer } = design.footer;
	const footer = [
		company && `<strong>${esc(fill(company))}</strong>`,
		contact && esc(fill(contact)),
		disclaimer && esc(fill(disclaimer)).replace(/\n/g, "<br>"),
	].filter(Boolean).join("<br>");
	return `${preheader}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f6f8fc"><tr><td align="center" style="padding:24px 8px"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background-color:#ffffff;border-top:4px solid ${accent};border-radius:12px"><tr><td style="height:14px"></td></tr>${design.blocks.map((block) => renderBlock(block, accent, fill)).join("")}<tr><td style="padding:20px 32px 28px;border-top:1px solid #e8eaed;${font};font-size:12px;line-height:1.6;color:#5f6368;text-align:center">${footer}</td></tr></table></td></tr></table>`;
}

export function renderText(design: Design, variables: Record<string, string> = {}): string {
	const fill = (value: string) => applyVariables(value, variables);
	const parts = design.blocks.map((block) => {
		switch (block.type) {
			case "heading":
			case "text":
				return fill(block.text);
			case "image":
				return safeUrl(block.link) ? `${fill(block.alt)}: ${block.link}` : fill(block.alt);
			case "button":
				return safeUrl(block.url) ? `${fill(block.label)}: ${block.url}` : "";
			case "media":
				return safeUrl(block.url) ? `${fill(block.label)}: ${block.url}` : "";
			case "divider":
				return "----------";
		}
	});
	const { company, contact, disclaimer } = design.footer;
	return [...parts, "--", fill(company), fill(contact), fill(disclaimer)].filter(Boolean).join("\n\n");
}

const str = (value: unknown, max = MAX_TEXT) => (typeof value === "string" ? value.slice(0, max) : "");

/** Rebuilds a design from untrusted JSON, keeping only known fields. Returns an error message when it cannot be saved. */
export function parseDesign(input: unknown): { design: Design } | { error: string } {
	const value = (input ?? {}) as { accent?: unknown; preheader?: unknown; blocks?: unknown; footer?: Record<string, unknown> };
	if (!Array.isArray(value.blocks)) return { error: "O modelo precisa de uma lista de blocos." };
	if (value.blocks.length > MAX_BLOCKS) return { error: `Use no máximo ${MAX_BLOCKS} blocos.` };
	const blocks: Block[] = [];
	for (const raw of value.blocks as Record<string, unknown>[]) {
		switch (raw?.type) {
			case "heading":
			case "text":
				blocks.push({ type: raw.type, text: str(raw.text) });
				break;
			case "image":
				blocks.push({ type: "image", url: str(raw.url, 2000), alt: str(raw.alt, 300), link: str(raw.link, 2000) });
				break;
			case "button":
				blocks.push({ type: "button", label: str(raw.label, 200), url: str(raw.url, 2000) });
				break;
			case "media":
				blocks.push({ type: "media", kind: raw.kind === "audio" ? "audio" : "video", url: str(raw.url, 2000), imageUrl: str(raw.imageUrl, 2000), label: str(raw.label, 200) });
				break;
			case "divider":
				blocks.push({ type: "divider" });
				break;
			default:
				return { error: "Bloco desconhecido." };
		}
	}
	const footer = { company: str(value.footer?.company, 200).trim(), contact: str(value.footer?.contact, 300).trim(), disclaimer: str(value.footer?.disclaimer, 2000).trim() };
	if (!footer.company || !footer.contact || !footer.disclaimer) return { error: "Preencha o rodapé: empresa, contato e aviso legal." };
	return { design: { accent: accentOf({ accent: str(value.accent, 7) } as Design), preheader: str(value.preheader, 200), blocks, footer } };
}
