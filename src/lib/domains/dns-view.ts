import { requireAwsConfig } from "@/lib/aws/config";
import { getSesIdentity } from "@/lib/aws/ses";
import { summariseDns, type DnsStatusSummary } from "@/lib/dns-status";
import { auditDomainDns, type DomainDnsAudit } from "@/lib/domains/dns-audit";
import { getDomainDns, type DomainDnsView } from "@/lib/domains/service";
import type { DomainRow } from "@/lib/domains/types";

export type DomainDnsViewWithAudit = DomainDnsView & { audit: DomainDnsAudit };

/** The public-DNS audit, with the DKIM CNAMEs SES expects when it is the sender. */
async function auditDomain(env: CloudflareEnv, domain: DomainRow, view: DomainDnsView) {
	let dkimCnames: { name: string; value: string }[] | undefined;
	if (domain.sendingProvider === "ses") {
		try {
			dkimCnames = (await getSesIdentity(await requireAwsConfig(env), domain.hostname)).records;
		} catch (error) {
			console.warn("auditDomain: failed to read the SES identity", error);
		}
	}
	return auditDomainDns(domain.hostname, { ...view, dkimCnames }, domain.sendingProvider);
}

/** The DNS page's view: zone records plus an independent public-DNS audit. */
export async function getDomainDnsView(
	env: CloudflareEnv,
	domain: DomainRow,
): Promise<DomainDnsViewWithAudit> {
	const dns = await getDomainDns(env, domain);
	const audit = await auditDomain(env, domain, dns);
	return { ...dns, audit };
}

/** The compact per-domain status the list endpoint returns. */
export async function summariseDomainDns(
	env: CloudflareEnv,
	domain: DomainRow,
): Promise<{ summary: DnsStatusSummary; sendingEnabled: boolean }> {
	const view = await getDomainDns(env, domain);
	const audit = await auditDomain(env, domain, view);
	return {
		summary: summariseDns(
			view.routing.records,
			view.routing.missing,
			view.sending,
			domain.routingEnabled,
			view.sendingEnabled,
			audit,
		),
		sendingEnabled: view.sendingEnabled,
	};
}
