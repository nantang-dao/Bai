-- ============================================
-- 创建 community_posts 表（社区动态表）
-- 预留 community_id 字段，允许NULL，等社区表创建后再添加外键约束
-- ============================================

CREATE TABLE IF NOT EXISTS community_posts (
    -- 主键
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 社区关联，预留字段。允许NULL
    -- 等 communities 表创建后，需要确认主键类型。如果 communities.id 是 INTEGER，需要改一下
    community_id UUID,

    -- 发布者信息
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,  

    -- 动态内容
    content TEXT NOT NULL,
    images JSONB DEFAULT '[]'::jsonb, -- 图片 URL 数组

    -- 置顶功能
    is_pinned BOOLEAN DEFAULT false, -- 是否置顶（管理员可置顶）

    -- 时间戳
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- 关联任务（暂未实现，后续再使用，目前允许NULL）
    task_id UUID REFERENCES task_info(id) ON DELETE SET NULL
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_community_posts_community_id
    ON community_posts(community_id) WHERE community_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_community_posts_author_id
    ON community_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_created_at
    ON community_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_posts_task_id
    ON community_posts(task_id) WHERE task_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_community_posts_is_pinned
    ON community_posts(is_pinned) WHERE is_pinned = true;

-- 添加备注说明
COMMENT ON TABLE community_posts IS '社区动态表，存储社区圈的所有动态';
COMMENT ON COLUMN community_posts.community_id IS '所属社区ID（预留字段，暂时允许NULL)';
COMMENT ON COLUMN community_posts.author_id IS '发布者ID（外键，关联users表）';
COMMENT ON COLUMN community_posts.content IS '动态内容（纯文本，不支持Markdown）';
COMMENT ON COLUMN community_posts.images IS '图片URL数组（JSON格式），最多9张，每张最大5MB';
COMMENT ON COLUMN community_posts.task_id IS '关联的任务ID（任务广播到社区圈时使用）';
COMMENT ON COLUMN community_posts.is_pinned IS '是否置顶（管理员可置顶，置顶动态排序在前）';

-- 触发器：自动更新 updated_at
DROP TRIGGER IF EXISTS update_community_posts_updated_at ON community_posts;
CREATE TRIGGER update_community_posts_updated_at
    BEFORE UPDATE ON community_posts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
