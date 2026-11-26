CREATE TABLE marketing_contacts (
	id TEXT PRIMARY KEY,
	email TEXT NOT NULL UNIQUE,
	email_hash TEXT NOT NULL,
	name TEXT NOT NULL DEFAULT '',
	fields TEXT NOT NULL DEFAULT '{}',
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL
);
CREATE INDEX marketing_contacts_hash ON marketing_contacts (email_hash);
CREATE TABLE marketing_lists (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL UNIQUE,
	created_at INTEGER NOT NULL
);
CREATE TABLE marketing_list_members (
	list_id TEXT NOT NULL,
	contact_id TEXT NOT NULL,
	unsubscribed_at INTEGER,
	created_at INTEGER NOT NULL,
	PRIMARY KEY (list_id, contact_id)
);
CREATE INDEX marketing_list_members_contact ON marketing_list_members (contact_id);
CREATE TABLE marketing_contact_tags (
	contact_id TEXT NOT NULL,
	tag TEXT NOT NULL,
	PRIMARY KEY (contact_id, tag)
);
CREATE INDEX marketing_contact_tags_tag ON marketing_contact_tags (tag);
-- Append only: one row per consent that was ever recorded.
CREATE TABLE marketing_consents (
	id TEXT PRIMARY KEY,
	contact_id TEXT NOT NULL,
	source TEXT NOT NULL,
	text TEXT NOT NULL,
	consented_at INTEGER NOT NULL,
	recorded_at INTEGER NOT NULL
);
CREATE INDEX marketing_consents_contact ON marketing_consents (contact_id);
CREATE TABLE marketing_events (
	id TEXT PRIMARY KEY,
	contact_id TEXT NOT NULL,
	type TEXT NOT NULL,
	detail TEXT NOT NULL DEFAULT '',
	created_at INTEGER NOT NULL
);
CREATE INDEX marketing_events_contact ON marketing_events (contact_id, created_at);
-- Keyed by a hash of the address so a block survives the deletion of the person's data.
CREATE TABLE marketing_suppressions (
	email_hash TEXT PRIMARY KEY,
	reason TEXT NOT NULL,
	created_at INTEGER NOT NULL
);
CREATE TABLE marketing_settings (
	key TEXT PRIMARY KEY,
	value TEXT NOT NULL
);
