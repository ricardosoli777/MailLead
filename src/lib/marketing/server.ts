import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/api/auth";
import { isPrimaryAdmin } from "@/lib/auth/admin";
import { hasValidSessionMutationOrigin } from "@/lib/auth/origin";
import { getEnv } from "@/lib/cloudflare";
import { parseDesign } from "./render";
import type { Template } from "./types";

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

/** Marketing is limited to the primary administrator; writes also require a same-origin request. */
export async function requireMarketing(request: Request) {
	const env = getEnv();
	const auth = await requireSessionUser(env, request);
	if (auth.error) return { error: auth.error } as const;
	if (!isPrimaryAdmin(auth.user)) return { error: fail("Forbidden", 403) } as const;
	if (request.method !== "GET" && !hasValidSessionMutationOrigin(request)) return { error: fail("Invalid origin", 403) } as const;
	if (!env.MARKETING_DB) return { error: fail("O banco de marketing (MARKETING_DB) não está configurado.", 503) } as const;
	return { env, db: env.MARKETING_DB, user: auth.user, error: null } as const;
}

type Row = { id: string; name: string; subject: string; design: string; updated_at: number };

export function toTemplate(row: Row): Template {
	return { id: row.id, name: row.name, subject: row.subject, design: JSON.parse(row.design), updatedAt: row.updated_at };
}

/** Validates the body of a create or update request. */
export async function readTemplateInput(request: Request) {
	const input = (await request.json().catch(() => null)) as { name?: unknown; subject?: unknown; design?: unknown } | null;
	const name = typeof input?.name === "string" ? input.name.trim().slice(0, 120) : "";
	const subject = typeof input?.subject === "string" ? input.subject.trim().slice(0, 300) : "";
	if (!name) return { error: fail("Dê um nome ao modelo.", 400) } as const;
	const parsed = parseDesign(input?.design);
	if ("error" in parsed) return { error: fail(parsed.error, 400) } as const;
	return { name, subject, design: parsed.design, error: null } as const;
}

/** Trusts the file's first bytes, not the declared type, so only real raster images are stored. */
export function sniffImageType(bytes: Uint8Array): string | null {
	const starts = (...signature: number[]) => signature.every((byte, index) => bytes[index] === byte);
	if (starts(0x89, 0x50, 0x4e, 0x47)) return "image/png";
	if (starts(0xff, 0xd8, 0xff)) return "image/jpeg";
	if (starts(0x47, 0x49, 0x46, 0x38)) return "image/gif";
	return null;
}
