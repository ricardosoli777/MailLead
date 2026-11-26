"use client";

import { useState } from "react";
import { CampaignManager } from "@/components/marketing/campaign-manager";
import { ContactManager } from "@/components/marketing/contact-manager";
import { SendingPanel } from "@/components/marketing/sending-panel";
import { TemplateManager } from "@/components/marketing/template-manager";
import { Button } from "@/components/ui/button";

const TABS = [{ key: "templates", label: "Modelos" }, { key: "contacts", label: "Contatos" }, { key: "campaigns", label: "Campanhas" }, { key: "sending", label: "Envio" }] as const;

export default function MarketingPage() {
	const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("templates");
	return (
		<div className="space-y-6">
			<div className="flex gap-2">
				{TABS.map((item) => (
					<Button key={item.key} type="button" size="sm" variant={tab === item.key ? "default" : "outline"} aria-pressed={tab === item.key} onClick={() => setTab(item.key)}>{item.label}</Button>
				))}
			</div>
			{tab === "templates" ? <TemplateManager /> : tab === "contacts" ? <ContactManager /> : tab === "campaigns" ? <CampaignManager /> : <SendingPanel />}
		</div>
	);
}
