export type AiProvider = "openai" | "anthropic" | "gemini";

export type AiMessage = { role: "user" | "assistant"; content: string };

export type AiBlock = { type: "heading" | "text"; text: string } | { type: "button"; label: string; url: string } | { type: "image"; url: string; alt: string } | { type: "divider" };

/** A file the administrator attached in the chat, already hosted. */
export type AiFile = { name: string; url: string; kind: "image" | "pdf" };

export type AiStep =
	| { type: "email"; name: string; subject: string; preheader: string; blocks: AiBlock[] }
	| { type: "wait"; amount: number; unit: "hours" | "days" }
	| { type: "condition"; test: "opened" | "clicked" | "tag"; tag: string; yes: AiStep[]; no: AiStep[] }
	| { type: "tag"; action: "add" | "remove"; tag: string };

export type AiFunnel = { name: string; triggerTag: string; goalTag: string; steps: AiStep[] };

export type AiAnswer = { reply: string; funnel: AiFunnel | null };
