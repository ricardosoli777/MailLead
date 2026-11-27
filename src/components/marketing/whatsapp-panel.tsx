"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { AudioRecorder } from "./audio-recorder";
import { marketingRequest } from "./marketing-request";

type State = { url: string; saved: boolean; status: { connected: boolean; name: string } | null; problem: string };

export function WhatsAppPanel() {
	const [state, setState] = useState<State | null>(null);
	const [url, setUrl] = useState("");
	const [token, setToken] = useState("");
	const [phone, setPhone] = useState("");
	const [audio, setAudio] = useState<File | null>(null);
	const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
	const [busy, setBusy] = useState(false);

	const load = useCallback(async () => {
		const data = await marketingRequest<State>("/api/marketing/whatsapp");
		setState(data);
		setUrl(data.url);
	}, []);
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

	const test = (file: File | null) => run(async () => {
		const form = new FormData();
		form.set("phone", phone);
		if (file) form.set("audio", file);
		await marketingRequest("/api/marketing/whatsapp/test", { method: "POST", body: form });
		return file ? "Áudio enviado. Confira no WhatsApp se chegou como mensagem de voz." : "Mensagem enviada.";
	});

	const connected = !!state?.status?.connected;

	return (
		<div className="max-w-3xl space-y-6">
			{message && <p role="status" className={`rounded-xl px-4 py-3 text-sm ${message.error ? "bg-red-50 text-red-800" : "bg-green-50 text-green-800"}`}>{message.text}</p>}

			<form className="space-y-3 rounded-3xl bg-white p-6" onSubmit={(event) => {
				event.preventDefault();
				void run(async () => {
					await marketingRequest("/api/marketing/whatsapp", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url, token }) });
					setToken("");
					await load();
					return "Conexão salva.";
				});
			}}>
				<div className="flex flex-wrap items-center justify-between gap-2">
					<h2 className="text-base font-semibold">Conexão do WhatsApp</h2>
					{state?.saved && (
						<span className={`rounded-full px-2 py-1 text-xs font-medium ${connected ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
							{connected ? `Conectado${state.status!.name ? `: ${state.status!.name}` : ""}` : "Desconectado"}
						</span>
					)}
				</div>
				<p className="text-sm text-neutral-500">Use o seu Evolution Go com uma instância só do MailLead. Nada é alterado nas outras instâncias.</p>
				{state?.problem && <p className="text-sm text-red-700">{state.problem}</p>}
				<label className="block space-y-1">
					<span className="block text-xs font-medium text-neutral-600">Endereço do servidor</span>
					<Input type="url" required value={url} placeholder="https://go.seudominio.com.br" onChange={(event) => setUrl(event.target.value)} />
				</label>
				<label className="block space-y-1">
					<span className="block text-xs font-medium text-neutral-600">Token da instância</span>
					<Input type="password" autoComplete="off" value={token} placeholder={state?.saved ? "Já salvo. Preencha só para trocar." : "Cole aqui"} onChange={(event) => setToken(event.target.value)} />
					<span className="block text-xs text-neutral-500">O token da instância &quot;maillead&quot;, não a chave geral. Ele não aparece de novo depois de salvo.</span>
				</label>
				<div className="flex flex-wrap gap-2">
					<Button type="submit" disabled={busy}>Salvar</Button>
					{state?.saved && (
						<>
							<Button type="button" variant="outline" disabled={busy} onClick={() => void run(async () => {
								await load();
								return "Situação atualizada.";
							})}>Verificar de novo</Button>
							<Button type="button" variant="ghost" className="text-red-600" disabled={busy} onClick={async () => {
								if (!(await confirmDialog("Remover o endereço e o token do MailLead? O Evolution Go continua como está."))) return;
								void run(async () => {
									await marketingRequest("/api/marketing/whatsapp", { method: "DELETE" });
									await load();
									return "Conexão removida.";
								});
							}}>Remover</Button>
						</>
					)}
				</div>
			</form>

			<section className="space-y-3 rounded-3xl bg-white p-6">
				<h2 className="text-base font-semibold">Gravar e testar</h2>
				<p className="text-sm text-neutral-500">Grave um áudio curto, ouça e envie para o seu próprio número. O servidor transforma em mensagem de voz.</p>
				<AudioRecorder value={audio} onChange={setAudio} />
				<label className="block space-y-1">
					<span className="block text-xs font-medium text-neutral-600">Seu número, com DDD</span>
					<Input type="tel" value={phone} placeholder="11 99999-9999" onChange={(event) => setPhone(event.target.value)} />
				</label>
				<div className="flex flex-wrap gap-2">
					<Button type="button" disabled={busy || !state?.saved || !phone.trim() || !audio} onClick={() => void test(audio)}>Enviar áudio de teste</Button>
					<Button type="button" variant="outline" disabled={busy || !state?.saved || !phone.trim()} onClick={() => void test(null)}>Enviar texto de teste</Button>
				</div>
				{!state?.saved && <p className="text-xs text-neutral-500">Você já pode gravar e ouvir. O envio libera depois de salvar a conexão.</p>}
			</section>
		</div>
	);
}
