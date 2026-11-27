"use client";

// The boxes that open to set up each part of a funnel.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { FlowDraft, FlowNode, StepStats, StepType } from "@/lib/marketing/flows-types";
import { MAX_WAIT, STEP_LABELS, WAIT_UNITS } from "@/lib/marketing/flows-utils";
import { renderHtml } from "@/lib/marketing/render";
import { STARTERS } from "@/lib/marketing/starters";
import type { Template } from "@/lib/marketing/types";
import { AudioRecorder } from "./audio-recorder";
import { STEP_STYLE } from "./flow-nodes";
import { marketingRequest } from "./marketing-request";

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
	whatsapp: "Manda um áudio para quem autorizou o WhatsApp no formulário.",
	wait: "Segura a pessoa por segundos, minutos, horas ou dias.",
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

/** Records or uploads right in the step; the audio is saved as soon as it is ready. */
function WhatsAppFields({ step, readOnly, onChange }: StepDialogProps & { step: Extract<FlowNode, { type: "whatsapp" }> }) {
	const [file, setFile] = useState<File | null>(null);
	const [state, setState] = useState<{ error: boolean; text: string } | null>(null);

	async function choose(next: File | null) {
		const discarded = !!file && !next;
		setFile(next);
		setState(null);
		if (discarded) onChange({ audioId: "" });
		if (!next) return;
		setState({ error: false, text: "Salvando o áudio…" });
		try {
			const body = new FormData();
			body.set("file", next);
			const { id } = await marketingRequest<{ id: string }>("/api/marketing/audio", { method: "POST", body });
			onChange({ audioId: id });
			setState({ error: false, text: "Áudio salvo neste passo. Salve o funil para guardar." });
		} catch (error) {
			setState({ error: true, text: (error as Error).message });
		}
	}

	return (
		<>
			<Field label="Nome desta etapa" help="Só você vê. Ex.: Boas-vindas em áudio.">
				<Input value={step.name} disabled={readOnly} maxLength={80} placeholder="Áudio" onChange={(event) => onChange({ name: event.target.value })} />
			</Field>
			{step.audioId && !file && <audio controls src={`/api/marketing/audio/${step.audioId}`} className="h-10 w-full" />}
			{!readOnly && <AudioRecorder value={file} onChange={(next) => void choose(next)} />}
			{state && <p role="status" className={`text-xs ${state.error ? "text-red-700" : "text-green-700"}`}>{state.text}</p>}
			<p className="rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-600">Só recebe quem marcou a autorização de WhatsApp no formulário; os demais seguem o funil sem o áudio. Os envios saem devagar: no máximo 5 a cada 5 minutos e 100 por dia, das 8h às 20h.</p>
		</>
	);
}

export function StepDialog(props: StepDialogProps) {
	const { step, tags, stats, error, readOnly, onChange, onDuplicate, onDelete, onClose } = props;
	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="max-h-[calc(100vh-4rem)] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>{STEP_LABELS[step.type]}</DialogTitle>
					<DialogDescription>{STEP_HELP[step.type]}</DialogDescription>
				</DialogHeader>
				<div className="mt-4 space-y-3">
					{error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
					{stats && <p className="rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-600">{stats.here} aqui agora{step.type === "email" ? ` · ${stats.sent} enviados · ${stats.opened} abriram · ${stats.clicked} clicaram` : step.type === "whatsapp" ? ` · ${stats.sent} enviados` : ""}</p>}
					{step.type === "email" && <EmailFields {...props} step={step} />}
					{step.type === "whatsapp" && <WhatsAppFields {...props} step={step} />}
					{step.type === "wait" && (
						<>
						<div className="grid grid-cols-2 gap-3">
							<Field label="Quanto"><Input type="number" min={1} max={MAX_WAIT} disabled={readOnly} value={step.amount || ""} onChange={(event) => onChange({ amount: Math.trunc(Number(event.target.value)) || 0 })} /></Field>
							<Field label="Unidade">
								<select className={SELECT} disabled={readOnly} value={step.unit} onChange={(event) => onChange({ unit: event.target.value })}>
									{Object.entries(WAIT_UNITS).map(([value, unit]) => <option key={value} value={value}>{unit.many}</option>)}
								</select>
							</Field>
						</div>
						{(step.unit === "seconds" || step.unit === "minutes") && <p className="text-xs text-neutral-500">Até 45 segundos a espera é contada na hora. Acima disso, o funil confere uma vez por minuto.</p>}
						</>
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
