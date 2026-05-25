-- ============================================
-- 活动付款支持：transactions 表新增字段
-- ============================================

-- 活动关联
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES community_events(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_event_id ON transactions(event_id);

-- 实际付款金额（wei），用户可能改金额
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS actual_amount NUMERIC(30, 0);

-- 标价（预期金额）
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS expected_amount NUMERIC(30, 0);

COMMENT ON COLUMN transactions.event_id IS '关联的活动 ID';
COMMENT ON COLUMN transactions.actual_amount IS '实际付款金额（wei），用户可能修改转账金额';
COMMENT ON COLUMN transactions.expected_amount IS '标价/预期金额（wei）';
