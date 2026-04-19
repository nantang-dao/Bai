-- 交付块 5 / 阶段 4C：TaskPool 整单提交 → Reviewer 审核 → 状态可追溯

-- 1) 扩展整单提交主表：增加审核状态
ALTER TABLE taskpool_overall_submissions
  ADD COLUMN IF NOT EXISTS status VARCHAR(16) NOT NULL DEFAULT 'draft';

COMMENT ON COLUMN taskpool_overall_submissions.status IS 'draft | under_review | approved | rejected';

-- 2) 审核记录表：保留审核决定与原因（可追溯）
CREATE TABLE IF NOT EXISTS taskpool_overall_submission_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_info_id UUID NOT NULL REFERENCES task_info(id) ON DELETE CASCADE,
  reviewer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  decision VARCHAR(16) NOT NULL, -- approved | rejected
  reason TEXT,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_taskpool_overall_submission_reviews_task
  ON taskpool_overall_submission_reviews(task_info_id);

CREATE INDEX IF NOT EXISTS idx_taskpool_overall_submission_reviews_reviewer
  ON taskpool_overall_submission_reviews(reviewer_user_id);

