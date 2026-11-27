"use client";

// Sign up with your own data, as a lead would, and watch what leaves.
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { FlowTestStatus } from "@/lib/marketing/flows-types";
import { marketingRequest } from "./marketing-request";

const TONE = { ok: "text-green-700", wait: "text-neutral-500", error: "text-red-700" } as const;

export function FlowTestDialog({ flowId, active, needsPhone, onClose }: { flowId: string; active: boolean; needsPhone: boolean; onClose: () => void }) {
	const [person, setPerson] = useState({ name: "", email: "", phone: "" });
	const [own, setOwn] = useState(false);
	const [running, setRunning] = useState("");
	const [status, setStatus] = useState<FlowTestStatus | null>(null);
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		if (!running) return;
		const check = () => void marketingRequest<{ test: FlowTestStatus | null }>(`/api/marketing/flows/${flowId}/test?email=${encodeURIComponent(running)}`)
			.then((data) => setStatus(data.test))
			.catch((loadError: Error) => setError(loadError.message));
		check();
		const timer = setInterval(check, 5000);
		return () => clearInterval(timer);
	}, [flowId, running]);

	async function start() {
		setBusy(true);
		setError("");
		setStatus(null);
		setRunning("");
		try {
			await marketingRequest(`/api/marketing/flows/${flowId}/test`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...person, own }) });
			setRunning(person.email);
		} catch (startError) {
			setError((startError as Error).message);
		} finally {
			setBusy(false);
		}
	}

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="max-h-[calc(100vh-4rem)] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>Testar o funil</DialogTitle>
					<DialogDescription>Cadastre-se como um cliente faria. As mensagens são enviadas de verdade para você.</DialogDescription>
				</DialogHeader>
				{!active ? (
					<p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Primeiro clique em <strong>Salvar e ativar</strong>. Depois volte aqui.</p>
				) : (
					<form className="mt-4 space-y-3" onSubmit={(event) => {
						event.preventDefault();
						void start();
					}}>
						<Input value={person.name} placeholder="Seu nome" aria-label="Seu nome" onChange={(event) => setPerson({ ...person, name: event.target.value })} />
						<Input type="email" required value={person.email} placeholder="Seu e-mail" aria-label="Seu e-mail" onChange={(event) => setPerson({ ...person, email: event.target.value })} />
						<Input type="tel" required={needsPhone} value={person.phone} placeholder={needsPhone ? "Seu WhatsApp com DDD" : "Seu WhatsApp com DDD (opcional)"} aria-label="Seu WhatsApp com DDD" onChange={(event) => setPerson({ ...person, phone: event.target.value })} />
						<label className="flex items-start gap-2 text-sm">
							<input type="checkbox" className="mt-1" checked={own} onChange={(event) => setOwn(event.target.checked)} />
							<span>O e-mail e o número são meus.</span>
						</label>
						<Button type="submit" disabled={busy || !own || !person.email.trim()}>{running ? "Testar de novo" : "Cadastrar e testar"}</Button>
					</form>
				)}
				{error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
				{running && (
					<div className="mt-4 space-y-2 rounded-xl border border-neutral-200 p-3 text-sm" role="status">
						<p className="font-medium">{status ? status.now : "Começando…"}</p>
						{status?.steps.map((step, index) => <p key={index}>{step.name}: <span className={TONE[step.tone]}>{step.text}</span></p>)}
						{!status?.done && <p className="text-xs text-neutral-500">Cada passo pode levar até 1 minuto. A tela se atualiza sozinha.</p>}
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
