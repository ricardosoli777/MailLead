import { NextResponse } from "next/server";
import { AiError, listAiModels } from "@/lib/marketing/ai";
import { isAiProvider } from "@/lib/marketing/ai-utils";
import { requireMarketing } from "@/lib/marketing/server";

export async function POST(request: Request) {
	const access = await requireMarketing(request);
	if (access.error) return access.error;
	const input = (await request.json().catch(() => null)) as { provider?: unknown; key?: unknown } | null;
	const key = typeof input?.key === "string" ? input.key.trim().slice(0, 500) : "";
	if (!isAiProvider(input?.provider) || !key) return NextResponse.json({ error: "Informe o provedor e a chave de API." }, { status: 400 });
	try {
		return NextResponse.json({ models: await listAiModels(input.provider, key) });
	} catch (error) {
		if (error instanceof AiError) return NextResponse.json({ error: error.message }, { status: 502 });
		throw error;
	}
}
