-- Marketing lives in its own D1 database (MARKETING_DB) so upstream migration numbers never collide.
CREATE TABLE marketing_templates (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	subject TEXT NOT NULL DEFAULT '',
	design TEXT NOT NULL,
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL
);
CREATE TABLE marketing_assets (
	id TEXT PRIMARY KEY,
	content_type TEXT NOT NULL,
	size INTEGER NOT NULL,
	created_at INTEGER NOT NULL
);
