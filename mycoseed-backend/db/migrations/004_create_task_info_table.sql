-- ============================================
-- 创建 task_info 表（任务信息表）
-- 存储多人任务的基本信息（所有参与者共享）
-- ============================================

CREATE TABLE IF NOT EXISTS task_info (
    -- 主键
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 基本信息（所有参与者共享）
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    activity_id INTEGER DEFAULT 0,
    
    -- 时间相关（所有参与者共享）
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    deadline TIMESTAMP WITH TIME ZONE NOT NULL,
    submit_deadline TIMESTAMP WITH TIME ZONE,    -- 提交截止时间（可选）
    
    -- 参与者相关
    participant_limit INTEGER,                   -- 参与人数上限（NULL表示不限）
    reward_distribution_mode VARCHAR(20) DEFAULT 'per_person', -- 奖励分配模式：'per_person' 或 'custom'
    
    -- 凭证配置（所有参与者共享）
    proof_config JSONB,                          -- 证明配置（提交要求）
    submission_instructions TEXT,                -- 提交说明（备注）
    
    -- 创建者（任务组的创建者）
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- 时间戳
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_task_info_creator_id ON task_info(creator_id);
CREATE INDEX IF NOT EXISTS idx_task_info_activity_id ON task_info(activity_id);
CREATE INDEX IF NOT EXISTS idx_task_info_created_at ON task_info(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_info_deadline ON task_info(deadline);

-- 添加备注说明
COMMENT ON TABLE task_info IS '任务信息表，存储多人任务的基本信息（所有参与者共享）';
COMMENT ON COLUMN task_info.title IS '任务标题';
COMMENT ON COLUMN task_info.description IS '任务描述';
COMMENT ON COLUMN task_info.activity_id IS '所属活动ID';
COMMENT ON COLUMN task_info.start_date IS '任务开始时间';
COMMENT ON COLUMN task_info.deadline IS '任务截止时间';
COMMENT ON COLUMN task_info.submit_deadline IS '提交截止时间（可选）';
COMMENT ON COLUMN task_info.participant_limit IS '参与人数上限，NULL表示不限';
COMMENT ON COLUMN task_info.reward_distribution_mode IS '奖励分配模式：per_person(每人平均), custom(自定义权重)';
COMMENT ON COLUMN task_info.proof_config IS '证明配置（提交要求，JSON格式）';
COMMENT ON COLUMN task_info.submission_instructions IS '提交说明（备注）';
COMMENT ON COLUMN task_info.creator_id IS '任务创建者ID（外键，关联users表）';

-- 触发器：自动更新 updated_at
DROP TRIGGER IF EXISTS update_task_info_updated_at ON task_info;
CREATE TRIGGER update_task_info_updated_at
    BEFORE UPDATE ON task_info
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
