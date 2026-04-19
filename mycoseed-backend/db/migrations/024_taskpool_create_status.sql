-- C2 阶段 4：建池幂等与重试（链下记录）
-- 目的：记录建池过程状态，避免重复点击/重试写乱

ALTER TABLE task_info
  ADD COLUMN IF NOT EXISTS taskpool_create_status VARCHAR(16) NOT NULL DEFAULT 'idle';
COMMENT ON COLUMN task_info.taskpool_create_status IS 'idle | signing | pending | confirmed | failed';

ALTER TABLE task_info
  ADD COLUMN IF NOT EXISTS taskpool_create_digest TEXT;
COMMENT ON COLUMN task_info.taskpool_create_digest IS 'EIP-712 CreateTaskPool digest（链下缓存，用于幂等对拍/排障）';

ALTER TABLE task_info
  ADD COLUMN IF NOT EXISTS taskpool_create_last_error TEXT;
COMMENT ON COLUMN task_info.taskpool_create_last_error IS '最近一次建池失败原因（链下）';

ALTER TABLE task_info
  ADD COLUMN IF NOT EXISTS taskpool_create_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
COMMENT ON COLUMN task_info.taskpool_create_updated_at IS '建池状态最近更新时间';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'task_info_taskpool_create_status_check'
  ) THEN
    ALTER TABLE task_info ADD CONSTRAINT task_info_taskpool_create_status_check
      CHECK (taskpool_create_status IN ('idle','signing','pending','confirmed','failed'));
  END IF;
END $$;

