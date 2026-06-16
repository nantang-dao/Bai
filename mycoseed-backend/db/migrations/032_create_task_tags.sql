-- 社区任务标签系统

CREATE TABLE IF NOT EXISTS community_task_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    color_hex VARCHAR(20) NOT NULL DEFAULT '#64748b',
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    archived BOOLEAN NOT NULL DEFAULT false,
    UNIQUE(community_id, name)
);
CREATE INDEX IF NOT EXISTS idx_ctt_community ON community_task_tags(community_id);

CREATE TABLE IF NOT EXISTS task_info_tags (
    task_info_id UUID NOT NULL REFERENCES task_info(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES community_task_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (task_info_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_tit_tag ON task_info_tags(tag_id);

-- 为已有社区插入默认任务标签
INSERT INTO community_task_tags (community_id, name, color_hex, sort_order)
SELECT c.id, t.name, t.color, t.ord
FROM communities c
CROSS JOIN (
    VALUES
        (0, '日常', '#f87171'),
        (1, '创作', '#3b82f6'),
        (2, '运营', '#eab308'),
        (3, '技术', '#a855f7')
) AS t(ord, name, color)
ON CONFLICT (community_id, name) DO NOTHING;
