import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test, { after } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = mkdtempSync(join(tmpdir(), "maillead-marketing-"));
after(() => rmSync(outDir, { recursive: true, force: true }));

async function bundle(entry, outfile) {
	await build({ entryPoints: [join(root, entry)], outfile: join(outDir, outfile), bundle: true, platform: "node", format: "esm", target: "node22", logLevel: "silent", alias: { "@": join(root, "src") } });
	return import(pathToFileURL(join(outDir, outfile)).href);
}

const { renderHtml, renderText, parseDesign, applyVariables } = await bundle("src/lib/marketing/render.ts", "render.mjs");
const { STARTERS } = await bundle("src/lib/marketing/starters.ts", "starters.mjs");

const footer = { company: "Acme", contact: "oi@acme.test", disclaimer: "Aviso" };
const design = (blocks) => ({ accent: "#0b57d0", preheader: "", blocks, footer });

test("T8: variables use the value or the fallback and never show raw", () => {
	assert.equal(applyVariables("Oi {{nome|cliente}}", { nome: "Ana" }), "Oi Ana");
	assert.equal(applyVariables("Oi {{nome|cliente}}"), "Oi cliente");
	assert.equal(applyVariables("Oi {{ nome }}!"), "Oi !");
});

test("user content is escaped and unsafe links are dropped", () => {
	const html = renderHtml(design([
		{ type: "text", text: '<script>alert(1)</script>' },
		{ type: "button", label: "x", url: "javascript:alert(1)" },
		{ type: "image", url: "data:image/png;base64,AAAA", alt: "a" },
		{ type: "image", url: 'https://a.test/i.png" onerror="x', alt: '"><b>' },
	]), {});
	assert.doesNotMatch(html, /<script|javascript:|data:image|onerror="|<b>/);
	assert.match(html, /&lt;script&gt;/);
});

test("T2: video and audio become a cover and a link, never embedded media", () => {
	const html = renderHtml(design([{ type: "media", kind: "video", url: "https://v.test/1", imageUrl: "https://v.test/c.png", label: "Ver" }]));
	assert.match(html, /href="https:\/\/v\.test\/1"/);
	assert.doesNotMatch(html, /<video|<audio|<iframe/);
});

test("T4: a design without a complete footer is refused", () => {
	assert.ok(parseDesign({ blocks: [], footer: { company: "Acme", contact: "", disclaimer: "x" } }).error);
	assert.ok(parseDesign({ blocks: [{ type: "nope" }], footer }).error);
	assert.ok(parseDesign({ blocks: [], footer }).design);
});

test("T5 and T6: every starter template renders to HTML and plain text", () => {
	for (const key of ["comercial", "proposta", "comunicado", "newsletter"]) assert.ok(STARTERS.some((s) => s.key === key), key);
	for (const starter of STARTERS) {
		assert.ok(parseDesign(starter.design).design);
		assert.doesNotMatch(renderHtml(starter.design) + renderText(starter.design), /\{\{/);
		assert.match(renderText(starter.design), /Nome da sua empresa/);
	}
});

test("links inside the text: words and loose addresses, in both versions", () => {
	const blocks = [{ type: "text", text: "Veja [o material](https://a.test/p?x=1&y=2).\nOu https://b.test/pagina. Fale: [aqui](mailto:oi@acme.test) [wiki](https://c.test/A_(b))" }];
	const html = renderHtml(design(blocks));
	assert.match(html, /<a href="https:\/\/a\.test\/p\?x=1&amp;y=2" [^>]*>o material<\/a>\./);
	assert.match(html, /<a href="https:\/\/b\.test\/pagina" [^>]*>https:\/\/b\.test\/pagina<\/a>\. Fale/);
	assert.match(html, /href="mailto:oi@acme\.test"/);
	assert.match(html, /href="https:\/\/c\.test\/A_\(b\)"/);
	assert.match(html, /<br>/);
	const text = renderText(design(blocks));
	assert.match(text, /Veja o material \(https:\/\/a\.test\/p\?x=1&y=2\)\./);
	assert.match(text, /Ou https:\/\/b\.test\/pagina\. Fale: aqui \(mailto:oi@acme\.test\)/);
});

test("a contact's own data never becomes a link, and unsafe addresses stay as text", () => {
	const block = [{ type: "text", text: "Oi {{nome|cliente}}, [sim](https://a.test/?n={{id|0}}) [não](javascript:alert(1))" }];
	const html = renderHtml(design(block), { nome: "[Ganhe](https://golpe.test) https://golpe.test", id: "7" });
	assert.doesNotMatch(html, /href="https:\/\/golpe/);
	assert.match(html, /href="https:\/\/a\.test\/\?n=7"/);
	assert.doesNotMatch(html, /href="javascript/);
});
