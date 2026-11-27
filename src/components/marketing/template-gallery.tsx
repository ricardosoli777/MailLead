"use client";

// Ready-made e-mails by use: browse and preview, or say what it is for and let the AI pick.
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Footer } from "@/lib/marketing/footer";
import { renderHtml } from "@/lib/marketing/render";
import { CATEGORIES, STARTERS, type CategoryId, type Starter } from "@/lib/marketing/starters";
import { readAiSettings } from "./ai-store";
import { marketingRequest } from "./marketing-request";

export function TemplateGallery({ onChoose }: { onChoose: (starter: Starter) => void }) {
	const [category, setCategory] = useState<CategoryId | "">("");
	const [seen, setSeen] = useState("");
	const [purpose, setPurpose] = useState("");
	const [pick, setPick] = useState<{ key: string; reason: string } | null>(null);
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);
	const [footer, setFooter] = useState<Footer | null>(null);
	useEffect(() => {
		void marketingRequest<{ footer: Footer | null }>("/api/marketing/footer").then((data) => setFooter(data.footer)).catch(() => {});
	}, []);

	async function choose() {
		setBusy(true);
		setError("");
		setPick(null);
		try {
			const settings = await readAiSettings().catch(() => null);
			const provider = settings?.active || "";
			const config = provider ? settings?.providers[provider] : undefined;
			if (!config?.key || !config.model) throw new Error("Para a IA escolher, cole a sua chave em IA, no menu.");
			const answer = await marketingRequest<{ key: string; reason: string }>("/api/marketing/ai/pick", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider, key: config.key, model: config.model, purpose }) });
			setPick(answer);
			setCategory("");
			setSeen(answer.key);
		} catch (pickError) {
			setError((pickError as Error).message);
		} finally {
			setBusy(false);
		}
	}

	const shown = STARTERS.filter((item) => (!category || item.category === category))
		// The AI's choice comes first.
		.sort((a, z) => Number(z.key === pick?.key) - Number(a.key === pick?.key));
	const chip = (active: boolean) => `rounded-full border px-3 py-1 text-xs font-medium ${active ? "border-blue-600 bg-blue-600 text-white" : "border-neutral-200 text-neutral-700 hover:border-blue-500"}`;

	return (
		<div className="space-y-3">
			<div className="flex flex-wrap gap-2">
				<Input className="min-w-48 flex-1" value={purpose} maxLength={500} placeholder="Para que é o e-mail? Ex.: lembrar da aula de amanhã" aria-label="Para que é o e-mail" onChange={(event) => setPurpose(event.target.value)} onKeyDown={(event) => {
					if (event.key !== "Enter") return;
					event.preventDefault();
					if (purpose.trim() && !busy) void choose();
				}} />
				<Button type="button" variant="outline" disabled={busy || !purpose.trim()} onClick={() => void choose()}>{busy ? "Escolhendo…" : "IA escolhe"}</Button>
			</div>
			{error && <p role="alert" className="text-sm text-red-700">{error}</p>}
			{pick && <p role="status" className="rounded-xl bg-blue-50 px-3 py-2 text-sm text-blue-900">Sugestão da IA: <strong>{STARTERS.find((item) => item.key === pick.key)?.name}</strong>. {pick.reason}</p>}
			<div className="flex flex-wrap gap-2" role="group" aria-label="Categorias">
				<button type="button" aria-pressed={!category} className={chip(!category)} onClick={() => setCategory("")}>Todos</button>
				{CATEGORIES.map((item) => <button key={item.id} type="button" aria-pressed={category === item.id} className={chip(category === item.id)} onClick={() => setCategory(item.id)}>{item.label}</button>)}
			</div>
			<ul className="grid gap-2 sm:grid-cols-2">
				{shown.map((item) => (
					<li key={item.key} data-starter={item.key} className={`space-y-2 rounded-2xl border bg-white p-3 ${pick?.key === item.key ? "border-blue-500 ring-2 ring-blue-100" : "border-neutral-200"} ${seen === item.key ? "sm:col-span-2" : ""}`}>
						<p className="flex items-center gap-2 text-sm font-medium text-neutral-900"><span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.design.accent }} />{item.name}</p>
						<p className="text-xs text-neutral-500">{item.use}</p>
						{seen === item.key && <iframe title={`Prévia: ${item.name}`} sandbox="" srcDoc={renderHtml(footer ? { ...item.design, footer } : item.design, {})} className="h-72 w-full rounded-lg border border-neutral-200" />}
						<div className="flex gap-2">
							<Button type="button" size="sm" onClick={() => onChoose(item)}>Usar este</Button>
							<Button type="button" size="sm" variant="ghost" onClick={() => setSeen(seen === item.key ? "" : item.key)}>{seen === item.key ? "Fechar prévia" : "Ver"}</Button>
						</div>
					</li>
				))}
			</ul>
			<p className="text-xs text-neutral-500">Antes de usar, troque o que está em [MAIÚSCULAS] e o endereço exemplo.com dos botões.</p>
		</div>
	);
}
