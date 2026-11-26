ALTER TABLE marketing_campaigns ADD COLUMN scheduled_at INTEGER;
ALTER TABLE marketing_campaigns ADD COLUMN started_at INTEGER;
-- Segment: only the people of the list that also carry this tag.
ALTER TABLE marketing_campaigns ADD COLUMN tag TEXT NOT NULL DEFAULT '';
ALTER TABLE marketing_campaigns ADD COLUMN include_inactive INTEGER NOT NULL DEFAULT 0;
ALTER TABLE marketing_sends ADD COLUMN opened_at INTEGER;
ALTER TABLE marketing_sends ADD COLUMN clicked_at INTEGER;
ALTER TABLE marketing_sends ADD COLUMN unsubscribed_at INTEGER;
CREATE INDEX marketing_sends_contact ON marketing_sends (contact_id, sent_at);
