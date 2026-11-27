/**
 * One signature for every marketing message: who sends it and how to reach them. Once saved, it
 * replaces the footer of every template and of what has not finished going out.
 */
import { readSetting, writeSetting } from "./engine";
import { parseDesign } from "./render";
import type { Design } from "./types";

export type Footer = Design["footer"];

export const readFooter = (db: D1Database) => readSetting<Footer>(db, "footer");

/** The design as it is saved: with the owner's footer, when there is one. */
export async function withFooter(db: D1Database, design: Design): Promise<Design> {
	const footer = await readFooter(db);
	return footer ? { ...design, footer } : design;
}

export async function saveFooter(db: D1Database, input: unknown): Promise<{ error: string } | { footer: Footer; templates: number; sending: number }> {
	const parsed = parseDesign({ blocks: [], footer: input });
	if ("error" in parsed) return { error: "Escreva o rodapé." };
	const { footer } = parsed.design;
	await writeSetting(db, "footer", footer);
	const json = JSON.stringify(footer);
	const templates = await db.prepare("UPDATE marketing_templates SET design = json_set(design, '$.footer', json(?))").bind(json).run();
	// Funnels and campaigns hold their own copy. Finished ones stay as they were sent.
	const sending = await db.prepare("UPDATE marketing_campaigns SET design = json_set(design, '$.footer', json(?)) WHERE status IN ('scheduled', 'running', 'paused')").bind(json).run();
	return { footer, templates: templates.meta.changes ?? 0, sending: sending.meta.changes ?? 0 };
}
