"use client";

// Records from the microphone, or takes a file, so the sender can listen before using it.
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Pause, Play, Trash2, Upload } from "@/components/icons";
import { MAX_AUDIO_BYTES } from "@/lib/marketing/whatsapp";

const MAX_SECONDS = 120;
// OGG where the browser records it; the others are converted by the WhatsApp server on sending.
const TYPES = [["audio/ogg;codecs=opus", "ogg"], ["audio/webm;codecs=opus", "webm"], ["audio/mp4", "m4a"]] as const;
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

export function AudioRecorder({ value, onChange }: { value: File | null; onChange: (file: File | null) => void }) {
	const [recording, setRecording] = useState(false);
	const [seconds, setSeconds] = useState(0);
	const [preview, setPreview] = useState("");
	const [error, setError] = useState("");
	const recorder = useRef<MediaRecorder | null>(null);
	const picker = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (!value) return setPreview("");
		const url = URL.createObjectURL(value);
		setPreview(url);
		return () => URL.revokeObjectURL(url);
	}, [value]);
	useEffect(() => {
		if (!recording) return;
		const timer = setInterval(() => setSeconds((current) => current + 1), 1000);
		return () => clearInterval(timer);
	}, [recording]);
	useEffect(() => {
		if (recording && seconds >= MAX_SECONDS) recorder.current?.stop();
	}, [recording, seconds]);
	// Leaving the screen releases the microphone.
	useEffect(() => () => recorder.current?.stream.getTracks().forEach((track) => track.stop()), []);

	async function start() {
		setError("");
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			const [mimeType, extension] = TYPES.find(([type]) => MediaRecorder.isTypeSupported(type)) ?? ["", "webm"];
			const next = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
			const chunks: Blob[] = [];
			next.ondataavailable = (event) => chunks.push(event.data);
			next.onstop = () => {
				stream.getTracks().forEach((track) => track.stop());
				setRecording(false);
				const type = next.mimeType.split(";")[0] || "audio/webm";
				onChange(new File(chunks, `gravacao.${extension}`, { type }));
			};
			recorder.current = next;
			onChange(null);
			setSeconds(0);
			next.start();
			setRecording(true);
		} catch {
			setError("Não consegui usar o microfone. Libere a permissão no navegador (ícone ao lado do endereço) ou envie um arquivo.");
		}
	}

	return (
		<div className="space-y-3 rounded-2xl border border-neutral-200 p-4">
			<div className="flex flex-wrap items-center gap-3">
				{recording ? (
					<>
						<Button type="button" size="sm" variant="destructive" onClick={() => recorder.current?.stop()}><Pause className="h-4 w-4" />Parar</Button>
						<span className="flex items-center gap-2 text-sm tabular-nums text-red-700" role="timer">
							<span className="h-2 w-2 animate-pulse rounded-full bg-red-600" />Gravando {clock(seconds)} de {clock(MAX_SECONDS)}
						</span>
					</>
				) : (
					<>
						<Button type="button" size="sm" onClick={() => void start()}><Play className="h-4 w-4" />{value ? "Regravar" : "Gravar"}</Button>
						<Button type="button" size="sm" variant="outline" onClick={() => picker.current?.click()}><Upload className="h-4 w-4" />Enviar arquivo</Button>
						<input ref={picker} type="file" accept="audio/*,.ogg,.opus,.mp3,.m4a,.wav" aria-label="Arquivo de áudio" className="hidden" onChange={(event) => {
							const file = event.target.files?.[0];
							event.target.value = "";
							if (!file) return;
							if (file.size > MAX_AUDIO_BYTES) return setError("O áudio pode ter no máximo 5 MB.");
							setError("");
							onChange(file);
						}} />
					</>
				)}
			</div>
			{error && <p role="alert" className="text-xs text-red-700">{error}</p>}
			{preview && !recording && (
				<div className="flex flex-wrap items-center gap-2">
					<audio controls src={preview} className="h-10 max-w-full flex-1" />
					<a href={preview} download={value!.name} className="text-xs text-blue-700 underline">Baixar</a>
					<Button type="button" size="sm" variant="ghost" aria-label="Descartar áudio" onClick={() => onChange(null)}><Trash2 className="h-4 w-4" /></Button>
				</div>
			)}
		</div>
	);
}
