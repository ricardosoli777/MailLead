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
const testing = await bundle("src/lib/marketing/flow-test.ts", "flow-test.mjs");
const campaigns = await bundle("src/lib/marketing/campaigns.ts", "campaigns.mjs");
const signature = await bundle("src/lib/marketing/footer.ts", "footer.mjs");

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
	const id = await flows.createFlow(db, { name: "Funil", listId: list.id, triggerTag, goalTag, graph: tree.fromTree(steps) }, NOW);
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
	assert.equal(await flows.saveFlow(db, id, { name: "x", listId: "y", triggerTag: "", graph: tree.emptyGraph() }), false, "an active funnel is not edited");
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
	await flows.saveFlow(db, id, { name: "Funil", listId: list.id, triggerTag: "", graph: tree.fromTree([tag("tag01", "x")]) });
	await flows.activateFlow(db, id, NOW + HOUR);
	await tick(NOW + HOUR);
	assert.equal(sent.length, 0);
	assert.deepEqual(run(), ["done:null"]);
	assert.equal(await flows.deleteFlow(db, id), true);
	assert.deepEqual(run(), []);
});

test("a draft may be incomplete; activation refuses it with the reason (F6)", async () => {
	const { db, id } = await setup([{ id: "mail1", type: "email", templateId: "", subject: "" }]);
	assert.match(await flows.activateFlow(db, id, NOW), /conteúdo/);
	const empty = await setup([]);
	assert.match(await flows.activateFlow(empty.db, empty.id, NOW), /passo/);
	const gone = await setup([{ id: "mail1", type: "email", templateId: "apagado", subject: "" }]);
	assert.match(await flows.activateFlow(gone.db, gone.id, NOW), /apagado/);
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

test("every ready-made funnel is a connected drawing that only lacks content", () => {
	for (const recipe of tree.RECIPES) {
		const graph = tree.recipeGraph(recipe.id);
		assert.deepEqual(tree.parseGraph(graph).graph, graph, recipe.id);
		const problems = Object.values(tree.graphErrors(graph));
		if (!graph.nodes.length) assert.deepEqual(problems, ["Ligue o Início ao primeiro passo."]);
		else assert.ok(problems.every((problem) => problem.startsWith("Falta o conteúdo")), `${recipe.id}: ${problems}`);
	}
});

const box = (step, x = 0, y = 0) => ({ ...step, x, y });
const line = (from, to, branch = "") => ({ from, to, branch });
const mail = (id) => ({ id, type: "email", name: "", templateId: "tpl", subject: "" });
const check = (id, test_ = "clicked") => ({ id, type: "condition", test: test_, tag: "" });
const graphOf = (nodes, edges) => ({ start: { x: 0, y: 0 }, nodes: nodes.map((node) => box(node)), edges });

test("the drawing is checked: loose boxes, open paths, lines going back, e-mail before a click test (F6)", () => {
	const errors = (nodes, edges) => tree.graphErrors(graphOf(nodes, edges));
	assert.match(errors([tag("tag01", "x")], []).start, /Início/);
	assert.match(errors([tag("tag01", "x")], []).tag01, /solta/);
	assert.match(errors([mail("mail1"), check("cond1")], [line("start", "mail1"), line("mail1", "cond1"), line("cond1", "mail1", "yes")]).cond1, /volta|dois/);
	assert.match(errors([tag("tag01", "a"), tag("tag02", "b")], [line("start", "tag01"), line("tag01", "tag02"), line("tag02", "tag01")]).tag02, /volta/);
	const open = errors([mail("mail1"), check("cond1"), tag("tag01", "x")], [line("start", "mail1"), line("mail1", "cond1"), line("cond1", "tag01", "yes")]);
	assert.match(open.cond1, /Sim e Não/);
	// One path reaches the condition without passing through an e-mail.
	const early = errors(
		[{ ...check("cond0", "tag"), tag: "a" }, mail("mail1"), check("cond1"), tag("tag01", "x")],
		[line("start", "cond0"), line("cond0", "mail1", "yes"), line("cond0", "cond1", "no"), line("mail1", "cond1"), line("cond1", "tag01", "yes"), line("cond1", "tag01", "no")],
	);
	assert.match(early.cond1, /e-mail antes/);
	assert.deepEqual(errors([mail("mail1"), check("cond1"), tag("tag01", "x")], [line("start", "mail1"), line("mail1", "cond1"), line("cond1", "tag01", "yes"), line("cond1", "tag01", "no")]), {});
});

test("drawing: connect, insert in a line, remove and arrange (F4, F5)", () => {
	let graph = graphOf([mail("mail1"), tag("tag01", "x")], [line("start", "mail1"), line("mail1", "tag01")]);
	assert.equal(tree.connect(graph, "tag01", "", "mail1"), graph, "not back up the path");
	assert.equal(tree.connect(graph, "tag01", "", "start"), graph);
	assert.equal(tree.connect(graph, "mail1", "yes", "tag01"), graph, "only a condition has two sides");
	assert.deepEqual(tree.openOutput(graph), { from: "tag01", branch: "" });

	graph = tree.insertOnEdge(graph, { from: "mail1", branch: "" }, tree.createStep("wait", "wait1"));
	assert.deepEqual([tree.successors(graph).get("mail1").next, tree.successors(graph).get("wait1").next], ["wait1", "tag01"]);
	assert.equal(tree.insertOnEdge(graph, { from: "mail1", branch: "" }, tree.createStep("exit")), graph);
	assert.equal(tree.successors(tree.removeNodes(graph, ["wait1"])).get("mail1").next, "tag01", "the path stays joined");

	const branched = tree.layout(graphOf(
		[mail("mail1"), check("cond1"), tag("yes01", "s"), tag("no001", "n"), tag("loose", "z")],
		[line("start", "mail1"), line("mail1", "cond1"), line("cond1", "no001", "no"), line("cond1", "yes01", "yes")],
	));
	const at = Object.fromEntries(branched.nodes.map((node) => [node.id, node]));
	assert.ok(at.mail1.y < at.cond1.y && at.cond1.y < at.yes01.y);
	assert.equal(at.yes01.y, at.no001.y);
	assert.ok(at.yes01.x < at.no001.x, "yes is on the left");
	assert.ok(at.loose.x > at.no001.x - 1, "a loose box goes to the side");
});

test("untrusted drawings are rebuilt or refused", () => {
	const nodes = [box(mail("mail1")), box(tag("tag01", "X "))];
	const { graph } = tree.parseGraph({ nodes: [{ ...nodes[0], extra: 1 }, nodes[1]], edges: [line("start", "mail1"), line("start", "tag01"), line("mail1", "none1"), line("mail1", "start"), line("mail1", "tag01", "yes")] });
	assert.deepEqual(graph.nodes[0], box(mail("mail1")));
	assert.equal(graph.nodes[1].tag, "x");
	assert.deepEqual(graph.edges, [line("start", "mail1")]);
	assert.ok(tree.parseGraph({ nodes: [{ id: "x", type: "email" }] }).error);
	assert.ok(tree.parseGraph({ nodes: [mail("same1"), mail("same1")] }).error);
	assert.ok(tree.parseGraph({ nodes: [{ id: "abcd1", type: "toString" }] }).error);
	assert.ok(tree.parseGraph({ nodes: [mail("start")] }).error);
	assert.ok(tree.parseGraph({ nodes: Array.from({ length: tree.MAX_STEPS + 1 }, (_, index) => mail(`mail${index}x`)) }).error);
});

test("a funnel saved by the first builder keeps working", async () => {
	const { db, id, join: enter, tick, run, tags } = await setup([]);
	const old = [email("mail1"), { id: "cond1", type: "condition", test: "clicked", tag: "", yes: [], no: [tag("no001", "nao-clicou")] }];
	db.sqlite.prepare("UPDATE marketing_flows SET steps = ? WHERE id = ?").run(JSON.stringify(old), id);
	const [flow] = await flows.listFlows(db);
	assert.deepEqual(tree.graphErrors(flow.graph), {});
	assert.equal(await flows.activateFlow(db, id, NOW), null);
	await enter("ana@gmail.com", NOW);
	await tick(NOW);
	await tick(NOW + HOUR);
	assert.deepEqual(tags(), ["nao-clicou"]);
	assert.deepEqual(run(), ["done:null"]);
});

const audio = (id) => ({ id, type: "whatsapp", audioId: "aud1" });

async function whatsAppSetup() {
	const context = await setup([audio("step0001"), tag("step0002", "ouviu")]);
	const { db, id } = context;
	db.sqlite.prepare("INSERT INTO marketing_audio (id, name, content_type, size, created_at) VALUES ('aud1', 'a.ogg', 'audio/ogg', 1, 0)").run();
	await engine.writeSetting(db, "whatsapp", { url: "https://go.example.com", token: "t" });
	assert.equal(await flows.activateFlow(db, id, NOW), null);
	const heard = [];
	const sender = { connected: async () => true, send: async (phone, audioId) => heard.push([phone, audioId]) };
	const allow = (address, phone) => db.sqlite.prepare("INSERT INTO marketing_whatsapp (contact_id, phone, source, text, consented_at) SELECT id, ?, 'f', 't', 0 FROM marketing_contacts WHERE email = ?").run(phone, address);
	const tagged = () => db.sqlite.prepare("SELECT COUNT(*) AS n FROM marketing_contact_tags WHERE tag = 'ouviu'").get().n;
	return { ...context, join_: context.join, sender, heard, allow, tagged };
}

test("an audio step reaches only who authorised WhatsApp, once, and the others walk on", async () => {
	const { db, join_, sender, heard, allow, tagged } = await whatsAppSetup();
	await join_("ana@gmail.com", NOW);
	await join_("bia@gmail.com", NOW);
	allow("ana@gmail.com", "5511999990000");
	await flows.runFlows(db, NOW + 1, 100, sender);
	await flows.runFlows(db, NOW + 2, 100, sender);
	assert.deepEqual(heard, [["5511999990000", "aud1"]]);
	assert.equal(tagged(), 2);
});

test("audio waits outside daytime, while disconnected and beyond five in five minutes", async () => {
	const { db, join_, sender, heard, allow, tagged } = await whatsAppSetup();
	for (let index = 0; index < 7; index++) {
		await join_(`p${index}@gmail.com`, NOW);
		allow(`p${index}@gmail.com`, `551199999000${index}`);
	}
	await flows.runFlows(db, NOW + 1, 100, { ...sender, connected: async () => false });
	await flows.runFlows(db, NOW + 2, 100, null);
	// 12h UTC is 9h in Brasilia; fourteen hours later it is 23h.
	await flows.runFlows(db, NOW + 14 * HOUR, 100, sender);
	assert.equal(heard.length, 0);
	assert.equal(tagged(), 0);
	await flows.runFlows(db, NOW + DAY, 100, sender);
	assert.equal(heard.length, 5);
	await flows.runFlows(db, NOW + DAY + 60_000, 100, sender);
	assert.equal(heard.length, 5, "the next minute is still inside the window");
	await flows.runFlows(db, NOW + DAY + 6 * 60_000, 100, sender);
	assert.equal(heard.length, 7);
	assert.equal(tagged(), 7);
});

test("a stopped number gets nothing, and a refused audio is not tried again", async () => {
	const { db, join_, sender, allow, tagged } = await whatsAppSetup();
	await join_("ana@gmail.com", NOW);
	await join_("bia@gmail.com", NOW);
	allow("ana@gmail.com", "5511999990000");
	allow("bia@gmail.com", "5511999990001");
	await store.stopWhatsApp(db, db.sqlite.prepare("SELECT id FROM marketing_contacts WHERE email = 'ana@gmail.com'").get().id);
	let attempts = 0;
	const failing = { ...sender, send: async () => { attempts++; throw new Error("recusado"); } };
	const log = console.error;
	console.error = () => {};
	await flows.runFlows(db, NOW + 1, 100, failing);
	await flows.runFlows(db, NOW + 2, 100, failing);
	console.error = log;
	assert.equal(attempts, 1);
	assert.equal(tagged(), 2);
});

test("a funnel with audio needs the connection and the recording", async () => {
	const { db, id } = await setup([audio("step0001")]);
	assert.match(await flows.activateFlow(db, id, NOW), /WhatsApp/);
	await engine.writeSetting(db, "whatsapp", { url: "https://go.example.com", token: "t" });
	assert.match(await flows.activateFlow(db, id, NOW), /áudio/);
});

test("short waits happen inside the pass; long ones are left for later", async () => {
	const short = (id, amount) => ({ id, type: "wait", amount, unit: "seconds" });
	const { db, id, join: enter, run, tags } = await setup([short("wait1", 20), tag("tag01", "um"), short("wait2", 20), tag("tag02", "dois"), { id: "wait3", type: "wait", amount: 2, unit: "minutes" }, tag("tag03", "tres")]);
	await flows.activateFlow(db, id, NOW);
	await enter("ana@gmail.com", NOW);
	const slept = [];
	const sleep = async (ms) => slept.push(ms);
	await flows.runFlows(db, NOW, 100, null, sleep);
	assert.deepEqual(slept, [20_000, 20_000]);
	assert.deepEqual(tags(), ["dois", "um"]);
	assert.deepEqual(run(), ["active:wait3"]);
	await flows.runFlows(db, NOW + 60_000, 100, null, sleep);
	assert.deepEqual(run(), ["active:wait3"]);
	await flows.runFlows(db, NOW + 40_000 + 120_000, 100, null, sleep);
	assert.deepEqual(run(), ["done:null"]);
	assert.equal(slept.length, 2);
});

test("the owner can test a live funnel with their own data, again and again", async () => {
	const { db, id, tick, sent, tags } = await setup([email("mail1"), audio("step0001"), tag("tag01", "fim")]);
	db.sqlite.prepare("INSERT INTO marketing_audio (id, name, content_type, size, created_at) VALUES ('aud1', 'a.ogg', 'audio/ogg', 1, 0)").run();
	await engine.writeSetting(db, "whatsapp", { url: "https://go.example.com", token: "t" });
	const me = { name: "Eu", email: "Eu@Gmail.com", phone: "11 99999-0000" };
	assert.match((await testing.startFlowTest(db, id, me, NOW)).error, /Ative/);
	await flows.activateFlow(db, id, NOW);
	assert.match((await testing.startFlowTest(db, id, { ...me, phone: "" }, NOW)).error, /WhatsApp/);

	const heard = [];
	const sender = { connected: async () => true, send: async (phone) => heard.push(phone) };
	for (const round of [0, 1]) {
		const start = NOW + round * HOUR;
		assert.equal((await testing.startFlowTest(db, id, me, start)).error, null);
		await tick(start + 1000);
		await flows.runFlows(db, start + 60_000, 100, sender);
		const result = await testing.flowTestStatus(db, id, "eu@gmail.com");
		// The test is still there after leaving the screen.
		assert.equal((await testing.currentFlowTest(db, id)).email, "eu@gmail.com");
		assert.equal((await flows.listFlows(db))[0].testing, true);
		assert.equal(result.done, true);
		assert.deepEqual(result.steps.map((step) => step.text), ["enviado", "enviado"]);
		assert.deepEqual(tags(), ["fim"]);
	}
	assert.equal(sent.length, 2);
	assert.deepEqual(heard, ["5511999990000", "5511999990000"]);
	await testing.stopFlowTest(db, id);
	assert.equal(await testing.currentFlowTest(db, id), null);
	assert.equal((await flows.listFlows(db))[0].testing, false);
});

test("the footer filled in once reaches the templates and what is still going out", async () => {
	const { db, id, join: enter, sent, tick } = await setup([wait("wait1"), email("mail1")]);
	await flows.activateFlow(db, id, NOW);
	await enter("ana@gmail.com", NOW);
	assert.ok((await signature.saveFooter(db, { company: "", contact: "x", disclaimer: "y" })).error);
	const saved = await signature.saveFooter(db, { company: "Rica Cursos", contact: "oi@rica.test", disclaimer: "Você se cadastrou." });
	assert.deepEqual([saved.templates, saved.sending], [1, 1]);
	assert.equal((await signature.withFooter(db, design)).footer.company, "Rica Cursos");
	await tick(NOW);
	await tick(NOW + 2 * DAY);
	await tick(NOW + 2 * DAY + HOUR);
	// The funnel was already active, and its e-mail leaves signed with the new data.
	assert.match(sent[0].text, /Rica Cursos/);
	assert.doesNotMatch(sent[0].text, /KLEAD\n/);
});
