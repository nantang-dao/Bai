-- ============================================
-- 创建 community_post_likes 表（社区动态点赞表）
-- 存储社区动态的点赞记录
-- ============================================

CREATE TABLE IF NOT EXISTS community_post_likes (
    -- 主键
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 外键关联
    post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- 时间戳
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- 唯一约束：防止重复点赞
    UNIQUE(post_id, user_id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_likes_post_id ON community_post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_likes_user_id ON community_post_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_likes_created_at ON community_post_likes(created_at DESC);

-- 添加备注说明
COMMENT ON TABLE community_post_likes IS '社区动态点赞表，存储社区动态的点赞记录';
COMMENT ON COLUMN community_post_likes.post_id IS '动态ID（外键，关联community_posts表）';
COMMENT ON COLUMN community_post_likes.user_id IS '点赞用户ID（外键，关联users表）';
COMMENT ON COLUMN community_post_likes.created_at IS '点赞时间';