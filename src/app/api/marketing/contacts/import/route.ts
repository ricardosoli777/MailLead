import { NextResponse } from "next/server";
import { importContacts } from "@/lib/marketing/contacts";
import { domainOf, KNOWN_DOMAINS, MAX_IMPORT_DOMAINS, MAX_IMPORT_ROWS, normalizeEmail, normalizeTags, readConsent } from "@/lib/marketing/contacts-utils";
import type { ImportRow } from "@/lib/marketing/contacts-types";
import { checkMailDomain } from "@/lib/marketing/domain-check";
import { requireMarketing } from "@/lib/marketing/server";

const fail = (error: string) => NextResponse.json({ error }, { status: 400 });

/** One slice of a file; the page splits large files. An import always declares where the consent came from (C4). */
export async function POST(request: Request) {
	const access = await requireMarketing(request);
	if (access.error) return access.error;
	const input = (await request.json().catch(() => null)) as { rows?: unknown; listId?: unknown; tags?: unknown; consent?: unknown; declared?: unknown } | null;
	const consent = readConsent(input?.consent);
	if (!consent) return fail("Informe a origem, o texto do consentimento e a data.");
	if (input?.declared !== true) return fail("Confirme que essas pessoas autorizaram o envio e que a lista não foi comprada.");
	if (typeof input.listId !== "string" || !input.listId) return fail("Escolha a lista.");
	if (!Array.isArray(input.rows) || !input.rows.length || input.rows.length > MAX_IMPORT_ROWS) return fail(`Envie de 1 a ${MAX_IMPORT_ROWS} linhas por vez.`);

	const rows: ImportRow[] = (input.rows as Record<string, unknown>[]).map((row, index) => ({
		line: Number(row?.line) || index + 1,
		email: typeof row?.email === "string" ? row.email.slice(0, 320) : "",
		name: typeof row?.name === "string" ? row.name.slice(0, 200) : "",
		fields: Object.fromEntries(Object.entries(row?.fields ?? {}).filter((entry): entry is [string, string] => typeof entry[1] === "string").slice(0, 20).map(([key, value]) => [key.slice(0, 60), value.slice(0, 500)])),
	}));
	const lookups = new Set(rows.map((row) => domainOf(normalizeEmail(row.email))).filter((domain) => !KNOWN_DOMAINS.has(domain)));
	if (lookups.size > MAX_IMPORT_DOMAINS) return fail("Muitos domínios diferentes de uma vez; divida o arquivo.");

	const list = await access.db.prepare("SELECT id FROM marketing_lists WHERE id = ?").bind(input.listId).first();
	if (!list) return fail("Essa lista não existe mais.");
	const report = await importContacts(access.db, rows, { listId: input.listId, consent, tags: normalizeTags(input.tags), origin: "importação", checkDomain: checkMailDomain });
	return NextResponse.json({ report });
}
