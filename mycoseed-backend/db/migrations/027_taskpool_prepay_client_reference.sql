-- 阶段 5.2：链下「支付单」引用（与 Semi deep link 协议一致，不强制 Semi 改代码）
-- client_reference：前端生成的 UUID，便于列表展示与对账；仍与 task_info_id + state 绑定

ALTER TABLE taskpool_prepay_intents
  ADD COLUMN IF NOT EXISTS client_reference TEXT;

COMMENT ON COLUMN taskpool_prepay_intents.client_reference IS '可选：链下支付单号（如 crypto.randomUUID），POST prepay-intent 时传入';

CREATE INDEX IF NOT EXISTS idx_taskpool_prepay_intents_task_info_created_ref
  ON taskpool_prepay_intents(task_info_id, created_at DESC);
