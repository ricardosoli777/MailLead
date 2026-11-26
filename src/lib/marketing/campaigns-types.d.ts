export type CampaignStatus = "scheduled" | "running" | "paused" | "done" | "cancelled";

export type CampaignInput = {
	name: string;
	templateId: string;
	listId: string;
	subject: string;
	tag: string;
	includeInactive: boolean;
	scheduledAt: number | null;
};

export type CampaignReport = {
	id: string;
	name: string;
	subject: string;
	status: CampaignStatus;
	listName: string | null;
	tag: string;
	createdAt: number;
	scheduledAt: number | null;
	total: number;
	pending: number;
	sent: number;
	delivered: number;
	bounced: number;
	complained: number;
	unsubscribed: number;
	opened: number;
	clicked: number;
	skipped: number;
	failed: number;
};

export type CampaignReview = { recipients: number; inactive: number; blockers: string[]; warnings: string[] };
