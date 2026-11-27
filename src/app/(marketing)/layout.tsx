"use client";

// MailLead Marketing: its own app, beside the inbox, calendar and drive, for the primary administrator.
import { AuthGuard } from "@/components/auth/auth-guard";
import { ComposeProvider } from "@/components/compose/compose-context";
import { LicenseIndicator } from "@/components/license-indicator";
import { MailSearchProvider } from "@/components/mail-search/mail-search-context";
import { MailboxProvider } from "@/components/mailbox-provider";
import { MailboxSelector } from "@/components/mailbox-selector";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import { ShortcutsProvider } from "@/components/shortcuts";
import { SidebarAside, MobileMenuButton } from "@/components/sidebar-aside";
import { SidebarResizeBoundary } from "@/components/sidebar-resize-boundary";
import { SidebarProvider, useSidebar } from "@/components/sidebar-state";
import { SkipToContent } from "@/components/skip-to-content";

function MarketingFrame({ children }: { children: React.ReactNode }) {
	const { mobile, toggle } = useSidebar();
	return (
		<div className="safe-area grid h-dvh grid-cols-[minmax(0,1fr)] overflow-hidden bg-[#f6f8fc] transition-[grid-template-columns] md:grid-cols-[var(--sidebar-width)_minmax(0,1fr)]" style={{ transitionDuration: "var(--sidebar-transition-duration)" }}>
			<SkipToContent />
			<SidebarAside>
				<div className="h-full">
					<MarketingNav onNavigate={mobile ? toggle : undefined} />
				</div>
				<SidebarResizeBoundary />
			</SidebarAside>
			<div className="flex min-h-0 min-w-0 flex-col">
				<header className="flex h-16 w-full shrink-0 items-center justify-end gap-3 pr-4 text-sm">
					<MobileMenuButton className="ml-2 mr-auto" />
					<LicenseIndicator />
					<MailboxSelector />
				</header>
				<main id="main-content" tabIndex={-1} className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain rounded-tl-3xl px-4 pb-10 pt-4 scrollbar-gutter-stable focus:outline-none lg:px-8">
					{children}
				</main>
			</div>
		</div>
	);
}

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
	return (
		<AuthGuard requireMailbox requireRole="admin" requirePrimary>
			<SidebarProvider expandedWidth={256} mobileOverlay>
				<MailboxProvider>
					<ComposeProvider>
						<MailSearchProvider>
							<ShortcutsProvider>
								<MarketingFrame>{children}</MarketingFrame>
							</ShortcutsProvider>
						</MailSearchProvider>
					</ComposeProvider>
				</MailboxProvider>
			</SidebarProvider>
		</AuthGuard>
	);
}
