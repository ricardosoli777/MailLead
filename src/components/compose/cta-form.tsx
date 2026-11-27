"use client";

// Asks for the words, the address and the colour of a call-to-action button.
import { useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { CTA_COLOR, ctaStyle } from "@/lib/email/cta";

const INPUT = "h-8 w-full rounded-md border border-neutral-200 px-2 text-sm outline-none focus:border-blue-400";

export function CtaForm({ onInsert, onClose }: { onInsert: (anchor: HTMLAnchorElement) => void; onClose: () => void }) {
	const { t } = useLanguage();
	const [text, setText] = useState("");
	const [url, setUrl] = useState("");
	const [color, setColor] = useState(CTA_COLOR);

	function insert() {
		const typed = url.trim();
		if (!typed || !text.trim()) return;
		// The fields are untrusted text: build the anchor with DOM APIs so it is never parsed as HTML.
		const anchor = document.createElement("a");
		anchor.setAttribute("href", /^(https?:|mailto:)/i.test(typed) ? typed : `https://${typed}`);
		anchor.setAttribute("style", ctaStyle(color));
		anchor.textContent = text.trim();
		onInsert(anchor);
	}

	return (
		<div
			className="absolute bottom-full left-2 z-10 mb-1 w-72 space-y-2 rounded-lg border border-neutral-200 bg-white p-2 shadow-lg"
			onKeyDown={(event) => {
				// This sits inside the message form: Enter must not send the e-mail.
				if (event.key === "Enter") {
					event.preventDefault();
					insert();
				}
				if (event.key === "Escape") {
					event.stopPropagation();
					onClose();
				}
			}}
		>
			<input autoFocus value={text} onChange={(event) => setText(event.target.value)} placeholder={t("editor.buttonText")} aria-label={t("editor.buttonText")} className={INPUT} />
			<input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com" aria-label={t("editor.insertLink")} className={INPUT} />
			<div className="flex items-center justify-between gap-2">
				<input type="color" value={color} onChange={(event) => setColor(event.target.value)} aria-label={t("editor.buttonColor")} className="h-8 w-10 cursor-pointer rounded-md border border-neutral-200" />
				<button type="button" onClick={insert} className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700">{t("editor.apply")}</button>
			</div>
		</div>
	);
}
