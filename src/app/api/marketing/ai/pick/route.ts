import { NextResponse } from "next/server";
import { AiError, pickStarter } from "@/lib/marketing/ai";
import { isAiProvider } from "@/lib/marketing/ai-utils";
import { requireMarketing } from "@/lib/marketing/server";

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

export async function POST(request: Request) {
	const access = await requireMarketing(request);
	if (access.error) return access.error;
	const input = (await request.json().catch(() => null)) as { provider?: unknown; key?: unknown; model?: unknown; purpose?: unknown } | null;
	const key = typeof input?.key === "string" ? input.key.trim().slice(0, 500) : "";
	const model = typeof input?.model === "string" ? input.model.trim().slice(0, 120) : "";
	const purpose = typeof input?.purpose === "string" ? input.purpose.trim().slice(0, 500) : "";
	if (!isAiProvider(input?.provider) || !key || !model) return fail("Configure o provedor, a chave e o modelo na aba IA.", 400);
	if (!purpose) return fail("Diga para que é o e-mail.", 400);
	try {
		return NextResponse.json(await pickStarter({ provider: input.provider, key, model, purpose }));
	} catch (error) {
		if (error instanceof AiError) return fail(error.message, 502);
		throw error;
	}
}
