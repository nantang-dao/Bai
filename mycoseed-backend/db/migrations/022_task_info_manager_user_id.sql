-- C2 阶段 1：链下 Manager（维护子任务草稿）；认领后写入且不可改
-- 与 taskpool_manager_user_id（链上元数据回写）区分：业务上通常一致，链下权限以本字段为准

ALTER TABLE task_info ADD COLUMN IF NOT EXISTS manager_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
COMMENT ON COLUMN task_info.manager_user_id IS '子任务维护者（Manager）；认领主项目时写入，不可更改';

-- 历史 TaskPool 任务：默认 Manager = 创建者，行为与改权限前一致
UPDATE task_info
SET manager_user_id = COALESCE(taskpool_manager_user_id, creator_id)
WHERE use_taskpool = true
  AND manager_user_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_task_info_manager_user_id ON task_info(manager_user_id) WHERE manager_user_id IS NOT NULL;
