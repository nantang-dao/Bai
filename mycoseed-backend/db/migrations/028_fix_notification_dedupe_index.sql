DROP INDEX IF EXISTS uniq_notifications_user_dedupe_key;
CREATE UNIQUE INDEX uniq_notifications_user_dedupe_key ON notifications(user_id, dedupe_key);
