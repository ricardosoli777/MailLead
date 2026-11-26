import { NextResponse } from "next/server";
import { DEFAULT_CONSENT, createForm } from "@/lib/marketing/capture";
import { createMailingList, listMailingLists } from "@/lib/marketing/contacts";
import { requireMarketing } from "@/lib/marketing/server";

export async function GET(request: Request) {
	const access = await requireMarketing(request);
	if (access.error) return access.error;
	return NextResponse.json({ lists: await listMailingLists(access.db) });
}

export async function POST(request: Request) {
	const access = await requireMarketing(request);
	if (access.error) return access.error;
	const input = (await request.json().catch(() => null)) as { name?: unknown } | null;
	const name = typeof input?.name === "string" ? input.name.trim().slice(0, 100) : "";
	if (!name) return NextResponse.json({ error: "Dê um nome à lista." }, { status: 400 });
	const list = await createMailingList(access.db, name);
	if (!list) return NextResponse.json({ error: "Já existe uma lista com esse nome." }, { status: 409 });
	// Every new list comes with its sign-up form, ready to adjust.
	const formId = await createForm(access.db, { name: list.name, listId: list.id, tags: [], consentText: DEFAULT_CONSENT });
	return NextResponse.json({ list, formId }, { status: 201 });
}
