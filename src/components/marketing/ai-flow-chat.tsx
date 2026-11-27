"use client";

// A conversation that ends in a draft funnel with its e-mails written. Nothing is activated here.
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { AiAnswer, AiFunnel, AiMessage, AiStep } from "@/lib/marketing/ai-types";
import { AI_PROVIDERS } from "@/lib/marketing/ai-utils";
import { readAiSettings, type AiSettings } from "./ai-store";
import { marketingRequest } from "./marketing-request";

const EXAMPLES = "Ex.: Funil de boas-vindas para quem baixou meu e-book de receitas. Quero 3 e-mails e, no último, convidar para o curso (https://meusite.com/curso).";

function Steps({ steps }: { steps: AiStep[] }) {
	return (
		<ol className="space-y-2">
			{steps.map((step, index) => (
				<li key={index} className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm">
					{step.type === "wait" ? `Esperar ${step.amount} ${step.unit === "days" ? "dia(s)" : "hora(s)"}`
						: step.type === "tag" ? `${step.action === "add" ? "Colocar" : "Tirar"} a etiqueta "${step.tag}"`
							: step.type === "email" ? (
								<details>
									<summary className="cursor-pointer"><strong>E-mail:</strong> {step.subject}</summary>
									<div className="mt-2 space-y-2 text-neutral-700">
										{step.blocks.map((block, position) => (block.type === "divider" ? <hr key={position} />
											: block.type === "button" ? <p key={position} className="break-all text-blue-700">Botão &quot;{block.label}&quot; → {block.url}</p>
												: <p key={position} className={`whitespace-pre-wrap ${block.type === "heading" ? "font-semibold" : ""}`}>{block.text}</p>))}
									</div>
								</details>
							) : (
								<div className="space-y-2">
									<p><strong>Condição:</strong> {step.test === "opened" ? "abriu o e-mail?" : step.test === "clicked" ? "clicou no e-mail?" : `tem a etiqueta "${step.tag}"?`}</p>
									{([["Sim", step.yes], ["Não", step.no]] as const).map(([label, side]) => (
										<div key={label} className="border-l-2 border-neutral-200 pl-3">
											<p className="text-xs font-medium text-neutral-500">{label}</p>
											{side.length ? <Steps steps={side} /> : <p className="text-xs text-neutral-500">Segue em frente.</p>}
										</div>
									))}
								</div>
							)}
				</li>
			))}
		</ol>
	);
}

export function AiFlowChat({ listId, onCreated }: { listId: string; onCreated: (id: string) => Promise<void> }) {
	const [settings, setSettings] = useState<AiSettings | null>(null);
	const [messages, setMessages] = useState<AiMessage[]>([]);
	const [funnel, setFunnel] = useState<AiFunnel | null>(null);
	const [draft, setDraft] = useState("");
	const [error, setError] = useState("");
	const [busy, setBusy] = useState<"" | "asking" | "creating">("");

	useEffect(() => {
		void readAiSettings().then(setSettings).catch(() => setSettings({ active: "", providers: {} }));
	}, []);

	const provider = settings?.active || "";
	const config = provider ? settings?.providers[provider] : undefined;
	const ready = !!config?.key && !!config.model;

	async function ask() {
		const content = draft.trim();
		if (!content || !ready) return;
		const next: AiMessage[] = [...messages, { role: "user", content }];
		setMessages(next);
		setDraft("");
		setError("");
		setBusy("asking");
		try {
			const answer = await marketingRequest<AiAnswer>("/api/marketing/ai/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider, key: config.key, model: config.model, messages: next, funnel }) });
			setMessages([...next, { role: "assistant", content: answer.reply }]);
			if (answer.funnel) setFunnel(answer.funnel);
		} catch (askError) {
			// The message goes back to the box so it can be sent again.
			setMessages(messages);
			setDraft(content);
			setError((askError as Error).message);
		} finally {
			setBusy("");
		}
	}

	async function create() {
		setBusy("creating");
		setError("");
		try {
			const { id } = await marketingRequest<{ id: string }>("/api/marketing/ai/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ funnel, listId }) });
			setMessages([]);
			setFunnel(null);
			await onCreated(id);
		} catch (createError) {
			setError((createError as Error).message);
		} finally {
			setBusy("");
		}
	}

	return (
		<section className="space-y-3 rounded-3xl bg-white p-6">
			<h2 className="text-base font-semibold">Criar com IA</h2>
			<p className="text-sm text-neutral-500">Conte o que você oferece, para quem e o objetivo. A IA monta o fluxo e escreve os e-mails. Você revisa antes de criar.</p>
			{settings && !ready && <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">Abra a aba <strong>IA</strong>, cole a sua chave e escolha o modelo.</p>}
			{ready && <p className="text-xs text-neutral-500">Usando {AI_PROVIDERS.find((item) => item.id === provider)?.label} · {config.model}</p>}
			{messages.length > 0 && (
				<div className="max-h-80 space-y-2 overflow-y-auto" aria-live="polite">
					{messages.map((message, index) => (
						<p key={index} className={`whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${message.role === "user" ? "ml-8 bg-blue-600 text-white" : "mr-8 bg-neutral-100"}`}>{message.content}</p>
					))}
				</div>
			)}
			{busy === "asking" && <p role="status" className="text-sm text-neutral-500">Escrevendo… pode levar um minuto.</p>}
			{error && <p role="alert" className="text-sm text-red-700">{error}</p>}
			{funnel && (
				<div className="space-y-3 rounded-2xl bg-neutral-50 p-4">
					<h3 className="text-sm font-semibold">Proposta: {funnel.name}</h3>
					<Steps steps={funnel.steps} />
					<p className="text-xs text-neutral-500">Confira textos, links e promessas. O funil é criado como rascunho: nada é enviado até você ativar.</p>
					<div className="flex flex-wrap gap-2">
						<Button type="button" disabled={!!busy} onClick={() => void create()}>{busy === "creating" ? "Criando…" : "Criar este funil"}</Button>
						<Button type="button" variant="ghost" disabled={!!busy} onClick={() => {
							setFunnel(null);
							setMessages([]);
						}}>Começar de novo</Button>
					</div>
				</div>
			)}
			<form className="space-y-2" onSubmit={(event) => {
				event.preventDefault();
				void ask();
			}}>
				<textarea className="min-h-24 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm" maxLength={4000} value={draft} aria-label="Mensagem para a IA" placeholder={funnel ? "Peça ajustes. Ex.: deixe o segundo e-mail mais curto." : EXAMPLES} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => {
					if (event.key === "Enter" && !event.shiftKey && !busy) {
						event.preventDefault();
						void ask();
					}
				}} />
				<Button type="submit" disabled={!ready || !!busy || !draft.trim()}>Enviar</Button>
			</form>
		</section>
	);
}
