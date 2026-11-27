"use client";

// Marketing screens are written in Portuguese only: this module exists in this fork alone,
// and the shared catalogs would require every string in all interface languages.
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { STARTERS, type Starter } from "@/lib/marketing/starters";
import type { Design, Template } from "@/lib/marketing/types";
import { marketingRequest } from "./marketing-request";
import { TemplateEditor } from "./template-editor";
import { TemplateGallery } from "./template-gallery";

export type Draft = { id: string | null; name: string; subject: string; design: Design };

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

	const use = (starter: Starter) => {
		const design = structuredClone(starter.design);
		// The signature already written once is kept.
		design.footer = structuredClone(templates[0]?.design.footer ?? STARTERS[0].design.footer);
		setDraft({ id: null, name: starter.name, subject: starter.subject, design });
	};

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
				<p className="text-sm text-neutral-500">Crie mensagens com logo, imagens, botões e rodapé. Os modelos salvos também aparecem no compositor.</p>
			</div>
			{error && <p role="alert" className="text-sm text-red-600">{error}</p>}
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
			<section className="space-y-3 rounded-3xl bg-white p-6">
				<Label>Modelos prontos</Label>
				<TemplateGallery onChoose={use} />
			</section>
		</div>
	);
}
