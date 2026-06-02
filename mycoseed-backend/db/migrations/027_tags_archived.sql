ALTER TABLE community_marketplace_tags ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE community_calendar_tags ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false;
