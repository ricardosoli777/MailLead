/**
 * The footer written in the editor. It is rebuilt from a short list of tags and styles, so nothing
 * else reaches the message; variables are filled in the text only after the tags are read, so a
 * contact's name can never become markup.
 */
const TAGS = new Set(["a", "b", "strong", "i", "em", "u", "s", "strike", "br", "div", "p", "span", "font", "ul", "ol", "li"]);
const BLOCKS = new Set(["div", "p", "li", "ul", "ol"]);
const STYLES: Record<string, RegExp> = {
	"text-align": /^(left|center|right|justify)$/,
	color: /^(#[0-9a-f]{3,6}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\))$/i,
	"font-size": /^(x-small|small|medium|large|x-large|\d{1,2}px)$/,
	"font-weight": /^(bold|normal|[1-9]00)$/,
	"font-style": /^(italic|normal)$/,
	"text-decoration": /^(underline|line-through|underline line-through|none)$/,
	"text-decoration-line": /^(underline|line-through|underline line-through|none)$/,
};
const TOKEN = /<!--[\s\S]*?-->|<\/?[a-zA-Z][^<>]*>|[^<]+|</g;
const ATTRIBUTE = /([a-zA-Z-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
const LEAVING = /(\{\{\s*link_descadastro\s*\}\})/;

const escapes: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (value: string) => value.replace(/[&<>"']/g, (char) => escapes[char]);
const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const decode = (value: string) => value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, name: string) => {
	if (name[0] !== "#") return named[name.toLowerCase()] ?? whole;
	const code = name[1].toLowerCase() === "x" ? parseInt(name.slice(2), 16) : Number(name.slice(1));
	return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
});

export type RichOptions = {
	/** Fills the variables of a piece of text. */
	fill: (value: string) => string;
	/** The address a link may point to, or "" to keep only its words. */
	link: (href: string) => string;
	/** When set, a loose `{{link_descadastro}}` becomes this link ("" drops it). */
	leaving?: string;
};

function walk(input: string, { fill, link, leaving }: RichOptions): { html: string; text: string } {
	let html = "";
	let text = "";
	let silent = "";
	const open: { name: string; close: string; url: string; from: number }[] = [];
	const newline = () => { if (text && !text.endsWith("\n")) text += "\n"; };
	const shut = () => {
		const item = open.pop()!;
		html += item.close;
		if (item.url && text.slice(item.from) !== item.url) text += ` (${item.url})`;
		if (BLOCKS.has(item.name)) newline();
	};
	for (const [token] of input.matchAll(TOKEN)) {
		if (token.startsWith("<!--")) continue;
		const tag = /^<(\/?)([a-zA-Z][a-zA-Z0-9]*)([\s\S]*)>$/.exec(token);
		if (!tag) {
			if (silent) continue;
			for (const part of leaving === undefined ? [decode(token)] : decode(token).split(LEAVING)) {
				if (leaving !== undefined && LEAVING.test(part) && !open.some((item) => item.url)) {
					if (!leaving) continue;
					html += `<a href="${esc(leaving)}" style="color:#5f6368;text-decoration:underline">Descadastre-se aqui</a>`;
					text += `Descadastre-se aqui: ${leaving}`;
					continue;
				}
				const filled = fill(part);
				html += esc(filled);
				text += filled;
			}
			continue;
		}
		const closing = tag[1] === "/";
		const name = tag[2].toLowerCase();
		if (name === "script" || name === "style") {
			silent = closing ? "" : name;
			continue;
		}
		if (silent || !TAGS.has(name)) continue;
		if (name === "br") {
			html += "<br>";
			text += "\n";
			continue;
		}
		if (closing) {
			const at = open.map((item) => item.name).lastIndexOf(name);
			if (at >= 0) while (open.length > at) shut();
			continue;
		}
		if (open.length >= 30) continue;
		const attributes = Object.fromEntries([...tag[3].matchAll(ATTRIBUTE)].map((match) => [match[1].toLowerCase(), decode(match[2] ?? match[3] ?? "")]));
		const styles: string[] = [];
		for (const rule of (attributes.style ?? "").split(";")) {
			const [property, ...rest] = rule.split(":");
			const key = property.trim().toLowerCase();
			const value = rest.join(":").trim();
			if (STYLES[key]?.test(value)) styles.push(`${key}:${value}`);
		}
		if (name === "font" && STYLES.color.test(attributes.color ?? "")) styles.push(`color:${attributes.color}`);
		if (name === "div" || name === "p") {
			const align = (attributes.align ?? "").toLowerCase();
			if (STYLES["text-align"].test(align)) styles.push(`text-align:${align}`);
		}
		const url = name === "a" ? link(attributes.href ?? "") : "";
		// A link without a usable address keeps its words only.
		const out = name === "font" || (name === "a" && !url) ? "span" : name;
		const base = name === "p" || name === "ul" || name === "ol" ? ["margin:0"] : url ? ["color:#5f6368", "text-decoration:underline"] : [];
		const style = [...base, ...styles].join(";");
		if (BLOCKS.has(name)) newline();
		html += `<${out}${url ? ` href="${esc(url)}"` : ""}${style ? ` style="${esc(style)}"` : ""}>`;
		open.push({ name, close: `</${out}>`, url, from: text.length });
	}
	while (open.length) shut();
	return { html, text: text.trim() };
}

export const richHtml = (input: string, options: RichOptions) => walk(input, options).html;
export const richText = (input: string, options: RichOptions) => walk(input, options).text;

/** What is stored: the same allowed tags, with the variables still written as codes. */
export const cleanRich = (input: string, link: (href: string) => string) => walk(input, { fill: (value) => value, link: (href) => (LEAVING.test(href) ? href : link(href)) });
