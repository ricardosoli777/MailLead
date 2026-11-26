import { NextResponse } from "next/server";
import { importContacts, listContacts } from "@/lib/marketing/contacts";
import { normalizeTags, readConsent } from "@/lib/marketing/contacts-utils";
import { checkMailDomain } from "@/lib/marketing/domain-check";
import { requireMarketing } from "@/lib/marketing/server";

export async function GET(request: Request) {
	const access = await requireMarketing(request);
	if (access.error) return access.error;
	const query = new URL(request.url).searchParams;
	return NextResponse.json(await listContacts(access.db, {
		q: query.get("q") ?? undefined,
		listId: query.get("list") ?? undefined,
		tag: query.get("tag") ?? undefined,
		status: query.get("status") ?? undefined,
		offset: Number(query.get("offset")) || 0,
	}));
}

/** Adds one person. Without a complete consent they are stored as "sem consentimento". */
export async function POST(request: Request) {
	const access = await requireMarketing(request);
	if (access.error) return access.error;
	const input = (await request.json().catch(() => null)) as { email?: unknown; name?: unknown; listId?: unknown; tags?: unknown; consent?: unknown } | null;
	const email = typeof input?.email === "string" ? input.email : "";
	const consent = readConsent(input?.consent);
	if (input?.consent && !consent) return NextResponse.json({ error: "Para registrar o consentimento, informe origem, texto e uma data que não seja futura." }, { status: 400 });
	const report = await importContacts(access.db, [{ line: 1, email, name: typeof input?.name === "string" ? input.name.trim().slice(0, 200) : "", fields: {} }], {
		listId: typeof input?.listId === "string" && input.listId ? input.listId : null,
		consent,
		tags: normalizeTags(input?.tags),
		origin: "cadastro manual",
		checkDomain: checkMailDomain,
	});
	if (report.rejected.length) return NextResponse.json({ error: `Não foi possível adicionar: ${report.rejected[0].reason}.` }, { status: 422 });
	return NextResponse.json({ report }, { status: 201 });
}
