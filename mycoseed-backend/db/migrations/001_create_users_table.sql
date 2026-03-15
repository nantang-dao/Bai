-- ============================================
-- 创建 users 表（用户表）
-- 包含所有字段：基础信息、资料、认证、钱包等
-- ============================================

CREATE TABLE IF NOT EXISTS users (
    -- 主键
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 身份标识（唯一）
    phone VARCHAR(20) UNIQUE,                    -- 手机号（唯一）
    email VARCHAR(255) UNIQUE,                  -- 邮箱（唯一）
    handle VARCHAR(50) UNIQUE,                  -- 用户名（唯一，可选）
    
    -- 用户资料
    name VARCHAR(100),                           -- 用户名称
    bio TEXT,                                    -- 用户简介
    avatar TEXT,                                 -- 用户头像URL
    image_url TEXT,                              -- 用户头像URL（旧字段，与avatar互斥）
    
    -- 认证相关
    phone_verified BOOLEAN DEFAULT false,         -- 手机号是否已验证
    password_hash VARCHAR(255),                 -- 密码哈希值（加密存储）
    
    -- 钱包相关（从外部身份系统同步）
    evm_chain_address VARCHAR(255),              -- 钱包地址
    evm_chain_active_key VARCHAR(255),          -- 钱包私钥（加密存储）
    encrypted_keys JSONB,                        -- 加密密钥（JSON格式）
    
    -- 时间戳
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 如果表已存在，添加缺失的字段（用于更新现有表）
DO $$
BEGIN
    -- 添加 name 字段（如果不存在）
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'users' 
          AND column_name = 'name'
    ) THEN
        ALTER TABLE users ADD COLUMN name VARCHAR(100);
    END IF;
    
    -- 添加 bio 字段（如果不存在）
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'users' 
          AND column_name = 'bio'
    ) THEN
        ALTER TABLE users ADD COLUMN bio TEXT;
    END IF;
    
    -- 添加 avatar 字段（如果不存在）
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'users' 
          AND column_name = 'avatar'
    ) THEN
        ALTER TABLE users ADD COLUMN avatar TEXT;
    END IF;
    
    -- 添加 password_hash 字段（如果不存在）
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'users' 
          AND column_name = 'password_hash'
    ) THEN
        ALTER TABLE users ADD COLUMN password_hash VARCHAR(255);
    END IF;
END $$;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_handle ON users(handle);

-- 添加备注说明
COMMENT ON TABLE users IS '用户表，存储所有用户信息';
COMMENT ON COLUMN users.phone IS '手机号（唯一标识）';
COMMENT ON COLUMN users.email IS '邮箱（唯一标识）';
COMMENT ON COLUMN users.handle IS '用户名（唯一标识，可选）';
COMMENT ON COLUMN users.name IS '用户名称';
COMMENT ON COLUMN users.bio IS '用户简介';
COMMENT ON COLUMN users.avatar IS '用户头像URL';
COMMENT ON COLUMN users.image_url IS '用户头像URL（旧字段，与avatar互斥）';
COMMENT ON COLUMN users.phone_verified IS '手机号是否已验证';
COMMENT ON COLUMN users.password_hash IS '用户密码哈希值（使用 bcrypt 加密）';
COMMENT ON COLUMN users.evm_chain_address IS '钱包地址（从外部身份系统同步）';
COMMENT ON COLUMN users.evm_chain_active_key IS '钱包私钥（加密存储）';
COMMENT ON COLUMN users.encrypted_keys IS '加密密钥（JSON格式）';

-- 创建通用函数：自动更新 updated_at（如果不存在）
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN 
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 触发器：自动更新 updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
