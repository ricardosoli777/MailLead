import { queryDns, type DnsQueryType } from "@/lib/dns-query";
import { KNOWN_DOMAINS } from "./contacts-utils";

type Query = (name: string, type: DnsQueryType) => Promise<string[]>;

/** Null when the domain receives mail; otherwise why a row with it is refused. */
export async function checkMailDomain(domain: string, query: Query = queryDns): Promise<string | null> {
	if (KNOWN_DOMAINS.has(domain)) return null;
	try {
		const mx = await query(domain, "MX");
		// RFC 7505: a single "0 ." record means the domain accepts no mail.
		if (mx.length) return mx.every((record) => /^\d+\s+\.$/.test(record.trim())) ? "o domínio não recebe e-mail" : null;
		return (await query(domain, "A")).length ? null : "o domínio não existe ou não recebe e-mail";
	} catch {
		return "não foi possível verificar o domínio, importe de novo mais tarde";
	}
}
