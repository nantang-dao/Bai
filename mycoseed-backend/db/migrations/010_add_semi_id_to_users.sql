-- ============================================
-- 添加 semi_id 字段到 users 表
-- 用于关联 Semi 用户和 Mycoseed 用户
-- ============================================

-- 添加 semi_id 字段
ALTER TABLE users ADD COLUMN IF NOT EXISTS semi_id VARCHAR(255);

-- 创建唯一索引（允许 NULL，但非 NULL 值必须唯一）
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_semi_id ON users(semi_id) WHERE semi_id IS NOT NULL;

-- 添加备注说明
COMMENT ON COLUMN users.semi_id IS 'Semi 用户 ID（TSID，用于关联 Semi 和 Mycoseed 用户）';

