-- ============================================
-- 创建 auth_tokens 表（认证令牌表）
-- 用于存储用户的认证令牌（用于 API 认证）
-- ============================================

CREATE TABLE IF NOT EXISTS auth_tokens (
    -- 主键
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 认证令牌
    token VARCHAR(255) NOT NULL UNIQUE,         -- 认证令牌（32位十六进制字符串）
    
    -- 外键
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- 用户ID
    
    -- 状态
    disabled BOOLEAN DEFAULT false,              -- 是否已禁用
    
    -- 时间戳
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_auth_tokens_token ON auth_tokens(token);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_user_id ON auth_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_disabled ON auth_tokens(disabled) WHERE disabled = false;

-- 添加备注说明
COMMENT ON TABLE auth_tokens IS '认证令牌表，存储用户的认证令牌（用于 API 认证）';
COMMENT ON COLUMN auth_tokens.token IS '认证令牌（唯一，32位十六进制字符串）';
COMMENT ON COLUMN auth_tokens.user_id IS '用户ID（外键，关联users表）';
COMMENT ON COLUMN auth_tokens.disabled IS '是否已禁用（登出时设置 disabled = true）';

-- 触发器：自动更新 updated_at
DROP TRIGGER IF EXISTS update_auth_tokens_updated_at ON auth_tokens;
CREATE TRIGGER update_auth_tokens_updated_at
    BEFORE UPDATE ON auth_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
