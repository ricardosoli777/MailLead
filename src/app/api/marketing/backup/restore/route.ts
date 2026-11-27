import { NextResponse } from "next/server";
import { BACKUP_PREFIX, BackupError, isBackupName, restoreBackup } from "@/lib/marketing/backup";
import { requireMarketing } from "@/lib/marketing/server";

const MAX_BYTES = 90 * 1024 * 1024;
const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

/** From a stored copy (`{ name }`) or from a file sent by the administrator. */
export async function POST(request: Request) {
	const access = await requireMarketing(request);
	if (access.error) return access.error;
	let file: ReadableStream<Uint8Array>;
	if (request.headers.get("content-type")?.startsWith("multipart/form-data")) {
		const upload = (await request.formData().catch(() => null))?.get("file");
		if (!(upload instanceof File)) return fail("Escolha o arquivo do backup.", 400);
		if (upload.size > MAX_BYTES) return fail("O arquivo é grande demais.", 413);
		file = upload.stream();
	} else {
		const name = ((await request.json().catch(() => null)) as { name?: unknown } | null)?.name;
		const object = isBackupName(name) ? await access.env.BUCKET.get(BACKUP_PREFIX + name) : null;
		if (!object) return fail("Backup não encontrado.", 404);
		file = object.body;
	}
	try {
		return NextResponse.json({ restored: await restoreBackup(access.db, file) });
	} catch (error) {
		if (error instanceof BackupError) return fail(error.message, 422);
		console.error("Marketing restore failed", error);
		return fail("Não foi possível restaurar.", 500);
	}
}
