import { ctaStyle, isColor } from "@/lib/email/cta";
import { cleanRich, richHtml, richText } from "./rich-footer";
import { MAX_BLOCKS, MAX_TEXT, type Block, type Design } from "./types";
import { unsubscribeHeaders } from "./unsubscribe";

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

/** `[word](address)` or a loose address. Variables inside, with their spaces, belong to the address. */
const LINK = /\[([^\]\n]+)\]\(\s*((?:https?:\/\/|mailto:)(?:\{\{[^{}\n]*\}\}|[^\s(){}]|\([^\s()]*\))+|\{\{\s*link_descadastro\s*\}\})\s*\)|(https?:\/\/(?:\{\{[^{}\n]*\}\}|[^\s<>"{}])+|\{\{\s*link_descadastro\s*\}\})/g;

type Piece = { text: string; url: string };

/**
 * Splits what the author wrote into plain text and links, and only then fills the variables: a
 * contact's name comes from a public form, so it must never be able to create a link.
 */
function pieces(value: string, fill: (value: string) => string): Piece[] {
	const out: Piece[] = [];
	let last = 0;
	for (const match of value.matchAll(LINK)) {
		const [whole, label, address, loose] = match;
		// Punctuation closing a sentence is not part of a loose address.
		const raw = loose ? loose.replace(/[.,;:!?)\]'’”]+$/, "") : address;
		const url = safeUrl(fill(raw));
		const leaving = raw.includes("link_descadastro");
		// Where there is no unsubscribe link (ordinary mail), the whole mention is dropped.
		if (!url && !leaving) continue;
		out.push({ text: fill(value.slice(last, match.index)), url: "" });
		if (url) out.push({ text: label ? fill(label) : leaving ? "Descadastre-se aqui" : url, url });
		last = match.index + (loose ? raw.length : whole.length);
	}
	out.push({ text: fill(value.slice(last)), url: "" });
	return out;
}

const textHtml = (value: string, accent: string, fill: (value: string) => string) => pieces(value, fill)
	.map((piece) => (piece.url ? `<a href="${esc(piece.url)}" style="color:${accent};text-decoration:underline">${esc(piece.text)}</a>` : esc(piece.text).replace(/\n/g, "<br>")))
	.join("");

const textPlain = (value: string, fill: (value: string) => string) => pieces(value, fill)
	.map((piece) => (piece.url && piece.text !== piece.url ? `${piece.text} (${piece.url})` : piece.text))
	.join("");

function row(content: string, padding = "10px 32px"): string {
	return `<tr><td style="padding:${padding};${font};font-size:15px;line-height:1.6;color:#202124">${content}</td></tr>`;
}

function image(url: string, alt: string): string {
	return `<img src="${esc(url)}" alt="${esc(alt)}" width="536" style="display:block;width:100%;max-width:536px;height:auto;border:0;border-radius:8px">`;
}

function button(label: string, url: string, accent: string): string {
	return `<a href="${esc(url)}" style="${ctaStyle(accent)}">${esc(label)}</a>`;
}

function renderBlock(block: Block, accent: string, fill: (value: string) => string): string {
	switch (block.type) {
		case "heading":
			return row(`<h1 style="margin:0;font-size:24px;line-height:1.3;color:#202124">${esc(fill(block.text))}</h1>`);
		case "text":
			return row(textHtml(block.text, accent, fill));
		case "image": {
			const src = safeUrl(block.url, { images: true });
			if (!src) return "";
			const link = safeUrl(block.link);
			const img = image(src, fill(block.alt));
			return row(link ? `<a href="${esc(link)}">${img}</a>` : img);
		}
		case "button": {
			const url = safeUrl(block.url);
			return url && block.label.trim() ? row(`<div style="text-align:center">${button(fill(block.label), url, isColor(block.color) ? block.color : accent)}</div>`, "16px 32px") : "";
		}
		case "media": {
			const url = safeUrl(block.url);
			if (!url) return "";
			const label = fill(block.label) || (block.kind === "video" ? "Assistir ao vídeo" : "Ouvir o áudio");
			const cover = safeUrl(block.imageUrl, { images: true });
			const picture = cover ? `<a href="${esc(url)}">${image(cover, label)}</a><br>` : "";
			return row(`<div style="text-align:center">${picture}${button(`▶ ${label}`, url, isColor(block.color) ? block.color : accent)}</div>`, "16px 32px");
		}
		case "divider":
			return row(`<hr style="border:0;border-top:1px solid #dadce0;margin:0">`);
	}
}

const accentOf = (design: Design) => (/^#[0-9a-f]{6}$/i.test(design.accent) ? design.accent : "#0b57d0");

/** The owner's data as variables, from the footer that every e-mail carries. */
export function senderVariables({ firstName, lastName, company, address, zip, city, state, country, contact }: Design["footer"], unsubscribeUrl = ""): Record<string, string> {
	return {
		remetente_nome: firstName ?? "", remetente_sobrenome: lastName ?? "", remetente_empresa: company,
		remetente_endereco: address ?? "", remetente_cep: zip ?? "", remetente_cidade: city ?? "",
		remetente_estado: state ?? "", remetente_pais: country ?? "", remetente_contato: contact,
		ano: String(new Date().getFullYear()),
		link_descadastro: safeUrl(unsubscribeUrl),
	};
}

/** The footer above the legal notice: who signs and where to find them. The first line is the signature. */
function signature({ company, contact, firstName, lastName, address, zip, city, state, country }: Design["footer"]): string[] {
	const person = [firstName, lastName].filter(Boolean).join(" ");
	const place = [address, [city, state].filter(Boolean).join(" - "), zip && `CEP ${zip}`, country].filter(Boolean).join(" · ");
	return [company || person, company ? person : "", place, contact].filter((line): line is string => Boolean(line));
}

const rightsLine = ({ rights, company, firstName, lastName }: Design["footer"]) =>
	rights ? `© ${new Date().getFullYear()} ${company || [firstName, lastName].filter(Boolean).join(" ")}. Todos os direitos reservados.` : "";

const footerLink = (href: string, fill: (value: string) => string, away: string) => (/^\{\{\s*link_descadastro\s*\}\}$/.test(href) ? away : safeUrl(fill(href)));

/** Stands in for each person's own link in previews, so the footer is seen as it will arrive. */
export const PREVIEW_UNSUBSCRIBE = "https://exemplo.invalid/descadastro";

export function renderHtml(design: Design, variables: Record<string, string> = {}, unsubscribeUrl = ""): string {
	// The owner's data wins over a contact field of the same name.
	const all = { ...variables, ...senderVariables(design.footer, unsubscribeUrl) };
	const fill = (value: string) => applyVariables(value, all);
	const accent = accentOf(design);
	const preheader = design.preheader ? `<div style="display:none;max-height:0;overflow:hidden">${esc(fill(design.preheader))}</div>` : "";
	const { disclaimer } = design.footer;
	const rights = rightsLine(design.footer);
	const away = safeUrl(unsubscribeUrl);
	const unsubscribe = away && `<a href="${esc(unsubscribeUrl)}" style="color:#5f6368;text-decoration:underline">Descadastre-se aqui</a>`;
	const written = design.footer.html && richHtml(design.footer.html, { fill, link: (href) => footerLink(href, fill, away), leaving: away });
	// There is always a way out: added unless the person already placed it in the footer.
	const footer = written ? written + (away && !written.includes(`href="${esc(away)}"`) ? `<br>${unsubscribe}` : "") : [
		...signature(design.footer).map((line, index) => (index ? esc(fill(line)) : `<strong>${esc(fill(line))}</strong>`)),
		disclaimer && esc(fill(disclaimer)).replace(/\n/g, "<br>"),
		rights && esc(rights),
		unsubscribe,
	].filter(Boolean).join("<br>");
	return `${preheader}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f6f8fc"><tr><td align="center" style="padding:24px 8px"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background-color:#ffffff;border-top:4px solid ${accent};border-radius:12px"><tr><td style="height:14px"></td></tr>${design.blocks.map((block) => renderBlock(block, accent, fill)).join("")}<tr><td style="padding:20px 32px 28px;border-top:1px solid #e8eaed;${font};font-size:12px;line-height:1.6;color:#5f6368;text-align:center">${footer}</td></tr></table></td></tr></table>`;
}

export function renderText(design: Design, variables: Record<string, string> = {}, unsubscribeUrl = ""): string {
	const all = { ...variables, ...senderVariables(design.footer, unsubscribeUrl) };
	const fill = (value: string) => applyVariables(value, all);
	const parts = design.blocks.map((block) => {
		switch (block.type) {
			case "heading":
				return fill(block.text);
			case "text":
				return textPlain(block.text, fill);
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
	const away = safeUrl(unsubscribeUrl);
	const written = design.footer.html && richText(design.footer.html, { fill, link: (href) => footerLink(href, fill, away), leaving: away });
	const footer = written ? [written] : [...signature(design.footer).map(fill), fill(design.footer.disclaimer), rightsLine(design.footer)];
	return [...parts, "--", ...footer, away && !written?.includes(away) && `Descadastre-se aqui: ${unsubscribeUrl}`].filter(Boolean).join("\n\n");
}

/** The only way to build a marketing message: it refuses to exist without a way out (U1). */
export function renderMarketingEmail(design: Design, subject: string, variables: Record<string, string>, unsubscribeUrl: string) {
	if (!/^https:\/\/\S+$/i.test(unsubscribeUrl)) throw new Error("Mensagem de marketing sem link de descadastro.");
	return {
		subject: applyVariables(subject, { ...variables, ...senderVariables(design.footer, unsubscribeUrl) }),
		html: renderHtml(design, variables, unsubscribeUrl),
		text: renderText(design, variables, unsubscribeUrl),
		headers: unsubscribeHeaders(unsubscribeUrl),
	};
}

const str = (value: unknown, max = MAX_TEXT) => (typeof value === "string" ? value.slice(0, max) : "");

const colorOf = (value: unknown) => (isColor(value) ? { color: value } : {});

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
				blocks.push({ type: "button", label: str(raw.label, 200), url: str(raw.url, 2000), ...colorOf(raw.color) });
				break;
			case "media":
				blocks.push({ type: "media", kind: raw.kind === "audio" ? "audio" : "video", url: str(raw.url, 2000), imageUrl: str(raw.imageUrl, 2000), label: str(raw.label, 200), ...colorOf(raw.color) });
				break;
			case "divider":
				blocks.push({ type: "divider" });
				break;
			default:
				return { error: "Bloco desconhecido." };
		}
	}
	const footer: Design["footer"] = { company: str(value.footer?.company, 200).trim(), contact: str(value.footer?.contact, 300).trim(), disclaimer: str(value.footer?.disclaimer, 2000).trim() };
	for (const key of ["firstName", "lastName", "address", "zip", "city", "state", "country"] as const) {
		const extra = str(value.footer?.[key], key === "address" ? 300 : 100).trim();
		if (extra) footer[key] = extra;
	}
	if (value.footer?.rights === true) footer.rights = true;
	const written = cleanRich(str(value.footer?.html, 8000), (href) => safeUrl(href));
	if (written.text) footer.html = written.html;
	if (!footer.html && (!(footer.company || footer.firstName) || !footer.contact || !footer.disclaimer)) return { error: "Preencha o rodapé: empresa ou nome, contato e aviso legal." };
	return { design: { accent: accentOf({ accent: str(value.accent, 7) } as Design), preheader: str(value.preheader, 200), blocks, footer } };
}
