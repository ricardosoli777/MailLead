import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test, { after } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = mkdtempSync(join(tmpdir(), "maillead-whatsapp-"));
after(() => rmSync(outDir, { recursive: true, force: true }));

await build({ entryPoints: [join(root, "src/lib/marketing/whatsapp.ts")], outfile: join(outDir, "whatsapp.mjs"), bundle: true, platform: "node", format: "esm", target: "node22", logLevel: "silent" });
const wa = await import(pathToFileURL(join(outDir, "whatsapp.mjs")).href);

const config = { url: "https://go.example.test", token: "token-da-instancia" };

function server(status = 200, body = { message: "success" }) {
	const calls = [];
	const request = async (url, init) => {
		calls.push({ url, init });
		return new Response(JSON.stringify(body), { status });
	};
	return { calls, request };
}

test("only https addresses, and Brazilian numbers get the country code", () => {
	assert.equal(wa.readServerUrl(" https://go.example.test/ "), "https://go.example.test");
	assert.equal(wa.readServerUrl("https://go.example.test/manager/login"), "https://go.example.test");
	assert.equal(wa.readServerUrl("http://go.example.test"), null);
	assert.equal(wa.readServerUrl("https://user:senha@go.example.test"), null);
	assert.equal(wa.readServerUrl("go"), null);
	assert.equal(wa.readPhone("(11) 99999-9999"), "5511999999999");
	assert.equal(wa.readPhone("+55 11 99999-9999"), "5511999999999");
	assert.equal(wa.readPhone("+1 415 555 0100"), "14155550100");
	assert.equal(wa.readPhone("999"), null);
});

test("sends with the instance token, never follows a redirect, and only calls status and send", async () => {
	const { calls, request } = server(200, { data: { Connected: true, LoggedIn: true, Name: "Loja" } });
	assert.deepEqual(await wa.whatsAppStatus(config, request), { connected: true, name: "Loja" });
	await wa.sendWhatsAppText(config, "5511999999999", "oi", request);
	await wa.sendWhatsAppAudio(config, "5511999999999", new File([new Uint8Array([1, 2, 3])], "gravacao.webm", { type: "audio/webm" }), request);
	assert.deepEqual(calls.map((call) => call.url.replace(config.url, "")), ["/instance/status", "/send/text", "/send/media"]);
	for (const call of calls) {
		assert.equal(call.init.headers.apikey, config.token);
		assert.equal(call.init.redirect, "manual");
	}
	assert.deepEqual(JSON.parse(calls[1].init.body), { number: "5511999999999", text: "oi" });
	const form = calls[2].init.body;
	assert.equal(form.get("type"), "audio");
	assert.equal(form.get("number"), "5511999999999");
	assert.equal(form.get("file").name, "gravacao.webm");
});

test("failures are explained without leaking the token", async () => {
	await assert.rejects(wa.whatsAppStatus(config, server(401, { error: "not authorized" }).request), /token/);
	await assert.rejects(wa.sendWhatsAppText(config, "5511999999999", "oi", server(500, { error: "client disconnected" }).request), /client disconnected/);
	await assert.rejects(wa.sendWhatsAppText(config, "5511999999999", "oi", server(302, null).request), /resposta 302/);
	await assert.rejects(wa.whatsAppStatus(config, async () => { throw new Error(config.token); }), (error) => !error.message.includes(config.token));
});
