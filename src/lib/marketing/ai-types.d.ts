export type AiProvider = "openai" | "anthropic" | "gemini";

export type AiMessage = { role: "user" | "assistant"; content: string };

export type AiBlock = { type: "heading" | "text"; text: string } | { type: "button"; label: string; url: string } | { type: "image"; url: string; alt: string } | { type: "divider" };

/** A picture the administrator attached in the chat, already hosted, to appear in the e-mails. */
export type AiFile = { name: string; url: string };

/** Source material the model reads to write the e-mails. Never hosted or stored. */
export type AiDocument = { name: string; kind: "pdf"; data: string } | { name: string; kind: "text"; text: string };

export type AiStep =
	| { type: "email"; name: string; subject: string; preheader: string; blocks: AiBlock[] }
	| { type: "wait"; amount: number; unit: "hours" | "days" }
	| { type: "condition"; test: "opened" | "clicked" | "tag"; tag: string; yes: AiStep[]; no: AiStep[] }
	| { type: "tag"; action: "add" | "remove"; tag: string };

export type AiFunnel = { name: string; triggerTag: string; goalTag: string; steps: AiStep[] };

export type AiAnswer = { reply: string; funnel: AiFunnel | null };
