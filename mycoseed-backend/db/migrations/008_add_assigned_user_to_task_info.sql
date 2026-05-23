-- ============================================
-- 添加 assigned_user_id 字段到 task_info 表
-- 用于指定特定用户完成任务
-- ============================================

-- 添加 assigned_user_id 字段
ALTER TABLE task_info
ADD COLUMN IF NOT EXISTS assigned_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_task_info_assigned_user_id ON task_info(assigned_user_id);

-- 添加备注说明
COMMENT ON COLUMN task_info.assigned_user_id IS '指定参与人员ID（如果设置，只有该用户可以领取任务）';
