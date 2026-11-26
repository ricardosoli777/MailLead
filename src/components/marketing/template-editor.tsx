"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentUser } from "@/hooks/use-current-user";
import { renderHtml, renderText } from "@/lib/marketing/render";
import type { Block, Design } from "@/lib/marketing/types";
import { marketingRequest, type Draft } from "./template-manager";

const NEW_BLOCKS: { label: string; block: Block }[] = [
	{ label: "Título", block: { type: "heading", text: "Título" } },
	{ label: "Texto", block: { type: "text", text: "Escreva aqui." } },
	{ label: "Imagem / logo", block: { type: "image", url: "", alt: "", link: "" } },
	{ label: "Botão", block: { type: "button", label: "Saiba mais", url: "https://" } },
	{ label: "Vídeo", block: { type: "media", kind: "video", url: "", imageUrl: "", label: "Assistir ao vídeo" } },
	{ label: "Áudio", block: { type: "media", kind: "audio", url: "", imageUrl: "", label: "Ouvir o áudio" } },
	{ label: "Divisor", block: { type: "divider" } },
];

const TITLES: Record<Block["type"], string> = { heading: "Título", text: "Texto", image: "Imagem", button: "Botão", media: "Vídeo / áudio", divider: "Divisor" };

function Field({ label, value, onChange, multiline, placeholder }: { label: string; value: string; onChange: (value: string) => void; multiline?: boolean; placeholder?: string }) {
	const Control = multiline ? Textarea : Input;
	return (
		<label className="block space-y-1">
			<span className="block text-xs font-medium text-neutral-600">{label}</span>
			<Control value={value} placeholder={placeholder} rows={multiline ? 4 : undefined} onChange={(event) => onChange(event.target.value)} />
		</label>
	);
}

function ImageField({ label, value, onChange, onError }: { label: string; value: string; onChange: (value: string) => void; onError: (message: string) => void }) {
	async function upload(file: File) {
		const form = new FormData();
		form.set("file", file);
		try {
			onChange((await marketingRequest<{ url: string }>("/api/marketing/assets", { method: "POST", body: form })).url);
		} catch (error) {
			onError((error as Error).message);
		}
	}
	return (
		<div className="space-y-1">
			<Field label={label} value={value} onChange={onChange} placeholder="https://… ou envie um arquivo abaixo" />
			<input
				type="file"
				accept="image/png,image/jpeg,image/gif"
				aria-label={`Enviar ${label}`}
				className="text-xs text-neutral-600"
				onChange={(event) => {
					const file = event.target.files?.[0];
					if (file) void upload(file);
					event.target.value = "";
				}}
			/>
		</div>
	);
}

export function TemplateEditor({ initial, onClose }: { initial: Draft; onClose: () => void }) {
	const user = useCurrentUser();
	const [draft, setDraft] = useState<Draft>(initial);
	const [testTo, setTestTo] = useState("");
	const [status, setStatus] = useState<{ error: boolean; message: string } | null>(null);
	const [busy, setBusy] = useState(false);
	const [view, setView] = useState<"desktop" | "mobile" | "text">("desktop");
	const { design } = draft;

	const setDesign = (patch: Partial<Design>) => setDraft((current) => ({ ...current, design: { ...current.design, ...patch } }));
	const setBlock = (index: number, patch: Record<string, string>) =>
		setDesign({ blocks: design.blocks.map((block, i) => (i === index ? ({ ...block, ...patch } as Block) : block)) });
	function move(index: number, offset: number) {
		const blocks = [...design.blocks];
		const [block] = blocks.splice(index, 1);
		blocks.splice(index + offset, 0, block);
		setDesign({ blocks });
	}
	const fail = (message: string) => setStatus({ error: true, message });
	const body = () => JSON.stringify({ name: draft.name, subject: draft.subject, design: draft.design, to: testTo.trim() || user?.email });

	async function run(action: () => Promise<string>) {
		setBusy(true);
		setStatus(null);
		try {
			setStatus({ error: false, message: await action() });
		} catch (error) {
			fail((error as Error).message);
		} finally {
			setBusy(false);
		}
	}

	const save = () => run(async () => {
		const data = await marketingRequest<{ template: { id: string } }>(draft.id ? `/api/marketing/templates/${draft.id}` : "/api/marketing/templates", {
			method: draft.id ? "PUT" : "POST",
			headers: { "Content-Type": "application/json" },
			body: body(),
		});
		setDraft((current) => ({ ...current, id: data.template.id }));
		return "Modelo salvo.";
	});

	const sendTest = () => run(async () => {
		await marketingRequest("/api/marketing/test-send", { method: "POST", headers: { "Content-Type": "application/json" }, body: body() });
		return "Teste enviado.";
	});

	const variables = { nome: user?.name ?? "" };

	return (
		<div className="space-y-6">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<Button type="button" variant="outline" onClick={onClose}>← Voltar</Button>
				<Button type="button" disabled={busy} onClick={() => void save()}>Salvar modelo</Button>
			</div>
			{status && <p role="status" className={`text-sm ${status.error ? "text-red-600" : "text-green-700"}`}>{status.message}</p>}

			<section className="space-y-3 rounded-3xl bg-white p-6">
				<Field label="Nome do modelo" value={draft.name} onChange={(name) => setDraft((current) => ({ ...current, name }))} />
				<Field label="Assunto" value={draft.subject} onChange={(subject) => setDraft((current) => ({ ...current, subject }))} />
				<Field label="Prévia (texto que aparece ao lado do assunto)" value={design.preheader} onChange={(preheader) => setDesign({ preheader })} />
				<label className="flex items-center gap-3 text-xs font-medium text-neutral-600">
					Cor de destaque
					<input type="color" value={design.accent} onChange={(event) => setDesign({ accent: event.target.value })} />
				</label>
				<p className="text-xs text-neutral-500">Use {"{{nome|cliente}}"} para o nome do destinatário, com um texto reserva.</p>
			</section>

			{design.blocks.map((block, index) => (
				<section key={index} className="space-y-3 rounded-3xl bg-white p-6">
					<div className="flex items-center justify-between gap-2">
						<Label>{TITLES[block.type]}</Label>
						<span className="flex gap-1">
							<Button type="button" size="sm" variant="outline" aria-label="Subir bloco" disabled={index === 0} onClick={() => move(index, -1)}>↑</Button>
							<Button type="button" size="sm" variant="outline" aria-label="Descer bloco" disabled={index === design.blocks.length - 1} onClick={() => move(index, 1)}>↓</Button>
							<Button type="button" size="sm" variant="outline" onClick={() => setDesign({ blocks: design.blocks.filter((_, i) => i !== index) })}>Remover</Button>
						</span>
					</div>
					{(block.type === "heading" || block.type === "text") && <Field label="Conteúdo" multiline={block.type === "text"} value={block.text} onChange={(text) => setBlock(index, { text })} />}
					{block.type === "image" && (
						<>
							<ImageField label="Imagem" value={block.url} onChange={(url) => setBlock(index, { url })} onError={fail} />
							<Field label="Descrição da imagem" value={block.alt} onChange={(alt) => setBlock(index, { alt })} />
							<Field label="Link ao clicar (opcional)" value={block.link ?? ""} onChange={(link) => setBlock(index, { link })} />
						</>
					)}
					{block.type === "button" && (
						<>
							<Field label="Texto do botão" value={block.label} onChange={(label) => setBlock(index, { label })} />
							<Field label="Link" value={block.url} onChange={(url) => setBlock(index, { url })} />
						</>
					)}
					{block.type === "media" && (
						<>
							<Field label={block.kind === "video" ? "Link do vídeo" : "Link do áudio"} value={block.url} onChange={(url) => setBlock(index, { url })} />
							<ImageField label="Imagem de capa" value={block.imageUrl ?? ""} onChange={(imageUrl) => setBlock(index, { imageUrl })} onError={fail} />
							<Field label="Texto do botão" value={block.label} onChange={(label) => setBlock(index, { label })} />
						</>
					)}
				</section>
			))}

			<section className="space-y-2 rounded-3xl bg-white p-6">
				<Label>Adicionar bloco</Label>
				<div className="flex flex-wrap gap-2">
					{NEW_BLOCKS.map((item) => (
						<Button key={item.label} type="button" size="sm" variant="outline" onClick={() => setDesign({ blocks: [...design.blocks, { ...item.block }] })}>+ {item.label}</Button>
					))}
				</div>
			</section>

			<section className="space-y-3 rounded-3xl bg-white p-6">
				<Label>Rodapé (obrigatório)</Label>
				<Field label="Empresa ou remetente" value={design.footer.company} onChange={(company) => setDesign({ footer: { ...design.footer, company } })} />
				<Field label="Contato" value={design.footer.contact} onChange={(contact) => setDesign({ footer: { ...design.footer, contact } })} />
				<Field label="Aviso legal" multiline value={design.footer.disclaimer} onChange={(disclaimer) => setDesign({ footer: { ...design.footer, disclaimer } })} />
			</section>

			<section className="space-y-3 rounded-3xl bg-white p-6">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<Label>Pré-visualização</Label>
					<span className="flex gap-1">
						{(["desktop", "mobile", "text"] as const).map((option) => (
							<Button key={option} type="button" size="sm" variant={view === option ? "default" : "outline"} onClick={() => setView(option)}>
								{option === "desktop" ? "Computador" : option === "mobile" ? "Celular" : "Só texto"}
							</Button>
						))}
					</span>
				</div>
				{view === "text" ? (
					<pre className="whitespace-pre-wrap rounded-xl bg-neutral-50 p-4 text-sm text-neutral-800">{renderText(design, variables)}</pre>
				) : (
					// An empty sandbox: no scripts, no same-origin access, links stay inert.
					<iframe title="Pré-visualização do e-mail" sandbox="" srcDoc={renderHtml(design, variables)} className="mx-auto block h-[600px] w-full rounded-xl border border-neutral-200" style={{ maxWidth: view === "mobile" ? 375 : undefined }} />
				)}
				<div className="flex flex-wrap items-end gap-2">
					<div className="min-w-56 flex-1">
						<Field label="Enviar teste para" value={testTo} onChange={setTestTo} placeholder={user?.email ?? "seu@email.com"} />
					</div>
					<Button type="button" variant="outline" disabled={busy} onClick={() => void sendTest()}>Enviar teste</Button>
				</div>
			</section>
		</div>
	);
}
