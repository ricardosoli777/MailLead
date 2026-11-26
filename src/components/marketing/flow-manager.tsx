"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Flow, FlowDraft, FlowStatus } from "@/lib/marketing/flows-types";
import { RECIPES, recipeSteps } from "@/lib/marketing/flows-utils";
import { FlowBoard } from "./flow-board";
import { marketingRequest } from "./marketing-request";

const SELECT = "h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm";
const STATUS: Record<FlowStatus, { label: string; className: string }> = {
	draft: { label: "Rascunho", className: "bg-neutral-200 text-neutral-700" },
	active: { label: "Ativo", className: "bg-green-100 text-green-800" },
	paused: { label: "Pausado", className: "bg-amber-100 text-amber-800" },
};
const json = (method: string, body: unknown): RequestInit => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

type Option = { id: string; name: string };
type Template = Option & { subject: string };

export function FlowManager() {
	const [flows, setFlows] = useState<Flow[]>([]);
	const [tags, setTags] = useState<string[]>([]);
	const [lists, setLists] = useState<Option[]>([]);
	const [templates, setTemplates] = useState<Template[]>([]);
	const [openId, setOpenId] = useState("");
	const [draft, setDraft] = useState<FlowDraft | null>(null);
	const [dirty, setDirty] = useState(false);
	const [name, setName] = useState("");
	const [recipeId, setRecipeId] = useState<string>("welcome");
	const recipe = RECIPES.find((item) => item.id === recipeId)!;
	const [deleting, setDeleting] = useState(false);
	const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
	const [busy, setBusy] = useState(false);

	const load = useCallback(async () => {
		const [data, listData, templateData] = await Promise.all([
			marketingRequest<{ flows: Flow[]; tags: string[] }>("/api/marketing/flows"),
			marketingRequest<{ lists: Option[] }>("/api/marketing/lists"),
			marketingRequest<{ templates: Template[] }>("/api/marketing/templates"),
		]);
		setFlows(data.flows);
		setTags(data.tags);
		setLists(listData.lists);
		setTemplates(templateData.templates);
		return data.flows;
	}, []);
	useEffect(() => {
		void load().catch((error: Error) => setMessage({ error: true, text: error.message }));
	}, [load]);

	const current = flows.find((flow) => flow.id === openId);
	const open = (flow: Flow | undefined) => {
		setOpenId(flow?.id ?? "");
		setDraft(flow ? { name: flow.name, listId: flow.listId, triggerTag: flow.triggerTag, goalTag: flow.goalTag, steps: flow.steps } : null);
		setDirty(false);
		setDeleting(false);
	};
	const change = (patch: Partial<FlowDraft>) => {
		setDraft((value) => (value ? { ...value, ...patch } : value));
		setDirty(true);
	};

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

	const save = async () => {
		await marketingRequest(`/api/marketing/flows/${openId}`, json("PUT", draft));
		setDirty(false);
	};
	const act = (action: "activate" | "pause") => run(async () => {
		// Activating always saves first, so what runs is what is on the screen.
		if (action === "activate" && current?.status !== "active") await save();
		await marketingRequest(`/api/marketing/flows/${openId}`, json("PATCH", { action }));
		await load();
		return action === "activate" ? "Funil ativo. Quem entrar a partir de agora percorre os passos." : "Funil pausado. Ninguém avança nem recebe até reativar.";
	});

	const readOnly = current?.status === "active";

	return (
		<div className="max-w-3xl space-y-6">
			{message && <p role="status" className={`fixed inset-x-4 bottom-4 z-50 mx-auto max-w-xl rounded-lg px-4 py-3 text-sm shadow-lg ${message.error ? "bg-red-50 text-red-800" : "bg-green-50 text-green-800"}`}>{message.text}</p>}

			{!current && (
				<>
					<section className="space-y-3 rounded-3xl bg-white p-6">
						<h2 className="text-base font-semibold">Novo funil</h2>
						<p className="text-sm text-neutral-500">Uma sequência automática: quando alguém entra, os passos acontecem sozinhos.</p>
						<label className="block space-y-1">
							<span className="block text-xs font-medium text-neutral-600">Começar de</span>
							<select className={SELECT} value={recipeId} onChange={(event) => setRecipeId(event.target.value)}>
								{RECIPES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
							</select>
							<span className="block text-xs text-neutral-500">{recipe.help}</span>
						</label>
						<div className="flex gap-2">
							<Input value={name} placeholder="Nome do funil (ex.: Boas-vindas)" aria-label="Nome do funil" onChange={(event) => setName(event.target.value)} />
							<Button type="button" disabled={busy || !name.trim()} onClick={() => void run(async () => {
								const { id } = await marketingRequest<{ id: string }>("/api/marketing/flows", json("POST", { name, listId: lists[0]?.id ?? "", triggerTag: recipe.triggerTag, goalTag: recipe.goalTag, steps: recipeSteps(recipe.id) }));
								setName("");
								open((await load()).find((flow) => flow.id === id));
								return "Funil criado. Monte os passos.";
							})}>Criar funil</Button>
						</div>
					</section>
					{flows.map((flow) => (
						<article key={flow.id} className="flex flex-wrap items-center justify-between gap-2 rounded-3xl bg-white p-6">
							<div>
								<h3 className="text-sm font-medium">{flow.name} <span className={`ml-1 rounded-full px-2 py-1 text-xs ${STATUS[flow.status].className}`}>{STATUS[flow.status].label}</span></h3>
								<p className="text-xs text-neutral-500">{flow.counts.active} no funil · {flow.counts.done} concluíram · {flow.counts.goal} no objetivo · {flow.counts.exited} saíram</p>
							</div>
							<Button type="button" size="sm" variant="outline" onClick={() => open(flow)}>Abrir</Button>
						</article>
					))}
				</>
			)}

			{current && draft && (
				<section className="space-y-4 rounded-3xl bg-white p-6">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<Button type="button" size="sm" variant="outline" onClick={() => {
							open(undefined);
							void load();
						}}>← Voltar</Button>
						<span className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS[current.status].className}`}>{STATUS[current.status].label}</span>
					</div>
					<label className="block space-y-1">
						<span className="block text-xs font-medium text-neutral-600">Nome</span>
						<Input value={draft.name} disabled={readOnly} onChange={(event) => change({ name: event.target.value })} />
					</label>
					<div className="grid gap-3 sm:grid-cols-2">
						<label className="block space-y-1">
							<span className="block text-xs font-medium text-neutral-600">Lista do funil</span>
							<select className={SELECT} disabled={readOnly} value={draft.listId} onChange={(event) => change({ listId: event.target.value })}>
								<option value="">Escolha…</option>
								{lists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}
							</select>
						</label>
						<label className="block space-y-1">
							<span className="block text-xs font-medium text-neutral-600">Começa quando…</span>
							<select className={SELECT} disabled={readOnly} value={draft.triggerTag ? "tag" : "list"} onChange={(event) => change({ triggerTag: event.target.value === "tag" ? tags[0] ?? "cliente" : "" })}>
								<option value="list">a pessoa entra na lista</option>
								<option value="tag">a pessoa da lista recebe uma etiqueta</option>
							</select>
						</label>
					</div>
					{draft.triggerTag !== "" && (
						<label className="block space-y-1">
							<span className="block text-xs font-medium text-neutral-600">Etiqueta que inicia</span>
							<Input value={draft.triggerTag} disabled={readOnly} list="flow-tags" onChange={(event) => change({ triggerTag: event.target.value.toLowerCase() })} />
						</label>
					)}
					<label className="block space-y-1">
						<span className="block text-xs font-medium text-neutral-600">Objetivo: sair do funil ao receber a etiqueta (opcional)</span>
						<Input value={draft.goalTag} disabled={readOnly} list="flow-tags" placeholder="ex.: comprou" onChange={(event) => change({ goalTag: event.target.value.toLowerCase() })} />
					</label>
					<datalist id="flow-tags">{tags.map((tag) => <option key={tag} value={tag} />)}</datalist>
					<p className="text-xs text-neutral-500">Formulário, API e webhook também iniciam o funil: eles colocam a pessoa na lista (e nas etiquetas escolhidas).</p>

					<div className="rounded-2xl bg-neutral-50 p-3">
						<FlowBoard steps={draft.steps} templates={templates} stats={current.stats} readOnly={readOnly} onChange={(steps) => change({ steps })} />
					</div>

					<div className="flex flex-wrap gap-2">
						{readOnly ? (
							<Button type="button" variant="outline" disabled={busy} onClick={() => void act("pause")}>Pausar para editar</Button>
						) : (
							<>
								<Button type="button" variant="outline" disabled={busy || !dirty} onClick={() => void run(async () => {
									await save();
									await load();
									return "Rascunho salvo.";
								})}>Salvar rascunho</Button>
								<Button type="button" disabled={busy} onClick={() => void act("activate")}>Salvar e ativar</Button>
							</>
						)}
						{deleting ? (
							<>
								<Button type="button" disabled={busy} onClick={() => void run(async () => {
									await marketingRequest(`/api/marketing/flows/${openId}`, { method: "DELETE" });
									open(undefined);
									await load();
									return "Funil apagado.";
								})}>Confirmar exclusão</Button>
								<Button type="button" variant="outline" onClick={() => setDeleting(false)}>Voltar</Button>
							</>
						) : <Button type="button" variant="outline" onClick={() => setDeleting(true)}>Apagar funil</Button>}
					</div>
					<p className="text-xs text-neutral-500">Os passos rodam a cada 5 minutos. Cada pessoa passa uma vez por funil. Quem se descadastra sai na hora.</p>
				</section>
			)}
		</div>
	);
}
