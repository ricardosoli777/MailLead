"use client";

// Who sends the e-mails: the data once, and a footer written freely with it, on all of them.
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Footer } from "@/lib/marketing/footer";
import { PREVIEW_UNSUBSCRIBE, renderHtml, senderVariables } from "@/lib/marketing/render";
import { FooterEditor } from "./footer-editor";
import { marketingRequest } from "./marketing-request";
import { SENDER_CODES } from "./variable-picker";

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

const NOTICE = "Você recebeu esta mensagem porque se cadastrou ou é cliente.";
const text = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** What the editor opens with before anything was written in it. */
const starting = (footer?: Footer) => [
	footer && !footer.company ? "<div><b>{{remetente_nome}} {{remetente_sobrenome}}</b></div>" : "<div><b>{{remetente_empresa}}</b></div>",
	// What an earlier footer already showed stays.
	footer?.address ? "<div>{{remetente_endereco}}</div>" : "",
	footer?.zip || footer?.city || footer?.state || footer?.country ? `<div>${(["zip", "city", "state", "country"] as const).filter((key) => footer[key]).map((key) => SENDER_CODES[key]).join(" - ")}</div>` : "",
	"<div>{{remetente_contato}}</div>",
	`<div>${text(footer?.disclaimer || NOTICE)}</div>`,
	!footer || footer.rights ? `<div>© {{ano}} ${footer && !footer.company ? "{{remetente_nome}}" : "{{remetente_empresa}}"}. Todos os direitos reservados.</div>` : "",
].join("");

export function FooterSettings({ onSaved }: { onSaved: () => void }) {
	const [footer, setFooter] = useState<Footer>({ company: "", contact: "", disclaimer: "", html: starting() });
	const [status, setStatus] = useState<{ error: boolean; text: string } | null>(null);
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		void marketingRequest<{ footer: Footer | null }>("/api/marketing/footer")
			.then((data) => data.footer && setFooter({ ...data.footer, html: data.footer.html || starting(data.footer) }))
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

	// A variable written in the footer whose data was left blank would leave a hole.
	const values = senderVariables(footer);
	const missing = FIELDS.filter(({ key }) => {
		const code = SENDER_CODES[key];
		return footer.html?.includes(code) && !values[code.slice(2, -2)];
	}).map((item) => item.label);
	const written = (footer.html ?? "").replace(/<[^>]*>|&nbsp;/g, "").trim();

	return (
		<section className="rounded-3xl bg-white p-6">
			<form className="space-y-4" onSubmit={(event) => {
				event.preventDefault();
				if (written) void save();
			}}>
				<div>
					<Label>Dados do rodapé</Label>
					<p className="text-sm text-neutral-500">Preencha uma vez e monte o rodapé do seu jeito: vale para todos os modelos, funis e campanhas ainda não concluídos.</p>
				</div>
				<div className="grid gap-3 sm:grid-cols-6">
					{FIELDS.map(({ key, label, wide, max }) => (
						<div key={key} className={`space-y-1 ${wide}`}>
							<label className="block space-y-1">
								<span className="block text-xs font-medium text-neutral-600">{label}</span>
								<Input value={footer[key] ?? ""} maxLength={max} onChange={(event) => setFooter({ ...footer, [key]: event.target.value })} />
							</label>
							<code className="block break-all text-[11px] text-neutral-400">{SENDER_CODES[key]}</code>
						</div>
					))}
				</div>
				<div className="space-y-1">
					<span className="block text-xs font-medium text-neutral-600">Rodapé do e-mail</span>
					<FooterEditor value={footer.html ?? ""} onChange={(html) => setFooter((current) => ({ ...current, html }))} />
					<p className="text-xs text-neutral-500">Use <strong>Inserir variável</strong> para colocar os dados acima. O link de descadastro entra sozinho no fim, a não ser que você o coloque em outro lugar.</p>
					{missing.length > 0 && <p className="text-xs text-amber-700">Sem preenchimento, mas usado no rodapé: {missing.join(", ")}.</p>}
				</div>
				<div className="space-y-1">
					<span className="block text-xs font-medium text-neutral-600">Como vai chegar</span>
					<iframe title="Prévia do rodapé" sandbox="" srcDoc={renderHtml({ accent: "#0b57d0", preheader: "", blocks: [], footer }, { nome: "Maria" }, PREVIEW_UNSUBSCRIBE)} className="h-56 w-full rounded-xl border border-neutral-200" />
				</div>
				<Button type="submit" disabled={busy || !written}>{busy ? "Salvando…" : "Salvar e aplicar em todos"}</Button>
				{status && <p role="status" className={`text-sm ${status.error ? "text-red-600" : "text-green-700"}`}>{status.text}</p>}
			</form>
		</section>
	);
}
