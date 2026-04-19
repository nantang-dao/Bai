-- 阶段 3：Semi 预付与 task_info 绑定（链下 intent / 状态机）
-- 记录发起预付时的 state、金额，回跳后落库 success/failed/cancelled，便于核对「已付未继续」

CREATE TABLE IF NOT EXISTS taskpool_prepay_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_info_id UUID NOT NULL REFERENCES task_info(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  state_token TEXT NOT NULL,
  amount_human TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  user_op_hash TEXT,
  tx_hash TEXT,
  error_code TEXT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT taskpool_prepay_intents_status_check CHECK (
    status IN ('pending', 'success', 'failed', 'cancelled', 'superseded')
  ),
  CONSTRAINT taskpool_prepay_intents_state_token_unique UNIQUE (state_token)
);

CREATE INDEX IF NOT EXISTS idx_taskpool_prepay_intents_task_info_id
  ON taskpool_prepay_intents(task_info_id);
CREATE INDEX IF NOT EXISTS idx_taskpool_prepay_intents_task_info_created
  ON taskpool_prepay_intents(task_info_id, created_at DESC);

COMMENT ON TABLE taskpool_prepay_intents IS 'Semi TaskPool 预付 intent：pending→success|failed|cancelled；新发起可 supersede 旧 pending';
