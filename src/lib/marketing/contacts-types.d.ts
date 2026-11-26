export type ContactStatus = "subscribed" | "no_consent" | "unsubscribed" | "blocked";

export type ContactSummary = {
	id: string;
	email: string;
	name: string;
	status: ContactStatus;
	tags: string[];
	lists: { id: string; name: string; unsubscribed: boolean }[];
	createdAt: number;
};

export type ContactDetail = ContactSummary & {
	fields: Record<string, string>;
	consents: { source: string; text: string; consentedAt: number; recordedAt: number }[];
	events: { type: string; detail: string; createdAt: number }[];
};

export type MailingList = { id: string; name: string; members: number };

export type Consent = { source: string; text: string; consentedAt: number };

export type ImportRow = { line: number; email: string; name: string; fields: Record<string, string> };

export type Rejection = { line: number; email: string; reason: string };

export type ImportReport = { added: number; updated: number; rejected: Rejection[] };
