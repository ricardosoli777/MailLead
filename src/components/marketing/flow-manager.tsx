"use client";

import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Flow } from "@/lib/marketing/flows-types";
import { recipeGraph, RECIPES } from "@/lib/marketing/flows-utils";
import type { Template } from "@/lib/marketing/types";
import { AiFlowChat } from "./ai-flow-chat";
import type { Option } from "./flow-dialogs";
import { marketingRequest } from "./marketing-request";

// The canvas is heavy, so it only loads when a funnel is opened.
const FlowEditor = lazy(() => import("./flow-editor"));

const SELECT = "h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm";
const STATUS = { draft: ["Rascunho", "bg-neutral-200 text-neutral-700"], active: ["Ativo", "bg-green-100 text-green-800"], paused: ["Pausado", "bg-amber-100 text-amber-800"] } as const;

export function FlowManager() {
	const [flows, setFlows] = useState<Flow[]>([]);
	const [tags, setTags] = useState<string[]>([]);
	const [lists, setLists] = useState<Option[]>([]);
	const [templates, setTemplates] = useState<Template[]>([]);
	const [openId, setOpenId] = useState("");
	const [name, setName] = useState("");
	const [recipeId, setRecipeId] = useState<string>("welcome");
	const recipe = RECIPES.find((item) => item.id === recipeId)!;
	const [error, setError] = useState("");
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
	}, []);
	useEffect(() => {
		void load().catch((loadError: Error) => setError(loadError.message));
	}, [load]);

	const current = flows.find((flow) => flow.id === openId);

	async function create() {
		setBusy(true);
		setError("");
		try {
			const { id } = await marketingRequest<{ id: string }>("/api/marketing/flows", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name, listId: lists.length === 1 ? lists[0].id : "", triggerTag: recipe.triggerTag, goalTag: recipe.goalTag, graph: recipeGraph(recipe.id) }),
			});
			await load();
			setName("");
			setOpenId(id);
		} catch (createError) {
			setError((createError as Error).message);
		} finally {
			setBusy(false);
		}
	}

	return (
		<div className="max-w-3xl space-y-6">
			{error && <p role="alert" className="text-sm text-red-600">{error}</p>}
			<AiFlowChat listId={lists.length === 1 ? lists[0].id : ""} onCreated={async (id) => {
				await load();
				setOpenId(id);
			}} />
			<section className="space-y-3 rounded-3xl bg-white p-6">
				<h2 className="text-base font-semibold">Novo funil</h2>
				<p className="text-sm text-neutral-500">Desenhe o fluxograma como quiser. O conteúdo de cada e-mail pode ser escrito depois.</p>
				<label className="block space-y-1">
					<span className="block text-xs font-medium text-neutral-600">Começar de</span>
					<select className={SELECT} value={recipeId} onChange={(event) => setRecipeId(event.target.value)}>
						{RECIPES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
					</select>
					<span className="block text-xs text-neutral-500">{recipe.help}</span>
				</label>
				<form className="flex gap-2" onSubmit={(event) => {
					event.preventDefault();
					if (name.trim()) void create();
				}}>
					<Input value={name} placeholder="Nome do funil (ex.: Boas-vindas)" aria-label="Nome do novo funil" onChange={(event) => setName(event.target.value)} />
					<Button type="submit" disabled={busy || !name.trim()}>Criar funil</Button>
				</form>
			</section>
			{flows.map((flow) => (
				<article key={flow.id} className="flex flex-wrap items-center justify-between gap-2 rounded-3xl bg-white p-6">
					<div>
						<h3 className="text-sm font-medium">{flow.name} <span className={`ml-1 rounded-full px-2 py-1 text-xs ${STATUS[flow.status][1]}`}>{STATUS[flow.status][0]}</span>{flow.testing && <span className="ml-1 rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700">teste aberto</span>}</h3>
						<p className="text-xs text-neutral-500">{flow.counts.active} no funil · {flow.counts.done} concluíram · {flow.counts.goal} no objetivo · {flow.counts.exited} saíram</p>
					</div>
					<Button type="button" size="sm" variant="outline" onClick={() => setOpenId(flow.id)}>Abrir fluxo</Button>
				</article>
			))}
			{current && (
				<Suspense fallback={<p className="text-sm text-neutral-500">Abrindo o fluxo…</p>}>
					<FlowEditor key={current.id} flow={current} lists={lists} templates={templates} tags={tags} onClose={() => setOpenId("")} onChanged={load} />
				</Suspense>
			)}
		</div>
	);
}
