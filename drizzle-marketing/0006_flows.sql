-- A funnel e-mail step is a hidden campaign, so it goes out with every protection campaigns have.
ALTER TABLE marketing_campaigns ADD COLUMN kind TEXT NOT NULL DEFAULT 'campaign';
-- When the tag was given: "received a tag" must not fire for old ones.
ALTER TABLE marketing_contact_tags ADD COLUMN created_at INTEGER NOT NULL DEFAULT 0;
CREATE TABLE marketing_flows (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	list_id TEXT NOT NULL,
	-- Empty: starts when someone joins the list. Otherwise: when a member of the list gets this tag.
	trigger_tag TEXT NOT NULL DEFAULT '',
	-- The goal: whoever gets this tag (a purchase, say) stops right there.
	goal_tag TEXT NOT NULL DEFAULT '',
	steps TEXT NOT NULL DEFAULT '[]',
	status TEXT NOT NULL DEFAULT 'draft',
	activated_at INTEGER,
	created_at INTEGER NOT NULL
);
-- One passage per person per funnel.
CREATE TABLE marketing_flow_runs (
	flow_id TEXT NOT NULL,
	contact_id TEXT NOT NULL,
	step_id TEXT,
	status TEXT NOT NULL DEFAULT 'active',
	wake_at INTEGER,
	last_send_id TEXT,
	next_check_at INTEGER NOT NULL,
	created_at INTEGER NOT NULL,
	PRIMARY KEY (flow_id, contact_id)
);
CREATE INDEX marketing_flow_runs_due ON marketing_flow_runs (status, next_check_at);
CREATE INDEX marketing_flow_runs_contact ON marketing_flow_runs (contact_id);
