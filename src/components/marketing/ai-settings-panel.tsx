"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AiProvider } from "@/lib/marketing/ai-types";
import { AI_PROVIDERS } from "@/lib/marketing/ai-utils";
import { emptyAiSettings, readAiSettings, writeAiSettings, type AiSettings } from "./ai-store";
import { marketingRequest } from "./marketing-request";

const SELECT = "h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm";
const NO_STORAGE = "Este navegador não deixou salvar. Em janela anônima as chaves não ficam guardadas.";

export function AiSettingsPanel() {
	const [settings, setSettings] = useState<AiSettings>(emptyAiSettings);
	const [typed, setTyped] = useState<Partial<Record<AiProvider, string>>>({});
	const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		void readAiSettings().then(setSettings).catch(() => setMessage({ error: true, text: NO_STORAGE }));
	}, []);

	async function save(next: AiSettings) {
		await writeAiSettings(next).catch(() => {
			throw new Error(NO_STORAGE);
		});
		setSettings(next);
	}

	async function run(action: () => Promise<string>) {
		setBusy(true);
		setMessage(null);
		try {
			setMessage({ error: false, text: await action() });
		} catch (error) {
			setMessage({ error: true, text: error instanceof Error ? error.message : "Falha." });
		} finally {
			setBusy(false);
		}
	}

	const connect = (provider: AiProvider) => run(async () => {
		const current = settings.providers[provider];
		const key = typed[provider]?.trim() || current?.key || "";
		const { models } = await marketingRequest<{ models: string[] }>("/api/marketing/ai/models", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider, key }) });
		const model = current && models.includes(current.model) ? current.model : provider === "anthropic" && models.includes("claude-opus-5-5") ? "claude-opus-5-5" : "";
		await save({ active: settings.active || provider, providers: { ...settings.providers, [provider]: { key, model, models } } });
		setTyped((values) => ({ ...values, [provider]: "" }));
		return model ? "Chave salva neste navegador." : "Chave salva neste navegador. Agora escolha o modelo.";
	});

	return (
		<div className="max-w-3xl space-y-6">
			<p className="rounded-3xl bg-white p-6 text-sm text-neutral-600">
				As chaves ficam salvas <strong>somente neste navegador</strong> (IndexedDB). A cada pedido, a chave vai ao seu servidor por HTTPS, é usada e não é gravada. Em outro computador, cole de novo. Não use em computador compartilhado. O uso da API é cobrado pelo provedor, à parte da assinatura do ChatGPT, Claude ou Gemini.
			</p>
			{message && <p role="status" className={`rounded-xl px-4 py-3 text-sm ${message.error ? "bg-red-50 text-red-800" : "bg-green-50 text-green-800"}`}>{message.text}</p>}
			{AI_PROVIDERS.map((item) => {
				const saved = settings.providers[item.id];
				return (
					<form key={item.id} aria-label={item.label} className="space-y-3 rounded-3xl bg-white p-6" onSubmit={(event) => {
						event.preventDefault();
						void connect(item.id);
					}}>
						<div className="flex flex-wrap items-center justify-between gap-2">
							<h2 className="text-base font-semibold">{item.label}</h2>
							{saved && (
								<label className="flex items-center gap-2 text-sm">
									<input type="radio" name="ai-active" checked={settings.active === item.id} onChange={() => void run(async () => {
										await save({ ...settings, active: item.id });
										return `O chat vai usar ${item.label}.`;
									})} />
									Usar este
								</label>
							)}
						</div>
						<label className="block space-y-1">
							<span className="block text-xs font-medium text-neutral-600">Chave de API</span>
							<Input type="password" autoComplete="off" value={typed[item.id] ?? ""} placeholder={saved ? "Salva neste navegador. Preencha só para trocar." : "Cole aqui"} onChange={(event) => setTyped((values) => ({ ...values, [item.id]: event.target.value }))} />
							<span className="block text-xs text-neutral-500">Onde criar: {item.keyHint}</span>
						</label>
						{saved && (
							<label className="block space-y-1">
								<span className="block text-xs font-medium text-neutral-600">Modelo</span>
								<select className={SELECT} value={saved.model} onChange={(event) => void run(async () => {
									await save({ ...settings, providers: { ...settings.providers, [item.id]: { ...saved, model: event.target.value } } });
									return "Modelo salvo.";
								})}>
									<option value="">Escolha o modelo</option>
									{saved.models.map((model) => <option key={model} value={model}>{model}</option>)}
								</select>
							</label>
						)}
						<div className="flex flex-wrap gap-2">
							<Button type="submit" disabled={busy || (!saved && !typed[item.id]?.trim())}>{saved ? "Salvar e atualizar modelos" : "Salvar e buscar modelos"}</Button>
							{saved && (
								<Button type="button" variant="ghost" className="text-red-600" disabled={busy} onClick={() => void run(async () => {
									const providers = { ...settings.providers };
									delete providers[item.id];
									await save({ active: settings.active === item.id ? (Object.keys(providers)[0] as AiProvider) ?? "" : settings.active, providers });
									return "Chave apagada deste navegador.";
								})}>Apagar chave</Button>
							)}
						</div>
					</form>
				);
			})}
		</div>
	);
}
