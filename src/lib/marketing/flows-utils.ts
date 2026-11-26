/** The funnel as a tree of steps. Pure, shared by the builder and the server. */
import type { FlowStep, StepType, Target } from "./flows-types";

export const MAX_STEPS = 30;
export const MAX_DEPTH = 3;

export const STEP_LABELS: Record<StepType, string> = { email: "Enviar e-mail", wait: "Esperar", condition: "Condição", tag: "Etiqueta", exit: "Sair do funil" };

export const newStepId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 12);

export function createStep(type: StepType, id = newStepId()): FlowStep {
	switch (type) {
		case "email": return { id, type, templateId: "", subject: "" };
		case "wait": return { id, type, amount: 1, unit: "days" };
		case "condition": return { id, type, test: "clicked", tag: "", yes: [], no: [] };
		case "tag": return { id, type, action: "add", tag: "" };
		case "exit": return { id, type };
	}
}

export const walk = (steps: FlowStep[]): FlowStep[] =>
	steps.flatMap((step) => (step.type === "condition" ? [step, ...walk(step.yes), ...walk(step.no)] : [step]));

const depth = (steps: FlowStep[]): number =>
	Math.max(0, ...steps.map((step) => (step.type === "condition" ? 1 + Math.max(depth(step.yes), depth(step.no)) : 0)));

const text = (value: unknown, max: number) => (typeof value === "string" ? value.slice(0, max) : "");

/** Rebuilds the tree from untrusted JSON. Incomplete steps are fine (drafts); broken ones are not. */
export function parseSteps(input: unknown): { steps: FlowStep[] } | { error: string } {
	const seen = new Set<string>();
	let broken = "";
	const read = (list: unknown, level: number): FlowStep[] => {
		if (!Array.isArray(list)) return [];
		return list.flatMap((raw: Record<string, unknown>): FlowStep[] => {
			const type = raw?.type as StepType;
			const id = text(raw?.id, 20);
			if (!Object.hasOwn(STEP_LABELS, type) || !/^[a-z0-9]{4,20}$/.test(id) || seen.has(id)) {
				broken = "Passo inválido.";
				return [];
			}
			seen.add(id);
			if (seen.size > MAX_STEPS) {
				broken = `Use no máximo ${MAX_STEPS} passos.`;
				return [];
			}
			switch (type) {
				case "email": return [{ id, type, templateId: text(raw.templateId, 80), subject: text(raw.subject, 300) }];
				case "wait": return [{ id, type, amount: Math.trunc(Number(raw.amount)) || 0, unit: raw.unit === "hours" ? "hours" : "days" }];
				case "tag": return [{ id, type, action: raw.action === "remove" ? "remove" : "add", tag: text(raw.tag, 40).trim().toLowerCase() }];
				case "exit": return [{ id, type }];
				case "condition": {
					if (level >= MAX_DEPTH) {
						broken = `Condições dentro de condições: no máximo ${MAX_DEPTH} níveis.`;
						return [];
					}
					const test = raw.test === "opened" || raw.test === "tag" ? raw.test : "clicked";
					return [{ id, type, test, tag: text(raw.tag, 40).trim().toLowerCase(), yes: read(raw.yes, level + 1), no: read(raw.no, level + 1) }];
				}
			}
		});
	};
	const steps = read(input, 0);
	return broken ? { error: broken } : { steps };
}

/** Why each step stops the funnel from being activated (F6). Empty when it is ready. */
export function stepErrors(steps: FlowStep[]): Record<string, string> {
	const errors: Record<string, string> = {};
	const visit = (list: FlowStep[], mailed: boolean): boolean => {
		for (const step of list) {
			if (step.type === "email") {
				if (!step.templateId) errors[step.id] = "Escolha um modelo.";
				mailed = true;
			} else if (step.type === "wait") {
				if (step.amount < 1 || step.amount > 365) errors[step.id] = "Informe a espera, de 1 a 365.";
			} else if (step.type === "tag") {
				if (!step.tag) errors[step.id] = "Escreva a etiqueta.";
			} else if (step.type === "condition") {
				if (step.test === "tag" && !step.tag) errors[step.id] = "Escreva a etiqueta.";
				else if (step.test !== "tag" && !mailed) errors[step.id] = "Coloque um e-mail antes desta condição.";
				else if (!step.yes.length && !step.no.length) errors[step.id] = "Coloque um passo em Sim ou em Não.";
				const yes = visit(step.yes, mailed);
				const no = visit(step.no, mailed);
				mailed = mailed || (yes && no);
			}
		}
		return mailed;
	};
	visit(steps, false);
	return errors;
}

export type Node = { step: FlowStep; next: string | null; yes: string | null; no: string | null };

/** Where each step leads. After either side of a condition the funnel continues below it. */
export function successors(steps: FlowStep[]): Map<string, Node> {
	const nodes = new Map<string, Node>();
	const index = (list: FlowStep[], after: string | null) => {
		list.forEach((step, position) => {
			const next = list[position + 1]?.id ?? after;
			const node: Node = { step, next, yes: null, no: null };
			nodes.set(step.id, node);
			if (step.type === "condition") {
				node.yes = step.yes[0]?.id ?? next;
				node.no = step.no[0]?.id ?? next;
				index(step.yes, next);
				index(step.no, next);
			}
		});
	};
	index(steps, null);
	return nodes;
}

const mapLists = (steps: FlowStep[], change: (list: FlowStep[], parent: string | null, branch: "yes" | "no") => FlowStep[], parent: string | null = null, branch: "yes" | "no" = "yes"): FlowStep[] =>
	change(steps, parent, branch).map((step) =>
		step.type === "condition" ? { ...step, yes: mapLists(step.yes, change, step.id, "yes"), no: mapLists(step.no, change, step.id, "no") } : step);

const isHere = (target: Target, parent: string | null, branch: "yes" | "no") => target.parent === parent && (parent === null || target.branch === branch);

export const insertStep = (steps: FlowStep[], target: Target, step: FlowStep): FlowStep[] =>
	mapLists(steps, (list, parent, branch) => (isHere(target, parent, branch) ? [...list.slice(0, target.index), step, ...list.slice(target.index)] : list));

export const removeStep = (steps: FlowStep[], id: string): FlowStep[] => mapLists(steps, (list) => list.filter((step) => step.id !== id));

export const updateStep = (steps: FlowStep[], id: string, patch: object): FlowStep[] =>
	mapLists(steps, (list) => list.map((step) => (step.id === id ? ({ ...step, ...patch } as FlowStep) : step)));

/** Moves a step (and whatever hangs from it). Returns the same tree when the move makes no sense. */
export function moveStep(steps: FlowStep[], id: string, target: Target): FlowStep[] {
	const step = walk(steps).find((item) => item.id === id);
	if (!step || walk([step]).some((item) => item.id === target.parent)) return steps;
	let position = -1;
	mapLists(steps, (list, parent, branch) => {
		if (isHere(target, parent, branch)) position = list.findIndex((item) => item.id === id);
		return list;
	});
	// Taking it out from above the target shifts the target up by one.
	const index = position >= 0 && position < target.index ? target.index - 1 : target.index;
	const moved = insertStep(removeStep(steps, id), { ...target, index }, step);
	return depth(moved) > MAX_DEPTH ? steps : moved;
}

/** Ready-made funnels, so nobody starts from an empty board. Templates are chosen afterwards. */
export const RECIPES = [
	{ id: "empty", label: "Em branco", help: "Monte do zero.", triggerTag: "", goalTag: "", plan: [] },
	{ id: "welcome", label: "Boas-vindas", help: "Três e-mails para quem acabou de entrar na lista.", triggerTag: "", goalTag: "", plan: ["email", 2, "email", 3, "email"] },
	{ id: "material", label: "Entrega de material", help: "Entrega o material e trata diferente quem clicou.", triggerTag: "", goalTag: "", plan: ["email", 1, "click"] },
	{ id: "sale", label: "Sequência de venda", help: "Oferta em três e-mails; quem ganhar a etiqueta \"comprou\" sai.", triggerTag: "", goalTag: "comprou", plan: ["email", 1, "email", 2, "email"] },
	{ id: "customer", label: "Pós-compra", help: "Começa quando a pessoa recebe a etiqueta \"comprou\".", triggerTag: "comprou", goalTag: "", plan: ["email", 3, "email", 7, "email"] },
] as const;

export function recipeSteps(id: string): FlowStep[] {
	const recipe = RECIPES.find((item) => item.id === id);
	return (recipe?.plan ?? []).map((item): FlowStep => {
		if (typeof item === "number") return { id: newStepId(), type: "wait", amount: item, unit: "days" };
		if (item === "email") return createStep("email");
		return {
			id: newStepId(), type: "condition", test: "clicked", tag: "",
			yes: [{ id: newStepId(), type: "tag", action: "add", tag: "interessado" }, createStep("email")],
			no: [createStep("email")],
		};
	});
}

