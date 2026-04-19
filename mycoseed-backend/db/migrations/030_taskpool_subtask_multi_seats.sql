-- 阶段 5：子任务 participantLimit>1 时允许生成多条 tasks 行（多席位）
--
-- 028 中的 idx_tasks_unique_pool_subtask 约束了同 pool_subtask_id 只能有 1 行，
-- 这会阻断“多人子任务”的席位扩展。这里移除该唯一索引，并用普通索引替代以保留查询性能。

DROP INDEX IF EXISTS idx_tasks_unique_pool_subtask;

-- 用于按子任务分组查询（领取/详情 participantsList 等）
CREATE INDEX IF NOT EXISTS idx_tasks_pool_subtask_id
  ON tasks(pool_subtask_id)
  WHERE pool_subtask_id IS NOT NULL;

