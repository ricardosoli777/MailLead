/** The funnel as a flowchart: boxes and the lines between them. Pure, shared by the builder and the server. */
import type { Branch, FlowEdge, FlowGraph, FlowNode, FlowStep, Position, StepType, WaitUnit } from "./flows-types";

export const MAX_STEPS = 30;
export const MAX_MESSAGE = 2000;
export const START = "start";
export const NODE_WIDTH = 240;
const COLUMN = 290;
const ROW = 160;

export const STEP_LABELS: Record<StepType, string> = { email: "Enviar e-mail", whatsapp: "WhatsApp", wait: "Esperar", condition: "Condição", tag: "Etiqueta", exit: "Fim" };

export const WAIT_UNITS: Record<WaitUnit, { one: string; many: string; ms: number }> = {
	seconds: { one: "segundo", many: "segundos", ms: 1000 },
	minutes: { one: "minuto", many: "minutos", ms: 60_000 },
	hours: { one: "hora", many: "horas", ms: 3_600_000 },
	days: { one: "dia", many: "dias", ms: 86_400_000 },
};
export const MAX_WAIT = 999;
export const readUnit = (value: unknown): WaitUnit => (typeof value === "string" && Object.hasOwn(WAIT_UNITS, value) ? (value as WaitUnit) : "days");
export const waitText = (amount: number, unit: WaitUnit) => `${amount} ${amount === 1 ? WAIT_UNITS[unit].one : WAIT_UNITS[unit].many}`;

export const newStepId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 12);

export function createStep(type: StepType, id = newStepId()): FlowStep {
	switch (type) {
		case "email": return { id, type, name: "", templateId: "", subject: "" };
		case "whatsapp": return { id, type, name: "", audioId: "", message: "", messageFirst: true };
		case "wait": return { id, type, amount: 1, unit: "days" };
		case "condition": return { id, type, test: "clicked", tag: "" };
		case "tag": return { id, type, action: "add", tag: "" };
		case "exit": return { id, type };
	}
}

export const emptyGraph = (): FlowGraph => ({ start: { x: 0, y: 0 }, nodes: [], edges: [] });

export const outputs = (type: StepType | typeof START): Branch[] => (type === "condition" ? ["yes", "no"] : type === "exit" ? [] : [""]);

const typeOf = (graph: FlowGraph, id: string) => (id === START ? START : graph.nodes.find((node) => node.id === id)?.type);

const text = (value: unknown, max: number) => (typeof value === "string" ? value.slice(0, max) : "");
const tagText = (value: unknown) => text(value, 40).trim().toLowerCase();
const coordinate = (value: unknown) => Math.max(-20000, Math.min(20000, Math.round(Number(value)) || 0));

function readStep(raw: Record<string, unknown>, id: string, type: StepType): FlowStep {
	switch (type) {
		case "email": return { id, type, name: text(raw.name, 80), templateId: text(raw.templateId, 80), subject: text(raw.subject, 300) };
		case "whatsapp": return { id, type, name: text(raw.name, 80), audioId: text(raw.audioId, 80), message: text(raw.message, MAX_MESSAGE), messageFirst: raw.messageFirst !== false };
		case "wait": return { id, type, amount: Math.trunc(Number(raw.amount)) || 0, unit: readUnit(raw.unit) };
		case "condition": return { id, type, test: raw.test === "opened" || raw.test === "tag" ? raw.test : "clicked", tag: tagText(raw.tag) };
		case "tag": return { id, type, action: raw.action === "remove" ? "remove" : "add", tag: tagText(raw.tag) };
		case "exit": return { id, type };
	}
}

/** Rebuilds the drawing from untrusted JSON. Unfinished drawings are fine (drafts); broken boxes are not. */
export function parseGraph(input: unknown): { graph: FlowGraph } | { error: string } {
	const value = (input ?? {}) as { start?: Record<string, unknown>; nodes?: unknown; edges?: unknown };
	const rawNodes = Array.isArray(value.nodes) ? (value.nodes as Record<string, unknown>[]) : [];
	if (rawNodes.length > MAX_STEPS) return { error: `Use no máximo ${MAX_STEPS} caixas.` };
	const graph: FlowGraph = { start: { x: coordinate(value.start?.x), y: coordinate(value.start?.y) }, nodes: [], edges: [] };
	const types = new Map<string, StepType | typeof START>([[START, START]]);
	for (const raw of rawNodes) {
		const type = raw?.type as StepType;
		const id = text(raw?.id, 20);
		if (!Object.hasOwn(STEP_LABELS, type) || !/^[a-z0-9]{4,20}$/.test(id) || types.has(id)) return { error: "Passo inválido." };
		types.set(id, type);
		graph.nodes.push({ ...readStep(raw, id, type), x: coordinate(raw.x), y: coordinate(raw.y) });
	}
	// Lines that no longer make sense are dropped: one line per output, none into the start.
	const used = new Set<string>();
	for (const raw of Array.isArray(value.edges) ? (value.edges as Record<string, unknown>[]).slice(0, MAX_STEPS * 2 + 1) : []) {
		const from = text(raw?.from, 20);
		const to = text(raw?.to, 20);
		const branch: Branch = raw?.branch === "yes" || raw?.branch === "no" ? raw.branch : "";
		const source = types.get(from);
		if (!source || to === START || !types.has(to) || !outputs(source).includes(branch) || used.has(`${from}:${branch}`)) continue;
		used.add(`${from}:${branch}`);
		graph.edges.push({ from, to, branch });
	}
	return { graph };
}

const targets = (graph: FlowGraph, id: string) => graph.edges.filter((edge) => edge.from === id).sort((a, b) => (a.branch === "no" ? 1 : 0) - (b.branch === "no" ? 1 : 0)).map((edge) => edge.to);

function reachable(graph: FlowGraph, from: string): Set<string> {
	const seen = new Set<string>();
	const queue = [from];
	while (queue.length) {
		for (const next of targets(graph, queue.pop()!)) {
			if (!seen.has(next)) {
				seen.add(next);
				queue.push(next);
			}
		}
	}
	return seen;
}

/** A funnel only goes forward: no line into the start, onto itself or back up the path. */
export function canConnect(graph: FlowGraph, from: string, branch: Branch, to: string): boolean {
	const source = typeOf(graph, from);
	return !!source && outputs(source).includes(branch) && to !== START && to !== from && !!typeOf(graph, to) && !reachable(graph, to).has(from);
}

/** Draws a line, replacing the one that already left from the same output. */
export function connect(graph: FlowGraph, from: string, branch: Branch, to: string): FlowGraph {
	if (!canConnect(graph, from, branch, to)) return graph;
	return { ...graph, edges: [...graph.edges.filter((edge) => edge.from !== from || edge.branch !== branch), { from, to, branch }] };
}

export const addNode = (graph: FlowGraph, step: FlowStep, at: Position): FlowGraph =>
	graph.nodes.length >= MAX_STEPS ? graph : { ...graph, nodes: [...graph.nodes, { ...step, x: Math.round(at.x), y: Math.round(at.y) }] };

export const updateNode = (graph: FlowGraph, id: string, patch: object): FlowGraph =>
	({ ...graph, nodes: graph.nodes.map((node) => (node.id === id ? ({ ...node, ...patch } as FlowNode) : node)) });

export const removeEdges = (graph: FlowGraph, gone: { from: string; branch: Branch }[]): FlowGraph =>
	({ ...graph, edges: graph.edges.filter((edge) => !gone.some((item) => item.from === edge.from && item.branch === edge.branch)) });

/** Removes boxes. A box in the middle of a straight path leaves the path joined. */
export function removeNodes(graph: FlowGraph, ids: string[]): FlowGraph {
	return ids.reduce((current, id) => {
		const node = current.nodes.find((item) => item.id === id);
		if (!node) return current;
		const after = node.type === "condition" ? undefined : current.edges.find((edge) => edge.from === id)?.to;
		const edges = current.edges.flatMap((edge): FlowEdge[] => {
			if (edge.from === id) return [];
			if (edge.to !== id) return [edge];
			return after ? [{ ...edge, to: after }] : [];
		});
		return { ...current, nodes: current.nodes.filter((item) => item.id !== id), edges };
	}, graph);
}

/** Puts a new box in the middle of a line, pushing down what comes after if there is no room. */
export function insertOnEdge(graph: FlowGraph, line: { from: string; branch: Branch }, step: FlowStep): FlowGraph {
	const edge = graph.edges.find((item) => item.from === line.from && item.branch === line.branch);
	// An end cannot sit in the middle of a path.
	if (!edge || step.type === "exit" || graph.nodes.length >= MAX_STEPS) return graph;
	const source = edge.from === START ? graph.start : graph.nodes.find((node) => node.id === edge.from)!;
	const target = graph.nodes.find((node) => node.id === edge.to)!;
	const shift = Math.max(0, source.y + 2 * ROW - target.y);
	const below = reachable(graph, edge.to).add(edge.to);
	const nodes = graph.nodes.map((node) => (shift && below.has(node.id) ? { ...node, y: node.y + shift } : node));
	const at = { x: Math.round((source.x + target.x) / 2), y: Math.round((source.y + target.y + shift) / 2) };
	const edges: FlowEdge[] = [
		...graph.edges.filter((item) => item !== edge),
		{ from: edge.from, to: step.id, branch: edge.branch },
		{ from: step.id, to: edge.to, branch: step.type === "condition" ? "yes" : "" },
	];
	return { ...graph, nodes: [...nodes, { ...step, ...at }], edges };
}

/** Where a new box goes when it hangs from a given output. */
export function positionBelow(graph: FlowGraph, from: string, branch: Branch): Position {
	const source = from === START ? graph.start : graph.nodes.find((node) => node.id === from) ?? graph.start;
	const at = { x: source.x + (branch === "yes" ? -COLUMN / 2 : branch === "no" ? COLUMN / 2 : 0), y: source.y + ROW };
	while (graph.nodes.some((node) => Math.abs(node.x - at.x) < NODE_WIDTH && Math.abs(node.y - at.y) < ROW / 2)) at.x += branch === "yes" ? -COLUMN : COLUMN;
	return at;
}

/** The output a tapped block should hang from: the lowest one still free. */
export function openOutput(graph: FlowGraph): { from: string; branch: Branch } | null {
	const boxes = [{ id: START as string, type: START as StepType | typeof START, ...graph.start }, ...graph.nodes];
	const connected = reachable(graph, START).add(START);
	const free = boxes.filter((box) => connected.has(box.id)).flatMap((box) => outputs(box.type)
		.filter((branch) => !graph.edges.some((edge) => edge.from === box.id && edge.branch === branch))
		.map((branch) => ({ from: box.id, branch, y: box.y })));
	const best = free.sort((a, b) => b.y - a.y)[0];
	return best ? { from: best.from, branch: best.branch } : null;
}

/** Arranges the boxes top to bottom, "Sim" on the left. Loose boxes go to the right. */
export function layout(graph: FlowGraph): FlowGraph {
	const column = new Map<string, number>();
	const level = new Map<string, number>();
	let leaf = 0;
	const deepen = (id: string, depth: number, path: Set<string>) => {
		if (path.has(id) || (level.get(id) ?? -1) >= depth) return;
		level.set(id, depth);
		path.add(id);
		for (const next of targets(graph, id)) deepen(next, depth + 1, path);
		path.delete(id);
	};
	const place = (id: string): number | null => {
		if (column.has(id)) return null;
		column.set(id, Number.NaN);
		const below = targets(graph, id).map(place).filter((value): value is number => value !== null);
		const value = below.length ? below.reduce((sum, item) => sum + item, 0) / below.length : leaf++;
		column.set(id, value);
		return value;
	};
	const pointed = new Set(graph.edges.map((edge) => edge.to));
	const roots = [START, ...graph.nodes.filter((node) => !pointed.has(node.id)).map((node) => node.id), ...graph.nodes.map((node) => node.id)];
	for (const root of roots) {
		if (column.has(root)) continue;
		deepen(root, root === START ? 0 : 1, new Set());
		place(root);
	}
	const rows = new Map<number, string[]>();
	for (const [id, depth] of level) rows.set(depth, [...(rows.get(depth) ?? []), id]);
	for (const ids of rows.values()) {
		ids.sort((a, b) => column.get(a)! - column.get(b)!);
		ids.forEach((id, index) => {
			if (index) column.set(id, Math.max(column.get(id)!, column.get(ids[index - 1])! + 1));
		});
	}
	const origin = column.get(START)!;
	const at = (id: string) => ({ x: Math.round((column.get(id)! - origin) * COLUMN), y: (level.get(id) ?? 1) * ROW });
	return { start: at(START), nodes: graph.nodes.map((node) => ({ ...node, ...at(node.id) })), edges: graph.edges };
}

/** Why each box stops the funnel from being activated (F6), keyed by box id or "start". Empty when ready. */
export function graphErrors(graph: FlowGraph): Record<string, string> {
	const errors: Record<string, string> = {};
	if (!graph.edges.some((edge) => edge.from === START)) errors[START] = "Ligue o Início ao primeiro passo.";
	const connected = reachable(graph, START);
	// Boxes in an order where everything that leads to a box comes before it.
	const waiting = new Map<string, number>(graph.nodes.map((node) => [node.id, 0]));
	for (const edge of graph.edges) waiting.set(edge.to, (waiting.get(edge.to) ?? 0) + 1);
	const queue = [START, ...graph.nodes.filter((node) => !waiting.get(node.id)).map((node) => node.id)];
	const order: string[] = [];
	while (queue.length) {
		const id = queue.shift()!;
		order.push(id);
		for (const next of targets(graph, id)) {
			waiting.set(next, waiting.get(next)! - 1);
			if (waiting.get(next) === 0) queue.push(next);
		}
	}
	// True when an e-mail was sent on every path that arrives at the box.
	const mailed = new Map<string, boolean>();
	for (const id of order) {
		const sends = typeOf(graph, id) === "email" || (mailed.get(id) ?? false);
		for (const next of targets(graph, id)) mailed.set(next, (mailed.get(next) ?? true) && sends);
	}
	for (const node of graph.nodes) {
		const lines = graph.edges.filter((edge) => edge.from === node.id).length;
		if (!connected.has(node.id)) errors[node.id] = "Caixa solta: ligue-a ao funil ou apague.";
		else if (!order.includes(node.id)) errors[node.id] = "Uma linha volta para trás. O funil só anda para a frente.";
		else if (node.type === "email" && !node.templateId) errors[node.id] = "Falta o conteúdo: escolha ou crie o e-mail.";
		else if (node.type === "whatsapp" && !node.audioId && !node.message?.trim()) errors[node.id] = "Escreva a mensagem ou grave um áudio.";
		else if (node.type === "wait" && (node.amount < 1 || node.amount > MAX_WAIT)) errors[node.id] = `Informe a espera, de 1 a ${MAX_WAIT}.`;
		else if (node.type === "tag" && !node.tag) errors[node.id] = "Escreva a etiqueta.";
		else if (node.type === "condition") {
			if (node.test === "tag" && !node.tag) errors[node.id] = "Escreva a etiqueta.";
			else if (node.test !== "tag" && !mailed.get(node.id)) errors[node.id] = "Coloque um e-mail antes desta condição.";
			else if (lines < 2) errors[node.id] = "Ligue os dois caminhos: Sim e Não.";
		}
	}
	return errors;
}

export type Node = { step: FlowStep; next: string | null; yes: string | null; no: string | null };

/** Where each box leads, in the shape the engine walks. */
export function successors(graph: FlowGraph): Map<string, Node> {
	const to = (from: string, branch: Branch) => graph.edges.find((edge) => edge.from === from && edge.branch === branch)?.to ?? null;
	return new Map(graph.nodes.map((node) => [node.id, { step: node, next: to(node.id, ""), yes: to(node.id, "yes"), no: to(node.id, "no") }]));
}

export const firstStep = (graph: FlowGraph): string | null => graph.edges.find((edge) => edge.from === START)?.to ?? null;

/** A list of steps, where a condition carries its two sides: the first builder's format and the recipes'. */
export type TreeStep = { id: string; type: StepType; yes?: TreeStep[]; no?: TreeStep[] } & Record<string, unknown>;

export function fromTree(tree: TreeStep[]): FlowGraph {
	const graph = emptyGraph();
	const end = "fim00end";
	let needsEnd = false;
	const build = (list: TreeStep[], after: string | null) => {
		list.forEach((raw, index) => {
			const next = list[index + 1]?.id ?? after;
			graph.nodes.push({ ...readStep(raw, raw.id, raw.type), x: 0, y: 0 });
			if (raw.type === "condition") {
				for (const branch of ["yes", "no"] as const) {
					const side = raw[branch] ?? [];
					const to = side[0]?.id ?? next ?? end;
					needsEnd ||= to === end;
					graph.edges.push({ from: raw.id, to, branch });
					build(side, next);
				}
			} else if (raw.type !== "exit" && next) {
				graph.edges.push({ from: raw.id, to: next, branch: "" });
			}
		});
	};
	build(tree, null);
	if (needsEnd) graph.nodes.push({ id: end, type: "exit", x: 0, y: 0 });
	if (tree.length) graph.edges.push({ from: START, to: tree[0].id, branch: "" });
	return layout(graph);
}

/** What is stored: a drawing, or a list saved by the first builder. */
export function readGraph(stored: string): FlowGraph {
	const value = JSON.parse(stored) as FlowGraph | TreeStep[];
	if (Array.isArray(value)) return fromTree(value);
	// Written messages were a box of their own for a short while.
	return { ...value, nodes: value.nodes.map((node) => ((node.type as string) === "whatsapp_text" ? ({ ...node, type: "whatsapp", audioId: "" } as FlowNode) : node)) };
}

/** Ready-made funnels, so nobody starts from an empty board. The content is written afterwards. */
export const RECIPES = [
	{ id: "empty", label: "Em branco", help: "Desenhe do zero.", triggerTag: "", goalTag: "", plan: [] },
	{ id: "welcome", label: "Boas-vindas", help: "Três e-mails para quem acabou de entrar na lista.", triggerTag: "", goalTag: "", plan: ["email", 2, "email", 3, "email"] },
	{ id: "material", label: "Entrega de material", help: "Entrega o material e trata diferente quem clicou.", triggerTag: "", goalTag: "", plan: ["email", 1, "click"] },
	{ id: "sale", label: "Sequência de venda", help: "Oferta em três e-mails; quem ganhar a etiqueta \"comprou\" sai.", triggerTag: "", goalTag: "comprou", plan: ["email", 1, "email", 2, "email"] },
	{ id: "customer", label: "Pós-compra", help: "Começa quando a pessoa recebe a etiqueta \"comprou\".", triggerTag: "comprou", goalTag: "", plan: ["email", 3, "email", 7, "email"] },
] as const;

export function recipeGraph(id: string): FlowGraph {
	const recipe = RECIPES.find((item) => item.id === id);
	let mails = 0;
	const mail = (): TreeStep => ({ ...createStep("email"), name: `E-mail ${++mails}` });
	return fromTree((recipe?.plan ?? []).map((item): TreeStep => {
		if (typeof item === "number") return { id: newStepId(), type: "wait", amount: item, unit: "days" };
		if (item === "email") return mail();
		return { id: newStepId(), type: "condition", test: "clicked", yes: [{ id: newStepId(), type: "tag", action: "add", tag: "interessado" }, mail()], no: [mail()] };
	}));
}
