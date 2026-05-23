-- ============================================
-- 创建 tasks 表（任务表 - 优化版）
-- 每个行代表一个创建者-领取者对（支持多人任务）
-- 核心字段：状态、奖励、关联信息（大字段已分离到独立表）
-- ============================================

CREATE TABLE IF NOT EXISTS tasks (
    -- 主键
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 外键关联
    task_info_id UUID NOT NULL REFERENCES task_info(id) ON DELETE CASCADE, -- 关联的任务信息ID（多人任务共享）
    creator_id UUID REFERENCES users(id) ON DELETE SET NULL,                -- 任务创建者ID
    claimer_id UUID REFERENCES users(id) ON DELETE CASCADE,                  -- 任务领取者ID（可为NULL，表示未领取）
    
    -- 奖励相关（每个参与者独立）
    reward NUMERIC(10,2) NOT NULL,                 -- 奖励金额
    currency VARCHAR(10) DEFAULT 'NT'             -- 货币类型：'ETH', 'NT', 'USDT', 'USDC', 'DAI'
        CHECK (currency IN ('ETH', 'NT', 'USDT', 'USDC', 'DAI')),
    weight_coefficient NUMERIC(5,2) DEFAULT 1.0,  -- 权重系数（用于自定义奖励分配，默认1.0）
    participant_index INTEGER DEFAULT 1,           -- 参与者序号（多人任务中的第几个参与者）
    
    -- 状态相关（核心字段，用于快速查询和筛选）
    status TEXT NOT NULL DEFAULT 'unclaimed'        -- 任务状态
        CHECK (status IN ('unclaimed', 'claimed', 'unsubmit', 'submitted', 'rejected', 'completed')),
    
    -- 时间戳字段（只保留完成时间，领取和提交时间从 timeline 获取）
    completed_at TIMESTAMP WITH TIME ZONE,          -- 任务完成时间
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 如果表已存在，添加缺失的字段（用于更新现有表）
DO $$
BEGIN
    -- 添加 task_info_id 字段（如果不存在）
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'tasks' 
          AND column_name = 'task_info_id'
    ) THEN
        ALTER TABLE tasks ADD COLUMN task_info_id UUID;
    END IF;
    
    -- 添加 claimer_id 字段（如果不存在）
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'tasks' 
          AND column_name = 'claimer_id'
    ) THEN
        ALTER TABLE tasks ADD COLUMN claimer_id UUID;
    END IF;
    
    -- 添加 currency 字段（如果不存在）
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'tasks' 
          AND column_name = 'currency'
    ) THEN
        ALTER TABLE tasks ADD COLUMN currency VARCHAR(10) DEFAULT 'NT';
    END IF;
    
    -- 添加 weight_coefficient 字段（如果不存在）
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'tasks' 
          AND column_name = 'weight_coefficient'
    ) THEN
        ALTER TABLE tasks ADD COLUMN weight_coefficient NUMERIC(5,2) DEFAULT 1.0;
    END IF;
    
    -- 添加 participant_index 字段（如果不存在）
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'tasks' 
          AND column_name = 'participant_index'
    ) THEN
        ALTER TABLE tasks ADD COLUMN participant_index INTEGER DEFAULT 1;
    END IF;
    
    -- 删除 is_claimed 字段（如果存在）
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'tasks' 
          AND column_name = 'is_claimed'
    ) THEN
        ALTER TABLE tasks DROP COLUMN is_claimed;
    END IF;
    
    -- 更新 status 字段的 CHECK 约束（如果 status 字段存在）
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'tasks' 
          AND column_name = 'status'
    ) THEN
        -- 删除旧的约束
        ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
        -- 添加新的约束
        ALTER TABLE tasks ADD CONSTRAINT tasks_status_check 
            CHECK (status IN ('unclaimed', 'claimed', 'unsubmit', 'submitted', 'rejected', 'completed'));
    END IF;
    
    -- 删除不需要的字段（如果存在）
    ALTER TABLE tasks DROP COLUMN IF EXISTS allow_repeat_claim;
    ALTER TABLE tasks DROP COLUMN IF EXISTS claimed_at;
    ALTER TABLE tasks DROP COLUMN IF EXISTS submitted_at;
    ALTER TABLE tasks DROP COLUMN IF EXISTS timeline;
    ALTER TABLE tasks DROP COLUMN IF EXISTS proof;
    ALTER TABLE tasks DROP COLUMN IF EXISTS reject_reason;
    ALTER TABLE tasks DROP COLUMN IF EXISTS reject_option;
    ALTER TABLE tasks DROP COLUMN IF EXISTS discount;
    ALTER TABLE tasks DROP COLUMN IF EXISTS discount_reason;
END $$;

-- 创建索引
-- tasks 表索引
CREATE INDEX IF NOT EXISTS idx_tasks_task_info_id ON tasks(task_info_id);
CREATE INDEX IF NOT EXISTS idx_tasks_creator_id ON tasks(creator_id) WHERE creator_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_claimer_id ON tasks(claimer_id) WHERE claimer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_creator_claimer ON tasks(creator_id, claimer_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);  -- 重要：状态索引用于快速筛选
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_currency ON tasks(currency);
CREATE INDEX IF NOT EXISTS idx_tasks_participant_index ON tasks(participant_index);
CREATE INDEX IF NOT EXISTS idx_tasks_completed_at ON tasks(completed_at);

-- 添加备注说明
COMMENT ON TABLE tasks IS '任务表（优化版），存储任务核心信息，大字段已分离到 task_timelines 和 task_proofs 表';
COMMENT ON COLUMN tasks.task_info_id IS '关联的任务信息ID（多人任务共享，外键关联task_info表）';
COMMENT ON COLUMN tasks.creator_id IS '任务创建者ID（外键，关联users表）';
COMMENT ON COLUMN tasks.claimer_id IS '任务领取者ID（外键，关联users表，可为NULL表示未领取）';
COMMENT ON COLUMN tasks.reward IS '奖励金额';
COMMENT ON COLUMN tasks.currency IS '奖励货币类型：ETH, NT, USDT, USDC, DAI';
COMMENT ON COLUMN tasks.weight_coefficient IS '权重系数（用于自定义奖励分配，默认1.0）';
COMMENT ON COLUMN tasks.participant_index IS '参与者序号（多人任务中的第几个参与者）';
COMMENT ON COLUMN tasks.status IS '任务状态：unclaimed(未领取), claimed(已领取), unsubmit(已领取未提交), submitted(已提交), rejected(已驳回), completed(已完成)';
COMMENT ON COLUMN tasks.completed_at IS '任务完成时间（领取和提交时间从 task_timelines.timeline 获取）';

-- 触发器：自动更新 updated_at
DROP TRIGGER IF EXISTS update_tasks_updated_at ON tasks;
CREATE TRIGGER update_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
