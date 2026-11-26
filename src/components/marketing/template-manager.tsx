"use client";

// Marketing screens are written in Portuguese only: this module exists in this fork alone,
// and the shared catalogs would require every string in all interface languages.
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { authFetch } from "@/lib/auth/client";
import { STARTERS } from "@/lib/marketing/starters";
import type { Design, Template } from "@/lib/marketing/types";
import { TemplateEditor } from "./template-editor";

export type Draft = { id: string | null; name: string; subject: string; design: Design };

export async function marketingRequest<T>(url: string, init?: RequestInit): Promise<T> {
	const response = await authFetch(url, { cache: "no-store", ...init });
	const data = (await response.json().catch(() => ({}))) as T & { error?: string };
	if (!response.ok) throw new Error(data.error ?? "Não foi possível concluir a operação.");
	return data;
}

export function TemplateManager() {
	const [templates, setTemplates] = useState<Template[]>([]);
	const [draft, setDraft] = useState<Draft | null>(null);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(() => {
		void marketingRequest<{ templates: Template[] }>("/api/marketing/templates")
			.then((data) => {
				setTemplates(data.templates);
				setError(null);
			})
			.catch((loadError: Error) => setError(loadError.message));
	}, []);
	useEffect(load, [load]);

	async function remove(template: Template) {
		if (!window.confirm(`Excluir o modelo "${template.name}"?`)) return;
		try {
			await marketingRequest(`/api/marketing/templates/${template.id}`, { method: "DELETE" });
			load();
		} catch (removeError) {
			setError((removeError as Error).message);
		}
	}

	if (draft) {
		return <TemplateEditor initial={draft} onClose={() => { setDraft(null); load(); }} />;
	}

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-medium text-neutral-900 md:text-3xl">Modelos de e-mail</h1>
				<p className="mt-2 text-sm text-neutral-500">Crie mensagens com logo, imagens, botões e rodapé. Os modelos salvos também aparecem no compositor.</p>
			</div>
			{error && <p role="alert" className="text-sm text-red-600">{error}</p>}
			<section className="space-y-3 rounded-3xl bg-white p-6">
				<Label>Começar de um modelo pronto</Label>
				<div className="flex flex-wrap gap-2">
					{STARTERS.map((starter) => (
						<Button key={starter.key} type="button" variant="outline" onClick={() => setDraft({ id: null, name: starter.name, subject: starter.subject, design: structuredClone(starter.design) })}>
							{starter.name}
						</Button>
					))}
				</div>
			</section>
			<section className="space-y-2 rounded-3xl bg-white p-6">
				<Label htmlFor="marketing-saved">Modelos salvos</Label>
				{templates.length === 0 && <p className="text-sm text-neutral-500">Nenhum modelo salvo ainda.</p>}
				<ul id="marketing-saved" className="divide-y divide-neutral-100">
					{templates.map((template) => (
						<li key={template.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
							<span>
								<span className="block text-sm font-medium text-neutral-900">{template.name}</span>
								<span className="block text-xs text-neutral-500">{template.subject}</span>
							</span>
							<span className="flex gap-2">
								<Button type="button" size="sm" variant="outline" onClick={() => setDraft({ id: template.id, name: template.name, subject: template.subject, design: template.design })}>Editar</Button>
								<Button type="button" size="sm" variant="outline" onClick={() => setDraft({ id: null, name: `${template.name} (cópia)`, subject: template.subject, design: structuredClone(template.design) })}>Duplicar</Button>
								<Button type="button" size="sm" variant="outline" onClick={() => void remove(template)}>Excluir</Button>
							</span>
						</li>
					))}
				</ul>
			</section>
		</div>
	);
}
