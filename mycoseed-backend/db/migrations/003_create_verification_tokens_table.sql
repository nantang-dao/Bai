-- ============================================
-- 创建 verification_tokens 表（验证码表）
-- 用于存储短信/邮箱验证码
-- ============================================

CREATE TABLE IF NOT EXISTS verification_tokens (
    -- 主键
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 验证码信息
    context VARCHAR(50) NOT NULL,                -- 验证码用途（如 'phone-login', 'email-login'）
    sent_to VARCHAR(255) NOT NULL,               -- 发送目标（手机号或邮箱）
    code VARCHAR(10) NOT NULL,                   -- 验证码（6位数字）
    
    -- 过期时间
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL, -- 过期时间（创建后15分钟）
    
    -- 状态
    used BOOLEAN DEFAULT false,                  -- 是否已使用
    
    -- 时间戳
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_verification_tokens_context ON verification_tokens(context);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_sent_to ON verification_tokens(sent_to);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_code ON verification_tokens(code);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_expires_at ON verification_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_used ON verification_tokens(used) WHERE used = false;

-- 添加备注说明
COMMENT ON TABLE verification_tokens IS '验证码表，存储短信/邮箱验证码';
COMMENT ON COLUMN verification_tokens.context IS '验证码用途（如 phone-login, email-login）';
COMMENT ON COLUMN verification_tokens.sent_to IS '发送目标（手机号或邮箱）';
COMMENT ON COLUMN verification_tokens.code IS '验证码（6位数字）';
COMMENT ON COLUMN verification_tokens.expires_at IS '过期时间（创建后15分钟）';
COMMENT ON COLUMN verification_tokens.used IS '是否已使用（使用后标记为 true）';

-- 触发器：自动更新 updated_at
DROP TRIGGER IF EXISTS update_verification_tokens_updated_at ON verification_tokens;
CREATE TRIGGER update_verification_tokens_updated_at
    BEFORE UPDATE ON verification_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
