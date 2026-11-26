CREATE TABLE marketing_forms (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	list_id TEXT NOT NULL,
	tags TEXT NOT NULL DEFAULT '[]',
	consent_text TEXT NOT NULL,
	double_opt_in INTEGER NOT NULL DEFAULT 1,
	-- Extra fields besides name and e-mail: [{key, label, required}].
	fields TEXT NOT NULL DEFAULT '[]',
	button TEXT NOT NULL DEFAULT 'Quero receber',
	created_at INTEGER NOT NULL
);
-- Waiting for the person to confirm. Only a hash of the emailed token is kept.
CREATE TABLE marketing_pending (
	token_hash TEXT PRIMARY KEY,
	form_id TEXT NOT NULL,
	email TEXT NOT NULL,
	name TEXT NOT NULL DEFAULT '',
	fields TEXT NOT NULL DEFAULT '{}',
	created_at INTEGER NOT NULL,
	confirmed_at INTEGER
);
CREATE INDEX marketing_pending_email ON marketing_pending (email, created_at);
CREATE INDEX marketing_pending_created ON marketing_pending (created_at);
CREATE TABLE marketing_api_keys (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	key_hash TEXT NOT NULL UNIQUE,
	created_at INTEGER NOT NULL,
	last_used_at INTEGER
);
CREATE TABLE marketing_hooks (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	list_id TEXT NOT NULL,
	tags TEXT NOT NULL DEFAULT '[]',
	consent_text TEXT NOT NULL,
	-- Kept readable: it is needed to check each signature.
	secret TEXT NOT NULL,
	created_at INTEGER NOT NULL
);
