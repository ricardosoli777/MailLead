import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import test, { after } from "node:test";
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
