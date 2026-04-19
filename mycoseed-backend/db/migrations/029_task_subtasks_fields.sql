-- 阶段 X：子任务草稿增强（可配置字段，复用普通任务逻辑）
-- 目标：让 task_subtasks 承载更多“像普通任务”的字段；并支持子任务提交截止不晚于任务池提交截止的 gate（后端校验为主）

ALTER TABLE task_subtasks
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS submission_instructions TEXT,
  ADD COLUMN IF NOT EXISTS proof_config JSONB,
  ADD COLUMN IF NOT EXISTS participant_limit INTEGER,
  ADD COLUMN IF NOT EXISTS reward_nt NUMERIC(24, 8),
  ADD COLUMN IF NOT EXISTS submit_deadline_override TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN task_subtasks.description IS '子任务描述（可选）';
COMMENT ON COLUMN task_subtasks.submission_instructions IS '子任务提交说明（可选）';
COMMENT ON COLUMN task_subtasks.proof_config IS '子任务 proof_config 覆盖（可选；结构与 task_info.proof_config 一致）';
COMMENT ON COLUMN task_subtasks.participant_limit IS '子任务参与人数（可选；为空时按任务池默认或产品规则）';
COMMENT ON COLUMN task_subtasks.reward_nt IS '子任务奖励（可选；单位 NT/积分，具体解释由链下规则决定）';
COMMENT ON COLUMN task_subtasks.submit_deadline_override IS '子任务提交截止覆盖（可选；不得晚于 task_info.submit_deadline，由后端校验）';

-- 基础数据约束（强 gate 在后端实现；此处只做弱约束防脏值）
ALTER TABLE task_subtasks DROP CONSTRAINT IF EXISTS task_subtasks_participant_limit_check;
ALTER TABLE task_subtasks ADD CONSTRAINT task_subtasks_participant_limit_check
  CHECK (participant_limit IS NULL OR participant_limit >= 1);

ALTER TABLE task_subtasks DROP CONSTRAINT IF EXISTS task_subtasks_reward_nt_check;
ALTER TABLE task_subtasks ADD CONSTRAINT task_subtasks_reward_nt_check
  CHECK (reward_nt IS NULL OR reward_nt >= 0);

