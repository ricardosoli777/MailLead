"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MailingList } from "@/lib/marketing/contacts-types";
import { marketingRequest } from "./marketing-request";

export function ListManager({ onFormCreated }: { onFormCreated: (formId: string) => void }) {
	const [lists, setLists] = useState<MailingList[] | null>(null);
	const [name, setName] = useState("");
	const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
	const [busy, setBusy] = useState(false);

	const load = useCallback(() => {
		void marketingRequest<{ lists: MailingList[] }>("/api/marketing/lists")
			.then((data) => setLists(data.lists))
			.catch((error: Error) => setMessage({ error: true, text: error.message }));
	}, []);
	useEffect(load, [load]);

	async function run(action: () => Promise<void>) {
		setBusy(true);
		setMessage(null);
		try {
			await action();
		} catch (error) {
			setMessage({ error: true, text: (error as Error).message });
		} finally {
			setBusy(false);
		}
	}

	// A new list comes with its capture form, so the next step is to adjust it.
	const create = () => run(async () => {
		const { formId } = await marketingRequest<{ formId: string }>("/api/marketing/lists", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
		onFormCreated(formId);
	});

	const remove = (list: MailingList) => {
		if (!window.confirm(`Excluir a lista "${list.name}"? Os contatos continuam cadastrados.`)) return;
		void run(async () => {
			await marketingRequest(`/api/marketing/lists/${list.id}`, { method: "DELETE" });
			setMessage({ error: false, text: "Lista excluída." });
			load();
		});
	};

	return (
		<div className="space-y-6">
			{message && <p role="status" className={`text-sm ${message.error ? "text-red-600" : "text-green-700"}`}>{message.text}</p>}

			<form
				className="space-y-3 rounded-3xl bg-white p-6"
				onSubmit={(event) => {
					event.preventDefault();
					if (!busy && name.trim()) void create();
				}}
			>
				<div className="flex flex-wrap items-end gap-2">
					<label className="block flex-1 space-y-1">
						<span className="block text-xs font-medium text-neutral-600">Nome da lista</span>
						<Input value={name} placeholder="Ex.: Clientes" onChange={(event) => setName(event.target.value)} />
					</label>
					<Button type="submit" disabled={busy || !name.trim()}>Criar lista</Button>
				</div>
				<p className="text-xs text-neutral-500">Ao criar, o formulário de inscrição dessa lista abre em seguida.</p>
			</form>

			<section className="space-y-3 rounded-3xl bg-white p-6">
				<Label>Suas listas</Label>
				<ul className="divide-y divide-neutral-100">
					{lists?.map((list) => (
						<li key={list.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
							<span className="min-w-0">
								<span className="block break-words text-sm font-medium text-neutral-900">{list.name}</span>
								<span className="block text-xs text-neutral-500">{list.members === 1 ? "1 contato" : `${list.members} contatos`}</span>
							</span>
							<Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => remove(list)}>Excluir</Button>
						</li>
					))}
					{lists?.length === 0 && <li className="py-3 text-sm text-neutral-500">Nenhuma lista ainda.</li>}
				</ul>
			</section>
		</div>
	);
}
