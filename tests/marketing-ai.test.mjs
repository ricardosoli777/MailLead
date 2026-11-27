import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import test, { after } from "node:test";
import { deflateRawSync } from "node:zlib";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
// Inside the project so the bundle finds the AI libraries.
const outDir = mkdtempSync(join(root, "node_modules", ".maillead-ai-"));
after(() => rmSync(outDir, { recursive: true, force: true }));

async function bundle(entry, outfile) {
	await build({ entryPoints: [join(root, entry)], outfile: join(outDir, outfile), bundle: true, packages: "external", platform: "node", format: "esm", target: "node22", logLevel: "silent", alias: { "@": join(root, "src") } });
	return import(pathToFileURL(join(outDir, outfile)).href);
}
const ai = await bundle("src/lib/marketing/ai.ts", "ai.mjs");
const utils = await bundle("src/lib/marketing/ai-utils.ts", "utils.mjs");
const flows = await bundle("src/lib/marketing/flows-utils.ts", "flows.mjs");
const starters = await bundle("src/lib/marketing/starters.ts", "starters.mjs");
const render = await bundle("src/lib/marketing/render.ts", "render.mjs");
const docx = await bundle("src/lib/marketing/docx.ts", "docx.mjs");

const mail = (name) => ({ type: "email", name, subject: `Assunto ${name}`, blocks: [{ type: "text", text: "Olá" }] });
const proposal = { name: "Boas-vindas", steps: [mail("um"), { type: "wait", amount: 2 }, { type: "condition", test: "clicked", yes: [{ type: "tag", tag: "Interessado" }], no: [mail("dois")] }] };

test("the model's answer is rebuilt, and links that are not web links are dropped", () => {
	const answer = utils.readAnswer("Claro!\n```json\n" + JSON.stringify({ reply: "Pronto", funnel: { ...proposal, steps: [{ type: "email", name: "x", blocks: [{ type: "button", label: "Ir", url: "javascript:alert(1)" }, { type: "text", text: "oi" }] }, { type: "invented" }] } }) + "\n```");
	assert.equal(answer.reply, "Pronto");
	assert.deepEqual(answer.funnel.steps.map((step) => step.type), ["email"]);
	assert.deepEqual(answer.funnel.steps[0].blocks, [{ type: "text", text: "oi" }]);
	assert.deepEqual(utils.readAnswer("Qual é o seu produto?"), { reply: "Qual é o seu produto?", funnel: null });
	assert.equal(utils.readFunnel({ steps: Array.from({ length: 80 }, () => mail("n")) }).steps.length, flows.MAX_STEPS - 1);
});

test("a proposal becomes a drawing that is ready to activate", () => {
	const saved = [];
	const graph = utils.funnelGraph(utils.readFunnel(proposal), (email) => `tpl_${saved.push(email)}`);
	assert.equal(saved.length, 2);
	assert.deepEqual(flows.graphErrors(graph), {});
	assert.ok(graph.nodes.length <= flows.MAX_STEPS);
});

test("lists only text models, with each provider's own header", async () => {
	const calls = [];
	const server = (ids, status = 200) => async (url, init) => {
		calls.push({ url, init });
		return new Response(JSON.stringify({ data: ids.map((id) => ({ id })) }), { status });
	};
	assert.deepEqual(await ai.listAiModels("openai", "k", server(["gpt-a", "text-embedding-x", "gpt-a-audio", "dall-e"])), ["gpt-a"]);
	assert.deepEqual(await ai.listAiModels("gemini", "k", server(["models/gemini-b", "models/imagen"])), ["gemini-b"]);
	assert.deepEqual(await ai.listAiModels("anthropic", "k", server(["claude-opus-5-5"])), ["claude-opus-5-5"]);
	assert.equal(calls[0].init.headers.Authorization, "Bearer k");
	assert.equal(calls[2].init.headers["x-api-key"], "k");
	assert.ok(calls.every((call) => call.init.redirect === "manual"));
	await assert.rejects(ai.listAiModels("openai", "k", server([], 401)), /recusada/);
});

test("asks Claude with the user's key and reads the proposal; errors never repeat the key", async () => {
	let sent;
	const request = async (url, init) => {
		sent = { url: String(url), headers: new Headers(init.headers), body: JSON.parse(init.body) };
		return new Response(JSON.stringify({ type: "message", id: "msg_1", model: "claude-opus-5-5", role: "assistant", stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({ reply: "Feito", funnel: proposal }) }], usage: { input_tokens: 1, output_tokens: 1 } }), { headers: { "content-type": "application/json" } });
	};
	const input = { provider: "anthropic", key: "segredo-123", model: "claude-opus-5-5", messages: [{ role: "user", content: "faça um funil" }], tags: [], funnel: null };
	const answer = await ai.askAi(input, request);
	assert.equal(answer.reply, "Feito");
	assert.equal(answer.funnel.steps.length, 3);
	assert.match(sent.url, /api\.anthropic\.com\/v1\/messages$/);
	assert.equal(sent.headers.get("x-api-key"), "segredo-123");
	assert.equal(sent.body.fallbacks, "default");
	assert.match(JSON.stringify(sent.body.system), /MailLead/);
	const refuse = async () => new Response(JSON.stringify({ type: "error", error: { type: "invalid_request_error", message: "bad key segredo-123" } }), { status: 400, headers: { "content-type": "application/json" } });
	await assert.rejects(ai.askAi(input, refuse), (error) => error.name === "Error" && !error.message.includes("segredo-123") && /400/.test(error.message));
});

test("only attached pictures can appear in an e-mail", () => {
	const files = utils.readFiles([{ name: "capa.png", url: "https://x.test/capa" }, { name: "x", url: "javascript:1" }]);
	assert.equal(files.length, 1);
	const funnel = utils.readFunnel({ steps: [{ type: "email", name: "a", blocks: [{ type: "image", url: "https://x.test/capa" }, { type: "image", url: "https://inventada.test/i.png" }, { type: "text", text: "oi" }] }] });
	assert.deepEqual(utils.keepAttachedImages(funnel, files).steps[0].blocks.map((block) => block.url ?? block.type), ["https://x.test/capa", "text"]);
});

test("documents are sent to the model to be read, and Word files become text", async () => {
	const documents = utils.readDocuments([{ name: "guia.pdf", kind: "pdf", data: Buffer.from("%PDF-1.4 x").toString("base64") }, { name: "notas.txt", kind: "text", text: "Preço: 10" }, { name: "x", kind: "pdf", data: "PHNjcmlwdD4=" }]);
	assert.equal(documents.length, 2);
	assert.equal(utils.documentsProblem(documents), null);
	assert.match(utils.documentsProblem([{ name: "g", kind: "text", text: "a".repeat(utils.MAX_DOCUMENT_TEXT + 1) }]), /100 mil/);
	let body;
	const request = async (_url, init) => {
		body = JSON.parse(init.body);
		return new Response(JSON.stringify({ type: "message", id: "m", model: "claude-opus-5-5", role: "assistant", stop_reason: "end_turn", content: [{ type: "text", text: '{"reply":"ok"}' }], usage: { input_tokens: 1, output_tokens: 1 } }), { headers: { "content-type": "application/json" } });
	};
	await ai.askAi({ provider: "anthropic", key: "k", model: "claude-opus-5-5", messages: [{ role: "user", content: "use o guia" }], tags: [], funnel: null, documents }, request);
	assert.deepEqual(body.messages[0].content.map((part) => part.type), ["document", "text", "text"]);
	assert.match(body.messages[0].content[1].text, /Preço: 10/);

	const zip = (name, content) => {
		const data = deflateRawSync(Buffer.from(content));
		const file = Buffer.from(name);
		const local = Buffer.alloc(30);
		local.writeUInt32LE(0x04034b50, 0);
		local.writeUInt16LE(8, 8);
		local.writeUInt16LE(file.length, 26);
		const central = Buffer.alloc(46);
		central.writeUInt32LE(0x02014b50, 0);
		central.writeUInt16LE(8, 10);
		central.writeUInt32LE(data.length, 20);
		central.writeUInt16LE(file.length, 28);
		const end = Buffer.alloc(22);
		end.writeUInt32LE(0x06054b50, 0);
		end.writeUInt16LE(1, 10);
		end.writeUInt32LE(30 + file.length + data.length, 16);
		return new Uint8Array(Buffer.concat([local, file, data, central, file, end]));
	};
	assert.equal(await docx.docxText(zip("word/document.xml", "<w:p><w:t>Olá &amp; bem-vindo</w:t></w:p><w:p><w:t>Fim</w:t></w:p>")), "Olá & bem-vindo\nFim");
	await assert.rejects(docx.docxText(new Uint8Array(40)), /Word/);
});

test("OpenAI and Gemini receive the PDF too", async () => {
	const data = Buffer.from("%PDF-1.4 x").toString("base64");
	for (const [provider, model] of [["openai", "gpt-x"], ["gemini", "gemini-x"]]) {
		let sent = "";
		const request = async (_url, init) => {
			sent = init.body;
			return new Response("{}", { status: 400, headers: { "content-type": "application/json" } });
		};
		await assert.rejects(ai.askAi({ provider, key: "k", model, messages: [{ role: "user", content: "oi" }], tags: [], funnel: null, documents: [{ name: "g.pdf", kind: "pdf", data }] }, request), /400/);
		assert.ok(sent.includes(`data:application/pdf;base64,${data}`), provider);
	}
});

test("every ready-made e-mail is valid, unique and flagged until it is filled in", () => {
	const keys = starters.STARTERS.map((item) => item.key);
	assert.equal(new Set(keys).size, keys.length);
	for (const item of starters.STARTERS) {
		assert.ok(!("error" in render.parseDesign(item.design)), item.key);
		assert.ok(starters.CATEGORIES.some((category) => category.id === item.category), item.key);
		assert.ok(item.use && item.subject, item.key);
	}
	assert.equal(starters.unfilled("Olá [NOME DO PRODUTO]"), "[NOME DO PRODUTO]");
	assert.equal(starters.unfilled("Botão (https://exemplo.com)"), "https://exemplo.com");
	assert.equal(starters.unfilled("Veja [Aqui Está](https://site.com) e {{nome|você}} [1]"), null);
});
