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

const FIELDS = [
	{ key: "firstName", label: "Nome", wide: "sm:col-span-3", max: 100 },
	{ key: "lastName", label: "Sobrenome", wide: "sm:col-span-3", max: 100 },
	{ key: "company", label: "Empresa", wide: "sm:col-span-6", max: 200 },
	{ key: "address", label: "Endereço", wide: "sm:col-span-4", max: 300 },
	{ key: "zip", label: "CEP", wide: "sm:col-span-2", max: 100 },
	{ key: "city", label: "Cidade", wide: "sm:col-span-3", max: 100 },
	{ key: "state", label: "Estado", wide: "sm:col-span-1", max: 100 },
	{ key: "country", label: "País", wide: "sm:col-span-2", max: 100 },
	{ key: "contact", label: "Contato (e-mail, telefone, site)", wide: "sm:col-span-6", max: 300 },
] as const;

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

	const filled = (footer.company.trim() || footer.firstName?.trim()) && footer.contact.trim() && footer.disclaimer.trim();
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
				<div className="grid gap-3 sm:grid-cols-6">
					{FIELDS.map(({ key, label, wide, max }) => (
						<label key={key} className={`block space-y-1 ${wide}`}>
							<span className="block text-xs font-medium text-neutral-600">{label}</span>
							<Input value={footer[key] ?? ""} maxLength={max} onChange={(event) => setFooter({ ...footer, [key]: event.target.value })} />
						</label>
					))}
				</div>
				<p className="text-xs text-neutral-500">Obrigatórios: empresa ou nome, contato e aviso legal. O que ficar vazio não aparece.</p>
				<label className="block space-y-1">
					<span className="block text-xs font-medium text-neutral-600">Aviso legal</span>
					<Textarea rows={3} value={footer.disclaimer} maxLength={2000} onChange={(event) => setFooter({ ...footer, disclaimer: event.target.value })} />
				</label>
				<label className="flex items-center gap-2 text-sm">
					<input type="checkbox" checked={footer.rights === true} onChange={(event) => setFooter({ ...footer, rights: event.target.checked })} />
					<span>Mostrar “© {new Date().getFullYear()} … Todos os direitos reservados.”</span>
				</label>
				<Button type="submit" disabled={busy || !filled}>{busy ? "Salvando…" : "Salvar e aplicar em todos"}</Button>
				{status && <p role="status" className={`text-sm ${status.error ? "text-red-600" : "text-green-700"}`}>{status.text}</p>}
			</form>
		</section>
	);
}
