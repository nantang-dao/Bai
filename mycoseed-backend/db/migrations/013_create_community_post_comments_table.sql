-- ============================================
-- 创建 community_post_comments 表（社区动态评论表）
-- 存储社区动态的评论，不支持嵌套回复（类似微信朋友圈）
-- ============================================

CREATE TABLE IF NOT EXISTS community_post_comments (
    -- 主键
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 外键关联
    post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE, -- 动态ID
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- 评论者ID

    -- 评论内容
    content TEXT NOT NULL CHECK (LENGTH(content) <= 500), -- 评论内容（最多500字）

    -- 时间戳
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON community_post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_author_id ON community_post_comments(author_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON community_post_comments(created_at ASC);  -- 按时间正序显示

-- 添加备注说明
COMMENT ON TABLE community_post_comments IS '社区动态评论表，存储社区动态的评论（不支持嵌套回复，类似微信朋友圈）';
COMMENT ON COLUMN community_post_comments.post_id IS '动态ID（外键，关联community_posts表）';
COMMENT ON COLUMN community_post_comments.author_id IS '评论者ID（外键，关联users表）';
COMMENT ON COLUMN community_post_comments.content IS '评论内容（最多500字，不支持嵌套回复）';

-- 触发器：自动更新 updated_at
DROP TRIGGER IF EXISTS update_community_post_comments_updated_at ON community_post_comments;
CREATE TRIGGER update_community_post_comments_updated_at
    BEFORE UPDATE ON community_post_comments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();