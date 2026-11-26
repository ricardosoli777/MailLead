/**
 * Outside `src/lib/marketing/` on purpose: that module never opens the mailbox database. This answers
 * one yes/no question, so a marketing sender cannot be a domain of day-to-day mail (R1).
 */
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { domains } from "@/db/schema";

export async function isMailDomain(env: CloudflareEnv, domain: string): Promise<boolean> {
	const [row] = await getDb(env).select({ id: domains.id }).from(domains).where(eq(domains.hostname, domain)).limit(1);
	return !!row;
}
