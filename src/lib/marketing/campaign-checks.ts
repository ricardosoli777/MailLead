/** R9: what to look at before sending. These are warnings; the person decides. */
import { unfilled } from "./starters";

const MAX_LINKS = 15;
/** Gmail cuts messages near 102 KB, hiding the footer and its unsubscribe link. */
const CLIP_BYTES = 100 * 1024;

export function contentWarnings(subject: string, html: string, text: string): string[] {
	const warnings: string[] = [];
	const left = unfilled(`${subject}\n${text}`);
	if (left) warnings.push(`Falta preencher: ${left}`);
	const letters = subject.replace(/[^\p{L}]/gu, "");
	if (subject.length > 70) warnings.push("O assunto é longo e será cortado no celular (mais de 70 caracteres).");
	if (letters.length > 5 && letters === letters.toUpperCase()) warnings.push("O assunto está todo em maiúsculas, o que parece spam.");
	if (/[!?]{2,}/.test(subject)) warnings.push("O assunto tem pontuação repetida, o que parece spam.");
	const images = (html.match(/<img /gi) ?? []).length;
	const words = text.split(/\s+/).filter(Boolean).length;
	if (images > 0 && words < images * 40) warnings.push("Há muita imagem para pouco texto. Escreva mais ou use menos imagens.");
	if (new TextEncoder().encode(html).byteLength > CLIP_BYTES) warnings.push("A mensagem é pesada e o Gmail pode cortar o final, onde fica o descadastro.");
	return warnings;
}

export function extractLinks(html: string): string[] {
	const links = new Set<string>();
	for (const [, url] of html.matchAll(/<a [^>]*?href="(https?:\/\/[^"]+)"/gi)) links.add(url.replace(/&amp;/g, "&"));
	return [...links].slice(0, MAX_LINKS);
}

export async function linkWarnings(links: string[], fetcher: typeof fetch = fetch): Promise<string[]> {
	const results = await Promise.all(links.map(async (url) => {
		try {
			const request = (method: string) => fetcher(url, { method, redirect: "follow", signal: AbortSignal.timeout(5000) });
			let response = await request("HEAD");
			if (response.status === 405 || response.status === 501) response = await request("GET");
			return response.status === 404 || response.status === 410 || response.status >= 500 ? `Link com erro ${response.status}: ${url}` : null;
		} catch {
			return `Link que não respondeu: ${url}`;
		}
	}));
	return results.filter((result): result is string => !!result);
}
