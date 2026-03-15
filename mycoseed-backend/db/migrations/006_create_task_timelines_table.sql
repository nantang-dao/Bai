-- ============================================
-- 创建 task_timelines 表（任务时间线表）
-- 存储任务的时间线历史，按需加载
-- ============================================

CREATE TABLE IF NOT EXISTS task_timelines (
    -- 主键
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 外键关联（一对一关系）
    task_id UUID NOT NULL UNIQUE REFERENCES tasks(id) ON DELETE CASCADE,
    
    -- 时间线数据（JSONB数组，记录所有状态变更事件）
    timeline JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- 时间戳
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_task_timelines_task_id ON task_timelines(task_id);
-- GIN 索引用于 JSONB 查询优化
CREATE INDEX IF NOT EXISTS idx_task_timelines_timeline ON task_timelines USING GIN (timeline);

-- 添加备注说明
COMMENT ON TABLE task_timelines IS '任务时间线表，存储任务的所有状态变更历史（一对一关系）';
COMMENT ON COLUMN task_timelines.task_id IS '关联的任务ID（外键，一对一关系）';
COMMENT ON COLUMN task_timelines.timeline IS '任务时间线，JSONB数组格式，记录所有状态变更事件（仅追加写入）';

-- 触发器：自动更新 updated_at
DROP TRIGGER IF EXISTS update_task_timelines_updated_at ON task_timelines;
CREATE TRIGGER update_task_timelines_updated_at
    BEFORE UPDATE ON task_timelines
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
