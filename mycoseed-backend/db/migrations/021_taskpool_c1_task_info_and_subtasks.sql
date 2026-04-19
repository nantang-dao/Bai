-- ============================================
-- C1：TaskPool 链下状态、预留与子任务草稿
-- poolId 链上 = uuidToTaskPoolUint256(task_info.id)，不在此库存 uint256
-- ============================================

-- task_info：TaskPool 元数据
ALTER TABLE task_info ADD COLUMN IF NOT EXISTS allow_split BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE task_info ADD COLUMN IF NOT EXISTS use_taskpool BOOLEAN NOT NULL DEFAULT false;
COMMENT ON COLUMN task_info.allow_split IS '是否允许拆分子任务（产品配置）';
COMMENT ON COLUMN task_info.use_taskpool IS '是否走链上 TaskPool 流程';

ALTER TABLE task_info ADD COLUMN IF NOT EXISTS planned_lock_nt NUMERIC(24, 8);
COMMENT ON COLUMN task_info.planned_lock_nt IS '计划从 publisher credit 锁入池的 NT 总额（与链下预留校验一致）';

ALTER TABLE task_info ADD COLUMN IF NOT EXISTS taskpool_phase VARCHAR(32) NOT NULL DEFAULT 'none';
COMMENT ON COLUMN task_info.taskpool_phase IS 'none | awaiting_pool | pool_created | closed';

ALTER TABLE task_info ADD COLUMN IF NOT EXISTS taskpool_create_tx_hash TEXT;
COMMENT ON COLUMN task_info.taskpool_create_tx_hash IS 'createTaskPool 交易哈希';

ALTER TABLE task_info ADD COLUMN IF NOT EXISTS taskpool_manager_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
COMMENT ON COLUMN task_info.taskpool_manager_user_id IS '链上 manager 对应用户（常为第一领取者）';

ALTER TABLE task_info ADD COLUMN IF NOT EXISTS subtasks_finalized BOOLEAN NOT NULL DEFAULT false;
COMMENT ON COLUMN task_info.subtasks_finalized IS '子任务草稿已定稿后不可再增删行';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'task_info_taskpool_phase_check'
  ) THEN
    ALTER TABLE task_info ADD CONSTRAINT task_info_taskpool_phase_check
      CHECK (taskpool_phase IN ('none', 'awaiting_pool', 'pool_created', 'closed'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_task_info_taskpool_phase ON task_info(taskpool_phase) WHERE use_taskpool = true;

-- 子任务草稿（建池前）
CREATE TABLE IF NOT EXISTS task_subtasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_info_id UUID NOT NULL REFERENCES task_info(id) ON DELETE CASCADE,
    subtask_uuid UUID NOT NULL DEFAULT gen_random_uuid(),
    title TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    max_amount_nt NUMERIC(24, 8),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (task_info_id, subtask_uuid)
);

CREATE INDEX IF NOT EXISTS idx_task_subtasks_task_info_id ON task_subtasks(task_info_id);

COMMENT ON TABLE task_subtasks IS 'TaskPool 子任务草稿；链上 taskId = uuidToTaskPoolUint256(subtask_uuid)';
COMMENT ON COLUMN task_subtasks.subtask_uuid IS '子任务稳定 UUID，用于派生链上 taskId';
COMMENT ON COLUMN task_subtasks.max_amount_nt IS '可选单条上限；链上可先全 0 仅用此做展示/校验';

DROP TRIGGER IF EXISTS update_task_subtasks_updated_at ON task_subtasks;
CREATE TRIGGER update_task_subtasks_updated_at
    BEFORE UPDATE ON task_subtasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
