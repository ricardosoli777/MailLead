"use client";

// Speech to text with what the browser already has (Chrome, Edge, Safari).
import { useEffect, useRef, useState } from "react";

type Recognition = {
	lang: string;
	continuous: boolean;
	interimResults: boolean;
	onresult: ((event: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
	onerror: ((event: { error: string }) => void) | null;
	onend: (() => void) | null;
	start(): void;
	stop(): void;
	abort(): void;
};

const engine = () => {
	const scope = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
	return scope.SpeechRecognition ?? scope.webkitSpeechRecognition;
};

export function useDictation(onWords: (words: string) => void, onError: (message: string) => void) {
	const [supported, setSupported] = useState(false);
	const [listening, setListening] = useState(false);
	const current = useRef<Recognition | null>(null);

	useEffect(() => {
		setSupported(!!engine());
		return () => current.current?.abort();
	}, []);

	const stop = () => current.current?.stop();

	function toggle() {
		if (listening) return stop();
		const Engine = engine();
		if (!Engine) return;
		const recognition = new Engine();
		recognition.lang = "pt-BR";
		recognition.continuous = true;
		recognition.interimResults = false;
		recognition.onresult = (event) => {
			for (let index = event.resultIndex; index < event.results.length; index++) onWords(event.results[index][0].transcript.trim());
		};
		recognition.onerror = (event) => {
			if (event.error === "not-allowed" || event.error === "service-not-allowed") onError("Libere o microfone no navegador (ícone ao lado do endereço).");
			else if (event.error !== "no-speech" && event.error !== "aborted") onError("O reconhecimento de voz falhou. Tente de novo ou digite.");
		};
		recognition.onend = () => setListening(false);
		current.current = recognition;
		onError("");
		recognition.start();
		setListening(true);
	}

	return { supported, listening, toggle, stop };
}
