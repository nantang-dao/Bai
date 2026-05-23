-- ============================================
-- 为 community_post_comments 增加「回复某人」字段（平面、朋友圈式）
-- 评论仍为平面列表，可选标记“回复谁”，展示为「A 回复 B: 内容」
-- ============================================

ALTER TABLE community_post_comments
ADD COLUMN IF NOT EXISTS reply_to_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_comments_reply_to_user
ON community_post_comments(reply_to_user_id) WHERE reply_to_user_id IS NOT NULL;

COMMENT ON COLUMN community_post_comments.reply_to_user_id IS '被回复用户ID（可选，用于展示「回复 某人」）';
