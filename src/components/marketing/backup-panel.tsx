"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { authFetch } from "@/lib/auth/client";
import type { BackupFile } from "@/lib/marketing/backup";
import { marketingRequest } from "./marketing-request";

const date = (value: number) => new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
const size = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);
const RESTORE_NOTE = "A restauração só acrescenta o que está faltando: nada é apagado nem substituído. Funis e campanhas que voltarem ficam pausados.";

export function BackupPanel() {
	const [files, setFiles] = useState<BackupFile[] | null>(null);
	const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
	const [busy, setBusy] = useState(false);

	const load = useCallback(async () => setFiles((await marketingRequest<{ backups: BackupFile[] }>("/api/marketing/backup")).backups), []);
	useEffect(() => {
		void load().catch((error: Error) => setMessage({ error: true, text: error.message }));
	}, [load]);

	async function run(action: () => Promise<string>) {
		setBusy(true);
		setMessage(null);
		try {
			setMessage({ error: false, text: await action() });
		} catch (error) {
			setMessage({ error: true, text: error instanceof Error ? error.message : "Falha." });
		} finally {
			setBusy(false);
		}
	}

	const restore = async (body: BodyInit, headers?: HeadersInit) => {
		const { restored } = await marketingRequest<{ restored: Record<string, number> }>("/api/marketing/backup/restore", { method: "POST", body, headers });
		const total = Object.values(restored).reduce((sum, value) => sum + value, 0);
		await load();
		return total ? `Restauração concluída: ${total} registros voltaram.` : "Nada faltava: os dados atuais já têm tudo o que está neste backup.";
	};

	const download = (name: string) => run(async () => {
		const response = await authFetch(`/api/marketing/backup/${name}`, { cache: "no-store" });
		if (!response.ok) throw new Error("Não foi possível baixar.");
		const link = document.createElement("a");
		link.href = URL.createObjectURL(await response.blob());
		link.download = name;
		link.click();
		setTimeout(() => URL.revokeObjectURL(link.href), 1000);
		return "Arquivo baixado. Ele contém dados dos seus contatos: guarde em lugar seguro.";
	});

	// The daily copy runs once a day, so a day and a half without one means something is wrong.
	const stale = files !== null && (!files[0] || Date.now() - files[0].createdAt > 36 * 60 * 60 * 1000);

	return (
		<div className="max-w-3xl space-y-6">
			{message && <p role="status" className={`rounded-xl px-4 py-3 text-sm ${message.error ? "bg-red-50 text-red-800" : "bg-green-50 text-green-800"}`}>{message.text}</p>}
			<section className="space-y-3 rounded-3xl bg-white p-6">
				<h2 className="text-base font-semibold">Backup do marketing</h2>
				<p className="text-sm text-neutral-500">Contatos, consentimentos, descadastros, modelos, funis, campanhas e histórico de envios. Uma cópia é feita todo dia (23h de Brasília) e ficam as últimas 30.</p>
				{stale && <p className="text-sm text-amber-700">Ainda não há cópia recente. Faça uma agora.</p>}
				<Button type="button" disabled={busy} onClick={() => void run(async () => {
					await marketingRequest("/api/marketing/backup", { method: "POST" });
					await load();
					return "Backup feito.";
				})}>{busy ? "Aguarde…" : "Fazer backup agora"}</Button>
				<ul className="divide-y divide-neutral-100">
					{files?.map((file) => (
						<li key={file.name} className="flex flex-wrap items-center justify-between gap-2 py-3">
							<span className="text-sm">{date(file.createdAt)} <span className="text-xs text-neutral-500">· {size(file.size)}</span></span>
							<span className="flex gap-2">
								<Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void download(file.name)}>Baixar</Button>
								<Button type="button" size="sm" variant="outline" disabled={busy} onClick={async () => {
									if (await confirmDialog(`Restaurar a cópia de ${date(file.createdAt)}? ${RESTORE_NOTE}`)) void run(() => restore(JSON.stringify({ name: file.name }), { "Content-Type": "application/json" }));
								}}>Restaurar</Button>
							</span>
						</li>
					))}
				</ul>
			</section>
			<section className="space-y-3 rounded-3xl bg-white p-6">
				<h2 className="text-base font-semibold">Restaurar de um arquivo</h2>
				<p className="text-sm text-neutral-500">{RESTORE_NOTE}</p>
				<input type="file" accept=".gz" aria-label="Arquivo de backup" className="text-sm" disabled={busy} onChange={async (event) => {
					const file = event.target.files?.[0];
					event.target.value = "";
					if (!file || !(await confirmDialog(`Restaurar o arquivo "${file.name}"? ${RESTORE_NOTE}`))) return;
					const form = new FormData();
					form.set("file", file);
					void run(() => restore(form));
				}} />
			</section>
		</div>
	);
}
