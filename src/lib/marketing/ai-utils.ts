/** What the model may propose, rebuilt field by field: its answer is untrusted text. */
import type { AiAnswer, AiBlock, AiFunnel, AiProvider, AiStep } from "./ai-types";
import { MAX_STEPS, fromTree, newStepId, type TreeStep } from "./flows-utils";
import type { FlowGraph } from "./flows-types";

export const AI_PROVIDERS: { id: AiProvider; label: string; keyHint: string }[] = [
	{ id: "openai", label: "OpenAI (ChatGPT)", keyHint: "platform.openai.com → API keys" },
	{ id: "anthropic", label: "Anthropic (Claude)", keyHint: "console.anthropic.com → API keys" },
	{ id: "gemini", label: "Google (Gemini)", keyHint: "aistudio.google.com → Get API key" },
];

export const isAiProvider = (value: unknown): value is AiProvider => AI_PROVIDERS.some((item) => item.id === value);

const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");
const tag = (value: unknown) => text(value, 40).toLowerCase();
const list = (value: unknown) => (Array.isArray(value) ? (value as Record<string, unknown>[]).filter((item) => item && typeof item === "object") : []);

function readBlocks(value: unknown): AiBlock[] {
	return list(value).slice(0, 20).flatMap((raw): AiBlock[] => {
		if (raw.type === "divider") return [{ type: "divider" }];
		if (raw.type === "heading" || raw.type === "text") {
			const body = text(raw.text, 4000);
			return body ? [{ type: raw.type, text: body }] : [];
		}
		if (raw.type === "button") {
			const label = text(raw.label, 80);
			const url = text(raw.url, 500);
			return label && /^https?:\/\/[^\s]+$/i.test(url) ? [{ type: "button", label, url }] : [];
		}
		return [];
	});
}

export function readFunnel(input: unknown): AiFunnel | null {
	const value = (input ?? {}) as Record<string, unknown>;
	let room = MAX_STEPS - 1; // one box is kept for the end of an empty branch
	const steps = (items: unknown, depth: number): AiStep[] => list(items).flatMap((raw): AiStep[] => {
		if (room <= 0 || depth > 4) return [];
		if (raw.type === "email") {
			const blocks = readBlocks(raw.blocks);
			if (!blocks.length) return [];
			room--;
			const name = text(raw.name, 80) || "E-mail";
			return [{ type: "email", name, subject: text(raw.subject, 300) || name, preheader: text(raw.preheader, 200), blocks }];
		}
		if (raw.type === "wait") {
			room--;
			return [{ type: "wait", amount: Math.max(1, Math.min(365, Math.trunc(Number(raw.amount)) || 1)), unit: raw.unit === "hours" ? "hours" : "days" }];
		}
		if (raw.type === "tag" && tag(raw.tag)) {
			room--;
			return [{ type: "tag", action: raw.action === "remove" ? "remove" : "add", tag: tag(raw.tag) }];
		}
		if (raw.type === "condition") {
			room--;
			return [{ type: "condition", test: raw.test === "opened" || raw.test === "tag" ? raw.test : "clicked", tag: tag(raw.tag), yes: steps(raw.yes, depth + 1), no: steps(raw.no, depth + 1) }];
		}
		return [];
	});
	const read = steps(value.steps, 0);
	if (!read.length) return null;
	return { name: text(value.name, 100) || "Funil criado com IA", triggerTag: tag(value.triggerTag), goalTag: tag(value.goalTag), steps: read };
}

/** Takes the JSON out of the answer. Anything else is shown as a plain reply. */
export function readAnswer(answer: string): AiAnswer {
	const start = answer.indexOf("{");
	const end = answer.lastIndexOf("}");
	if (start >= 0 && end > start) {
		try {
			const value = JSON.parse(answer.slice(start, end + 1)) as { reply?: unknown; funnel?: unknown };
			const funnel = value.funnel ? readFunnel(value.funnel) : null;
			const reply = text(value.reply, 4000);
			if (reply || funnel) return { reply: reply || "Montei esta proposta.", funnel };
		} catch {
			// Not JSON after all.
		}
	}
	return { reply: text(answer, 4000), funnel: null };
}

export type AiEmail = Extract<AiStep, { type: "email" }>;

/** The drawing for a proposal. `save` stores each e-mail and returns its template id. */
export function funnelGraph(funnel: AiFunnel, save: (email: AiEmail) => string): FlowGraph {
	const tree = (steps: AiStep[]): TreeStep[] => steps.map((step): TreeStep => {
		const id = newStepId();
		if (step.type === "email") return { id, type: "email", name: step.name, subject: step.subject, templateId: save(step) };
		if (step.type === "condition") return { id, type: "condition", test: step.test, tag: step.tag, yes: tree(step.yes), no: tree(step.no) };
		return { ...step, id };
	});
	return fromTree(tree(funnel.steps));
}
