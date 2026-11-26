/** What a campaign request needs before it may be created: its input and the pre-send review. */
import type { CampaignInput, CampaignReview } from "./campaigns-types";
import { countAudience } from "./campaigns";
import { contentWarnings, extractLinks, linkWarnings } from "./campaign-checks";
import { normalizeTags } from "./contacts-utils";
import { checkBreaker, readSetting, warmupState } from "./engine";
import { renderMarketingEmail } from "./render";
import type { SenderSettings } from "./sending-types";
import { toTemplate } from "./server";
import { checkSender } from "./ses-marketing";

export function readCampaignInput(input: unknown): CampaignInput {
	const value = (input ?? {}) as Record<string, unknown>;
	const text = (key: string, max: number) => (typeof value[key] === "string" ? (value[key] as string).trim().slice(0, max) : "");
	const scheduledAt = Number(value.scheduledAt);
	return {
		name: text("name", 120),
		templateId: text("templateId", 80),
		listId: text("listId", 80),
		subject: text("subject", 300).replace(/[\r\n]+/g, " "),
		tag: normalizeTags(text("tag", 40))[0] ?? "",
		includeInactive: value.includeInactive === true,
		scheduledAt: Number.isFinite(scheduledAt) && scheduledAt > 0 ? scheduledAt : null,
	};
}

export async function reviewCampaign(env: CloudflareEnv, db: D1Database, input: CampaignInput) {
	const blockers: string[] = [];
	if (!input.name) blockers.push("Dê um nome à campanha.");
	const row = await db.prepare("SELECT id, name, subject, design, updated_at FROM marketing_templates WHERE id = ?").bind(input.templateId).first<Parameters<typeof toTemplate>[0]>();
	const template = row ? toTemplate(row) : null;
	if (!template) blockers.push("Escolha um modelo.");
	const list = await db.prepare("SELECT id FROM marketing_lists WHERE id = ?").bind(input.listId).first();
	if (!list) blockers.push("Escolha uma lista.");
	const subject = input.subject || template?.subject || "";
	if (template && !subject) blockers.push("Informe o assunto.");

	const sender = await readSetting<SenderSettings>(db, "sender");
	if (!sender) blockers.push("Configure o remetente na aba Envio.");
	else for (const check of await checkSender(env, db, sender)) if (!check.ok) blockers.push(`${check.label}: ${check.detail}`);
	const breaker = await checkBreaker(db);
	if (breaker) blockers.push(`Envio pausado: ${breaker}`);

	const audience = list ? await countAudience(db, input.listId, input.tag) : { total: 0, inactive: 0 };
	const recipients = audience.total - (input.includeInactive ? 0 : audience.inactive);
	if (list && recipients === 0) blockers.push("Ninguém nesta lista pode receber agora (confira consentimento, etiqueta e bloqueios).");

	const warnings: string[] = [];
	if (template) {
		const message = renderMarketingEmail(template.design, subject, { nome: "" }, "https://exemplo.invalid/descadastro");
		warnings.push(...contentWarnings(message.subject, message.html, message.text));
		warnings.push(...(await linkWarnings(extractLinks(message.html).filter((url) => !url.includes("exemplo.invalid")))));
	}
	const warmup = await warmupState(db);
	const today = Math.max(0, warmup.limit - warmup.sentLast24Hours);
	if (recipients > today) warnings.push(`Pelo aquecimento, até ${today} saem nas próximas 24 horas; o restante vai nos dias seguintes.`);

	const review: CampaignReview = { recipients, inactive: audience.inactive, blockers, warnings };
	return { review, template, subject };
}
