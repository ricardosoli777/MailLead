import { NextResponse } from "next/server";
import { listBackupFiles, saveBackup } from "@/lib/marketing/backup";
import { requireMarketing } from "@/lib/marketing/server";

export async function GET(request: Request) {
	const access = await requireMarketing(request);
	if (access.error) return access.error;
	return NextResponse.json({ backups: await listBackupFiles(access.env.BUCKET) });
}

export async function POST(request: Request) {
	const access = await requireMarketing(request);
	if (access.error) return access.error;
	try {
		return NextResponse.json({ name: await saveBackup(access.db, access.env.BUCKET) }, { status: 201 });
	} catch (error) {
		console.error("Marketing backup failed", error);
		return NextResponse.json({ error: "Não foi possível fazer o backup." }, { status: 500 });
	}
}
