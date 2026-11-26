import { NextResponse } from "next/server";
import { eraseContact, getContact, updateContact } from "@/lib/marketing/contacts";
import { normalizeTags, readConsent } from "@/lib/marketing/contacts-utils";
import { requireMarketing } from "@/lib/marketing/server";

type Context = { params: Promise<{ id: string }> };
const missing = () => NextResponse.json({ error: "Contato não encontrado." }, { status: 404 });

/** Everything stored about one person, which is also their data export (C6). */
export async function GET(request: Request, { params }: Context) {
	const access = await requireMarketing(request);
	if (access.error) return access.error;
	const contact = await getContact(access.db, (await params).id);
	return contact ? NextResponse.json({ contact }) : missing();
}

export async function PUT(request: Request, { params }: Context) {
	const access = await requireMarketing(request);
	if (access.error) return access.error;
	const { id } = await params;
	if (!(await getContact(access.db, id))) return missing();
	const input = (await request.json().catch(() => null)) as { name?: unknown; tags?: unknown; listIds?: unknown; consent?: unknown } | null;
	const consent = readConsent(input?.consent);
	if (input?.consent && !consent) return NextResponse.json({ error: "Informe origem, texto e uma data que não seja futura." }, { status: 400 });
	await updateContact(access.db, id, {
		name: typeof input?.name === "string" ? input.name.trim().slice(0, 200) : undefined,
		tags: input?.tags === undefined ? undefined : normalizeTags(input.tags),
		listIds: Array.isArray(input?.listIds) ? input.listIds.filter((value): value is string => typeof value === "string").slice(0, 50) : undefined,
		consent,
	});
	return NextResponse.json({ contact: await getContact(access.db, id) });
}

export async function DELETE(request: Request, { params }: Context) {
	const access = await requireMarketing(request);
	if (access.error) return access.error;
	return (await eraseContact(access.db, (await params).id)) ? NextResponse.json({ ok: true }) : missing();
}
