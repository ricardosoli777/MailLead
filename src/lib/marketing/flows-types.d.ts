export type WaitUnit = "seconds" | "minutes" | "hours" | "days";

export type FlowStep =
	| { id: string; type: "email"; name: string; templateId: string; subject: string }
	| { id: string; type: "whatsapp"; name: string; audioId: string }
	| { id: string; type: "wait"; amount: number; unit: WaitUnit }
	| { id: string; type: "condition"; test: "opened" | "clicked" | "tag"; tag: string }
	| { id: string; type: "tag"; action: "add" | "remove"; tag: string }
	| { id: string; type: "exit" };

export type StepType = FlowStep["type"];

export type Position = { x: number; y: number };

/** A box on the canvas. */
export type FlowNode = FlowStep & Position;

/** Which output a line leaves from: the two sides of a condition, or the only one. */
export type Branch = "" | "yes" | "no";

/** `from` is a box id, or "start". */
export type FlowEdge = { from: string; to: string; branch: Branch };

export type FlowGraph = { start: Position; nodes: FlowNode[]; edges: FlowEdge[] };

export type FlowStatus = "draft" | "active" | "paused";

export type FlowDraft = { name: string; listId: string; triggerTag: string; goalTag: string; graph: FlowGraph };

export type StepStats = { here: number; sent: number; opened: number; clicked: number };

export type Flow = FlowDraft & {
	id: string;
	status: FlowStatus;
	counts: { active: number; done: number; goal: number; exited: number };
	stats: Record<string, StepStats>;
};
