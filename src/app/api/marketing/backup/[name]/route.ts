import { NextResponse } from "next/server";
import { BACKUP_PREFIX, isBackupName } from "@/lib/marketing/backup";
import { requireMarketing } from "@/lib/marketing/server";

export async function GET(request: Request, { params }: { params: Promise<{ name: string }> }) {
	const access = await requireMarketing(request);
	if (access.error) return access.error;
	const { name } = await params;
	const object = isBackupName(name) ? await access.env.BUCKET.get(BACKUP_PREFIX + name) : null;
	if (!object) return NextResponse.json({ error: "Backup não encontrado." }, { status: 404 });
	return new Response(object.body, {
		headers: { "Content-Type": "application/gzip", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" },
	});
}
