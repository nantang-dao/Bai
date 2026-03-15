-- 社区背景图（最多三张），存 URL 数组
ALTER TABLE communities
ADD COLUMN IF NOT EXISTS background_images JSONB NOT NULL DEFAULT '[]'::jsonb;
COMMENT ON COLUMN communities.background_images IS '背景图 URL 数组，最多 3 张';
