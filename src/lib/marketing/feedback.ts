/** Bounce, complaint and delivery events of marketing messages (U5). The caller verifies the SNS signature. */
import { emailHash, normalizeEmail } from "./contacts-utils";

type Recipient = { emailAddress?: unknown };
type SesEvent = {
	/** Configuration set events use `eventType`; identity notifications use `notificationType`. */
	eventType?: string;
	notificationType?: string;
	mail?: { messageId?: string };
	bounce?: { bounceType?: string; bouncedRecipients?: Recipient[] };
	complaint?: { complainedRecipients?: Recipient[] };
};

const COLUMN = { Bounce: "bounced_at", Complaint: "complained_at", Delivery: "delivered_at" } as const;

export async function recordSesEvent(db: D1Database, message: string, now = Date.now()): Promise<number> {
	let event: SesEvent;
	try { event = JSON.parse(message) as SesEvent; } catch { return 0; }
	const type = (event.eventType ?? event.notificationType) as keyof typeof COLUMN;
	const messageId = event.mail?.messageId;
	if (!messageId || !Object.hasOwn(COLUMN, type)) return 0;
	// Only permanent bounces count; a full mailbox may accept the next message.
	if (type === "Bounce" && event.bounce?.bounceType !== "Permanent") return 0;
	await db.prepare(`UPDATE marketing_sends SET ${COLUMN[type]} = COALESCE(${COLUMN[type]}, ?) WHERE message_id = ?`).bind(now, messageId).run();
	if (type === "Delivery") return 0;

	const recipients = (type === "Bounce" ? event.bounce?.bouncedRecipients : event.complaint?.complainedRecipients) ?? [];
	const reason = type === "Bounce" ? "bounce" : "complaint";
	let blocked = 0;
	for (const recipient of recipients.slice(0, 50)) {
		const email = typeof recipient.emailAddress === "string" ? normalizeEmail(recipient.emailAddress.replace(/^.*<|>.*$/g, "")) : "";
		if (!email.includes("@")) continue;
		await db.prepare("INSERT INTO marketing_suppressions (email_hash, reason, created_at) VALUES (?, ?, ?) ON CONFLICT (email_hash) DO UPDATE SET reason = excluded.reason WHERE marketing_suppressions.reason = 'unsubscribe'")
			.bind(await emailHash(email), reason, now).run();
		const contact = await db.prepare("SELECT id FROM marketing_contacts WHERE email = ?").bind(email).first<{ id: string }>();
		if (contact) await db.prepare("INSERT INTO marketing_events (id, contact_id, type, detail, created_at) VALUES (?, ?, ?, ?, ?)").bind(crypto.randomUUID(), contact.id, reason, "Amazon SES", now).run();
		blocked++;
	}
	return blocked;
}
