"use client";

import { Bot, DatabaseBackup, FileText, HelpCircle, Inbox, Smartphone, Plus, Route, Send, Users, Webhook } from "@/components/icons";
import { NavItem } from "@/components/components-nav";
import { SidebarFooter } from "@/components/sidebar-footer";
import { SidebarHeader } from "@/components/sidebar-header";
import { SidebarScaffold } from "@/components/sidebar-scaffold";
import { useSidebar } from "@/components/sidebar-state";
import { MARKETING_SECTIONS, type MarketingSection } from "./marketing-sections";

const ICONS: Record<MarketingSection, typeof Send> = { funis: Route, campanhas: Send, modelos: FileText, contatos: Users, captura: Inbox, envio: Send, whatsapp: Smartphone, ia: Bot, backup: DatabaseBackup, ajuda: HelpCircle };

export function MarketingNav({ onNavigate }: { onNavigate?: () => void }) {
	const { minimal } = useSidebar();
	const link = (id: MarketingSection) => {
		const section = MARKETING_SECTIONS.find((item) => item.id === id)!;
		return <NavItem key={id} link={{ href: `/marketing/${id}`, label: section.label, icon: id === "envio" ? Webhook : ICONS[id] }} />;
	};
	const groups: [string, MarketingSection[]][] = [
		["Criar", ["funis", "campanhas", "modelos"]],
		["Público", ["contatos", "captura"]],
		["Configurações", ["envio", "whatsapp", "ia", "backup"]],
	];
	return (
		<SidebarScaffold header={<SidebarHeader href="/inbox" label="Marketing" />} footer={<SidebarFooter />}>
			<div className="space-y-4" onClick={onNavigate}>
				<NavItem link={{ href: "/marketing/funis", label: "Criar funil", icon: Plus, primary: true }} />
				{groups.map(([label, ids]) => (
					<section key={label}>
						{minimal ? <hr className="mx-6 mb-3 border-neutral-200/70" /> : <h2 className="px-6 pb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</h2>}
						<div className="space-y-px">{ids.map(link)}</div>
					</section>
				))}
				<div>{link("ajuda")}</div>
			</div>
		</SidebarScaffold>
	);
}
