import type { AppDatabase } from "@/db";

// Modified 2026-11-26 (AGPL-3.0 section 5a): shared mailboxes need no license in this fork.
export async function isTeamMailboxSharingEnabled(_db: AppDatabase): Promise<boolean> {
	return true;
}
