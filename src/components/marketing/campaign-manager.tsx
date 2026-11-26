"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CampaignReport, CampaignReview, CampaignStatus } from "@/lib/marketing/campaigns-types";
import { marketingRequest } from "./marketing-request";

const STATUS: Record<CampaignStatus, { label: string; className: string }> = {
	scheduled: { label: "Agendada", className: "bg-blue-100 text-blue-800" },
	running: { label: "Enviando", className: "bg-amber-100 text-amber-800" },
	paused: { label: "Pausada", className: "bg-neutral-200 text-neutral-700" },
	done: { label: "Concluída", className: "bg-green-100 text-green-800" },
	cancelled: { label: "Cancelada", className: "bg-red-100 text-red-800" },
};

const SELECT = "h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm";
const json = (method: string, body: unknown): RequestInit => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const number = (value: number) => value.toLocaleString("pt-BR");
const when = (time: number) => new Date(time).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
const EMPTY = { name: "", templateId: "", listId: "", subject: "", tag: "", includeInactive: false, scheduledAt: "" };

type Option = { id: string; name: string };

function Choice({ label, value, onChange, options, empty }: { label: string; value: string; onChange: (value: string) => void; options: Option[]; empty: string }) {
	return (
		<label className="block space-y-1">
			<span className="block text-xs font-medium text-neutral-600">{label}</span>
			<select className={SELECT} value={value} onChange={(event) => onChange(event.target.value)}>
				<option value="">{empty}</option>
				{options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
			</select>
		</label>
	);
}

export function CampaignManager() {
	const [campaigns, setCampaigns] = useState<CampaignReport[]>([]);
	const [tags, setTags] = useState<string[]>([]);
	const [templates, setTemplates] = useState<(Option & { subject: string })[]>([]);
	const [lists, setLists] = useState<Option[]>([]);
	const [form, setForm] = useState(EMPTY);
	const [review, setReview] = useState<CampaignReview | null>(null);
	const [cancelling, setCancelling] = useState("");
	const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
	const [busy, setBusy] = useState(false);

	const load = useCallback(() => {
		void Promise.all([
			marketingRequest<{ campaigns: CampaignReport[]; tags: string[] }>("/api/marketing/campaigns"),
			marketingRequest<{ templates: (Option & { subject: string })[] }>("/api/marketing/templates"),
			marketingRequest<{ lists: Option[] }>("/api/marketing/lists"),
		])
			.then(([data, templateData, listData]) => {
				setCampaigns(data.campaigns);
				setTags(data.tags);
				setTemplates(templateData.templates);
				setLists(listData.lists);
			})
			.catch((error: Error) => setMessage({ error: true, text: error.message }));
	}, []);
	useEffect(load, [load]);

	// Anything changed means the review no longer describes what would be sent.
	const change = (patch: Partial<typeof EMPTY>) => {
		setForm((current) => ({ ...current, ...patch }));
		setReview(null);
	};
	const body = () => ({ ...form, scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).getTime() : null });

	async function run(action: () => Promise<void>) {
		setBusy(true);
		setMessage(null);
		try {
			await action();
		} catch (error) {
			setMessage({ error: true, text: error instanceof Error ? error.message : "Falha." });
		} finally {
			setBusy(false);
		}
	}

	const check = () => run(async () => setReview((await marketingRequest<{ review: CampaignReview }>("/api/marketing/campaigns/review", json("POST", body()))).review));
	const send = () => run(async () => {
		const scheduled = !!form.scheduledAt;
		await marketingRequest("/api/marketing/campaigns", json("POST", body()));
		setForm(EMPTY);
		setReview(null);
		setMessage({ error: false, text: scheduled ? "Campanha agendada." : "Campanha criada. O envio começa em até 5 minutos." });
		load();
	});
	const act = (id: string, action: "pause" | "resume" | "cancel") => run(async () => {
		setCancelling("");
		await marketingRequest(`/api/marketing/campaigns/${id}`, json("PATCH", { action }));
		load();
	});

	return (
		<div className="max-w-3xl space-y-6">
			{message && <p role="status" className={`fixed inset-x-4 bottom-4 z-50 mx-auto max-w-xl rounded-lg px-4 py-3 text-sm shadow-lg ${message.error ? "bg-red-50 text-red-800" : "bg-green-50 text-green-800"}`}>{message.text}</p>}

			<section className="space-y-3 rounded-3xl bg-white p-6">
				<h2 className="text-base font-semibold">Nova campanha</h2>
				<label className="block space-y-1">
					<span className="block text-xs font-medium text-neutral-600">Nome (só você vê)</span>
					<Input value={form.name} onChange={(event) => change({ name: event.target.value })} />
				</label>
				<Choice label="Modelo" value={form.templateId} options={templates} empty="Escolha…" onChange={(templateId) => change({ templateId, subject: templates.find((item) => item.id === templateId)?.subject ?? "" })} />
				<label className="block space-y-1">
					<span className="block text-xs font-medium text-neutral-600">Assunto</span>
					<Input value={form.subject} onChange={(event) => change({ subject: event.target.value })} />
				</label>
				<Choice label="Lista" value={form.listId} options={lists} empty="Escolha…" onChange={(listId) => change({ listId })} />
				<Choice label="Somente quem tem a etiqueta (opcional)" value={form.tag} options={tags.map((tag) => ({ id: tag, name: tag }))} empty="Todos da lista" onChange={(tag) => change({ tag })} />
				<label className="block space-y-1">
					<span className="block text-xs font-medium text-neutral-600">Agendar para (vazio = agora)</span>
					<Input type="datetime-local" value={form.scheduledAt} onChange={(event) => change({ scheduledAt: event.target.value })} />
				</label>
				<label className="flex items-start gap-2 text-sm">
					<input type="checkbox" className="mt-1" checked={form.includeInactive} onChange={(event) => change({ includeInactive: event.target.checked })} />
					<span>Incluir quem não abre nem clica há 180 dias (aumenta o risco de spam)</span>
				</label>
				<Button type="button" variant="outline" disabled={busy} onClick={() => void check()}>Revisar</Button>

				{review && (
					<div className="space-y-2 rounded-lg border border-neutral-200 p-4 text-sm">
						<p className="font-medium">{number(review.recipients)} pessoa(s) vão receber.</p>
						{!form.includeInactive && review.inactive > 0 && <p className="text-neutral-500">{number(review.inactive)} inativa(s) ficaram de fora.</p>}
						{review.blockers.map((item) => <p key={item} className="text-red-700">✗ {item}</p>)}
						{review.warnings.map((item) => <p key={item} className="break-all text-amber-700">Atenção: {item}</p>)}
						<Button type="button" disabled={busy || review.blockers.length > 0} onClick={() => void send()}>
							{form.scheduledAt ? "Confirmar agendamento" : `Enviar para ${number(review.recipients)}`}
						</Button>
					</div>
				)}
			</section>

			<section className="space-y-3">
				<div className="flex items-center justify-between gap-2">
					<h2 className="text-base font-semibold">Campanhas</h2>
					<Button type="button" size="sm" variant="outline" disabled={busy} onClick={load}>Atualizar</Button>
				</div>
				{campaigns.length === 0 && <p className="text-sm text-neutral-500">Nenhuma campanha ainda.</p>}
				{campaigns.map((campaign) => (
					<article key={campaign.id} className="space-y-3 rounded-3xl bg-white p-6">
						<div className="flex flex-wrap items-start justify-between gap-2">
							<div>
								<h3 className="text-sm font-medium text-neutral-900">{campaign.name}</h3>
								<p className="text-xs text-neutral-500">
									{campaign.subject} · {campaign.listName ?? "lista apagada"}{campaign.tag ? ` · ${campaign.tag}` : ""} · {campaign.status === "scheduled" && campaign.scheduledAt ? `para ${when(campaign.scheduledAt)}` : when(campaign.createdAt)}
								</p>
							</div>
							<span className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS[campaign.status].className}`}>{STATUS[campaign.status].label}</span>
						</div>
						<dl className="grid grid-cols-3 gap-2 text-sm sm:grid-cols-5">
							{([
								["Na fila", campaign.pending], ["Enviados", campaign.sent], ["Entregues", campaign.delivered], ["Devoluções", campaign.bounced], ["Reclamações", campaign.complained],
								["Descadastros", campaign.unsubscribed], ["Aberturas*", campaign.opened], ["Cliques*", campaign.clicked], ["Pulados", campaign.skipped], ["Falhas", campaign.failed],
							] as const).map(([label, value]) => (
								<div key={label}>
									<dt className="text-xs text-neutral-500">{label}</dt>
									<dd className="font-medium">{number(value)}</dd>
								</div>
							))}
						</dl>
						{["running", "scheduled", "paused"].includes(campaign.status) && (
							<div className="flex flex-wrap gap-2">
								{campaign.status === "paused"
									? <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void act(campaign.id, "resume")}>Retomar</Button>
									: <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void act(campaign.id, "pause")}>Pausar</Button>}
								{cancelling === campaign.id ? (
									<>
										<Button type="button" size="sm" disabled={busy} onClick={() => void act(campaign.id, "cancel")}>Confirmar cancelamento</Button>
										<Button type="button" size="sm" variant="outline" onClick={() => setCancelling("")}>Voltar</Button>
									</>
								) : <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setCancelling(campaign.id)}>Cancelar campanha</Button>}
							</div>
						)}
					</article>
				))}
				{campaigns.length > 0 && <p className="text-xs text-neutral-500">*Aberturas e cliques são aproximados: provedores e antivírus abrem e-mails e links sozinhos.</p>}
			</section>
		</div>
	);
}
