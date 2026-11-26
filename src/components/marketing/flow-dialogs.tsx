"use client";

// The boxes that open to set up each part of a funnel.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { FlowDraft, FlowNode, StepStats, StepType } from "@/lib/marketing/flows-types";
import { STEP_LABELS } from "@/lib/marketing/flows-utils";
import { renderHtml } from "@/lib/marketing/render";
import { STARTERS } from "@/lib/marketing/starters";
import type { Template } from "@/lib/marketing/types";
import { STEP_STYLE } from "./flow-nodes";

const SELECT = "h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm disabled:opacity-60";
export type Option = { id: string; name: string };

function Field({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {
	return (
		<label className="block space-y-1">
			<span className="block text-xs font-medium text-neutral-600">{label}</span>
			{children}
			{help && <span className="block text-xs text-neutral-500">{help}</span>}
		</label>
	);
}

const STEP_HELP: Record<StepType, string> = {
	email: "Envia uma mensagem. O conteúdo pode ser escrito agora ou depois.",
	wait: "Segura a pessoa por algumas horas ou dias.",
	condition: "Separa em dois caminhos: Sim e Não.",
	tag: "Marca a pessoa, ou tira uma marca.",
	exit: "Encerra o funil neste caminho.",
};

/** "What comes next?", opened by every + button. */
export function PickDialog({ types, onPick, onClose }: { types: StepType[]; onPick: (type: StepType) => void; onClose: () => void }) {
	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Adicionar passo</DialogTitle>
					<DialogDescription>O que acontece a seguir?</DialogDescription>
				</DialogHeader>
				<div className="mt-4 space-y-2">
					{types.map((type) => {
						const { icon: Icon, badge } = STEP_STYLE[type];
						return (
							<button key={type} type="button" className="flex w-full items-center gap-3 rounded-xl border border-neutral-200 p-3 text-left hover:border-blue-500 hover:bg-blue-50/40" onClick={() => onPick(type)}>
								<span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${badge}`}><Icon className="h-4 w-4" /></span>
								<span>
									<span className="block text-sm font-medium">{STEP_LABELS[type]}</span>
									<span className="block text-xs text-neutral-500">{STEP_HELP[type]}</span>
								</span>
							</button>
						);
					})}
				</div>
			</DialogContent>
		</Dialog>
	);
}

export function StartDialog({ draft, lists, tags, readOnly, onChange, onClose }: { draft: FlowDraft; lists: Option[]; tags: string[]; readOnly: boolean; onChange: (patch: Partial<FlowDraft>) => void; onClose: () => void }) {
	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Início do funil</DialogTitle>
					<DialogDescription>Quem entra e quando sai antes do fim.</DialogDescription>
				</DialogHeader>
				<div className="mt-4 space-y-3">
					<Field label="Lista do funil">
						<select className={SELECT} disabled={readOnly} value={draft.listId} onChange={(event) => onChange({ listId: event.target.value })}>
							<option value="">Escolha…</option>
							{lists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}
						</select>
					</Field>
					<Field label="Começa quando…">
						<select className={SELECT} disabled={readOnly} value={draft.triggerTag ? "tag" : "list"} onChange={(event) => onChange({ triggerTag: event.target.value === "tag" ? tags[0] ?? "cliente" : "" })}>
							<option value="list">a pessoa entra na lista</option>
							<option value="tag">a pessoa da lista recebe uma etiqueta</option>
						</select>
					</Field>
					{draft.triggerTag !== "" && (
						<Field label="Etiqueta que inicia">
							<Input value={draft.triggerTag} disabled={readOnly} list="flow-tags" onChange={(event) => onChange({ triggerTag: event.target.value.toLowerCase() })} />
						</Field>
					)}
					<Field label="Objetivo (opcional)" help="Quem receber esta etiqueta sai do funil na hora.">
						<Input value={draft.goalTag} disabled={readOnly} list="flow-tags" placeholder="ex.: comprou" onChange={(event) => onChange({ goalTag: event.target.value.toLowerCase() })} />
					</Field>
					<p className="text-xs text-neutral-500">Formulário, API e webhook também iniciam o funil: eles colocam a pessoa na lista e nas etiquetas escolhidas.</p>
					<datalist id="flow-tags">{tags.map((tag) => <option key={tag} value={tag} />)}</datalist>
					<div className="flex justify-end"><Button type="button" onClick={onClose}>Pronto</Button></div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

type StepDialogProps = {
	step: FlowNode;
	templates: Template[];
	tags: string[];
	stats?: StepStats;
	error: string;
	readOnly: boolean;
	onChange: (patch: object) => void;
	onCreateContent: (starter: string) => void;
	onEditContent: () => void;
	onDuplicate: () => void;
	onDelete: () => void;
	onClose: () => void;
};

function EmailFields({ step, templates, readOnly, onChange, onCreateContent, onEditContent }: StepDialogProps & { step: Extract<FlowNode, { type: "email" }> }) {
	const [starter, setStarter] = useState("");
	const template = templates.find((item) => item.id === step.templateId);
	return (
		<>
			<Field label="Nome desta etapa" help="Só você vê. Ex.: Entrega do material, Última chance.">
				<Input value={step.name} disabled={readOnly} maxLength={80} placeholder="E-mail" onChange={(event) => onChange({ name: event.target.value })} />
			</Field>
			<div className="space-y-3 rounded-xl border border-neutral-200 p-3">
				<p className="text-xs font-semibold text-neutral-700">Conteúdo do e-mail</p>
				{template ? (
					<>
						<iframe title="Prévia do e-mail" sandbox="" srcDoc={renderHtml(template.design, {})} className="h-48 w-full rounded-lg border border-neutral-200" />
						{!readOnly && <Button type="button" size="sm" variant="outline" onClick={onEditContent}>Editar conteúdo</Button>}
					</>
				) : !readOnly && (
					<div className="space-y-2">
						<p className="text-xs text-neutral-500">Ainda sem conteúdo. Pode desenhar o funil inteiro primeiro e escrever depois.</p>
						<div className="flex flex-wrap gap-2">
							<select className={`${SELECT} !w-auto flex-1`} aria-label="Começar de" value={starter} onChange={(event) => setStarter(event.target.value)}>
								<option value="">Em branco</option>
								{STARTERS.map((item) => <option key={item.key} value={item.key}>{item.name}</option>)}
							</select>
							<Button type="button" onClick={() => onCreateContent(starter)}>Escrever e-mail</Button>
						</div>
					</div>
				)}
				<Field label={template ? "Trocar por outro modelo" : "Ou usar um modelo salvo"}>
					<select className={SELECT} disabled={readOnly} value={step.templateId} onChange={(event) => onChange({ templateId: event.target.value })}>
						<option value="">Nenhum</option>
						{templates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
					</select>
				</Field>
			</div>
			<Field label="Assunto" help="Em branco, usa o assunto do modelo.">
				<Input value={step.subject} disabled={readOnly} placeholder={template?.subject ?? "Assunto do e-mail"} onChange={(event) => onChange({ subject: event.target.value })} />
			</Field>
		</>
	);
}

export function StepDialog(props: StepDialogProps) {
	const { step, tags, stats, error, readOnly, onChange, onDuplicate, onDelete, onClose } = props;
	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{STEP_LABELS[step.type]}</DialogTitle>
					<DialogDescription>{STEP_HELP[step.type]}</DialogDescription>
				</DialogHeader>
				<div className="mt-4 space-y-3">
					{error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
					{stats && <p className="rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-600">{stats.here} aqui agora{step.type === "email" ? ` · ${stats.sent} enviados · ${stats.opened} abriram · ${stats.clicked} clicaram` : ""}</p>}
					{step.type === "email" && <EmailFields {...props} step={step} />}
					{step.type === "wait" && (
						<div className="grid grid-cols-2 gap-3">
							<Field label="Quanto"><Input type="number" min={1} max={365} disabled={readOnly} value={step.amount || ""} onChange={(event) => onChange({ amount: Math.trunc(Number(event.target.value)) || 0 })} /></Field>
							<Field label="Unidade">
								<select className={SELECT} disabled={readOnly} value={step.unit} onChange={(event) => onChange({ unit: event.target.value })}>
									<option value="hours">horas</option>
									<option value="days">dias</option>
								</select>
							</Field>
						</div>
					)}
					{step.type === "condition" && (
						<Field label="Separar quem…" help="Abriu e clicou olham o último e-mail enviado neste funil.">
							<select className={SELECT} disabled={readOnly} value={step.test} onChange={(event) => onChange({ test: event.target.value })}>
								<option value="clicked">clicou no último e-mail</option>
								<option value="opened">abriu o último e-mail</option>
								<option value="tag">tem uma etiqueta</option>
							</select>
						</Field>
					)}
					{step.type === "tag" && (
						<Field label="O que fazer">
							<select className={SELECT} disabled={readOnly} value={step.action} onChange={(event) => onChange({ action: event.target.value })}>
								<option value="add">colocar a etiqueta</option>
								<option value="remove">tirar a etiqueta</option>
							</select>
						</Field>
					)}
					{(step.type === "tag" || (step.type === "condition" && step.test === "tag")) && (
						<Field label="Etiqueta">
							<Input value={step.tag} disabled={readOnly} list="flow-step-tags" maxLength={40} onChange={(event) => onChange({ tag: event.target.value.toLowerCase() })} />
							<datalist id="flow-step-tags">{tags.map((tag) => <option key={tag} value={tag} />)}</datalist>
						</Field>
					)}
					<div className="flex flex-wrap justify-between gap-2 pt-2">
						{!readOnly ? (
							<span className="flex gap-2">
								<Button type="button" size="sm" variant="outline" onClick={onDuplicate}>Duplicar</Button>
								<Button type="button" size="sm" variant="outline" className="text-red-600" onClick={onDelete}>Apagar</Button>
							</span>
						) : <span />}
						<Button type="button" size="sm" onClick={onClose}>Pronto</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
