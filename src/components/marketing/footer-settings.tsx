"use client";

// Who sends the e-mails: filled in once, written at the bottom of all of them.
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Footer } from "@/lib/marketing/footer";
import { STARTERS } from "@/lib/marketing/starters";
import { marketingRequest } from "./marketing-request";

export function FooterSettings({ onSaved }: { onSaved: () => void }) {
	const [footer, setFooter] = useState<Footer>({ company: "", contact: "", disclaimer: STARTERS[0].design.footer.disclaimer });
	const [status, setStatus] = useState<{ error: boolean; text: string } | null>(null);
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		void marketingRequest<{ footer: Footer | null }>("/api/marketing/footer")
			.then((data) => data.footer && setFooter(data.footer))
			.catch((error: Error) => setStatus({ error: true, text: error.message }));
	}, []);

	async function save() {
		setBusy(true);
		setStatus(null);
		try {
			const result = await marketingRequest<{ templates: number; sending: number }>("/api/marketing/footer", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(footer) });
			setStatus({ error: false, text: `Salvo. Aplicado em ${result.templates} modelo(s) e ${result.sending} envio(s) em andamento.` });
			onSaved();
		} catch (error) {
			setStatus({ error: true, text: (error as Error).message });
		} finally {
			setBusy(false);
		}
	}

	const filled = footer.company.trim() && footer.contact.trim() && footer.disclaimer.trim();
	return (
		<section className="rounded-3xl bg-white p-6">
			<form className="space-y-3" onSubmit={(event) => {
				event.preventDefault();
				if (filled) void save();
			}}>
				<div>
					<Label>Dados do rodapé</Label>
					<p className="text-sm text-neutral-500">Preencha uma vez: vale para todos os modelos, funis e campanhas ainda não concluídos.</p>
				</div>
				<label className="block space-y-1">
					<span className="block text-xs font-medium text-neutral-600">Nome da empresa ou seu nome</span>
					<Input value={footer.company} maxLength={200} onChange={(event) => setFooter({ ...footer, company: event.target.value })} />
				</label>
				<label className="block space-y-1">
					<span className="block text-xs font-medium text-neutral-600">Contato (e-mail, telefone, endereço)</span>
					<Input value={footer.contact} maxLength={300} onChange={(event) => setFooter({ ...footer, contact: event.target.value })} />
				</label>
				<label className="block space-y-1">
					<span className="block text-xs font-medium text-neutral-600">Aviso legal</span>
					<Textarea rows={3} value={footer.disclaimer} maxLength={2000} onChange={(event) => setFooter({ ...footer, disclaimer: event.target.value })} />
				</label>
				<Button type="submit" disabled={busy || !filled}>{busy ? "Salvando…" : "Salvar e aplicar em todos"}</Button>
				{status && <p role="status" className={`text-sm ${status.error ? "text-red-600" : "text-green-700"}`}>{status.text}</p>}
			</form>
		</section>
	);
}
