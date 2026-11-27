"use client";

// A small formatted-text field for the footer: style, alignment, size, colour, lists, links and variables.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { safeUrl } from "@/lib/marketing/render";
import { cleanRich } from "@/lib/marketing/rich-footer";
import { VariablePicker } from "./variable-picker";

const bars = (widths: [number, number][]) => (
	<svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
		{widths.map(([from, to], index) => <path key={index} d={`M${from} ${4 + index * 4}H${to}`} />)}
	</svg>
);

const BUTTONS: { command: string; label: string; face: ReactNode }[] = [
	{ command: "bold", label: "Negrito", face: <b>B</b> },
	{ command: "italic", label: "Itálico", face: <i>I</i> },
	{ command: "underline", label: "Sublinhado", face: <u>S</u> },
	{ command: "strikeThrough", label: "Riscado", face: <s>R</s> },
	{ command: "justifyLeft", label: "Alinhar à esquerda", face: bars([[2, 14], [2, 10], [2, 12]]) },
	{ command: "justifyCenter", label: "Centralizar", face: bars([[2, 14], [4, 12], [3, 13]]) },
	{ command: "justifyRight", label: "Alinhar à direita", face: bars([[2, 14], [6, 14], [4, 14]]) },
	{ command: "insertUnorderedList", label: "Lista", face: <span className="text-xl leading-none">☰</span> },
	{ command: "removeFormat", label: "Limpar formatação", face: "⌫" },
];

const clean = (html: string) => cleanRich(html, (href) => safeUrl(href)).html;
const SELECT = "h-8 rounded-md border border-neutral-200 bg-white px-2 text-xs text-neutral-600";

export function FooterEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
	const box = useRef<HTMLDivElement>(null);
	const emitted = useRef<string | null>(null);
	const range = useRef<Range | null>(null);
	const [link, setLink] = useState<string | null>(null);

	// Only a value that did not come from typing is written into the field, so the cursor stays put.
	useEffect(() => {
		if (box.current && value !== emitted.current) box.current.innerHTML = clean(value);
	}, [value]);

	const emit = () => {
		emitted.current = box.current?.innerHTML ?? "";
		onChange(emitted.current);
	};
	const remember = () => {
		const selection = window.getSelection();
		if (selection?.rangeCount && box.current?.contains(selection.anchorNode)) range.current = selection.getRangeAt(0).cloneRange();
	};
	const run = (command: string, argument?: string) => {
		box.current?.focus();
		const selection = window.getSelection();
		if (range.current && selection) {
			selection.removeAllRanges();
			selection.addRange(range.current);
		}
		document.execCommand("styleWithCSS", false, "true");
		document.execCommand(command, false, argument);
		remember();
		emit();
	};

	function applyLink() {
		const typed = (link ?? "").trim();
		setLink(null);
		if (!typed) return;
		const href = /^(https?:|mailto:)/i.test(typed) ? typed : `https://${typed}`;
		if (!safeUrl(href)) return;
		if (range.current && !range.current.collapsed) return run("createLink", href);
		const anchor = document.createElement("a");
		anchor.href = href;
		anchor.textContent = typed;
		run("insertHTML", anchor.outerHTML);
	}

	return (
		<div className="rounded-xl border border-neutral-200">
			<div className="flex flex-wrap items-center gap-1 border-b border-neutral-200 p-2" role="toolbar" aria-label="Formatação do rodapé">
				{BUTTONS.map((item) => (
					<button key={item.command} type="button" title={item.label} aria-label={item.label} className="grid h-8 w-8 place-items-center rounded-md text-sm text-neutral-700 hover:bg-neutral-100" onMouseDown={(event) => event.preventDefault()} onClick={() => run(item.command)}>{item.face}</button>
				))}
				<button type="button" className="h-8 rounded-md px-2 text-xs text-neutral-700 hover:bg-neutral-100" onMouseDown={(event) => event.preventDefault()} onClick={() => setLink("")}>Link</button>
				<select className={SELECT} aria-label="Tamanho da letra" value="" onChange={(event) => event.target.value && run("fontSize", event.target.value)}>
					<option value="">Tamanho</option>
					<option value="1">Pequena</option>
					<option value="2">Normal</option>
					<option value="4">Grande</option>
				</select>
				<input type="color" aria-label="Cor da letra" className="h-8 w-8 cursor-pointer rounded-md border border-neutral-200" defaultValue="#5f6368" onChange={(event) => run("foreColor", event.target.value)} />
				<VariablePicker label="rodapé" onPick={(code) => run("insertText", code)} />
			</div>
			{link !== null && (
				<div className="flex gap-2 border-b border-neutral-200 p-2">
					<Input value={link} autoFocus placeholder="https://seu-site.com" aria-label="Endereço do link" onChange={(event) => setLink(event.target.value)} onKeyDown={(event) => {
						if (event.key !== "Enter") return;
						event.preventDefault();
						applyLink();
					}} />
					<Button type="button" size="sm" onClick={applyLink}>Colocar link</Button>
				</div>
			)}
			<div
				ref={box}
				contentEditable
				suppressContentEditableWarning
				role="textbox"
				aria-multiline
				aria-label="Rodapé do e-mail"
				className="min-h-32 p-3 text-center text-sm text-neutral-700 outline-none [&_ul]:list-inside [&_ul]:list-disc"
				onInput={emit}
				onKeyUp={remember}
				onMouseUp={remember}
				onBlur={remember}
				onPaste={(event) => {
					event.preventDefault();
					document.execCommand("insertText", false, event.clipboardData.getData("text/plain"));
				}}
			/>
		</div>
	);
}
