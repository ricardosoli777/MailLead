import { NextResponse } from "next/server";
import { deleteMailingList } from "@/lib/marketing/contacts";
import { requireMarketing } from "@/lib/marketing/server";

/** Removes the list only; the people stay as contacts. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const access = await requireMarketing(request);
	if (access.error) return access.error;
	await deleteMailingList(access.db, (await params).id);
	return NextResponse.json({ ok: true });
}
