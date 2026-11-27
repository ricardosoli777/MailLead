"use client";

// The funnel as a flowchart on a full screen: drag boxes in, draw the lines, click a box to set it up.
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Background, BackgroundVariant, ConnectionLineType, MarkerType, MiniMap, Panel, ReactFlow, ReactFlowProvider, useReactFlow, type EdgeChange, type NodeChange } from "@xyflow/react";
import { ArrowLeft, Maximize2, Minus, Plus, RotateCw, Sparkles, Undo2 } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { confirmDestructive, confirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import type { Branch, Flow, FlowDraft, FlowGraph, FlowNode, FlowStatus, Position, StepType } from "@/lib/marketing/flows-types";
import { addNode, canConnect, connect, createStep, graphErrors, insertOnEdge, layout, MAX_STEPS, newStepId, NODE_WIDTH, openOutput, outputs, positionBelow, removeEdges, removeNodes, START, STEP_LABELS, updateNode, waitText } from "@/lib/marketing/flows-utils";
import { STARTERS } from "@/lib/marketing/starters";
import type { Template } from "@/lib/marketing/types";
import { PickDialog, StartDialog, StepDialog, type Option } from "./flow-dialogs";
import { CanvasActions, EDGE_TYPES, NODE_TYPES, STEP_STYLE, type Line, type LineData, type StartBox, type StepBox } from "./flow-nodes";
import { marketingRequest } from "./marketing-request";
import type { Draft } from "./template-manager";
import { TemplateEditor } from "./template-editor";

const FLOW_STATUS: Record<FlowStatus, { label: string; className: string }> = {
	draft: { label: "Rascunho", className: "bg-neutral-200 text-neutral-700" },
	active: { label: "Ativo", className: "bg-green-100 text-green-800" },
	paused: { label: "Pausado", className: "bg-amber-100 text-amber-800" },
};

const DRAG_TYPE = "application/x-flow-step";
const PALETTE: StepType[] = ["email", "whatsapp", "wait", "condition", "tag", "exit"];
const json = (method: string, body: unknown): RequestInit => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const branchOf = (handle: string | null | undefined): Branch => (handle === "yes" || handle === "no" ? handle : "");

type Props = { flow: Flow; lists: Option[]; templates: Template[]; tags: string[]; onClose: () => void; onChanged: () => Promise<unknown> };

type History = { draft: FlowDraft; past: FlowGraph[]; future: FlowGraph[] };

type Opened =
	| { kind: "step"; id: string }
	| { kind: "start" }
	| { kind: "pick"; from: string; branch: Branch; at?: Position }
	| { kind: "pickLine"; line: LineData }
	| null;

function describe(node: FlowNode, templates: Template[]): { title: string; detail: string; hint: string } {
	switch (node.type) {
		case "email": {
			const template = templates.find((item) => item.id === node.templateId);
			return { title: node.name || template?.name || "E-mail", detail: node.subject || template?.subject || "", hint: template ? "" : "Sem conteúdo ainda" };
		}
		case "whatsapp": return { title: node.name || "Áudio", detail: node.audioId ? "áudio pronto" : "", hint: node.audioId ? "" : "Sem áudio ainda" };
		case "wait": return { title: waitText(node.amount, node.unit), detail: "antes de continuar", hint: "" };
		case "condition": return node.test === "tag"
			? { title: node.tag ? `Tem a etiqueta "${node.tag}"?` : "Tem a etiqueta?", detail: "", hint: node.tag ? "" : "Escolha a etiqueta" }
			: { title: node.test === "clicked" ? "Clicou no e-mail?" : "Abriu o e-mail?", detail: "olha o último enviado", hint: "" };
		case "tag": return { title: node.tag ? `${node.action === "add" ? "Colocar" : "Tirar"} "${node.tag}"` : "Etiqueta", detail: "", hint: node.tag ? "" : "Escolha a etiqueta" };
		case "exit": return { title: "Fim do funil", detail: "", hint: "" };
	}
}

function Editor({ flow, lists, templates: initialTemplates, tags, onClose, onChanged }: Props) {
	const canvas = useReactFlow();
	const initialDraft: FlowDraft = { name: flow.name, listId: flow.listId, triggerTag: flow.triggerTag, goalTag: flow.goalTag, graph: flow.graph };
	const [history, setHistory] = useState<History>({ draft: initialDraft, past: [], future: [] });
	const [saved, setSaved] = useState(() => JSON.stringify(initialDraft));
	const [status, setStatus] = useState<FlowStatus>(flow.status);
	const [templates, setTemplates] = useState(initialTemplates);
	const [opened, setOpened] = useState<Opened>(null);
	const [content, setContent] = useState<{ nodeId: string; draft: Draft } | null>(null);
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [sizes, setSizes] = useState<Record<string, { width: number; height: number }>>({});
	const [showErrors, setShowErrors] = useState(false);
	const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
	const [busy, setBusy] = useState(false);

	const { draft } = history;
	const { graph } = draft;
	const readOnly = status === "active";
	const dirty = JSON.stringify(draft) !== saved;
	const errors = useMemo(() => (showErrors && !readOnly ? graphErrors(graph) : {}), [showErrors, readOnly, graph]);

	/** Changes the drawing; `record` keeps the previous one for "undo". */
	const change = useCallback((edit: (graph: FlowGraph) => FlowGraph, record = true) => {
		setHistory((current) => {
			const next = edit(current.draft.graph);
			if (next === current.draft.graph) return current;
			return { draft: { ...current.draft, graph: next }, past: record ? [...current.past.slice(-49), current.draft.graph] : current.past, future: record ? [] : current.future };
		});
	}, []);
	const remember = () => setHistory((current) => ({ ...current, past: [...current.past.slice(-49), current.draft.graph], future: [] }));
	const patchDraft = (patch: Partial<FlowDraft>) => setHistory((current) => ({ ...current, draft: { ...current.draft, ...patch } }));
	const undo = () => setHistory((current) => (current.past.length ? { draft: { ...current.draft, graph: current.past.at(-1)! }, past: current.past.slice(0, -1), future: [current.draft.graph, ...current.future] } : current));
	const redo = () => setHistory((current) => (current.future.length ? { draft: { ...current.draft, graph: current.future[0] }, past: [...current.past, current.draft.graph], future: current.future.slice(1) } : current));

	useEffect(() => {
		if (!dirty) return;
		const warn = (event: BeforeUnloadEvent) => event.preventDefault();
		window.addEventListener("beforeunload", warn);
		return () => window.removeEventListener("beforeunload", warn);
	}, [dirty]);
	useEffect(() => {
		if (!message || message.error) return;
		const timer = setTimeout(() => setMessage(null), 4000);
		return () => clearTimeout(timer);
	}, [message]);

	const reveal = (at: Position) => {
		const view = canvas.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
		const zoom = canvas.getZoom();
		// Only move the view when the new box would be out of sight.
		if (Math.abs(at.x + NODE_WIDTH / 2 - view.x) * zoom > window.innerWidth / 3 || Math.abs(at.y - view.y) * zoom > window.innerHeight / 4) {
			void canvas.setCenter(at.x + NODE_WIDTH / 2, at.y, { zoom, duration: 300 });
		}
	};

	const full = () => {
		if (graph.nodes.length < MAX_STEPS) return false;
		setMessage({ error: true, text: `Use no máximo ${MAX_STEPS} caixas.` });
		return true;
	};

	/** Adds a box, hanging it from an output when one is given, and opens it. */
	const add = (type: StepType, at: Position, from?: { from: string; branch: Branch }) => {
		if (full()) return;
		const step = createStep(type);
		change((current) => {
			const next = addNode(current, step, at);
			return from ? connect(next, from.from, from.branch, step.id) : next;
		});
		reveal(at);
		setOpened(type === "exit" ? null : { kind: "step", id: step.id });
	};
	const addLine = (type: StepType, line: LineData) => {
		if (full()) return;
		const step = createStep(type);
		change((current) => insertOnEdge(current, line, step));
		setOpened({ kind: "step", id: step.id });
	};
	/** Tapping a block (phones, keyboard) continues the funnel from its lowest free end. */
	const tap = (type: StepType) => {
		const out = openOutput(graph);
		if (out) return add(type, positionBelow(graph, out.from, out.branch), out);
		const center = canvas.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
		add(type, { x: center.x - NODE_WIDTH / 2, y: center.y });
	};

	const drop = (event: React.DragEvent) => {
		event.preventDefault();
		const type = event.dataTransfer.getData(DRAG_TYPE) as StepType;
		if (readOnly || !PALETTE.includes(type)) return;
		const point = canvas.screenToFlowPosition({ x: event.clientX, y: event.clientY });
		// Dropped on a line: the box goes in the middle of it.
		const line = type === "exit" ? undefined : graph.edges.find((edge) => {
			const source = edge.from === START ? graph.start : graph.nodes.find((node) => node.id === edge.from)!;
			const target = graph.nodes.find((node) => node.id === edge.to)!;
			const x = (source.x + target.x + NODE_WIDTH) / 2;
			const y = (source.y + (sizes[edge.from]?.height ?? 70) + target.y) / 2;
			return Math.abs(point.x - x) < 60 && Math.abs(point.y - y) < 30;
		});
		if (line) return addLine(type, { from: line.from, branch: line.branch });
		add(type, { x: point.x - NODE_WIDTH / 2, y: point.y - 30 });
	};

	const openFlowOutputs = (id: string, type: StepType | typeof START) => outputs(type).filter((branch) => !graph.edges.some((edge) => edge.from === id && edge.branch === branch));
	const triggerText = draft.triggerTag ? `Recebe "${draft.triggerTag}"` : "Entra na lista";
	const listName = lists.find((list) => list.id === draft.listId)?.name;

	const nodes: (StartBox | StepBox)[] = [
		{
			id: START,
			type: "start",
			position: graph.start,
			measured: sizes[START],
			selected: selected.has(START),
			deletable: false,
			data: { detail: triggerText, goal: [listName ?? "Escolha a lista", draft.goalTag && `objetivo: ${draft.goalTag}`].filter(Boolean).join(" · "), error: errors[START] ?? "", open: openFlowOutputs(START, START).length > 0 },
		},
		...graph.nodes.map((node): StepBox => ({
			id: node.id,
			type: "step",
			position: { x: node.x, y: node.y },
			measured: sizes[node.id],
			selected: selected.has(node.id),
			data: {
				step: node,
				...describe(node, templates),
				error: errors[node.id] ?? "",
				stats: flow.status !== "draft" ? flow.stats[node.id] : undefined,
				open: openFlowOutputs(node.id, node.type),
			},
		})),
	];
	const edges: Line[] = graph.edges.map((edge) => {
		const id = `${edge.from}|${edge.branch}`;
		return {
			id,
			type: "line",
			source: edge.from,
			sourceHandle: edge.branch || "out",
			target: edge.to,
			selected: selected.has(id),
			markerEnd: { type: MarkerType.ArrowClosed, color: edge.branch === "yes" ? "#34d399" : edge.branch === "no" ? "#fb7185" : "#a3a3a3" },
			data: { from: edge.from, branch: edge.branch },
		};
	});

	const select = (id: string, on: boolean) => setSelected((current) => {
		const next = new Set(current);
		if (on) next.add(id);
		else next.delete(id);
		return next;
	});
	const onNodesChange = (changes: NodeChange[]) => {
		for (const item of changes) {
			if (item.type === "position" && item.position) {
				const at = { x: Math.round(item.position.x), y: Math.round(item.position.y) };
				change((current) => (item.id === START ? { ...current, start: at } : updateNode(current, item.id, at)), false);
			} else if (item.type === "dimensions" && item.dimensions) {
				const size = item.dimensions;
				setSizes((current) => ({ ...current, [item.id]: size }));
			} else if (item.type === "select") {
				select(item.id, item.selected);
			}
		}
	};
	const onEdgesChange = (changes: EdgeChange[]) => {
		for (const item of changes) if (item.type === "select") select(item.id, item.selected);
	};

	const actions = useMemo(() => ({
		readOnly,
		addAfter: (from: string, branch: Branch) => setOpened({ kind: "pick", from, branch }),
		addOnLine: (line: LineData) => setOpened({ kind: "pickLine", line }),
		removeLine: (line: LineData) => change((current) => removeEdges(current, [line])),
	}), [readOnly, change]);

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
		await marketingRequest(`/api/marketing/flows/${flow.id}`, json("PUT", draft));
		setSaved(JSON.stringify(draft));
	};
	const activate = () => {
		const problems = graphErrors(graph);
		if (!draft.listId) {
			setOpened({ kind: "start" });
			return setMessage({ error: true, text: "Escolha a lista que inicia o funil." });
		}
		if (!graph.nodes.length) return setMessage({ error: true, text: "Adicione pelo menos um passo." });
		const ids = Object.keys(problems);
		if (ids.length) {
			setShowErrors(true);
			void canvas.fitView({ nodes: ids.map((id) => ({ id })), duration: 400, maxZoom: 1, padding: 0.4 });
			return setMessage({ error: true, text: ids.length === 1 ? problems[ids[0]] : `Faltam ajustes em ${ids.length} caixas, marcadas em vermelho.` });
		}
		void run(async () => {
			// Activating always saves first, so what runs is what is on the screen.
			await save();
			await marketingRequest(`/api/marketing/flows/${flow.id}`, json("PATCH", { action: "activate" }));
			setStatus("active");
			setOpened(null);
			await onChanged();
			return "Funil ativo. Quem entrar a partir de agora percorre os passos.";
		});
	};
	const pause = () => void run(async () => {
		await marketingRequest(`/api/marketing/flows/${flow.id}`, json("PATCH", { action: "pause" }));
		setStatus("paused");
		await onChanged();
		return "Funil pausado. Ninguém avança nem recebe até reativar.";
	});
	const remove = async () => {
		if (!(await confirmDestructive(`Apagar o funil "${draft.name}"? Quem está nele para de receber.`))) return;
		await run(async () => {
			await marketingRequest(`/api/marketing/flows/${flow.id}`, { method: "DELETE" });
			await onChanged();
			onClose();
			return "Funil apagado.";
		});
	};
	const back = async () => {
		if (dirty && !(await confirmDialog("Há alterações não salvas. Sair mesmo assim?"))) return;
		await onChanged();
		onClose();
	};

	const current = opened?.kind === "step" ? graph.nodes.find((node) => node.id === opened.id) : undefined;

	const write = (nodeId: string, starterKey: string) => {
		const node = graph.nodes.find((item) => item.id === nodeId);
		if (node?.type !== "email") return;
		const starter = STARTERS.find((item) => item.key === starterKey);
		// The footer is the sender's: reuse the one already written.
		const footer = templates[0]?.design.footer ?? STARTERS[0].design.footer;
		const base = starter ? structuredClone(starter.design) : { accent: "#0b57d0", preheader: "", blocks: [{ type: "text" as const, text: "Olá, {{nome|tudo bem}}!" }], footer };
		setOpened(null);
		setContent({ nodeId, draft: { id: null, name: `${draft.name} · ${node.name || "E-mail"}`.slice(0, 120), subject: node.subject || starter?.subject || "", design: { ...base, footer: { ...footer } } } });
	};
	const editContent = (nodeId: string) => {
		const node = graph.nodes.find((item) => item.id === nodeId);
		const template = node?.type === "email" ? templates.find((item) => item.id === node.templateId) : undefined;
		if (!template) return;
		setOpened(null);
		setContent({ nodeId, draft: { id: template.id, name: template.name, subject: template.subject, design: structuredClone(template.design) } });
	};

	const keyDown = (event: React.KeyboardEvent) => {
		const target = event.target as HTMLElement;
		if (target.closest("input, textarea, select") || opened || content) return;
		if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z" && !readOnly) {
			event.preventDefault();
			if (event.shiftKey) redo();
			else undo();
		} else if (event.key === "Enter" && target.classList.contains("react-flow__node")) {
			const id = target.dataset.id!;
			setOpened(id === START ? { kind: "start" } : { kind: "step", id });
		}
	};

	const tool = "flex h-9 w-9 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100 disabled:opacity-30";

	return (
		<div className="fixed inset-0 z-[120] flex flex-col bg-neutral-50 text-neutral-900" onKeyDown={keyDown}>
			{/* The app header and sidebar go up to z-110, so dialogs opened from here must sit above them too. */}
			<style>{"body .dialog-overlay, body .dialog-content { z-index: 130; }"}</style>
			<header className="flex flex-wrap items-center gap-2 border-b border-neutral-200 bg-white px-3 py-2">
				<Button type="button" size="sm" variant="ghost" onClick={() => void back()}><ArrowLeft className="h-4 w-4" />Funis</Button>
				<Input className="!h-9 w-full max-w-xs flex-1 font-medium" aria-label="Nome do funil" disabled={readOnly} value={draft.name} onChange={(event) => patchDraft({ name: event.target.value })} />
				<span className={`rounded-full px-2 py-1 text-xs font-medium ${FLOW_STATUS[status].className}`}>{FLOW_STATUS[status].label}</span>
				{dirty && <span className="text-xs text-amber-700">alterações não salvas</span>}
				<div className="ml-auto flex flex-wrap gap-2">
					<Button type="button" size="sm" variant="ghost" className="text-red-600" disabled={busy} onClick={() => void remove()}>Apagar</Button>
					{readOnly ? (
						<Button type="button" size="sm" variant="outline" disabled={busy} onClick={pause}>Pausar para editar</Button>
					) : (
						<>
							<Button type="button" size="sm" variant="outline" disabled={busy || !dirty} onClick={() => void run(async () => {
								await save();
								await onChanged();
								return "Rascunho salvo.";
							})}>Salvar rascunho</Button>
							<Button type="button" size="sm" disabled={busy} onClick={activate}>Salvar e ativar</Button>
						</>
					)}
				</div>
			</header>

			<div className="flex min-h-0 flex-1 flex-col md:flex-row">
				{!readOnly && (
					<aside aria-label="Blocos" className="flex gap-2 overflow-x-auto border-b border-neutral-200 bg-white p-3 md:w-52 md:flex-col md:overflow-y-auto md:border-b-0 md:border-r">
						<p className="hidden text-xs text-neutral-500 md:block">Arraste um bloco para a tela, ou clique para continuar o funil.</p>
						{PALETTE.map((type) => {
							const { icon: Icon, badge } = STEP_STYLE[type];
							return (
								<button key={type} type="button" draggable className="flex shrink-0 cursor-grab items-center gap-2 rounded-xl border border-neutral-200 bg-white p-2 pr-3 text-sm font-medium shadow-sm hover:border-blue-500 active:cursor-grabbing" onDragStart={(event) => {
									event.dataTransfer.setData(DRAG_TYPE, type);
									event.dataTransfer.effectAllowed = "copy";
								}} onClick={() => tap(type)}>
									<span className={`flex h-8 w-8 items-center justify-center rounded-lg ${badge}`}><Icon className="h-4 w-4" /></span>
									{STEP_LABELS[type]}
								</button>
							);
						})}
					</aside>
				)}

				<div className="relative min-h-0 flex-1" onDragOver={(event) => {
					event.preventDefault();
					event.dataTransfer.dropEffect = "copy";
				}} onDrop={drop}>
					<CanvasActions.Provider value={actions}>
						<ReactFlow
							nodes={nodes}
							edges={edges}
							nodeTypes={NODE_TYPES}
							edgeTypes={EDGE_TYPES}
							onNodesChange={onNodesChange}
							onEdgesChange={onEdgesChange}
							onNodeDragStart={remember}
							onSelectionDragStart={remember}
							onNodeClick={(event, node) => {
								if ((event.target as Element).closest(".react-flow__handle")) return;
								setOpened(node.id === START ? { kind: "start" } : { kind: "step", id: node.id });
							}}
							onConnect={(link) => change((now) => connect(now, link.source, branchOf(link.sourceHandle), link.target))}
							isValidConnection={(link) => canConnect(graph, link.source, branchOf(link.sourceHandle), link.target)}
							onConnectEnd={(event, state) => {
								// A line let go on empty canvas asks what comes next, right there.
								if (state.toNode || state.fromHandle?.type !== "source" || !state.fromNode) return;
								if (!(event.target as Element).classList.contains("react-flow__pane")) return;
								const point = "changedTouches" in event ? event.changedTouches[0] : event;
								const at = canvas.screenToFlowPosition({ x: point.clientX, y: point.clientY });
								setOpened({ kind: "pick", from: state.fromNode.id, branch: branchOf(state.fromHandle.id), at: { x: at.x - NODE_WIDTH / 2, y: at.y } });
							}}
							onBeforeDelete={async (gone) => {
								// Removal is done here so that a straight path stays joined and "undo" has one entry.
								const ids = gone.nodes.map((node) => node.id).filter((id) => id !== START);
								const lines = (gone.edges as Line[]).filter((edge) => !ids.includes(edge.source) && !ids.includes(edge.target)).map((edge) => edge.data!);
								if (ids.length || lines.length) change((now) => removeNodes(removeEdges(now, lines), ids));
								setSelected(new Set());
								return false;
							}}
							nodesDraggable={!readOnly}
							nodesConnectable={!readOnly}
							deleteKeyCode={readOnly || opened || content ? null : ["Delete", "Backspace"]}
							connectionLineType={ConnectionLineType.SmoothStep}
							connectionRadius={36}
							snapToGrid
							snapGrid={[10, 10]}
							minZoom={0.25}
							maxZoom={1.75}
							fitView
							fitViewOptions={{ maxZoom: 1, padding: 0.2 }}
							proOptions={{ hideAttribution: true }}
						>
							<Background variant={BackgroundVariant.Dots} gap={20} size={1.5} color="#d4d4d4" />
							<MiniMap pannable zoomable className="!hidden md:!block" ariaLabel="Mapa do funil" nodeColor={(node) => (node.type === "start" ? "#171717" : STEP_STYLE[(node as StepBox).data.step.type].accent)} />
							<Panel position="bottom-left" className="flex gap-1 rounded-xl border border-neutral-200 bg-white p-1 shadow-sm">
								{!readOnly && (
									<>
										<button type="button" className={tool} aria-label="Desfazer" title="Desfazer (Ctrl+Z)" disabled={!history.past.length} onClick={undo}><Undo2 className="h-4 w-4" /></button>
										<button type="button" className={tool} aria-label="Refazer" title="Refazer (Ctrl+Shift+Z)" disabled={!history.future.length} onClick={redo}><RotateCw className="h-4 w-4" /></button>
										<button type="button" className={tool} aria-label="Organizar" title="Organizar as caixas" onClick={() => {
											change(layout);
											setTimeout(() => void canvas.fitView({ duration: 300, maxZoom: 1, padding: 0.2 }), 60);
										}}><Sparkles className="h-4 w-4" /></button>
									</>
								)}
								<button type="button" className={tool} aria-label="Diminuir" title="Diminuir" onClick={() => void canvas.zoomOut()}><Minus className="h-4 w-4" /></button>
								<button type="button" className={tool} aria-label="Aumentar" title="Aumentar" onClick={() => void canvas.zoomIn()}><Plus className="h-4 w-4" /></button>
								<button type="button" className={tool} aria-label="Ver tudo" title="Ver o funil inteiro" onClick={() => void canvas.fitView({ duration: 300, maxZoom: 1, padding: 0.2 })}><Maximize2 className="h-4 w-4" /></button>
							</Panel>
							{!graph.nodes.length && !readOnly && (
								<Panel position="top-center" className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-xs text-neutral-600 shadow-sm">
									Arraste um bloco para cá, ou toque no + abaixo do Início.
								</Panel>
							)}
						</ReactFlow>
					</CanvasActions.Provider>
				</div>
			</div>

			{message && !content && <p role="status" className={`fixed inset-x-4 top-16 z-[140] mx-auto w-fit max-w-xl rounded-xl px-4 py-3 text-sm shadow-lg ${message.error ? "bg-red-50 text-red-800" : "bg-green-50 text-green-800"}`} onClick={() => setMessage(null)}>{message.text}</p>}

			{opened?.kind === "start" && <StartDialog draft={draft} lists={lists} tags={tags} readOnly={readOnly} onChange={patchDraft} onClose={() => setOpened(null)} />}
			{opened?.kind === "pick" && <PickDialog types={PALETTE} onClose={() => setOpened(null)} onPick={(type) => add(type, opened.at ?? positionBelow(graph, opened.from, opened.branch), opened)} />}
			{opened?.kind === "pickLine" && <PickDialog types={PALETTE.filter((type) => type !== "exit")} onClose={() => setOpened(null)} onPick={(type) => addLine(type, opened.line)} />}
			{current && (
				<StepDialog
					key={current.id}
					step={current}
					templates={templates}
					tags={tags}
					stats={flow.status !== "draft" ? flow.stats[current.id] : undefined}
					error={errors[current.id] ?? ""}
					readOnly={readOnly}
					onChange={(patch) => change((now) => updateNode(now, current.id, patch))}
					onCreateContent={(starter) => write(current.id, starter)}
					onEditContent={() => editContent(current.id)}
					onDuplicate={() => {
						if (full()) return;
						const copy = { ...current, id: newStepId() };
						change((now) => addNode(now, copy, { x: current.x + NODE_WIDTH + 40, y: current.y + 40 }));
						setOpened(null);
						setMessage({ error: false, text: "Cópia criada ao lado. Ligue-a onde quiser." });
					}}
					onDelete={() => {
						change((now) => removeNodes(now, [current.id]));
						setOpened(null);
					}}
					onClose={() => setOpened(null)}
				/>
			)}

			{content && (
				<div className="absolute inset-0 z-10 overflow-y-auto bg-neutral-100 px-4 pb-4">
					<div className="mx-auto max-w-3xl space-y-3 pt-3">
						<p className="text-sm text-neutral-600">Escreva e clique em <strong>Salvar modelo</strong>. Depois, <strong>Voltar</strong> leva ao fluxo.</p>
						<TemplateEditor
							stickyBar
							initial={content.draft}
							onSaved={(template) => {
								setTemplates((list) => [template, ...list.filter((item) => item.id !== template.id)]);
								change((now) => updateNode(now, content.nodeId, { templateId: template.id }));
							}}
							onClose={() => {
								setOpened({ kind: "step", id: content.nodeId });
								setContent(null);
							}}
						/>
					</div>
				</div>
			)}
		</div>
	);
}

export default function FlowEditor(props: Props) {
	return createPortal(<ReactFlowProvider><Editor {...props} /></ReactFlowProvider>, document.body);
}
