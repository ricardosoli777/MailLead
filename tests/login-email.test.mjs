import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test, { after } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = mkdtempSync(join(tmpdir(), "mailflare-login-email-"));
after(() => rmSync(outDir, { recursive: true, force: true }));

const mocks = {
	"drizzle-orm": "export const and=()=>1,eq=()=>1,ne=()=>1;",
	"@/db/schema": "export const domains={},mailboxes={},users={};",
	"@/db": `export const getDb=()=>({
		select(){const q={from(){return q},innerJoin(){q.joined=true;return q},where(){return q.joined?Promise.resolve(globalThis.state.inboxes):q},limit(){return Promise.resolve(globalThis.state.taken)}};return q},
		update(){return {set(v){return {where(){globalThis.state.written.push(v)}}}}},
	});`,
	"@/lib/cloudflare": "export const getEnv=()=>({});",
	"@/lib/api/auth": "export const requireSessionUser=async()=>({user:globalThis.state.user});",
	"@/lib/auth/admin": "export const isPrimaryAdmin=(u)=>u.role==='admin'&&u.isPrimaryAdmin;",
	"@/lib/auth/origin": "export const hasValidSessionMutationOrigin=()=>true;",
	"@/lib/auth/session": "export const getSessionTokenFromRequestHeaders=()=>'session';",
	"@/lib/auth/webauthn/authorize": "export const authorizeSecurityChange=async(_e,_u,_s,input,action)=>input.stepUpToken==='goodtoken'&&action==='admin.login_email';",
	"@/lib/auth/webauthn/grants": "export const bumpSecurityVersion=async()=>{};",
	"@/lib/http/auth-error": "export const authError=(code,status)=>Response.json({code},{status});",
	"@/lib/mailboxes/audit": "export const createAuditLog=async()=>{};",
};

await build({
	entryPoints: [join(root, "src/app/api/admin/login-email/utils.ts")],
	outfile: join(outDir, "route.mjs"),
	bundle: true,
	platform: "node",
	format: "esm",
	nodePaths: [join(root, "node_modules")],
	plugins: [{
		name: "mocks",
		setup(builder) {
			builder.onResolve({ filter: /^(@\/|drizzle-orm$)/ }, (args) => ({ path: args.path, namespace: "mock" }));
			builder.onLoad({ filter: /.*/, namespace: "mock" }, (args) => ({ contents: mocks[args.path], loader: "js" }));
		},
	}],
});
const { PUT } = await import(pathToFileURL(join(outDir, "route.mjs")).href);

async function change(email, { stepUpToken = "goodtoken", primary = true, taken = [] } = {}) {
	globalThis.state = {
		user: { id: "u1", email: "old@one.com", role: "admin", isPrimaryAdmin: primary },
		inboxes: [{ localPart: "old", hostname: "one.com" }, { localPart: "new", hostname: "two.com" }],
		taken,
		written: [],
	};
	const response = await PUT(new Request("https://app/api/admin/login-email", { method: "PUT", body: JSON.stringify({ email, stepUpToken }) }));
	return [response.status, globalThis.state.written];
}

test("the primary admin moves the sign-in to an inbox of their own", async () => {
	assert.deepEqual(await change("New@Two.com"), [200, [{ email: "new@two.com" }]]);
});

test("nothing changes without proof, rights, an own inbox or a free address", async () => {
	assert.deepEqual(await change("new@two.com", { stepUpToken: "wrongtoken" }), [401, []]);
	assert.deepEqual(await change("new@two.com", { primary: false }), [403, []]);
	assert.deepEqual(await change("someone@else.com"), [400, []]);
	assert.deepEqual(await change("new@two.com", { taken: [{ id: "u2" }] }), [409, []]);
});
