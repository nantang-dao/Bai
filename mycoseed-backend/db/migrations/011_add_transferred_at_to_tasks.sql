-- ============================================
-- 添加 transferred_at 字段到 tasks 表
-- 用于记录转账完成时间
-- ============================================

-- 添加 transferred_at 字段
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS transferred_at TIMESTAMP WITH TIME ZONE;

-- 创建索引（可选，用于快速查询已转账的任务）
CREATE INDEX IF NOT EXISTS idx_tasks_transferred_at ON tasks(transferred_at) WHERE transferred_at IS NOT NULL;

-- 添加备注说明
COMMENT ON COLUMN tasks.transferred_at IS '转账完成时间（NULL表示未转账）';

