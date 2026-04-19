-- 阶段 1：tasks 行在商城中的语义（普通 / 任务池主入口 / 子任务可领行）
-- 「领池子 = Manager」仍写入 task_info.manager_user_id（本 migration 仅扩展 tasks）

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS listing_kind VARCHAR(32) NOT NULL DEFAULT 'standard';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS pool_subtask_id UUID REFERENCES task_subtasks(id) ON DELETE RESTRICT;

COMMENT ON COLUMN tasks.listing_kind IS 'standard=普通任务行; taskpool_pool=任务池在商城的主入口行(后续:领此行的 claim 同步写 manager_user_id); taskpool_subtask=子任务发布生成的可领行';
COMMENT ON COLUMN tasks.pool_subtask_id IS '仅 listing_kind=taskpool_subtask 时指向 task_subtasks.id';

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_listing_kind_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_listing_kind_check
  CHECK (listing_kind IN ('standard', 'taskpool_pool', 'taskpool_subtask'));

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_pool_subtask_link_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_pool_subtask_link_check
  CHECK (
    (listing_kind = 'taskpool_subtask' AND pool_subtask_id IS NOT NULL)
    OR (listing_kind <> 'taskpool_subtask' AND pool_subtask_id IS NULL)
  );

CREATE INDEX IF NOT EXISTS idx_tasks_listing_kind ON tasks(listing_kind);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_unique_pool_subtask
  ON tasks(pool_subtask_id)
  WHERE pool_subtask_id IS NOT NULL;

-- 回填：每个 use_taskpool 的 task_info，取「首条」任务行作为商城上的任务池主入口
UPDATE tasks t
SET listing_kind = 'taskpool_pool'
FROM (
  SELECT DISTINCT ON (task_info_id) id
  FROM tasks
  WHERE task_info_id IN (SELECT id FROM task_info WHERE use_taskpool = true)
  ORDER BY task_info_id, participant_index ASC NULLS LAST, created_at ASC
) first_row
WHERE t.id = first_row.id;
