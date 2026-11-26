"use client";

/** The funnel drawn top to bottom. Blocks are dragged onto the "+" points, or added by clicking them. */
import { useState, type DragEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { FlowStep, StepStats, StepType, Target } from "@/lib/marketing/flows-types";
import { STEP_LABELS, createStep, insertStep, moveStep, removeStep, stepErrors, updateStep } from "@/lib/marketing/flows-utils";

const SELECT = "h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm";
const TYPES = Object.keys(STEP_LABELS) as StepType[];
const NEW = "application/x-maillead-new";
const MOVE = "application/x-maillead-move";

type Template = { id: string; name: string; subject: string };
type Board = {
	templates: Template[];
	errors: Record<string, string>;
	stats: Record<string, StepStats>;
	readOnly: boolean;
	add: (target: Target, type: StepType) => void;
	drop: (target: Target, event: DragEvent) => void;
	update: (id: string, patch: object) => void;
	remove: (id: string) => void;
	move: (id: string, target: Target) => void;
};

function Insert({ target, board }: { target: Target; board: Board }) {
	const [open, setOpen] = useState(false);
	const [over, setOver] = useState(false);
	if (board.readOnly) return <div className="mx-auto h-4 w-px bg-neutral-300" />;
	return (
		<div
			className={`flex flex-col items-center rounded-lg border border-dashed py-1 ${over ? "border-blue-500 bg-blue-50" : "border-transparent"}`}
			onDragOver={(event) => {
				if (!event.dataTransfer.types.includes(NEW) && !event.dataTransfer.types.includes(MOVE)) return;
				event.preventDefault();
				setOver(true);
			}}
			onDragLeave={() => setOver(false)}
			onDrop={(event) => {
				setOver(false);
				board.drop(target, event);
			}}
		>
			<button type="button" aria-label="Adicionar passo aqui" aria-expanded={open} className="flex h-7 w-7 items-center justify-center rounded-full border border-neutral-300 bg-white text-neutral-600 hover:border-blue-500 hover:text-blue-600" onClick={() => setOpen(!open)}>+</button>
			{open && (
				<div className="mt-1 flex flex-wrap justify-center gap-1">
					{TYPES.map((type) => (
						<Button key={type} type="button" size="sm" variant="outline" onClick={() => {
							setOpen(false);
							board.add(target, type);
						}}>{STEP_LABELS[type]}</Button>
					))}
				</div>
			)}
		</div>
	);
}

function Fields({ step, board }: { step: FlowStep; board: Board }) {
	const set = (patch: object) => board.update(step.id, patch);
	const disabled = board.readOnly;
	if (step.type === "email") {
		const template = board.templates.find((item) => item.id === step.templateId);
		return (
			<div className="space-y-2">
				<select className={SELECT} aria-label="Modelo" disabled={disabled} value={step.templateId} onChange={(event) => set({ templateId: event.target.value })}>
					<option value="">Escolha o modelo…</option>
					{board.templates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
				</select>
				<Input aria-label="Assunto" disabled={disabled} value={step.subject} placeholder={template?.subject || "Assunto (vazio usa o do modelo)"} onChange={(event) => set({ subject: event.target.value })} />
			</div>
		);
	}
	if (step.type === "wait") {
		return (
			<div className="flex gap-2">
				<Input type="number" min={1} max={365} aria-label="Quanto esperar" className="w-24" disabled={disabled} value={step.amount || ""} onChange={(event) => set({ amount: Number(event.target.value) })} />
				<select className={SELECT} aria-label="Unidade" disabled={disabled} value={step.unit} onChange={(event) => set({ unit: event.target.value })}>
					<option value="hours">hora(s)</option>
					<option value="days">dia(s)</option>
				</select>
			</div>
		);
	}
	if (step.type === "tag") {
		return (
			<div className="flex gap-2">
				<select className={SELECT} aria-label="O que fazer" disabled={disabled} value={step.action} onChange={(event) => set({ action: event.target.value })}>
					<option value="add">Colocar a etiqueta</option>
					<option value="remove">Tirar a etiqueta</option>
				</select>
				<Input aria-label="Etiqueta" disabled={disabled} value={step.tag} placeholder="etiqueta" onChange={(event) => set({ tag: event.target.value.toLowerCase() })} />
			</div>
		);
	}
	if (step.type === "condition") {
		return (
			<div className="flex flex-wrap gap-2">
				<select className={SELECT} aria-label="Condição" disabled={disabled} value={step.test} onChange={(event) => set({ test: event.target.value })}>
					<option value="clicked">Clicou no último e-mail?</option>
					<option value="opened">Abriu o último e-mail? (aproximado)</option>
					<option value="tag">Tem a etiqueta?</option>
				</select>
				{step.test === "tag" && <Input aria-label="Etiqueta" disabled={disabled} value={step.tag} placeholder="etiqueta" onChange={(event) => set({ tag: event.target.value.toLowerCase() })} />}
			</div>
		);
	}
	return <p className="text-sm text-neutral-500">A pessoa encerra o funil aqui.</p>;
}

function Card({ step, target, last, board }: { step: FlowStep; target: Target; last: number; board: Board }) {
	const stats = board.stats[step.id];
	const error = board.errors[step.id];
	return (
		<div className={`rounded-xl border bg-white p-3 ${error && !board.readOnly ? "border-amber-400" : "border-neutral-200"}`}>
			<div
				className={`mb-2 flex items-center justify-between gap-2 ${board.readOnly ? "" : "cursor-grab"}`}
				draggable={!board.readOnly}
				onDragStart={(event) => event.dataTransfer.setData(MOVE, step.id)}
			>
				<p className="text-sm font-medium">{board.readOnly ? "" : "⠿ "}{STEP_LABELS[step.type]}</p>
				{!board.readOnly && (
					<div className="flex gap-1">
						<Button type="button" size="sm" variant="outline" aria-label="Subir passo" disabled={target.index === 0} onClick={() => board.move(step.id, { ...target, index: target.index - 1 })}>↑</Button>
						<Button type="button" size="sm" variant="outline" aria-label="Descer passo" disabled={target.index === last} onClick={() => board.move(step.id, { ...target, index: target.index + 2 })}>↓</Button>
						<Button type="button" size="sm" variant="outline" aria-label="Remover passo" onClick={() => board.remove(step.id)}>×</Button>
					</div>
				)}
			</div>
			<Fields step={step} board={board} />
			{error && !board.readOnly && <p className="mt-2 text-xs text-amber-700">{error}</p>}
			{stats && (stats.here > 0 || stats.sent > 0) && (
				<p className="mt-2 text-xs text-neutral-500">
					{stats.here > 0 && `${stats.here} pessoa(s) aqui agora. `}
					{stats.sent > 0 && `Enviados ${stats.sent} · aberturas ${stats.opened} · cliques ${stats.clicked}`}
				</p>
			)}
		</div>
	);
}

function Column({ steps, parent, branch, board }: { steps: FlowStep[]; parent: string | null; branch: "yes" | "no"; board: Board }) {
	return (
		<div className="min-w-0">
			<Insert target={{ parent, branch, index: 0 }} board={board} />
			{steps.map((step, index) => (
				<div key={step.id}>
					<Card step={step} target={{ parent, branch, index }} last={steps.length - 1} board={board} />
					{step.type === "condition" && (
						<div className="mt-2 grid gap-2 sm:grid-cols-2">
							{(["yes", "no"] as const).map((side) => (
								<div key={side} className={`min-w-0 rounded-xl p-2 ${side === "yes" ? "bg-green-50" : "bg-red-50"}`}>
									<p className="text-center text-xs font-semibold">{side === "yes" ? "Sim" : "Não"}</p>
									<Column steps={step[side]} parent={step.id} branch={side} board={board} />
								</div>
							))}
						</div>
					)}
					<Insert target={{ parent, branch, index: index + 1 }} board={board} />
				</div>
			))}
		</div>
	);
}

export function FlowBoard({ steps, templates, stats, readOnly, onChange }: { steps: FlowStep[]; templates: Template[]; stats: Record<string, StepStats>; readOnly: boolean; onChange: (steps: FlowStep[]) => void }) {
	const board: Board = {
		templates,
		stats,
		readOnly,
		errors: stepErrors(steps),
		add: (target, type) => onChange(insertStep(steps, target, createStep(type))),
		drop: (target, event) => {
			event.preventDefault();
			const type = event.dataTransfer.getData(NEW) as StepType;
			const moved = event.dataTransfer.getData(MOVE);
			if (TYPES.includes(type)) onChange(insertStep(steps, target, createStep(type)));
			else if (moved) onChange(moveStep(steps, moved, target));
		},
		update: (id, patch) => onChange(updateStep(steps, id, patch)),
		remove: (id) => onChange(removeStep(steps, id)),
		move: (id, target) => onChange(moveStep(steps, id, target)),
	};
	return (
		<div className="space-y-3">
			{!readOnly && (
				<div className="flex flex-wrap items-center gap-2">
					<span className="text-xs text-neutral-500">Arraste para um “+”, ou toque no “+”:</span>
					{TYPES.map((type) => (
						<button key={type} type="button" draggable className="cursor-grab rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm" onDragStart={(event) => event.dataTransfer.setData(NEW, type)} onClick={() => board.add({ parent: null, branch: "yes", index: steps.length }, type)}>
							{STEP_LABELS[type]}
						</button>
					))}
				</div>
			)}
			<Column steps={steps} parent={null} branch="yes" board={board} />
		</div>
	);
}
