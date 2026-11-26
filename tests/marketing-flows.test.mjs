import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test, { after } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = mkdtempSync(join(tmpdir(), "maillead-flows-"));
after(() => rmSync(outDir, { recursive: true, force: true }));

async function bundle(entry, outfile) {
	await build({ entryPoints: [join(root, entry)], outfile: join(outDir, outfile), bundle: true, platform: "node", format: "esm", target: "node22", logLevel: "silent", alias: { "@": join(root, "src") } });
	return import(pathToFileURL(join(outDir, outfile)).href);
}

const store = await bundle("src/lib/marketing/contacts.ts", "contacts.mjs");
const flows = await bundle("src/lib/marketing/flows.ts", "flows.mjs");
const tree = await bundle("src/lib/marketing/flows-utils.ts", "tree.mjs");
const engine = await bundle("src/lib/marketing/engine.ts", "engine.mjs");
const campaigns = await bundle("src/lib/marketing/campaigns.ts", "campaigns.mjs");

function database() {
	const sqlite = new DatabaseSync(":memory:");
	for (const file of readdirSync(join(root, "drizzle-marketing")).sort()) sqlite.exec(readFileSync(join(root, "drizzle-marketing", file), "utf8"));
	const statement = (sql, values = []) => ({
		bind: (...bound) => statement(sql, bound),
		all: async () => ({ results: sqlite.prepare(sql).all(...values) }),
		first: async () => sqlite.prepare(sql).get(...values) ?? null,
		run: async () => ({ meta: { changes: Number(sqlite.prepare(sql).run(...values).changes) } }),
	});
	return {
		prepare: (sql) => statement(sql),
		batch: async (statements) => {
			for (const item of statements) await item.run();
		},
		sqlite,
	};
}

const NOW = Date.parse("2026-11-26T12:00:00Z");
const HOUR = 3600000;
const DAY = 24 * HOUR;
const design = { accent: "#0b57d0", preheader: "", blocks: [{ type: "text", text: "Olá {{nome|cliente}}" }], footer: { company: "KLEAD", contact: "contato@klead.com.br", disclaimer: "Você se cadastrou." } };
const settings = { fromName: "KLEAD", fromEmail: "contato@news.klead.com.br", replyTo: "", origin: "https://mail.klead.com.br", weeklyLimit: 1, hourlyByProvider: { gmail: 1000, outlook: 1000, yahoo: 1000, other: 1000 } };

const email = (id) => ({ id, type: "email", templateId: "tpl", subject: "" });
const wait = (id, amount = 1) => ({ id, type: "wait", amount, unit: "days" });
const tag = (id, name) => ({ id, type: "tag", action: "add", tag: name });

async function setup(steps, { triggerTag = "", goalTag = "" } = {}) {
	const db = database();
	db.sqlite.prepare("INSERT INTO marketing_templates (id, name, subject, design, created_at, updated_at) VALUES ('tpl', 'Boas-vindas', 'Oi', ?, 0, 0)").run(JSON.stringify(design));
	const list = await store.createMailingList(db, "Clientes");
	await engine.writeSetting(db, "sender", settings);
	const id = await flows.createFlow(db, { name: "Funil", listId: list.id, triggerTag, goalTag, steps }, NOW);
	const join_ = (address, now, extra = {}) => store.importContacts(db, [{ line: 1, email: address, name: "Ana", fields: {} }], { listId: list.id, consent: { source: "teste", text: "aceito", consentedAt: now }, origin: "teste", now, ...extra });
	const sent = [];
	const deps = (now) => ({
		quota: async () => ({ max24Hour: 50000, maxPerSecond: 14, sentLast24Hours: 0, sendingEnabled: true }),
		send: async (message) => {
			sent.push(message);
			return { messageId: `m${sent.length}` };
		},
		now: () => now,
		sleep: async () => {},
	});
	// What the five-minute cron does.
	const tick = async (now) => {
		await flows.runFlows(db, now);
		await engine.runEngine(db, deps(now));
	};
	const run = () => db.sqlite.prepare("SELECT status, step_id FROM marketing_flow_runs").all().map((row) => `${row.status}:${row.step_id}`);
	const tags = () => db.sqlite.prepare("SELECT tag FROM marketing_contact_tags ORDER BY tag").all().map((row) => row.tag);
	return { db, list, id, join: join_, sent, tick, run, tags };
}

test("only people who arrive after activation enter, and the steps happen in order (F1, F2)", async () => {
	const { db, id, join: enter, sent, tick, run, tags } = await setup([email("mail1"), wait("wait1", 2), tag("tag01", "fim")]);
	await enter("antiga@gmail.com", NOW - DAY);
	await tick(NOW);
	assert.deepEqual(run(), [], "a draft does nothing");
	assert.equal(await flows.activateFlow(db, id, NOW), null);
	await tick(NOW);
	assert.deepEqual(run(), [], "who was already there does not enter");

	await enter("ana@gmail.com", NOW + 1000);
	await tick(NOW + 2000);
	assert.equal(sent.length, 1);
	assert.equal(sent[0].to, "ana@gmail.com");
	await tick(NOW + HOUR);
	assert.deepEqual(run(), ["active:wait1"]);
	await tick(NOW + DAY);
	assert.deepEqual(tags(), []);
	await tick(NOW + HOUR + 2 * DAY);
	assert.deepEqual(tags(), ["fim"]);
	assert.deepEqual(run(), ["done:null"]);
	await tick(NOW + 10 * DAY);
	assert.equal(sent.length, 1, "nobody walks the funnel twice");
});

test("the wait counts from when the message really left", async () => {
	const { db, id, join: enter, tick, run } = await setup([email("mail1"), wait("wait1")]);
	await flows.activateFlow(db, id, NOW);
	await enter("ana@gmail.com", NOW);
	await flows.runFlows(db, NOW);
	await flows.runFlows(db, NOW + 3 * DAY);
	assert.deepEqual(run(), ["active:mail1"], "still queued, so it does not move on");
	await tick(NOW + 3 * DAY);
	await tick(NOW + 3 * DAY + HOUR);
	assert.deepEqual(run(), ["active:wait1"]);
});

test("a condition takes the yes or the no path and then rejoins (F5)", async () => {
	const condition = { id: "cond1", type: "condition", test: "clicked", tag: "", yes: [tag("yes01", "clicou")], no: [tag("no001", "nao-clicou")] };
	const { db, id, join: enter, tick, run, tags } = await setup([email("mail1"), wait("wait1"), condition, tag("end01", "fim")]);
	await flows.activateFlow(db, id, NOW);
	await enter("ana@gmail.com", NOW);
	await enter("bia@gmail.com", NOW);
	await tick(NOW);
	await tick(NOW + HOUR);
	db.sqlite.prepare("UPDATE marketing_sends SET clicked_at = ? WHERE contact_id = (SELECT id FROM marketing_contacts WHERE email = 'ana@gmail.com')").run(NOW + HOUR);
	await tick(NOW + 2 * DAY);
	assert.deepEqual(tags(), ["clicou", "fim", "fim", "nao-clicou"]);
	assert.deepEqual(run(), ["done:null", "done:null"]);
});

test("two e-mails in a row both arrive despite the weekly campaign limit, and campaigns hide them", async () => {
	const { db, id, join: enter, sent, tick } = await setup([email("mail1"), email("mail2")]);
	await flows.activateFlow(db, id, NOW);
	await enter("ana@gmail.com", NOW);
	await tick(NOW);
	await tick(NOW + HOUR);
	await tick(NOW + 2 * HOUR);
	assert.equal(sent.length, 2);
	assert.ok(sent[0].headers["List-Unsubscribe"]);
	assert.deepEqual(await campaigns.listCampaigns(db), []);
	const [flow] = await flows.listFlows(db);
	assert.equal(flow.stats.mail2.sent, 1);
	assert.equal(flow.counts.done, 1);
});

test("unsubscribing leaves the funnel at once and nothing queued goes out (F3)", async () => {
	const { db, id, join: enter, sent, tick, run } = await setup([email("mail1"), wait("wait1"), email("mail2")]);
	await flows.activateFlow(db, id, NOW);
	await enter("ana@gmail.com", NOW);
	await flows.runFlows(db, NOW);
	const contact = db.sqlite.prepare("SELECT id FROM marketing_contacts").get().id;
	await store.unsubscribeAll(db, contact, "teste", NOW);
	await engine.runEngine(db, { quota: async () => ({ max24Hour: 1000, maxPerSecond: 14, sentLast24Hours: 0, sendingEnabled: true }), send: async () => assert.fail("must not send"), now: () => NOW });
	await tick(NOW + DAY);
	assert.equal(sent.length, 0);
	assert.deepEqual(run(), ["exited:mail1"]);
});

test("a tag starts the funnel only when given after activation", async () => {
	const { db, id, join: enter, tick, tags } = await setup([tag("tag01", "entrou")], { triggerTag: "comprou" });
	await enter("velha@gmail.com", NOW - DAY, { tags: ["comprou"] });
	await flows.activateFlow(db, id, NOW);
	await enter("ana@gmail.com", NOW);
	await tick(NOW + 1);
	assert.deepEqual(tags(), ["comprou"]);
	const ana = db.sqlite.prepare("SELECT id FROM marketing_contacts WHERE email = 'ana@gmail.com'").get().id;
	await store.updateContact(db, ana, { tags: ["comprou"] }, NOW + HOUR);
	await tick(NOW + HOUR + 1);
	assert.deepEqual(tags(), ["comprou", "comprou", "entrou"]);
	// Saving the old contact again keeps the date of the tag it already had.
	const old = db.sqlite.prepare("SELECT id FROM marketing_contacts WHERE email = 'velha@gmail.com'").get().id;
	await store.updateContact(db, old, { tags: ["comprou", "outra"] }, NOW + 2 * HOUR);
	await tick(NOW + 2 * HOUR + 1);
	assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM marketing_flow_runs").get().n, 1);
});

test("a paused funnel holds its people and its queued mail", async () => {
	const { db, id, join: enter, sent, tick, run } = await setup([email("mail1")]);
	await flows.activateFlow(db, id, NOW);
	await enter("ana@gmail.com", NOW);
	await flows.runFlows(db, NOW);
	assert.equal(await flows.saveFlow(db, id, { name: "x", listId: "y", triggerTag: "", steps: [] }), false, "an active funnel is not edited");
	assert.equal(await flows.pauseFlow(db, id), true);
	await tick(NOW + HOUR);
	assert.equal(sent.length, 0);
	await flows.activateFlow(db, id, NOW + 2 * HOUR);
	await tick(NOW + 2 * HOUR);
	await tick(NOW + 3 * HOUR);
	assert.equal(sent.length, 1);
	assert.deepEqual(run(), ["done:null"]);
});

test("removing a step while paused ends who was waiting on it without sending", async () => {
	const { db, list, id, join: enter, sent, tick, run } = await setup([email("mail1")]);
	await flows.activateFlow(db, id, NOW);
	await enter("ana@gmail.com", NOW);
	await flows.runFlows(db, NOW);
	await flows.pauseFlow(db, id);
	await flows.saveFlow(db, id, { name: "Funil", listId: list.id, triggerTag: "", steps: [tag("tag01", "x")] });
	await flows.activateFlow(db, id, NOW + HOUR);
	await tick(NOW + HOUR);
	assert.equal(sent.length, 0);
	assert.deepEqual(run(), ["done:null"]);
	assert.equal(await flows.deleteFlow(db, id), true);
	assert.deepEqual(run(), []);
});

test("a draft may be incomplete; activation refuses it with the reason (F6)", async () => {
	const { db, id } = await setup([{ id: "mail1", type: "email", templateId: "", subject: "" }]);
	assert.match(await flows.activateFlow(db, id, NOW), /modelo/);
	const empty = await setup([]);
	assert.match(await flows.activateFlow(empty.db, empty.id, NOW), /passo/);
	const gone = await setup([{ id: "mail1", type: "email", templateId: "apagado", subject: "" }]);
	assert.match(await flows.activateFlow(gone.db, gone.id, NOW), /apagado/);
	const errors = tree.stepErrors([{ id: "cond1", type: "condition", test: "opened", tag: "", yes: [wait("wait1", 0)], no: [] }, tag("tag01", "")]);
	assert.deepEqual(Object.keys(errors).sort(), ["cond1", "tag01", "wait1"]);
});

test("reaching the goal ends the passage and drops what was queued", async () => {
	const { db, list, id, join: enter, sent, tick, run } = await setup([email("mail1"), wait("wait1"), email("mail2")], { goalTag: "comprou" });
	await flows.activateFlow(db, id, NOW);
	await enter("ana@gmail.com", NOW);
	await tick(NOW);
	await tick(NOW + HOUR);
	await tick(NOW + 2 * DAY);
	db.sqlite.prepare("UPDATE marketing_sends SET status = 'pending', sent_at = NULL WHERE campaign_id LIKE '%mail2'").run();
	const before = sent.length;
	// The sales webhook tags the buyer.
	await store.importContacts(db, [{ line: 1, email: "ana@gmail.com", name: "", fields: {} }], { listId: list.id, consent: null, tags: ["comprou"], origin: "webhook", now: NOW + 3 * DAY });
	await tick(NOW + 3 * DAY);
	assert.equal(sent.length, before);
	assert.deepEqual(run().map((item) => item.split(":")[0]), ["goal"]);
	assert.equal((await flows.listFlows(db))[0].counts.goal, 1);
});

test("every ready-made funnel is a valid draft that only lacks templates", () => {
	for (const recipe of tree.RECIPES) {
		const steps = tree.recipeSteps(recipe.id);
		assert.deepEqual(tree.parseSteps(steps).steps, steps);
		assert.ok(Object.values(tree.stepErrors(steps)).every((problem) => problem === "Escolha um modelo."), recipe.id);
	}
});

test("the tree: insert, move, remove, limits and untrusted input (F4, F5)", () => {
	const condition = { id: "cond1", type: "condition", test: "tag", tag: "a", yes: [], no: [] };
	let steps = [email("mail1"), condition, wait("wait1")];
	const ids = (list) => list.map((step) => step.id).join(",");
	steps = tree.moveStep(steps, "mail1", { parent: "cond1", branch: "yes", index: 0 });
	assert.equal(ids(steps), "cond1,wait1");
	assert.equal(ids(steps[0].yes), "mail1");
	assert.equal(tree.moveStep(steps, "cond1", { parent: "cond1", branch: "no", index: 0 }), steps, "not inside itself");
	assert.equal(ids(tree.moveStep(steps, "cond1", { parent: null, branch: "yes", index: 2 })), "wait1,cond1", "moving down");
	assert.equal(ids(tree.removeStep(steps, "mail1")[0].yes), "");
	const nodes = tree.successors(steps);
	assert.equal(nodes.get("mail1").next, "wait1", "after a side the funnel continues below the condition");
	assert.equal(nodes.get("cond1").no, "wait1");

	assert.ok(tree.parseSteps([{ id: "x", type: "email" }]).error);
	assert.ok(tree.parseSteps([email("same1"), email("same1")]).error);
	assert.ok(tree.parseSteps([{ id: "abcd1", type: "toString" }]).error);
	assert.ok(tree.parseSteps(Array.from({ length: tree.MAX_STEPS + 1 }, (_, index) => email(`mail${index}x`))).error);
	let deep = [];
	for (let level = 0; level <= tree.MAX_DEPTH; level++) deep = [{ id: `deep${level}`, type: "condition", test: "tag", tag: "a", yes: deep, no: [] }];
	assert.ok(tree.parseSteps(deep).error);
	assert.deepEqual(tree.parseSteps([{ ...email("mail1"), extra: 1 }]).steps, [email("mail1")]);
});
