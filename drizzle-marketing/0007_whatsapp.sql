-- WhatsApp has its own permission, given on a form besides the e-mail one. Empty text: the form does not ask.
ALTER TABLE marketing_forms ADD COLUMN whatsapp_text TEXT NOT NULL DEFAULT '';
-- The number a person authorised, waiting for the e-mail confirmation.
ALTER TABLE marketing_pending ADD COLUMN phone TEXT NOT NULL DEFAULT '';
CREATE TABLE marketing_whatsapp (
	contact_id TEXT PRIMARY KEY,
	phone TEXT NOT NULL,
	source TEXT NOT NULL,
	text TEXT NOT NULL,
	consented_at INTEGER NOT NULL,
	opted_out_at INTEGER
);
-- One row per person per funnel audio step, so an audio is never sent twice.
CREATE TABLE marketing_whatsapp_sends (
	flow_id TEXT NOT NULL,
	step_id TEXT NOT NULL,
	contact_id TEXT NOT NULL,
	status TEXT NOT NULL,
	error TEXT NOT NULL DEFAULT '',
	claimed_at INTEGER NOT NULL,
	sent_at INTEGER,
	PRIMARY KEY (flow_id, step_id, contact_id)
);
CREATE INDEX marketing_whatsapp_sends_claimed ON marketing_whatsapp_sends (claimed_at);
CREATE TABLE marketing_audio (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	content_type TEXT NOT NULL,
	size INTEGER NOT NULL,
	created_at INTEGER NOT NULL
);
