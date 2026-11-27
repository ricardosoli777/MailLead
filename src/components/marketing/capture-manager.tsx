"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CaptureForm, CaptureHook, CaptureKey, FormField } from "@/lib/marketing/capture-types";
import { marketingRequest } from "./marketing-request";

type Data = { forms: CaptureForm[]; hooks: CaptureHook[]; keys: CaptureKey[] };
type List = { id: string; name: string };
type Kind = "form" | "hook" | "key";

const SELECT = "h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm";
const EMPTY = { name: "", listId: "", tags: "", consentText: "", doubleOptIn: true, button: "Quero receber", fields: [] as FormField[] };
const MAX_FIELDS = 8;
const SUGGESTED = ["Telefone", "WhatsApp", "Cidade", "Empresa"];
const draftOf = (form: CaptureForm) => ({ name: form.name, listId: form.listId, tags: form.tags.join(", "), consentText: form.consentText, doubleOptIn: form.doubleOptIn, button: form.button, fields: form.fields });
const escapes: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
const escapeHtml = (value: string) => value.replace(/[&<>"]/g, (char) => escapes[char]);

const inputType = (key: string) => (/telefone|whats|celular|fone/.test(key) ? "tel" : "text");

/** A plain form: it works on any site, without scripts or frames. */
const snippet = (url: string, form: CaptureForm) => [
	`<form action="${url}" method="post" target="_blank">`,
	`  <input name="name" placeholder="Seu nome">`,
	`  <input name="email" type="email" placeholder="Seu e-mail" required>`,
	...form.fields.map((field) => `  <input name="campo.${escapeHtml(field.key)}" type="${inputType(field.key)}" placeholder="${escapeHtml(field.label)}"${field.required ? " required" : ""}>`),
	`  <div style="position:absolute;left:-9999px" aria-hidden="true"><input name="website" tabindex="-1" autocomplete="off"></div>`,
	`  <p>${escapeHtml(form.consentText)}</p>`,
	`  <button>${escapeHtml(form.button)}</button>`,
	`</form>`,
].join("\n");

function FieldsEditor({ value, onChange }: { value: typeof EMPTY; onChange: (patch: Partial<typeof EMPTY>) => void }) {
	const set = (index: number, patch: Partial<FormField>) => onChange({ fields: value.fields.map((field, at) => (at === index ? { ...field, ...patch } : field)) });
	const add = (label: string) => onChange({ fields: [...value.fields, { key: label.toLowerCase(), label, required: false }] });
	const room = value.fields.length < MAX_FIELDS;
	return (
		<>
			<fieldset className="space-y-2">
				<legend className="text-xs font-medium text-neutral-600">Campos que o formulário pede</legend>
				<p className="text-sm text-neutral-500">Nome e e-mail (obrigatório) já vêm. Adicione os outros:</p>
				{value.fields.map((field, index) => (
					<div key={index} className="flex flex-wrap items-center gap-2">
						<Input className="min-w-40 flex-1" value={field.label} placeholder="Nome do campo" aria-label="Nome do campo" onChange={(event) => set(index, { label: event.target.value })} />
						<label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={field.required} onChange={(event) => set(index, { required: event.target.checked })} />Obrigatório</label>
						<Button type="button" size="sm" variant="outline" onClick={() => onChange({ fields: value.fields.filter((_, at) => at !== index) })}>Tirar</Button>
					</div>
				))}
				{room && (
					<div className="flex flex-wrap gap-2">
						{SUGGESTED.filter((label) => !value.fields.some((field) => field.label.toLowerCase() === label.toLowerCase())).map((label) => (
							<Button key={label} type="button" size="sm" variant="outline" onClick={() => add(label)}>+ {label}</Button>
						))}
						<Button type="button" size="sm" variant="outline" onClick={() => add("")}>+ Outro campo</Button>
					</div>
				)}
			</fieldset>
			<label className="block space-y-1">
				<span className="block text-xs font-medium text-neutral-600">Texto do botão</span>
				<Input value={value.button} onChange={(event) => onChange({ button: event.target.value })} />
			</label>
			<label className="flex items-start gap-2 text-sm">
				<input type="checkbox" className="mt-1" checked={value.doubleOptIn} onChange={(event) => onChange({ doubleOptIn: event.target.checked })} />
				<span>Pedir confirmação por e-mail (recomendado: impede que robôs cadastrem endereços de outras pessoas)</span>
			</label>
		</>
	);
}

function Copy({ label, value }: { label: string; value: string }) {
	const [copied, setCopied] = useState(false);
	return (
		<div className="space-y-1">
			<div className="flex items-center justify-between gap-2">
				<span className="text-xs font-medium text-neutral-600">{label}</span>
				<Button type="button" size="sm" variant="outline" onClick={() => void navigator.clipboard.writeText(value).then(() => setCopied(true))}>{copied ? "Copiado" : "Copiar"}</Button>
			</div>
			<pre className="overflow-x-auto rounded-lg bg-neutral-100 p-3 text-xs">{value}</pre>
		</div>
	);
}

function TargetFields({ value, onChange, lists }: { value: typeof EMPTY; onChange: (patch: Partial<typeof EMPTY>) => void; lists: List[] }) {
	return (
		<>
			<label className="block space-y-1">
				<span className="block text-xs font-medium text-neutral-600">Nome</span>
				<Input value={value.name} onChange={(event) => onChange({ name: event.target.value })} />
			</label>
			<label className="block space-y-1">
				<span className="block text-xs font-medium text-neutral-600">Entra na lista</span>
				<select className={SELECT} value={value.listId} onChange={(event) => onChange({ listId: event.target.value })}>
					<option value="">{lists.length ? "Escolha…" : "Crie uma lista em Contatos"}</option>
					{lists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}
				</select>
			</label>
			<label className="block space-y-1">
				<span className="block text-xs font-medium text-neutral-600">Etiquetas (separadas por vírgula, opcional)</span>
				<Input value={value.tags} onChange={(event) => onChange({ tags: event.target.value })} />
			</label>
			<label className="block space-y-1">
				<span className="block text-xs font-medium text-neutral-600">O que a pessoa está aceitando (fica registrado)</span>
				<Input value={value.consentText} placeholder="Aceito receber novidades e ofertas por e-mail." onChange={(event) => onChange({ consentText: event.target.value })} />
			</label>
		</>
	);
}

export function CaptureManager({ editId, onEdit }: { editId: string; onEdit: (id: string) => void }) {
	const [data, setData] = useState<Data>({ forms: [], hooks: [], keys: [] });
	const [lists, setLists] = useState<List[]>([]);
	const [form, setForm] = useState(EMPTY);
	const [draft, setDraft] = useState(EMPTY);
	const [hook, setHook] = useState(EMPTY);
	const [keyName, setKeyName] = useState("");
	const [newKey, setNewKey] = useState("");
	const [open, setOpen] = useState("");
	const [removing, setRemoving] = useState("");
	const [origin, setOrigin] = useState("");
	const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
	const [busy, setBusy] = useState(false);

	const load = useCallback(() => {
		setOrigin(window.location.origin);
		void Promise.all([marketingRequest<Data>("/api/marketing/capture"), marketingRequest<{ lists: List[] }>("/api/marketing/lists")])
			.then(([capture, listData]) => {
				setData(capture);
				setLists(listData.lists);
			})
			.catch((error: Error) => setMessage({ error: true, text: error.message }));
	}, []);
	useEffect(load, [load]);

	// Fills the editor when a form is opened, also right after its list is created.
	const editing = data.forms.find((item) => item.id === editId);
	useEffect(() => {
		if (editing) setDraft(draftOf(editing));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [editing?.id]);
	const save = () => run(async () => {
		await marketingRequest("/api/marketing/capture", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editId, ...draft }) });
		return "Formulário salvo. Copie o código de novo se já colou em algum site.";
	});

	async function run(action: () => Promise<string>) {
		setBusy(true);
		setMessage(null);
		try {
			const text = await action();
			setMessage({ error: false, text });
			load();
		} catch (error) {
			setMessage({ error: true, text: error instanceof Error ? error.message : "Falha." });
		} finally {
			setBusy(false);
		}
	}

	const create = <T,>(body: object) => marketingRequest<T>("/api/marketing/capture", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
	const remove = (kind: Kind, id: string) => run(async () => {
		setRemoving("");
		await marketingRequest(`/api/marketing/capture?kind=${kind}&id=${encodeURIComponent(id)}`, { method: "DELETE" });
		return "Apagado.";
	});
	const removeButton = (kind: Kind, id: string) => removing === id ? (
		<>
			<Button type="button" size="sm" disabled={busy} onClick={() => void remove(kind, id)}>Confirmar</Button>
			<Button type="button" size="sm" variant="outline" onClick={() => setRemoving("")}>Voltar</Button>
		</>
	) : <Button type="button" size="sm" variant="outline" onClick={() => setRemoving(id)}>Apagar</Button>;
	const listName = (id: string) => lists.find((list) => list.id === id)?.name ?? "lista apagada";

	return (
		<div className="max-w-3xl space-y-6">
			{message && <p role="status" className={`fixed inset-x-4 bottom-4 z-50 mx-auto max-w-xl rounded-lg px-4 py-3 text-sm shadow-lg ${message.error ? "bg-red-50 text-red-800" : "bg-green-50 text-green-800"}`}>{message.text}</p>}

			<section className="space-y-3 rounded-3xl bg-white p-6">
				<h2 className="text-base font-semibold">Formulários</h2>
				<p className="text-sm text-neutral-500">Cada lista nova já ganha um. Escolha os campos, cole o código na sua página de vendas e os leads entram na lista.</p>
				{data.forms.map((item) => (
					<article key={item.id} className="space-y-3 rounded-lg border border-neutral-200 p-4">
						<div className="flex flex-wrap items-center justify-between gap-2">
							<p className="text-sm font-medium">{item.name} <span className="font-normal text-neutral-500">→ {listName(item.listId)} · {item.doubleOptIn ? "com confirmação" : "sem confirmação"}</span></p>
							<div className="flex gap-2">
								<Button type="button" size="sm" variant="outline" onClick={() => onEdit(editId === item.id ? "" : item.id)}>{editId === item.id ? "Fechar" : "Ajustar e copiar"}</Button>
								{removeButton("form", item.id)}
							</div>
						</div>
						{editId === item.id && (
							<>
								<TargetFields value={draft} lists={lists} onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))} />
								<FieldsEditor value={draft} onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))} />
								<Button type="button" disabled={busy} onClick={() => void save()}>Salvar formulário</Button>
								<Copy label="Código para colar na sua página de vendas" value={snippet(`${origin}/api/marketing/f/${item.id}`, item)} />
								<Copy label="Ou divulgue o link da página pronta" value={`${origin}/api/marketing/f/${item.id}`} />
								<a className="inline-block text-sm text-blue-700 underline" href={`/api/marketing/f/${item.id}`} target="_blank" rel="noreferrer">Ver como a pessoa vê</a>
							</>
						)}
					</article>
				))}
				<details className="space-y-3">
					<summary className="cursor-pointer text-sm font-medium">Criar outro formulário</summary>
					<TargetFields value={form} lists={lists} onChange={(patch) => setForm((current) => ({ ...current, ...patch }))} />
					<FieldsEditor value={form} onChange={(patch) => setForm((current) => ({ ...current, ...patch }))} />
					<Button type="button" disabled={busy} onClick={() => void run(async () => {
						const { id } = await create<{ id: string }>({ kind: "form", ...form });
						setForm(EMPTY);
						onEdit(id);
						return "Formulário criado. Ajuste e copie o código acima.";
					})}>Criar formulário</Button>
				</details>
			</section>

			<section className="space-y-3 rounded-3xl bg-white p-6">
				<h2 className="text-base font-semibold">Webhooks de entrada</h2>
				<p className="text-sm text-neutral-500">Outro sistema avisa o MailLead e a pessoa entra na lista.</p>
				{data.hooks.map((item) => (
					<article key={item.id} className="space-y-2 rounded-lg border border-neutral-200 p-4">
						<div className="flex flex-wrap items-center justify-between gap-2">
							<p className="text-sm font-medium">{item.name} <span className="font-normal text-neutral-500">→ {listName(item.listId)}</span></p>
							<div className="flex gap-2">
								<Button type="button" size="sm" variant="outline" onClick={() => setOpen(open === item.id ? "" : item.id)}>{open === item.id ? "Fechar" : "Como configurar"}</Button>
								{removeButton("hook", item.id)}
							</div>
						</div>
						{open === item.id && (
							<>
								<Copy label="Endereço (POST, JSON)" value={`${origin}/api/marketing/hooks/${item.id}`} />
								<Copy label="Segredo da assinatura" value={item.secret} />
								<Copy label="Corpo" value={`{"email":"pessoa@exemplo.com","name":"Nome"}`} />
								<p className="text-xs text-neutral-500">Cabeçalho <code>X-MailLead-Signature</code>: HMAC-SHA256 do corpo, em hexadecimal, com o segredo acima.</p>
							</>
						)}
					</article>
				))}
				<TargetFields value={hook} lists={lists} onChange={(patch) => setHook((current) => ({ ...current, ...patch }))} />
				<Button type="button" disabled={busy} onClick={() => void run(async () => {
					await create({ kind: "hook", ...hook });
					setHook(EMPTY);
					return "Webhook criado.";
				})}>Criar webhook</Button>
			</section>

			<section className="space-y-3 rounded-3xl bg-white p-6">
				<h2 className="text-base font-semibold">Chaves de API</h2>
				<p className="text-sm text-neutral-500">Servem só para adicionar e remover contatos de marketing. Não dão acesso ao seu e-mail.</p>
				{data.keys.map((item) => (
					<div key={item.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
						<span>{item.name} <span className="text-neutral-500">· {item.lastUsedAt ? `usada em ${new Date(item.lastUsedAt).toLocaleDateString("pt-BR")}` : "nunca usada"}</span></span>
						<div className="flex gap-2">{removeButton("key", item.id)}</div>
					</div>
				))}
				{newKey && (
					<div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-4">
						<p className="text-sm font-medium">Copie agora: esta chave não será mostrada de novo.</p>
						<Copy label="Chave" value={newKey} />
					</div>
				)}
				<div className="flex gap-2">
					<Input value={keyName} placeholder="Nome da chave (ex.: site)" aria-label="Nome da chave" onChange={(event) => setKeyName(event.target.value)} />
					<Button type="button" disabled={busy} onClick={() => void run(async () => {
						setNewKey((await create<{ key: string }>({ kind: "key", name: keyName })).key);
						setKeyName("");
						return "Chave criada.";
					})}>Criar chave</Button>
				</div>
				{lists.length > 0 && (
					<>
						<Copy label="Identificadores das listas (campo listId)" value={lists.map((list) => `${list.id}  ${list.name}`).join("\n")} />
						<Copy label="Exemplo para adicionar um contato" value={`curl -X POST ${origin}/api/marketing/v1/contacts \\\n  -H "Authorization: Bearer SUA_CHAVE" -H "Content-Type: application/json" \\\n  -d '{"email":"pessoa@exemplo.com","name":"Nome","listId":"${lists[0].id}","consent":{"source":"checkout","text":"Aceito receber e-mails","date":"${new Date().toISOString().slice(0, 10)}"}}'`} />
						<p className="text-xs text-neutral-500">Para remover: POST em <code>/api/marketing/v1/unsubscribe</code> com <code>{`{"email":"..."}`}</code>.</p>
					</>
				)}
			</section>
		</div>
	);
}
