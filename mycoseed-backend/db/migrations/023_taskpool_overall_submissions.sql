-- C2 阶段 4A：TaskPool 整单提交（链下）
-- 仅用于链下体验闭环：Manager 提交总凭证/整单说明，Publisher 只读可查看

CREATE TABLE IF NOT EXISTS taskpool_overall_submissions (
  task_info_id UUID PRIMARY KEY REFERENCES task_info(id) ON DELETE CASCADE,
  submitted_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_taskpool_overall_submissions_submitter
  ON taskpool_overall_submissions(submitted_by_user_id);

