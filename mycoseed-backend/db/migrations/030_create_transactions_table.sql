-- ============================================
-- 创建 transactions 表（链上转账记录表）
-- 存储从 Alchemy 查询到的链上转账记录，关联到具体任务
-- ============================================

CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tx_hash VARCHAR(128) NOT NULL,
    chain VARCHAR(20) NOT NULL DEFAULT 'optimism',
    sender_address VARCHAR(128),
    receiver_address VARCHAR(128),
    amount NUMERIC(30, 0),           -- wei 值
    currency VARCHAR(10) DEFAULT 'NT',
    status VARCHAR(20) DEFAULT 'success',
    memo TEXT,
    task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_tx_hash ON transactions(tx_hash);
CREATE INDEX IF NOT EXISTS idx_transactions_task_id ON transactions(task_id);
CREATE INDEX IF NOT EXISTS idx_transactions_sender ON transactions(sender_address);
CREATE INDEX IF NOT EXISTS idx_transactions_receiver ON transactions(receiver_address);

COMMENT ON TABLE transactions IS '链上转账记录表，存储从 Alchemy 查询到的 ERC20 Transfer 事件';
COMMENT ON COLUMN transactions.tx_hash IS '交易哈希';
COMMENT ON COLUMN transactions.amount IS '转账金额（wei 值）';
COMMENT ON COLUMN transactions.task_id IS '关联的任务 ID';

-- 触发器：自动更新 updated_at
DROP TRIGGER IF EXISTS update_transactions_updated_at ON transactions;
CREATE TRIGGER update_transactions_updated_at
    BEFORE UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
