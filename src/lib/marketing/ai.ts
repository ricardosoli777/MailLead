/**
 * The funnel writer. The API key belongs to the administrator's browser: it arrives with each
 * request, is used for that request and is never stored or logged here.
 */
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { APICallError, generateText } from "ai";
import type { AiAnswer, AiFile, AiFunnel, AiMessage, AiProvider } from "./ai-types";
import { keepAttachedImages, readAnswer } from "./ai-utils";

export class AiError extends Error {}

const GEMINI = "https://generativelanguage.googleapis.com/v1beta/openai";
/** Claude models that can hand a declined request to another model within the same call. */
const WITH_FALLBACK = /^claude-(opus-5(-5)?|sonnet-5-5|fable-5-[12])$/;

const failure = (status: number | undefined, detail: string) => {
	if (status === 401 || status === 403) return new AiError("A chave de API foi recusada. Confira a chave na aba IA.");
	if (status === 429) return new AiError("Limite de uso ou créditos esgotados na sua conta do provedor.");
	if (status === 404) return new AiError("Esse modelo não está disponível para a sua chave. Escolha outro na aba IA.");
	return new AiError(`O provedor de IA recusou o pedido${status ? ` (${status})` : ""}. Confira a chave e o modelo. ${detail.slice(0, 200)}`);
};

export async function listAiModels(provider: AiProvider, key: string, request: typeof fetch = fetch): Promise<string[]> {
	const [url, headers]: [string, Record<string, string>] = provider === "anthropic"
		? ["https://api.anthropic.com/v1/models?limit=1000", { "x-api-key": key, "anthropic-version": "2023-06-01" }]
		: [provider === "openai" ? "https://api.openai.com/v1/models" : `${GEMINI}/models`, { Authorization: `Bearer ${key}` }];
	let response: Response;
	try {
		response = await request(url, { headers, redirect: "manual", signal: AbortSignal.timeout(20_000) });
	} catch {
		throw new AiError("O provedor de IA não respondeu. Tente de novo.");
	}
	// Listing sends nothing but the key, so a "bad request" here (Gemini) is a bad key.
	if (!response.ok) throw failure(response.status === 400 ? 401 : response.status, "não foi possível listar os modelos");
	const body = (await response.json().catch(() => null)) as { data?: { id?: unknown }[] } | null;
	const ids = (body?.data ?? []).flatMap((item) => (typeof item.id === "string" && item.id.length <= 120 ? [item.id.replace(/^models\//, "")] : []));
	// Only models that write text.
	const writes = ids.filter((id) => (provider === "openai" ? /^(gpt-|o\d|chatgpt-)/.test(id) : provider === "gemini" ? id.startsWith("gemini") : true)
		&& !/(audio|realtime|tts|transcribe|image|search|embedding|moderation|instruct|live|vision)/.test(id));
	if (!writes.length) throw new AiError("Essa chave não retornou nenhum modelo de texto.");
	return [...new Set(writes)].sort().reverse();
}

function system(context: { tags: string[]; funnel: AiFunnel | null; files?: AiFile[] }): string {
	return `Você ajuda a criar funis de e-mail no MailLead, em português do Brasil. Os e-mails vão somente para pessoas que se cadastraram e aceitaram receber.

Responda APENAS com um objeto JSON, sem texto fora dele:
{"reply": "sua mensagem curta para o usuário", "funnel": null}
Quando já houver informação suficiente (o que é oferecido, para quem e o objetivo), preencha "funnel":
{"name": "...", "triggerTag": "", "goalTag": "", "steps": [...]}
Passos, na ordem em que acontecem:
{"type": "email", "name": "nome interno", "subject": "assunto", "preheader": "frase de prévia", "blocks": [{"type": "heading", "text": "..."}, {"type": "text", "text": "..."}, {"type": "button", "label": "...", "url": "https://..."}]}
Um bloco de imagem é {"type": "image", "url": "...", "alt": "descrição"}.
{"type": "wait", "amount": 2, "unit": "days"}  (unit: "hours" ou "days")
{"type": "condition", "test": "clicked", "tag": "", "yes": [...], "no": [...]}  (test: "opened", "clicked" ou "tag"; abertura e clique só depois de um e-mail)
{"type": "tag", "action": "add", "tag": "interessado"}

Regras:
- Se faltar informação importante, pergunte em "reply" e deixe "funnel" null.
- No máximo 20 passos. "triggerTag" e "goalTag" ficam vazios, a não ser que o usuário peça.
- Não invente preços, prazos, resultados, depoimentos, números, escassez nem links. Use um botão somente com um link que o usuário informou; sem link, convide a responder o e-mail.
- Para o nome da pessoa use {{nome|tudo bem}}. Não escreva rodapé nem descadastro: o sistema já coloca.
- Texto direto, sem promessas enganosas, sem assunto em letras maiúsculas.
- Ao ajustar uma proposta existente, devolva o funil completo outra vez.
- Arquivos anexados pelo usuário: use cada um no e-mail em que fizer sentido. Imagem vira bloco "image"; PDF vira botão com o endereço dele. Você não vê o conteúdo dos arquivos, só o nome: se não souber o que são, pergunte.
Anexos: ${context.files?.length ? JSON.stringify(context.files) : "nenhum"}.
Etiquetas já usadas: ${context.tags.join(", ") || "nenhuma"}.
Proposta atual: ${context.funnel ? JSON.stringify(context.funnel) : "nenhuma"}`;
}

export async function askAi(input: { provider: AiProvider; key: string; model: string; messages: AiMessage[]; tags: string[]; funnel: AiFunnel | null; files?: AiFile[] }, request?: typeof fetch): Promise<AiAnswer> {
	const settings = { apiKey: input.key, fetch: request };
	const model = input.provider === "anthropic" ? createAnthropic(settings)(input.model)
		: input.provider === "openai" ? createOpenAI(settings).responses(input.model)
			: createOpenAICompatible({ name: "gemini", baseURL: GEMINI, ...settings }).chatModel(input.model);
	let result: { text: string; finishReason: string };
	try {
		result = await generateText({
			model,
			instructions: system(input),
			messages: input.messages,
			maxOutputTokens: 16_000,
			maxRetries: 1,
			abortSignal: AbortSignal.timeout(180_000),
			providerOptions: {
				openai: { store: false },
				...(WITH_FALLBACK.test(input.model) ? { anthropic: { fallbacks: "default" } } : {}),
			},
		});
	} catch (error) {
		// The provider's message may quote the key back.
		const detail = (error instanceof Error ? error.message : "").replaceAll(input.key, "…");
		if (APICallError.isInstance(error)) throw failure(error.statusCode, detail);
		throw new AiError("A IA não respondeu. Tente de novo ou escolha outro modelo.");
	}
	if (result.finishReason === "content-filter") throw new AiError("O modelo se recusou a escrever esse conteúdo. Reformule o pedido.");
	if (result.finishReason === "length") throw new AiError("A resposta ficou grande demais e veio cortada. Peça um funil menor.");
	const answer = readAnswer(result.text);
	return answer.funnel ? { ...answer, funnel: keepAttachedImages(answer.funnel, input.files ?? [], input.funnel) } : answer;
}
