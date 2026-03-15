-- ============================================
-- 创建 task_proofs 表（任务凭证表）
-- 存储任务凭证和审核相关信息
-- ============================================

CREATE TABLE IF NOT EXISTS task_proofs (
    -- 主键
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 外键关联（一对一关系）
    task_id UUID NOT NULL UNIQUE REFERENCES tasks(id) ON DELETE CASCADE,
    
    -- 凭证相关
    proof TEXT,                                     -- 完成凭证（可能包含大量文本或JSON）
    
    -- 审核相关
    reject_reason TEXT,                             -- 驳回理由
    reject_option TEXT                              -- 驳回选项：'resubmit'(重新提交), 'reclaim'(重新领取), 'rejected'(终止任务)
        CHECK (reject_option IS NULL OR reject_option IN ('resubmit', 'reclaim', 'rejected')),
    
    -- 折扣相关
    discount NUMERIC(5,2),                          -- 打折百分数
    discount_reason TEXT,                           -- 打折理由
    
    -- 时间戳
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_task_proofs_task_id ON task_proofs(task_id);
CREATE INDEX IF NOT EXISTS idx_task_proofs_reject_option ON task_proofs(reject_option) WHERE reject_option IS NOT NULL;

-- 添加备注说明
COMMENT ON TABLE task_proofs IS '任务凭证表，存储任务凭证和审核相关信息（一对一关系）';
COMMENT ON COLUMN task_proofs.task_id IS '关联的任务ID（外键，一对一关系）';
COMMENT ON COLUMN task_proofs.proof IS '完成凭证（可能包含大量文本或JSON）';
COMMENT ON COLUMN task_proofs.reject_reason IS '驳回理由';
COMMENT ON COLUMN task_proofs.reject_option IS '驳回选项：resubmit(重新提交), reclaim(重新领取), rejected(终止任务)';
COMMENT ON COLUMN task_proofs.discount IS '打折百分数';
COMMENT ON COLUMN task_proofs.discount_reason IS '打折理由';

-- 触发器：自动更新 updated_at
DROP TRIGGER IF EXISTS update_task_proofs_updated_at ON task_proofs;
CREATE TRIGGER update_task_proofs_updated_at
    BEFORE UPDATE ON task_proofs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
