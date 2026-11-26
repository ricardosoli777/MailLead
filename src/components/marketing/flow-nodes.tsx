"use client";

// The boxes and lines drawn on the funnel canvas.
import { createContext, useContext } from "react";
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, Handle, Position, type Edge, type EdgeProps, type Node, type NodeProps } from "@xyflow/react";
import { Clock, Mail, Play, Plus, Route, Square, Tag, X } from "@/components/icons";
import type { Branch, FlowNode, StepStats, StepType } from "@/lib/marketing/flows-types";
import { NODE_WIDTH, outputs, START, STEP_LABELS } from "@/lib/marketing/flows-utils";

export type StepData = { step: FlowNode; title: string; detail: string; hint: string; error: string; stats?: StepStats; open: Branch[] };
export type StartData = { detail: string; goal: string; error: string; open: boolean };
export type LineData = { from: string; branch: Branch };
export type StepBox = Node<StepData, "step">;
export type StartBox = Node<StartData, "start">;
export type Line = Edge<LineData, "line">;

export const CanvasActions = createContext<{ readOnly: boolean; addAfter: (from: string, branch: Branch) => void; addOnLine: (line: LineData) => void; removeLine: (line: LineData) => void }>({
	readOnly: false,
	addAfter: () => {},
	addOnLine: () => {},
	removeLine: () => {},
});

export const STEP_STYLE: Record<StepType, { icon: typeof Mail; badge: string; accent: string }> = {
	email: { icon: Mail, badge: "bg-blue-50 text-blue-600", accent: "#2563eb" },
	wait: { icon: Clock, badge: "bg-amber-50 text-amber-600", accent: "#d97706" },
	condition: { icon: Route, badge: "bg-violet-50 text-violet-600", accent: "#7c3aed" },
	tag: { icon: Tag, badge: "bg-emerald-50 text-emerald-600", accent: "#059669" },
	exit: { icon: Square, badge: "bg-neutral-100 text-neutral-600", accent: "#525252" },
};

const HANDLE = "!h-3.5 !w-3.5 !border-2 !border-white !bg-neutral-400 transition-transform hover:!scale-125 hover:!bg-blue-600";
const SIDE: Record<Branch, { left: string; label: string; className: string }> = {
	"": { left: "50%", label: "", className: "" },
	yes: { left: "25%", label: "Sim", className: "bg-emerald-100 text-emerald-800" },
	no: { left: "75%", label: "Não", className: "bg-rose-100 text-rose-800" },
};

/** The connection dots of a box and, under each free one, a button to add the next step. */
function Outputs({ id, type, open }: { id: string; type: StepType | typeof START; open: Branch[] }) {
	const { readOnly, addAfter } = useContext(CanvasActions);
	return outputs(type).map((branch) => {
		const side = SIDE[branch];
		return (
			<div key={branch}>
				<Handle type="source" id={branch || "out"} position={Position.Bottom} style={{ left: side.left }} className={HANDLE} />
				{side.label && <span className={`pointer-events-none absolute -bottom-6 -translate-x-1/2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${side.className}`} style={{ left: side.left }}>{side.label}</span>}
				{!readOnly && open.includes(branch) && (
					<button type="button" aria-label={`Adicionar passo${side.label ? ` no caminho ${side.label}` : ""}`} className="nodrag nopan absolute flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full border border-dashed border-neutral-400 bg-white text-neutral-500 shadow-sm hover:border-blue-600 hover:text-blue-600" style={{ left: side.left, bottom: side.label ? -54 : -36 }} onClick={(event) => {
						event.stopPropagation();
						addAfter(id, branch);
					}}><Plus className="h-3.5 w-3.5" /></button>
				)}
			</div>
		);
	});
}

function StepNodeView({ id, data, selected }: NodeProps<StepBox>) {
	const { step, title, detail, hint, error, stats, open } = data;
	const style = STEP_STYLE[step.type];
	const Icon = style.icon;
	return (
		<div data-step={step.type} className={`relative cursor-pointer rounded-2xl border bg-white shadow-sm transition-shadow hover:shadow-md ${error ? "border-red-400 ring-2 ring-red-100" : selected ? "border-blue-500 ring-2 ring-blue-100" : "border-neutral-200"}`} style={{ width: NODE_WIDTH }}>
			<Handle type="target" position={Position.Top} className={HANDLE} />
			<div className="flex items-start gap-3 p-3">
				<span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${style.badge}`}><Icon className="h-4 w-4" /></span>
				<div className="min-w-0 flex-1">
					<p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">{STEP_LABELS[step.type]}</p>
					<p className="truncate text-sm font-medium text-neutral-900">{title}</p>
					{detail && <p className="truncate text-xs text-neutral-500">{detail}</p>}
					{hint && !error && <p className="mt-1 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">{hint}</p>}
				</div>
			</div>
			{stats && (
				<p className="border-t border-neutral-100 px-3 py-1.5 text-[11px] text-neutral-500">
					{stats.here} aqui{step.type === "email" ? ` · ${stats.sent} enviados · ${stats.opened} abriram · ${stats.clicked} clicaram` : ""}
				</p>
			)}
			{error && <p className="rounded-b-2xl border-t border-red-100 bg-red-50 px-3 py-1.5 text-[11px] text-red-700">{error}</p>}
			<Outputs id={id} type={step.type} open={open} />
		</div>
	);
}

function StartNodeView({ data, selected }: NodeProps<StartBox>) {
	return (
		<div className={`relative cursor-pointer rounded-2xl border bg-neutral-900 text-white shadow-md ${data.error ? "border-red-400 ring-2 ring-red-200" : selected ? "border-blue-400 ring-2 ring-blue-200" : "border-neutral-900"}`} style={{ width: NODE_WIDTH }}>
			<div className="flex items-start gap-3 p-3">
				<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10"><Play className="h-4 w-4" /></span>
				<div className="min-w-0 flex-1">
					<p className="text-[10px] font-semibold uppercase tracking-wide text-white/60">Início</p>
					<p className="text-sm font-medium">{data.detail}</p>
					{data.goal && <p className="truncate text-xs text-white/60">{data.goal}</p>}
				</div>
			</div>
			{data.error && <p className="rounded-b-2xl bg-red-600 px-3 py-1.5 text-[11px]">{data.error}</p>}
			<Outputs id={START} type={START} open={data.open ? [""] : []} />
		</div>
	);
}

function LineView({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected, markerEnd }: EdgeProps<Line>) {
	const { readOnly, addOnLine, removeLine } = useContext(CanvasActions);
	const [path, labelX, labelY] = getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, borderRadius: 16 });
	const color = selected ? "#2563eb" : data?.branch === "yes" ? "#34d399" : data?.branch === "no" ? "#fb7185" : "#a3a3a3";
	return (
		<>
			<BaseEdge path={path} markerEnd={markerEnd} style={{ stroke: color, strokeWidth: 2 }} />
			{!readOnly && data && (
				<EdgeLabelRenderer>
					<div className="nodrag nopan pointer-events-auto absolute flex gap-1" style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}>
						<button type="button" aria-label="Inserir passo nesta linha" className="flex h-5 w-5 items-center justify-center rounded-full border border-neutral-300 bg-white text-neutral-500 shadow-sm hover:border-blue-600 hover:text-blue-600" onClick={() => addOnLine(data)}><Plus className="h-3 w-3" /></button>
						<button type="button" aria-label="Apagar esta linha" className="flex h-5 w-5 items-center justify-center rounded-full border border-neutral-300 bg-white text-neutral-500 shadow-sm hover:border-red-600 hover:text-red-600" onClick={() => removeLine(data)}><X className="h-3 w-3" /></button>
					</div>
				</EdgeLabelRenderer>
			)}
		</>
	);
}

export const NODE_TYPES = { step: StepNodeView, start: StartNodeView };
export const EDGE_TYPES = { line: LineView };
