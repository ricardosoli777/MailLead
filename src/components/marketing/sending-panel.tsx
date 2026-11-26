"use client";

import { useCallback, useEffect, useState } from "react";
import AwsCredentialsPanel from "@/app/(admin)/domains/AwsCredentialsPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Quota, SenderSettings } from "@/lib/marketing/sending-types";
import { marketingRequest } from "./marketing-request";

type Status = {
	sender: SenderSettings;
	saved: boolean;
	checks: { id: string; label: string; ok: boolean; detail: string }[];
	quota: Quota | null;
	warmup: { day: number; limit: number; sentLast24Hours: number };
	stats: { sent: number; bounced: number; complained: number };
	breaker: { reason: string; at: number } | null;
};

const json = (method: string, body: unknown): RequestInit => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const number = (value: number) => value.toLocaleString("pt-BR");
const SELECT = "h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm";
const PROVIDERS = [["gmail", "Gmail"], ["outlook", "Outlook"], ["yahoo", "Yahoo"], ["other", "Outros"]] as const;

function Field({ label, value, onChange, placeholder, type }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string }) {
	return (
		<label className="block space-y-1">
			<span className="block text-xs font-medium text-neutral-600">{label}</span>
			<Input type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
		</label>
	);
}

export function SendingPanel() {
	const [status, setStatus] = useState<Status | null>(null);
	const [sender, setSender] = useState<SenderSettings | null>(null);
	const [templates, setTemplates] = useState<{ id: string; name: string }[]>([]);
	const [test, setTest] = useState({ to: "", templateId: "" });
	const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
	const [busy, setBusy] = useState(false);

	const load = useCallback(() => {
		void Promise.all([
			marketingRequest<Status>("/api/marketing/sending"),
			marketingRequest<{ templates: { id: string; name: string }[] }>("/api/marketing/templates"),
		])
			.then(([data, list]) => {
				setStatus(data);
				// Keeps what is being typed when the credentials panel asks for a refresh.
				setSender((current) => current ?? data.sender);
				setTemplates(list.templates);
			})
			.catch((error: Error) => setMessage({ error: true, text: error.message }));
	}, []);
	useEffect(load, [load]);

	async function run(url: string, init: RequestInit, done: string) {
		setBusy(true);
		setMessage(null);
		try {
			await marketingRequest(url, init);
			setMessage({ error: false, text: done });
			load();
		} catch (error) {
			setMessage({ error: true, text: error instanceof Error ? error.message : "Falha." });
		} finally {
			setBusy(false);
		}
	}

	const notice = message && <p role="status" className={`rounded-lg px-3 py-2 text-sm ${message.error ? "bg-red-50 text-red-800" : "bg-green-50 text-green-800"}`}>{message.text}</p>;
	if (!status || !sender) return notice || <p className="text-sm text-neutral-500">Carregando…</p>;
	const ready = status.checks.length > 0 && status.checks.every((check) => check.ok);

	return (
		<div className="max-w-2xl space-y-6">
			{notice}
			{status.breaker && (
				<div className="space-y-2 rounded-lg bg-red-50 p-4 text-sm text-red-900">
					<p className="font-medium">Envio pausado para proteger sua reputação.</p>
					<p>{status.breaker.reason}</p>
					<Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void run("/api/marketing/sending", { method: "DELETE" }, "Envio retomado.")}>Já revisei, retomar</Button>
				</div>
			)}

			<section className="space-y-3">
				<h2 className="text-base font-semibold">Remetente</h2>
				<Field label="Nome do remetente" value={sender.fromName} placeholder="Ex.: KLEAD" onChange={(fromName) => setSender({ ...sender, fromName })} />
				<Field label="E-mail de envio (subdomínio só de marketing)" value={sender.fromEmail} placeholder="contato@news.seudominio.com.br" onChange={(fromEmail) => setSender({ ...sender, fromEmail })} />
				<Field label="Responder para (opcional)" value={sender.replyTo} onChange={(replyTo) => setSender({ ...sender, replyTo })} />
				<Field label="Endereço público (usado no link de descadastro)" value={sender.origin} onChange={(origin) => setSender({ ...sender, origin })} />
				<div>
					<p className="text-xs font-medium text-neutral-600">Máximo por hora em cada provedor</p>
					<div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-4">
						{PROVIDERS.map(([key, label]) => (
							<Field key={key} label={label} type="number" value={String(sender.hourlyByProvider[key])} onChange={(value) => setSender({ ...sender, hourlyByProvider: { ...sender.hourlyByProvider, [key]: Number(value) } })} />
						))}
					</div>
				</div>
				<Button type="button" disabled={busy} onClick={() => void run("/api/marketing/sending", json("PUT", sender), "Remetente salvo.")}>Salvar</Button>
			</section>

			<section className="space-y-2">
				<h2 className="text-base font-semibold">Conta Amazon SES</h2>
				<AwsCredentialsPanel need="sending" onChanged={load} />
			</section>

			<section className="space-y-2">
				<h2 className="text-base font-semibold">Verificações</h2>
				{!status.saved && <p className="text-sm text-neutral-500">Salve o remetente para verificar o domínio.</p>}
				<ul className="space-y-1 text-sm">
					{status.checks.map((check) => (
						<li key={check.id} className="flex gap-2">
							<span aria-hidden className={check.ok ? "text-green-700" : "text-red-700"}>{check.ok ? "✓" : "✗"}</span>
							<span>{check.label}<span className="sr-only">{check.ok ? ": ok" : ": pendente"}</span>{check.detail && <span className="block text-xs text-neutral-500">{check.detail}</span>}</span>
						</li>
					))}
				</ul>
				{status.saved && (
					<div className="flex gap-2">
						<Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void run("/api/marketing/sending/setup", { method: "POST" }, "Eventos configurados no Amazon SES.")}>Configurar eventos</Button>
						<Button type="button" size="sm" variant="outline" disabled={busy} onClick={load}>Verificar de novo</Button>
					</div>
				)}
			</section>

			<section className="space-y-1 text-sm">
				<h2 className="text-base font-semibold">Limites e reputação</h2>
				<p>Aquecimento, dia {status.warmup.day}: {number(status.warmup.sentLast24Hours)} de {number(status.warmup.limit)} nas últimas 24 horas.</p>
				{status.quota && <p>Cota do Amazon SES: {number(status.quota.sentLast24Hours)} de {number(status.quota.max24Hour)} em 24 horas, até {number(status.quota.maxPerSecond)} por segundo.</p>}
				<p>Últimos 7 dias: {number(status.stats.sent)} enviados, {number(status.stats.bounced)} devoluções, {number(status.stats.complained)} reclamações.</p>
			</section>

			<section className="space-y-3">
				<h2 className="text-base font-semibold">Teste pelo domínio de marketing</h2>
				<Field label="Enviar para" value={test.to} type="email" onChange={(to) => setTest({ ...test, to })} />
				<label className="block space-y-1">
					<span className="block text-xs font-medium text-neutral-600">Modelo</span>
					<select className={SELECT} value={test.templateId} onChange={(event) => setTest({ ...test, templateId: event.target.value })}>
						<option value="">Escolha…</option>
						{templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
					</select>
				</label>
				<Button type="button" disabled={busy || !ready || !test.to || !test.templateId} onClick={() => void run("/api/marketing/sending/test", json("POST", test), "Teste enviado.")}>Enviar teste</Button>
				{!ready && <p className="text-xs text-neutral-500">O envio libera quando todas as verificações estiverem certas.</p>}
			</section>
		</div>
	);
}
