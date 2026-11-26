CREATE TABLE marketing_campaigns (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	list_id TEXT NOT NULL,
	subject TEXT NOT NULL,
	-- Snapshot: editing the template later must not change a running campaign.
	design TEXT NOT NULL,
	status TEXT NOT NULL DEFAULT 'running',
	created_at INTEGER NOT NULL
);
CREATE TABLE marketing_sends (
	id TEXT PRIMARY KEY,
	campaign_id TEXT NOT NULL,
	contact_id TEXT NOT NULL,
	provider TEXT NOT NULL,
	status TEXT NOT NULL DEFAULT 'pending',
	message_id TEXT,
	error TEXT NOT NULL DEFAULT '',
	claimed_at INTEGER,
	sent_at INTEGER,
	delivered_at INTEGER,
	bounced_at INTEGER,
	complained_at INTEGER
);
-- One message per person per campaign (K2).
CREATE UNIQUE INDEX marketing_sends_once ON marketing_sends (campaign_id, contact_id);
CREATE INDEX marketing_sends_queue ON marketing_sends (status, campaign_id);
CREATE INDEX marketing_sends_sent ON marketing_sends (sent_at);
CREATE INDEX marketing_sends_message ON marketing_sends (message_id);
