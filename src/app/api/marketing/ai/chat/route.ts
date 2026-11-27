import { NextResponse } from "next/server";
import { AiError, askAi } from "@/lib/marketing/ai";
import type { AiMessage } from "@/lib/marketing/ai-types";
import { isAiProvider, readFiles, readFunnel } from "@/lib/marketing/ai-utils";
import { requireMarketing } from "@/lib/marketing/server";

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

export async function POST(request: Request) {
	const access = await requireMarketing(request);
	if (access.error) return access.error;
	const input = (await request.json().catch(() => null)) as { provider?: unknown; key?: unknown; model?: unknown; messages?: unknown; funnel?: unknown; files?: unknown } | null;
	const key = typeof input?.key === "string" ? input.key.trim().slice(0, 500) : "";
	const model = typeof input?.model === "string" ? input.model.trim().slice(0, 120) : "";
	if (!isAiProvider(input?.provider) || !key || !model) return fail("Configure o provedor, a chave e o modelo na aba IA.", 400);
	const messages = (Array.isArray(input.messages) ? (input.messages as AiMessage[]) : [])
		.filter((item) => (item?.role === "user" || item?.role === "assistant") && typeof item.content === "string" && item.content.trim())
		.slice(-20)
		.map((item) => ({ role: item.role, content: item.content.slice(0, 4000) }));
	while (messages[0]?.role === "assistant") messages.shift();
	if (messages.at(-1)?.role !== "user") return fail("Escreva o que você quer.", 400);
	const { results } = await access.db.prepare("SELECT DISTINCT tag FROM marketing_contact_tags ORDER BY tag LIMIT 50").all<{ tag: string }>();
	try {
		return NextResponse.json(await askAi({ provider: input.provider, key, model, messages, tags: results.map((row) => row.tag), funnel: input.funnel ? readFunnel(input.funnel) : null, files: readFiles(input.files) }));
	} catch (error) {
		if (error instanceof AiError) return fail(error.message, 502);
		throw error;
	}
}
