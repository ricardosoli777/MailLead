export type FlowStep =
	| { id: string; type: "email"; templateId: string; subject: string }
	| { id: string; type: "wait"; amount: number; unit: "hours" | "days" }
	| { id: string; type: "condition"; test: "opened" | "clicked" | "tag"; tag: string; yes: FlowStep[]; no: FlowStep[] }
	| { id: string; type: "tag"; action: "add" | "remove"; tag: string }
	| { id: string; type: "exit" };

export type StepType = FlowStep["type"];

/** A place in the funnel: the top level, or one side of a condition. */
export type Target = { parent: string | null; branch: "yes" | "no"; index: number };

export type FlowStatus = "draft" | "active" | "paused";

export type FlowDraft = { name: string; listId: string; triggerTag: string; goalTag: string; steps: FlowStep[] };

export type StepStats = { here: number; sent: number; opened: number; clicked: number };

export type Flow = FlowDraft & {
	id: string;
	status: FlowStatus;
	counts: { active: number; done: number; goal: number; exited: number };
	stats: Record<string, StepStats>;
};
