"use client";

import { useState } from "react";
import { CampaignManager } from "@/components/marketing/campaign-manager";
import { CaptureManager } from "@/components/marketing/capture-manager";
import { ContactManager } from "@/components/marketing/contact-manager";
import { SendingPanel } from "@/components/marketing/sending-panel";
import { TemplateManager } from "@/components/marketing/template-manager";
import { Button } from "@/components/ui/button";

const TABS = [{ key: "templates", label: "Modelos" }, { key: "contacts", label: "Contatos" }, { key: "capture", label: "Captura" }, { key: "campaigns", label: "Campanhas" }, { key: "sending", label: "Envio" }] as const;

export default function MarketingPage() {
	const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("templates");
	const [formId, setFormId] = useState("");
	const editForm = (id: string) => {
		setFormId(id);
		setTab("capture");
	};
	return (
		<div className="space-y-6">
			<div className="flex gap-2">
				{TABS.map((item) => (
					<Button key={item.key} type="button" size="sm" variant={tab === item.key ? "default" : "outline"} aria-pressed={tab === item.key} onClick={() => {
						setFormId("");
						setTab(item.key);
					}}>{item.label}</Button>
				))}
			</div>
			{tab === "templates" ? <TemplateManager /> : tab === "contacts" ? <ContactManager onFormCreated={editForm} /> : tab === "capture" ? <CaptureManager editId={formId} onEdit={setFormId} /> : tab === "campaigns" ? <CampaignManager /> : <SendingPanel />}
		</div>
	);
}
