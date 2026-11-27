"use client";

import { Suspense, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { AiSettingsPanel } from "@/components/marketing/ai-settings-panel";
import { BackupPanel } from "@/components/marketing/backup-panel";
import { CampaignManager } from "@/components/marketing/campaign-manager";
import { CaptureManager } from "@/components/marketing/capture-manager";
import { ContactManager } from "@/components/marketing/contact-manager";
import { FlowManager } from "@/components/marketing/flow-manager";
import { HelpPanel } from "@/components/marketing/help-panel";
import { MARKETING_SECTIONS, type MarketingSection } from "@/components/marketing/marketing-sections";
import { SendingPanel } from "@/components/marketing/sending-panel";
import { TemplateManager } from "@/components/marketing/template-manager";
import { WhatsAppPanel } from "@/components/marketing/whatsapp-panel";

function Section({ id }: { id: MarketingSection }) {
	const router = useRouter();
	// The form being edited is part of the address, so it survives a reload.
	const formId = useSearchParams().get("form") ?? "";
	const editForm = (form: string) => router.push(form ? `/marketing/captura?form=${encodeURIComponent(form)}` : "/marketing/captura");
	switch (id) {
		case "funis": return <FlowManager />;
		case "campanhas": return <CampaignManager />;
		case "modelos": return <TemplateManager />;
		case "contatos": return <ContactManager onFormCreated={editForm} />;
		case "captura": return <CaptureManager editId={formId} onEdit={editForm} />;
		case "envio": return <SendingPanel />;
		case "whatsapp": return <WhatsAppPanel />;
		case "ia": return <AiSettingsPanel />;
		case "backup": return <BackupPanel />;
		case "ajuda": return <HelpPanel />;
	}
}

export default function MarketingSectionPage() {
	const router = useRouter();
	const { section } = useParams<{ section: string }>();
	const current = MARKETING_SECTIONS.find((item) => item.id === section);
	useEffect(() => {
		if (!current) router.replace("/marketing/funis");
		else document.title = `${current.label} · Marketing`;
	}, [current, router]);
	if (!current) return null;
	return (
		<div className="mx-auto w-full max-w-5xl space-y-6">
			<h1 className="text-2xl font-semibold text-neutral-800">{current.label}</h1>
			<Suspense fallback={null}>
				<Section key={current.id} id={current.id} />
			</Suspense>
		</div>
	);
}
