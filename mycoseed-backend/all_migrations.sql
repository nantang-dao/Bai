-- === 001_create_users_table.sql ===
-- ============================================
-- 鍒涘缓 users 琛紙鐢ㄦ埛琛級
-- 鍖呭惈鎵€鏈夊瓧娈碉細鍩虹淇℃伅銆佽祫鏂欍€佽璇併€侀挶鍖呯瓑
-- ============================================

CREATE TABLE IF NOT EXISTS users (
    -- 涓婚敭
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 韬唤鏍囪瘑锛堝敮涓€锛?    phone VARCHAR(20) UNIQUE,                    -- 鎵嬫満鍙凤紙鍞竴锛?    email VARCHAR(255) UNIQUE,                  -- 閭锛堝敮涓€锛?    handle VARCHAR(50) UNIQUE,                  -- 鐢ㄦ埛鍚嶏紙鍞竴锛屽彲閫夛級
    
    -- 鐢ㄦ埛璧勬枡
    name VARCHAR(100),                           -- 鐢ㄦ埛鍚嶇О
    bio TEXT,                                    -- 鐢ㄦ埛绠€浠?    avatar TEXT,                                 -- 鐢ㄦ埛澶村儚URL
    image_url TEXT,                              -- 鐢ㄦ埛澶村儚URL锛堟棫瀛楁锛屼笌avatar浜掓枼锛?    
    -- 璁よ瘉鐩稿叧
    phone_verified BOOLEAN DEFAULT false,         -- 鎵嬫満鍙锋槸鍚﹀凡楠岃瘉
    password_hash VARCHAR(255),                 -- 瀵嗙爜鍝堝笇鍊硷紙鍔犲瘑瀛樺偍锛?    
    -- 閽卞寘鐩稿叧锛堜粠澶栭儴韬唤绯荤粺鍚屾锛?    evm_chain_address VARCHAR(255),              -- 閽卞寘鍦板潃
    evm_chain_active_key VARCHAR(255),          -- 閽卞寘绉侀挜锛堝姞瀵嗗瓨鍌級
    encrypted_keys JSONB,                        -- 鍔犲瘑瀵嗛挜锛圝SON鏍煎紡锛?    
    -- 鏃堕棿鎴?    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 濡傛灉琛ㄥ凡瀛樺湪锛屾坊鍔犵己澶辩殑瀛楁锛堢敤浜庢洿鏂扮幇鏈夎〃锛?DO $$
BEGIN
    -- 娣诲姞 name 瀛楁锛堝鏋滀笉瀛樺湪锛?    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'users' 
          AND column_name = 'name'
    ) THEN
        ALTER TABLE users ADD COLUMN name VARCHAR(100);
    END IF;
    
    -- 娣诲姞 bio 瀛楁锛堝鏋滀笉瀛樺湪锛?    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'users' 
          AND column_name = 'bio'
    ) THEN
        ALTER TABLE users ADD COLUMN bio TEXT;
    END IF;
    
    -- 娣诲姞 avatar 瀛楁锛堝鏋滀笉瀛樺湪锛?    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'users' 
          AND column_name = 'avatar'
    ) THEN
        ALTER TABLE users ADD COLUMN avatar TEXT;
    END IF;
    
    -- 娣诲姞 password_hash 瀛楁锛堝鏋滀笉瀛樺湪锛?    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'users' 
          AND column_name = 'password_hash'
    ) THEN
        ALTER TABLE users ADD COLUMN password_hash VARCHAR(255);
    END IF;
END $$;

-- 鍒涘缓绱㈠紩
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_handle ON users(handle);

-- 娣诲姞澶囨敞璇存槑
COMMENT ON TABLE users IS '鐢ㄦ埛琛紝瀛樺偍鎵€鏈夌敤鎴蜂俊鎭?;
COMMENT ON COLUMN users.phone IS '鎵嬫満鍙凤紙鍞竴鏍囪瘑锛?;
COMMENT ON COLUMN users.email IS '閭锛堝敮涓€鏍囪瘑锛?;
COMMENT ON COLUMN users.handle IS '鐢ㄦ埛鍚嶏紙鍞竴鏍囪瘑锛屽彲閫夛級';
COMMENT ON COLUMN users.name IS '鐢ㄦ埛鍚嶇О';
COMMENT ON COLUMN users.bio IS '鐢ㄦ埛绠€浠?;
COMMENT ON COLUMN users.avatar IS '鐢ㄦ埛澶村儚URL';
COMMENT ON COLUMN users.image_url IS '鐢ㄦ埛澶村儚URL锛堟棫瀛楁锛屼笌avatar浜掓枼锛?;
COMMENT ON COLUMN users.phone_verified IS '鎵嬫満鍙锋槸鍚﹀凡楠岃瘉';
COMMENT ON COLUMN users.password_hash IS '鐢ㄦ埛瀵嗙爜鍝堝笇鍊硷紙浣跨敤 bcrypt 鍔犲瘑锛?;
COMMENT ON COLUMN users.evm_chain_address IS '閽卞寘鍦板潃锛堜粠澶栭儴韬唤绯荤粺鍚屾锛?;
COMMENT ON COLUMN users.evm_chain_active_key IS '閽卞寘绉侀挜锛堝姞瀵嗗瓨鍌級';
COMMENT ON COLUMN users.encrypted_keys IS '鍔犲瘑瀵嗛挜锛圝SON鏍煎紡锛?;

-- 鍒涘缓閫氱敤鍑芥暟锛氳嚜鍔ㄦ洿鏂?updated_at锛堝鏋滀笉瀛樺湪锛?CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN 
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 瑙﹀彂鍣細鑷姩鏇存柊 updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- === 002_create_auth_tokens_table.sql ===
-- ============================================
-- 鍒涘缓 auth_tokens 琛紙璁よ瘉浠ょ墝琛級
-- 鐢ㄤ簬瀛樺偍鐢ㄦ埛鐨勮璇佷护鐗岋紙鐢ㄤ簬 API 璁よ瘉锛?-- ============================================

CREATE TABLE IF NOT EXISTS auth_tokens (
    -- 涓婚敭
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 璁よ瘉浠ょ墝
    token VARCHAR(255) NOT NULL UNIQUE,         -- 璁よ瘉浠ょ墝锛?2浣嶅崄鍏繘鍒跺瓧绗︿覆锛?    
    -- 澶栭敭
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- 鐢ㄦ埛ID
    
    -- 鐘舵€?    disabled BOOLEAN DEFAULT false,              -- 鏄惁宸茬鐢?    
    -- 鏃堕棿鎴?    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 鍒涘缓绱㈠紩
CREATE INDEX IF NOT EXISTS idx_auth_tokens_token ON auth_tokens(token);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_user_id ON auth_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_disabled ON auth_tokens(disabled) WHERE disabled = false;

-- 娣诲姞澶囨敞璇存槑
COMMENT ON TABLE auth_tokens IS '璁よ瘉浠ょ墝琛紝瀛樺偍鐢ㄦ埛鐨勮璇佷护鐗岋紙鐢ㄤ簬 API 璁よ瘉锛?;
COMMENT ON COLUMN auth_tokens.token IS '璁よ瘉浠ょ墝锛堝敮涓€锛?2浣嶅崄鍏繘鍒跺瓧绗︿覆锛?;
COMMENT ON COLUMN auth_tokens.user_id IS '鐢ㄦ埛ID锛堝閿紝鍏宠仈users琛級';
COMMENT ON COLUMN auth_tokens.disabled IS '鏄惁宸茬鐢紙鐧诲嚭鏃惰缃?disabled = true锛?;

-- 瑙﹀彂鍣細鑷姩鏇存柊 updated_at
DROP TRIGGER IF EXISTS update_auth_tokens_updated_at ON auth_tokens;
CREATE TRIGGER update_auth_tokens_updated_at
    BEFORE UPDATE ON auth_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- === 003_create_verification_tokens_table.sql ===
-- ============================================
-- 鍒涘缓 verification_tokens 琛紙楠岃瘉鐮佽〃锛?-- 鐢ㄤ簬瀛樺偍鐭俊/閭楠岃瘉鐮?-- ============================================

CREATE TABLE IF NOT EXISTS verification_tokens (
    -- 涓婚敭
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 楠岃瘉鐮佷俊鎭?    context VARCHAR(50) NOT NULL,                -- 楠岃瘉鐮佺敤閫旓紙濡?'phone-login', 'email-login'锛?    sent_to VARCHAR(255) NOT NULL,               -- 鍙戦€佺洰鏍囷紙鎵嬫満鍙锋垨閭锛?    code VARCHAR(10) NOT NULL,                   -- 楠岃瘉鐮侊紙6浣嶆暟瀛楋級
    
    -- 杩囨湡鏃堕棿
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL, -- 杩囨湡鏃堕棿锛堝垱寤哄悗15鍒嗛挓锛?    
    -- 鐘舵€?    used BOOLEAN DEFAULT false,                  -- 鏄惁宸蹭娇鐢?    
    -- 鏃堕棿鎴?    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 鍒涘缓绱㈠紩
CREATE INDEX IF NOT EXISTS idx_verification_tokens_context ON verification_tokens(context);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_sent_to ON verification_tokens(sent_to);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_code ON verification_tokens(code);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_expires_at ON verification_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_used ON verification_tokens(used) WHERE used = false;

-- 娣诲姞澶囨敞璇存槑
COMMENT ON TABLE verification_tokens IS '楠岃瘉鐮佽〃锛屽瓨鍌ㄧ煭淇?閭楠岃瘉鐮?;
COMMENT ON COLUMN verification_tokens.context IS '楠岃瘉鐮佺敤閫旓紙濡?phone-login, email-login锛?;
COMMENT ON COLUMN verification_tokens.sent_to IS '鍙戦€佺洰鏍囷紙鎵嬫満鍙锋垨閭锛?;
COMMENT ON COLUMN verification_tokens.code IS '楠岃瘉鐮侊紙6浣嶆暟瀛楋級';
COMMENT ON COLUMN verification_tokens.expires_at IS '杩囨湡鏃堕棿锛堝垱寤哄悗15鍒嗛挓锛?;
COMMENT ON COLUMN verification_tokens.used IS '鏄惁宸蹭娇鐢紙浣跨敤鍚庢爣璁颁负 true锛?;

-- 瑙﹀彂鍣細鑷姩鏇存柊 updated_at
DROP TRIGGER IF EXISTS update_verification_tokens_updated_at ON verification_tokens;
CREATE TRIGGER update_verification_tokens_updated_at
    BEFORE UPDATE ON verification_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- === 004_create_task_info_table.sql ===
-- ============================================
-- 鍒涘缓 task_info 琛紙浠诲姟淇℃伅琛級
-- 瀛樺偍澶氫汉浠诲姟鐨勫熀鏈俊鎭紙鎵€鏈夊弬涓庤€呭叡浜級
-- ============================================

CREATE TABLE IF NOT EXISTS task_info (
    -- 涓婚敭
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 鍩烘湰淇℃伅锛堟墍鏈夊弬涓庤€呭叡浜級
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    activity_id INTEGER DEFAULT 0,
    
    -- 鏃堕棿鐩稿叧锛堟墍鏈夊弬涓庤€呭叡浜級
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    deadline TIMESTAMP WITH TIME ZONE NOT NULL,
    submit_deadline TIMESTAMP WITH TIME ZONE,    -- 鎻愪氦鎴鏃堕棿锛堝彲閫夛級
    
    -- 鍙備笌鑰呯浉鍏?    participant_limit INTEGER,                   -- 鍙備笌浜烘暟涓婇檺锛圢ULL琛ㄧず涓嶉檺锛?    reward_distribution_mode VARCHAR(20) DEFAULT 'per_person', -- 濂栧姳鍒嗛厤妯″紡锛?per_person' 鎴?'custom'
    
    -- 鍑瘉閰嶇疆锛堟墍鏈夊弬涓庤€呭叡浜級
    proof_config JSONB,                          -- 璇佹槑閰嶇疆锛堟彁浜よ姹傦級
    submission_instructions TEXT,                -- 鎻愪氦璇存槑锛堝娉級
    
    -- 鍒涘缓鑰咃紙浠诲姟缁勭殑鍒涘缓鑰咃級
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- 鏃堕棿鎴?    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 鍒涘缓绱㈠紩
CREATE INDEX IF NOT EXISTS idx_task_info_creator_id ON task_info(creator_id);
CREATE INDEX IF NOT EXISTS idx_task_info_activity_id ON task_info(activity_id);
CREATE INDEX IF NOT EXISTS idx_task_info_created_at ON task_info(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_info_deadline ON task_info(deadline);

-- 娣诲姞澶囨敞璇存槑
COMMENT ON TABLE task_info IS '浠诲姟淇℃伅琛紝瀛樺偍澶氫汉浠诲姟鐨勫熀鏈俊鎭紙鎵€鏈夊弬涓庤€呭叡浜級';
COMMENT ON COLUMN task_info.title IS '浠诲姟鏍囬';
COMMENT ON COLUMN task_info.description IS '浠诲姟鎻忚堪';
COMMENT ON COLUMN task_info.activity_id IS '鎵€灞炴椿鍔↖D';
COMMENT ON COLUMN task_info.start_date IS '浠诲姟寮€濮嬫椂闂?;
COMMENT ON COLUMN task_info.deadline IS '浠诲姟鎴鏃堕棿';
COMMENT ON COLUMN task_info.submit_deadline IS '鎻愪氦鎴鏃堕棿锛堝彲閫夛級';
COMMENT ON COLUMN task_info.participant_limit IS '鍙備笌浜烘暟涓婇檺锛孨ULL琛ㄧず涓嶉檺';
COMMENT ON COLUMN task_info.reward_distribution_mode IS '濂栧姳鍒嗛厤妯″紡锛歱er_person(姣忎汉骞冲潎), custom(鑷畾涔夋潈閲?';
COMMENT ON COLUMN task_info.proof_config IS '璇佹槑閰嶇疆锛堟彁浜よ姹傦紝JSON鏍煎紡锛?;
COMMENT ON COLUMN task_info.submission_instructions IS '鎻愪氦璇存槑锛堝娉級';
COMMENT ON COLUMN task_info.creator_id IS '浠诲姟鍒涘缓鑰匢D锛堝閿紝鍏宠仈users琛級';

-- 瑙﹀彂鍣細鑷姩鏇存柊 updated_at
DROP TRIGGER IF EXISTS update_task_info_updated_at ON task_info;
CREATE TRIGGER update_task_info_updated_at
    BEFORE UPDATE ON task_info
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- === 005_create_tasks_table.sql ===
-- ============================================
-- 鍒涘缓 tasks 琛紙浠诲姟琛?- 浼樺寲鐗堬級
-- 姣忎釜琛屼唬琛ㄤ竴涓垱寤鸿€?棰嗗彇鑰呭锛堟敮鎸佸浜轰换鍔★級
-- 鏍稿績瀛楁锛氱姸鎬併€佸鍔便€佸叧鑱斾俊鎭紙澶у瓧娈靛凡鍒嗙鍒扮嫭绔嬭〃锛?-- ============================================

CREATE TABLE IF NOT EXISTS tasks (
    -- 涓婚敭
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 澶栭敭鍏宠仈
    task_info_id UUID NOT NULL REFERENCES task_info(id) ON DELETE CASCADE, -- 鍏宠仈鐨勪换鍔′俊鎭疘D锛堝浜轰换鍔″叡浜級
    creator_id UUID REFERENCES users(id) ON DELETE SET NULL,                -- 浠诲姟鍒涘缓鑰匢D
    claimer_id UUID REFERENCES users(id) ON DELETE CASCADE,                  -- 浠诲姟棰嗗彇鑰匢D锛堝彲涓篘ULL锛岃〃绀烘湭棰嗗彇锛?    
    -- 濂栧姳鐩稿叧锛堟瘡涓弬涓庤€呯嫭绔嬶級
    reward NUMERIC(10,2) NOT NULL,                 -- 濂栧姳閲戦
    currency VARCHAR(10) DEFAULT 'NT'             -- 璐у竵绫诲瀷锛?ETH', 'NT', 'USDT', 'USDC', 'DAI'
        CHECK (currency IN ('ETH', 'NT', 'USDT', 'USDC', 'DAI')),
    weight_coefficient NUMERIC(5,2) DEFAULT 1.0,  -- 鏉冮噸绯绘暟锛堢敤浜庤嚜瀹氫箟濂栧姳鍒嗛厤锛岄粯璁?.0锛?    participant_index INTEGER DEFAULT 1,           -- 鍙備笌鑰呭簭鍙凤紙澶氫汉浠诲姟涓殑绗嚑涓弬涓庤€咃級
    
    -- 鐘舵€佺浉鍏筹紙鏍稿績瀛楁锛岀敤浜庡揩閫熸煡璇㈠拰绛涢€夛級
    status TEXT NOT NULL DEFAULT 'unclaimed'        -- 浠诲姟鐘舵€?        CHECK (status IN ('unclaimed', 'claimed', 'unsubmit', 'submitted', 'rejected', 'completed')),
    
    -- 鏃堕棿鎴冲瓧娈碉紙鍙繚鐣欏畬鎴愭椂闂达紝棰嗗彇鍜屾彁浜ゆ椂闂翠粠 timeline 鑾峰彇锛?    completed_at TIMESTAMP WITH TIME ZONE,          -- 浠诲姟瀹屾垚鏃堕棿
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 濡傛灉琛ㄥ凡瀛樺湪锛屾坊鍔犵己澶辩殑瀛楁锛堢敤浜庢洿鏂扮幇鏈夎〃锛?DO $$
BEGIN
    -- 娣诲姞 task_info_id 瀛楁锛堝鏋滀笉瀛樺湪锛?    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'tasks' 
          AND column_name = 'task_info_id'
    ) THEN
        ALTER TABLE tasks ADD COLUMN task_info_id UUID;
    END IF;
    
    -- 娣诲姞 claimer_id 瀛楁锛堝鏋滀笉瀛樺湪锛?    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'tasks' 
          AND column_name = 'claimer_id'
    ) THEN
        ALTER TABLE tasks ADD COLUMN claimer_id UUID;
    END IF;
    
    -- 娣诲姞 currency 瀛楁锛堝鏋滀笉瀛樺湪锛?    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'tasks' 
          AND column_name = 'currency'
    ) THEN
        ALTER TABLE tasks ADD COLUMN currency VARCHAR(10) DEFAULT 'NT';
    END IF;
    
    -- 娣诲姞 weight_coefficient 瀛楁锛堝鏋滀笉瀛樺湪锛?    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'tasks' 
          AND column_name = 'weight_coefficient'
    ) THEN
        ALTER TABLE tasks ADD COLUMN weight_coefficient NUMERIC(5,2) DEFAULT 1.0;
    END IF;
    
    -- 娣诲姞 participant_index 瀛楁锛堝鏋滀笉瀛樺湪锛?    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'tasks' 
          AND column_name = 'participant_index'
    ) THEN
        ALTER TABLE tasks ADD COLUMN participant_index INTEGER DEFAULT 1;
    END IF;
    
    -- 鍒犻櫎 is_claimed 瀛楁锛堝鏋滃瓨鍦級
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'tasks' 
          AND column_name = 'is_claimed'
    ) THEN
        ALTER TABLE tasks DROP COLUMN is_claimed;
    END IF;
    
    -- 鏇存柊 status 瀛楁鐨?CHECK 绾︽潫锛堝鏋?status 瀛楁瀛樺湪锛?    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'tasks' 
          AND column_name = 'status'
    ) THEN
        -- 鍒犻櫎鏃х殑绾︽潫
        ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
        -- 娣诲姞鏂扮殑绾︽潫
        ALTER TABLE tasks ADD CONSTRAINT tasks_status_check 
            CHECK (status IN ('unclaimed', 'claimed', 'unsubmit', 'submitted', 'rejected', 'completed'));
    END IF;
    
    -- 鍒犻櫎涓嶉渶瑕佺殑瀛楁锛堝鏋滃瓨鍦級
    ALTER TABLE tasks DROP COLUMN IF EXISTS allow_repeat_claim;
    ALTER TABLE tasks DROP COLUMN IF EXISTS claimed_at;
    ALTER TABLE tasks DROP COLUMN IF EXISTS submitted_at;
    ALTER TABLE tasks DROP COLUMN IF EXISTS timeline;
    ALTER TABLE tasks DROP COLUMN IF EXISTS proof;
    ALTER TABLE tasks DROP COLUMN IF EXISTS reject_reason;
    ALTER TABLE tasks DROP COLUMN IF EXISTS reject_option;
    ALTER TABLE tasks DROP COLUMN IF EXISTS discount;
    ALTER TABLE tasks DROP COLUMN IF EXISTS discount_reason;
END $$;

-- 鍒涘缓绱㈠紩
-- tasks 琛ㄧ储寮?CREATE INDEX IF NOT EXISTS idx_tasks_task_info_id ON tasks(task_info_id);
CREATE INDEX IF NOT EXISTS idx_tasks_creator_id ON tasks(creator_id) WHERE creator_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_claimer_id ON tasks(claimer_id) WHERE claimer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_creator_claimer ON tasks(creator_id, claimer_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);  -- 閲嶈锛氱姸鎬佺储寮曠敤浜庡揩閫熺瓫閫?CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_currency ON tasks(currency);
CREATE INDEX IF NOT EXISTS idx_tasks_participant_index ON tasks(participant_index);
CREATE INDEX IF NOT EXISTS idx_tasks_completed_at ON tasks(completed_at);

-- 娣诲姞澶囨敞璇存槑
COMMENT ON TABLE tasks IS '浠诲姟琛紙浼樺寲鐗堬級锛屽瓨鍌ㄤ换鍔℃牳蹇冧俊鎭紝澶у瓧娈靛凡鍒嗙鍒?task_timelines 鍜?task_proofs 琛?;
COMMENT ON COLUMN tasks.task_info_id IS '鍏宠仈鐨勪换鍔′俊鎭疘D锛堝浜轰换鍔″叡浜紝澶栭敭鍏宠仈task_info琛級';
COMMENT ON COLUMN tasks.creator_id IS '浠诲姟鍒涘缓鑰匢D锛堝閿紝鍏宠仈users琛級';
COMMENT ON COLUMN tasks.claimer_id IS '浠诲姟棰嗗彇鑰匢D锛堝閿紝鍏宠仈users琛紝鍙负NULL琛ㄧず鏈鍙栵級';
COMMENT ON COLUMN tasks.reward IS '濂栧姳閲戦';
COMMENT ON COLUMN tasks.currency IS '濂栧姳璐у竵绫诲瀷锛欵TH, NT, USDT, USDC, DAI';
COMMENT ON COLUMN tasks.weight_coefficient IS '鏉冮噸绯绘暟锛堢敤浜庤嚜瀹氫箟濂栧姳鍒嗛厤锛岄粯璁?.0锛?;
COMMENT ON COLUMN tasks.participant_index IS '鍙備笌鑰呭簭鍙凤紙澶氫汉浠诲姟涓殑绗嚑涓弬涓庤€咃級';
COMMENT ON COLUMN tasks.status IS '浠诲姟鐘舵€侊細unclaimed(鏈鍙?, claimed(宸查鍙?, unsubmit(宸查鍙栨湭鎻愪氦), submitted(宸叉彁浜?, rejected(宸查┏鍥?, completed(宸插畬鎴?';
COMMENT ON COLUMN tasks.completed_at IS '浠诲姟瀹屾垚鏃堕棿锛堥鍙栧拰鎻愪氦鏃堕棿浠?task_timelines.timeline 鑾峰彇锛?;

-- 瑙﹀彂鍣細鑷姩鏇存柊 updated_at
DROP TRIGGER IF EXISTS update_tasks_updated_at ON tasks;
CREATE TRIGGER update_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- === 006_create_task_timelines_table.sql ===
-- ============================================
-- 鍒涘缓 task_timelines 琛紙浠诲姟鏃堕棿绾胯〃锛?-- 瀛樺偍浠诲姟鐨勬椂闂寸嚎鍘嗗彶锛屾寜闇€鍔犺浇
-- ============================================

CREATE TABLE IF NOT EXISTS task_timelines (
    -- 涓婚敭
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 澶栭敭鍏宠仈锛堜竴瀵逛竴鍏崇郴锛?    task_id UUID NOT NULL UNIQUE REFERENCES tasks(id) ON DELETE CASCADE,
    
    -- 鏃堕棿绾挎暟鎹紙JSONB鏁扮粍锛岃褰曟墍鏈夌姸鎬佸彉鏇翠簨浠讹級
    timeline JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- 鏃堕棿鎴?    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 鍒涘缓绱㈠紩
CREATE INDEX IF NOT EXISTS idx_task_timelines_task_id ON task_timelines(task_id);
-- GIN 绱㈠紩鐢ㄤ簬 JSONB 鏌ヨ浼樺寲
CREATE INDEX IF NOT EXISTS idx_task_timelines_timeline ON task_timelines USING GIN (timeline);

-- 娣诲姞澶囨敞璇存槑
COMMENT ON TABLE task_timelines IS '浠诲姟鏃堕棿绾胯〃锛屽瓨鍌ㄤ换鍔＄殑鎵€鏈夌姸鎬佸彉鏇村巻鍙诧紙涓€瀵逛竴鍏崇郴锛?;
COMMENT ON COLUMN task_timelines.task_id IS '鍏宠仈鐨勪换鍔D锛堝閿紝涓€瀵逛竴鍏崇郴锛?;
COMMENT ON COLUMN task_timelines.timeline IS '浠诲姟鏃堕棿绾匡紝JSONB鏁扮粍鏍煎紡锛岃褰曟墍鏈夌姸鎬佸彉鏇翠簨浠讹紙浠呰拷鍔犲啓鍏ワ級';

-- 瑙﹀彂鍣細鑷姩鏇存柊 updated_at
DROP TRIGGER IF EXISTS update_task_timelines_updated_at ON task_timelines;
CREATE TRIGGER update_task_timelines_updated_at
    BEFORE UPDATE ON task_timelines
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- === 007_create_task_proofs_table.sql ===
-- ============================================
-- 鍒涘缓 task_proofs 琛紙浠诲姟鍑瘉琛級
-- 瀛樺偍浠诲姟鍑瘉鍜屽鏍哥浉鍏充俊鎭?-- ============================================

CREATE TABLE IF NOT EXISTS task_proofs (
    -- 涓婚敭
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 澶栭敭鍏宠仈锛堜竴瀵逛竴鍏崇郴锛?    task_id UUID NOT NULL UNIQUE REFERENCES tasks(id) ON DELETE CASCADE,
    
    -- 鍑瘉鐩稿叧
    proof TEXT,                                     -- 瀹屾垚鍑瘉锛堝彲鑳藉寘鍚ぇ閲忔枃鏈垨JSON锛?    
    -- 瀹℃牳鐩稿叧
    reject_reason TEXT,                             -- 椹冲洖鐞嗙敱
    reject_option TEXT                              -- 椹冲洖閫夐」锛?resubmit'(閲嶆柊鎻愪氦), 'reclaim'(閲嶆柊棰嗗彇), 'rejected'(缁堟浠诲姟)
        CHECK (reject_option IS NULL OR reject_option IN ('resubmit', 'reclaim', 'rejected')),
    
    -- 鎶樻墸鐩稿叧
    discount NUMERIC(5,2),                          -- 鎵撴姌鐧惧垎鏁?    discount_reason TEXT,                           -- 鎵撴姌鐞嗙敱
    
    -- 鏃堕棿鎴?    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 鍒涘缓绱㈠紩
CREATE INDEX IF NOT EXISTS idx_task_proofs_task_id ON task_proofs(task_id);
CREATE INDEX IF NOT EXISTS idx_task_proofs_reject_option ON task_proofs(reject_option) WHERE reject_option IS NOT NULL;

-- 娣诲姞澶囨敞璇存槑
COMMENT ON TABLE task_proofs IS '浠诲姟鍑瘉琛紝瀛樺偍浠诲姟鍑瘉鍜屽鏍哥浉鍏充俊鎭紙涓€瀵逛竴鍏崇郴锛?;
COMMENT ON COLUMN task_proofs.task_id IS '鍏宠仈鐨勪换鍔D锛堝閿紝涓€瀵逛竴鍏崇郴锛?;
COMMENT ON COLUMN task_proofs.proof IS '瀹屾垚鍑瘉锛堝彲鑳藉寘鍚ぇ閲忔枃鏈垨JSON锛?;
COMMENT ON COLUMN task_proofs.reject_reason IS '椹冲洖鐞嗙敱';
COMMENT ON COLUMN task_proofs.reject_option IS '椹冲洖閫夐」锛歳esubmit(閲嶆柊鎻愪氦), reclaim(閲嶆柊棰嗗彇), rejected(缁堟浠诲姟)';
COMMENT ON COLUMN task_proofs.discount IS '鎵撴姌鐧惧垎鏁?;
COMMENT ON COLUMN task_proofs.discount_reason IS '鎵撴姌鐞嗙敱';

-- 瑙﹀彂鍣細鑷姩鏇存柊 updated_at
DROP TRIGGER IF EXISTS update_task_proofs_updated_at ON task_proofs;
CREATE TRIGGER update_task_proofs_updated_at
    BEFORE UPDATE ON task_proofs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- === 008_add_assigned_user_to_task_info.sql ===
-- ============================================
-- 娣诲姞 assigned_user_id 瀛楁鍒?task_info 琛?-- 鐢ㄤ簬鎸囧畾鐗瑰畾鐢ㄦ埛瀹屾垚浠诲姟
-- ============================================

-- 娣诲姞 assigned_user_id 瀛楁
ALTER TABLE task_info
ADD COLUMN IF NOT EXISTS assigned_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- 鍒涘缓绱㈠紩
CREATE INDEX IF NOT EXISTS idx_task_info_assigned_user_id ON task_info(assigned_user_id);

-- 娣诲姞澶囨敞璇存槑
COMMENT ON COLUMN task_info.assigned_user_id IS '鎸囧畾鍙備笌浜哄憳ID锛堝鏋滆缃紝鍙湁璇ョ敤鎴峰彲浠ラ鍙栦换鍔★級';


-- === 010_add_semi_id_to_users.sql ===
-- ============================================
-- 娣诲姞 semi_id 瀛楁鍒?users 琛?-- 鐢ㄤ簬鍏宠仈 Semi 鐢ㄦ埛鍜?Mycoseed 鐢ㄦ埛
-- ============================================

-- 娣诲姞 semi_id 瀛楁
ALTER TABLE users ADD COLUMN IF NOT EXISTS semi_id VARCHAR(255);

-- 鍒涘缓鍞竴绱㈠紩锛堝厑璁?NULL锛屼絾闈?NULL 鍊煎繀椤诲敮涓€锛?CREATE UNIQUE INDEX IF NOT EXISTS idx_users_semi_id ON users(semi_id) WHERE semi_id IS NOT NULL;

-- 娣诲姞澶囨敞璇存槑
COMMENT ON COLUMN users.semi_id IS 'Semi 鐢ㄦ埛 ID锛圱SID锛岀敤浜庡叧鑱?Semi 鍜?Mycoseed 鐢ㄦ埛锛?;



-- === 011_add_transferred_at_to_tasks.sql ===
-- ============================================
-- 娣诲姞 transferred_at 瀛楁鍒?tasks 琛?-- 鐢ㄤ簬璁板綍杞处瀹屾垚鏃堕棿
-- ============================================

-- 娣诲姞 transferred_at 瀛楁
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS transferred_at TIMESTAMP WITH TIME ZONE;

-- 鍒涘缓绱㈠紩锛堝彲閫夛紝鐢ㄤ簬蹇€熸煡璇㈠凡杞处鐨勪换鍔★級
CREATE INDEX IF NOT EXISTS idx_tasks_transferred_at ON tasks(transferred_at) WHERE transferred_at IS NOT NULL;

-- 娣诲姞澶囨敞璇存槑
COMMENT ON COLUMN tasks.transferred_at IS '杞处瀹屾垚鏃堕棿锛圢ULL琛ㄧず鏈浆璐︼級';



-- === 012_community_posts.sql ===
-- ============================================
-- 鍒涘缓 community_posts 琛紙绀惧尯鍔ㄦ€佽〃锛?-- 棰勭暀 community_id 瀛楁锛屽厑璁窷ULL锛岀瓑绀惧尯琛ㄥ垱寤哄悗鍐嶆坊鍔犲閿害鏉?-- ============================================

CREATE TABLE IF NOT EXISTS community_posts (
    -- 涓婚敭
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 绀惧尯鍏宠仈锛岄鐣欏瓧娈点€傚厑璁窷ULL
    -- 绛?communities 琛ㄥ垱寤哄悗锛岄渶瑕佺‘璁や富閿被鍨嬨€傚鏋?communities.id 鏄?INTEGER锛岄渶瑕佹敼涓€涓?    community_id UUID,

    -- 鍙戝竷鑰呬俊鎭?    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,  

    -- 鍔ㄦ€佸唴瀹?    content TEXT NOT NULL,
    images JSONB DEFAULT '[]'::jsonb, -- 鍥剧墖 URL 鏁扮粍

    -- 缃《鍔熻兘
    is_pinned BOOLEAN DEFAULT false, -- 鏄惁缃《锛堢鐞嗗憳鍙疆椤讹級

    -- 鏃堕棿鎴?    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- 鍏宠仈浠诲姟锛堟殏鏈疄鐜帮紝鍚庣画鍐嶄娇鐢紝鐩墠鍏佽NULL锛?    task_id UUID REFERENCES task_info(id) ON DELETE SET NULL
);

-- 鍒涘缓绱㈠紩
CREATE INDEX IF NOT EXISTS idx_community_posts_community_id
    ON community_posts(community_id) WHERE community_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_community_posts_author_id
    ON community_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_created_at
    ON community_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_posts_task_id
    ON community_posts(task_id) WHERE task_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_community_posts_is_pinned
    ON community_posts(is_pinned) WHERE is_pinned = true;

-- 娣诲姞澶囨敞璇存槑
COMMENT ON TABLE community_posts IS '绀惧尯鍔ㄦ€佽〃锛屽瓨鍌ㄧぞ鍖哄湀鐨勬墍鏈夊姩鎬?;
COMMENT ON COLUMN community_posts.community_id IS '鎵€灞炵ぞ鍖篒D锛堥鐣欏瓧娈碉紝鏆傛椂鍏佽NULL)';
COMMENT ON COLUMN community_posts.author_id IS '鍙戝竷鑰匢D锛堝閿紝鍏宠仈users琛級';
COMMENT ON COLUMN community_posts.content IS '鍔ㄦ€佸唴瀹癸紙绾枃鏈紝涓嶆敮鎸丮arkdown锛?;
COMMENT ON COLUMN community_posts.images IS '鍥剧墖URL鏁扮粍锛圝SON鏍煎紡锛夛紝鏈€澶?寮狅紝姣忓紶鏈€澶?MB';
COMMENT ON COLUMN community_posts.task_id IS '鍏宠仈鐨勪换鍔D锛堜换鍔″箍鎾埌绀惧尯鍦堟椂浣跨敤锛?;
COMMENT ON COLUMN community_posts.is_pinned IS '鏄惁缃《锛堢鐞嗗憳鍙疆椤讹紝缃《鍔ㄦ€佹帓搴忓湪鍓嶏級';

-- 瑙﹀彂鍣細鑷姩鏇存柊 updated_at
DROP TRIGGER IF EXISTS update_community_posts_updated_at ON community_posts;
CREATE TRIGGER update_community_posts_updated_at
    BEFORE UPDATE ON community_posts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- === 013_create_community_post_comments_table.sql ===
-- ============================================
-- 鍒涘缓 community_post_comments 琛紙绀惧尯鍔ㄦ€佽瘎璁鸿〃锛?-- 瀛樺偍绀惧尯鍔ㄦ€佺殑璇勮锛屼笉鏀寔宓屽鍥炲锛堢被浼煎井淇℃湅鍙嬪湀锛?-- ============================================

CREATE TABLE IF NOT EXISTS community_post_comments (
    -- 涓婚敭
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 澶栭敭鍏宠仈
    post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE, -- 鍔ㄦ€両D
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- 璇勮鑰匢D

    -- 璇勮鍐呭
    content TEXT NOT NULL CHECK (LENGTH(content) <= 500), -- 璇勮鍐呭锛堟渶澶?00瀛楋級

    -- 鏃堕棿鎴?    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 鍒涘缓绱㈠紩
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON community_post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_author_id ON community_post_comments(author_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON community_post_comments(created_at ASC);  -- 鎸夋椂闂存搴忔樉绀?
-- 娣诲姞澶囨敞璇存槑
COMMENT ON TABLE community_post_comments IS '绀惧尯鍔ㄦ€佽瘎璁鸿〃锛屽瓨鍌ㄧぞ鍖哄姩鎬佺殑璇勮锛堜笉鏀寔宓屽鍥炲锛岀被浼煎井淇℃湅鍙嬪湀锛?;
COMMENT ON COLUMN community_post_comments.post_id IS '鍔ㄦ€両D锛堝閿紝鍏宠仈community_posts琛級';
COMMENT ON COLUMN community_post_comments.author_id IS '璇勮鑰匢D锛堝閿紝鍏宠仈users琛級';
COMMENT ON COLUMN community_post_comments.content IS '璇勮鍐呭锛堟渶澶?00瀛楋紝涓嶆敮鎸佸祵濂楀洖澶嶏級';

-- 瑙﹀彂鍣細鑷姩鏇存柊 updated_at
DROP TRIGGER IF EXISTS update_community_post_comments_updated_at ON community_post_comments;
CREATE TRIGGER update_community_post_comments_updated_at
    BEFORE UPDATE ON community_post_comments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- === 014_create_community_post_likes_table.sql ===
-- ============================================
-- 鍒涘缓 community_post_likes 琛紙绀惧尯鍔ㄦ€佺偣璧炶〃锛?-- 瀛樺偍绀惧尯鍔ㄦ€佺殑鐐硅禐璁板綍
-- ============================================

CREATE TABLE IF NOT EXISTS community_post_likes (
    -- 涓婚敭
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 澶栭敭鍏宠仈
    post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- 鏃堕棿鎴?    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- 鍞竴绾︽潫锛氶槻姝㈤噸澶嶇偣璧?    UNIQUE(post_id, user_id)
);

-- 鍒涘缓绱㈠紩
CREATE INDEX IF NOT EXISTS idx_likes_post_id ON community_post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_likes_user_id ON community_post_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_likes_created_at ON community_post_likes(created_at DESC);

-- 娣诲姞澶囨敞璇存槑
COMMENT ON TABLE community_post_likes IS '绀惧尯鍔ㄦ€佺偣璧炶〃锛屽瓨鍌ㄧぞ鍖哄姩鎬佺殑鐐硅禐璁板綍';
COMMENT ON COLUMN community_post_likes.post_id IS '鍔ㄦ€両D锛堝閿紝鍏宠仈community_posts琛級';
COMMENT ON COLUMN community_post_likes.user_id IS '鐐硅禐鐢ㄦ埛ID锛堝閿紝鍏宠仈users琛級';
COMMENT ON COLUMN community_post_likes.created_at IS '鐐硅禐鏃堕棿';

-- === 015_add_reply_to_user_to_comments.sql ===
-- ============================================
-- 涓?community_post_comments 澧炲姞銆屽洖澶嶆煇浜恒€嶅瓧娈碉紙骞抽潰銆佹湅鍙嬪湀寮忥級
-- 璇勮浠嶄负骞抽潰鍒楄〃锛屽彲閫夋爣璁扳€滃洖澶嶈皝鈥濓紝灞曠ず涓恒€孉 鍥炲 B: 鍐呭銆?-- ============================================

ALTER TABLE community_post_comments
ADD COLUMN IF NOT EXISTS reply_to_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_comments_reply_to_user
ON community_post_comments(reply_to_user_id) WHERE reply_to_user_id IS NOT NULL;

COMMENT ON COLUMN community_post_comments.reply_to_user_id IS '琚洖澶嶇敤鎴稩D锛堝彲閫夛紝鐢ㄤ簬灞曠ず銆屽洖澶?鏌愪汉銆嶏級';


-- === 016_create_communities_and_related.sql ===
-- ============================================
-- 绀惧尯涓庣鐞嗗憳锛歝ommunities, community_members, community_join_requests, announcements, system_admins
-- ============================================

-- 1. 绯荤粺绠＄悊鍛樿〃锛堟渶澶?5 浜猴紝搴旂敤灞傛牎楠岋級
CREATE TABLE IF NOT EXISTS system_admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_system_admins_user_id ON system_admins(user_id);
COMMENT ON TABLE system_admins IS '绯荤粺绠＄悊鍛樿〃锛屾渶澶?浜猴紝鍙垱寤虹ぞ鍖哄苟鎸囧畾鎬荤鐞嗗憳';

-- 2. 绀惧尯涓昏〃
CREATE TABLE IF NOT EXISTS communities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    markdown_intro TEXT,
    is_public BOOLEAN NOT NULL DEFAULT true,
    point_name VARCHAR(50) DEFAULT '绉垎',
    super_admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_communities_slug ON communities(slug);
CREATE INDEX IF NOT EXISTS idx_communities_super_admin_id ON communities(super_admin_id);
CREATE INDEX IF NOT EXISTS idx_communities_is_public ON communities(is_public);
COMMENT ON TABLE communities IS '绀惧尯涓昏〃';
COMMENT ON COLUMN communities.slug IS '鑻辨枃/鎷奸煶锛屼綔閭€璇风爜锛屽敮涓€';

DROP TRIGGER IF EXISTS update_communities_updated_at ON communities;
CREATE TRIGGER update_communities_updated_at
    BEFORE UPDATE ON communities
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 3. 绀惧尯鎴愬憳涓庤鑹诧紙member / sub_admin / super_admin锛?CREATE TABLE IF NOT EXISTS community_members (
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'sub_admin', 'super_admin')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (community_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_community_members_user_id ON community_members(user_id);
COMMENT ON TABLE community_members IS '绀惧尯鎴愬憳涓庤鑹诧紝鍗曡〃涓嶅尯鍒嗙鐞嗗憳';

-- 4. 绉佹湁绀惧尯鍏ョ兢鐢宠
CREATE TABLE IF NOT EXISTS community_join_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(community_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_join_requests_community_status ON community_join_requests(community_id, status);
COMMENT ON TABLE community_join_requests IS '绉佹湁绀惧尯鍏ョ兢鐢宠';

-- 5. 鍏憡锛堟寜绀惧尯锛?CREATE TABLE IF NOT EXISTS announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    content TEXT,
    is_pinned BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_announcements_community_id ON announcements(community_id);
DROP TRIGGER IF EXISTS update_announcements_updated_at ON announcements;
CREATE TRIGGER update_announcements_updated_at
    BEFORE UPDATE ON announcements
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 绀惧尯澶村儚锛氬垱寤虹ぞ鍖烘椂鍙€夛紝绀惧尯绠＄悊鍛樺彲淇敼
ALTER TABLE communities
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

COMMENT ON COLUMN communities.avatar_url IS '绀惧尯澶村儚 URL锛屼负绌哄垯鍓嶇浣跨敤榛樿/鏍规嵁 name 鐢熸垚';



-- === 017_add_community_id_to_task_info_and_posts.sql ===
-- ============================================
-- 涓?task_info銆乧ommunity_posts 澧炲姞 community_id锛涙彃鍏ュ崡濉樼ぞ鍖哄苟杩佺Щ鐜版湁鏁版嵁
-- ============================================

-- 1. 鎻掑叆榛樿绀惧尯銆屽崡濉樸€嶏紙鑻ヤ笉瀛樺湪锛夈€俿lug = nantang 浣滈個璇风爜
INSERT INTO communities (id, name, slug, description, markdown_intro, is_public, point_name, super_admin_id, created_at, updated_at)
SELECT 
    '00000000-0000-0000-0000-000000000002',
    '鍗楀',
    'nantang',
    '绱犺垗鎻愪緵涔℃潙鏉戞皯瀹块楗紝浣撻獙涔℃潙鐢熸椿锛屾劅鍙楄嚜鐒朵箣缇庛€?,
    E'# 鍗楀\n\n娆㈣繋鏉ュ埌鍗楀锛岀礌鑸嶆彁渚涗埂鏉戞潙姘戝椁愰ギ鏈嶅姟銆俓n\n## 鎴戜滑鐨勭壒鑹瞈n- 涔℃潙姘戝浣撻獙\n- 鍦伴亾涔℃潙椁愰ギ\n- 鑷劧鐢熸€佷綋楠孿n- 鍗楀璞嗙Н鍒嗗鍔?,
    true,
    '鍗楀璞?,
    NULL,
    NOW(),
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM communities WHERE id = '00000000-0000-0000-0000-000000000002');

-- 2. task_info 澧炲姞 community_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'task_info' AND column_name = 'community_id'
    ) THEN
        ALTER TABLE task_info ADD COLUMN community_id UUID REFERENCES communities(id) ON DELETE SET NULL;
        CREATE INDEX IF NOT EXISTS idx_task_info_community_id ON task_info(community_id);
        -- 鐜版湁浠诲姟褰掑埌鍗楀
        UPDATE task_info SET community_id = '00000000-0000-0000-0000-000000000002' WHERE community_id IS NULL;
    END IF;
END $$;

-- 3. community_posts 鐨?community_id 澧炲姞澶栭敭锛堣嫢灏氭湭绾︽潫锛夈€傜幇鏈?NULL 褰掑埌鍗楀
DO $$
BEGIN
    UPDATE community_posts SET community_id = '00000000-0000-0000-0000-000000000002' WHERE community_id IS NULL;
EXCEPTION WHEN OTHERS THEN
    NULL; -- 鑻ュ凡鏈夌害鏉熸垨鍒椾笉瀛樺湪鍒欏拷鐣?END $$;

-- 3. community_posts锛氱幇鏈?NULL 褰掑埌鍗楀锛堣〃宸插瓨鍦ㄤ笖鍚?community_id 鏃讹級
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'community_posts' AND column_name = 'community_id') THEN
        UPDATE community_posts SET community_id = '00000000-0000-0000-0000-000000000002' WHERE community_id IS NULL;
    END IF;
END $$;

-- ============================================
-- 灏嗙敤鎴枫€孋C銆嶃€屼簯灞曞睍銆嶃€岄噹鐢熻摑鑾撱€嶆坊鍔犱负绯荤粺绠＄悊鍛橈紙鏈€澶?5 浜猴紝浠呭綋鏈弧涓旂敤鎴峰瓨鍦ㄦ椂鎻掑叆锛?-- INSERT INTO system_admins (user_id)
-- SELECT u.id
-- FROM users u
-- WHERE u.name IN ('CC', '浜戝睍灞?, '閲庣敓钃濊帗')
--   AND NOT EXISTS (SELECT 1 FROM system_admins s WHERE s.user_id = u.id)
--   AND (SELECT count(*) FROM system_admins) < 5
-- ON CONFLICT (user_id) DO NOTHING;
-- ============================================

-- === 018_add_community_background_images.sql ===
-- 绀惧尯鑳屾櫙鍥撅紙鏈€澶氫笁寮狅級锛屽瓨 URL 鏁扮粍
ALTER TABLE communities
ADD COLUMN IF NOT EXISTS background_images JSONB NOT NULL DEFAULT '[]'::jsonb;
COMMENT ON COLUMN communities.background_images IS '鑳屾櫙鍥?URL 鏁扮粍锛屾渶澶?3 寮?;


-- === 020_add_receiver_remark_to_task_proofs.sql ===
-- 涓?task_proofs 琛ㄥ鍔犳帴鍖呰€呭娉ㄥ瓧娈碉紙鐢ㄤ簬澶囨敞涓婇摼锛?ALTER TABLE task_proofs
ADD COLUMN IF NOT EXISTS receiver_remark TEXT;

COMMENT ON COLUMN task_proofs.receiver_remark IS '鎺ュ寘鑰呭娉紝涓?proof 涓€璧锋彁浜わ紝鐢ㄤ簬涓婇摼';

-- === 021_create_faqs_table.sql ===
-- ============================================
-- FAQ锛氬父瑙侀棶棰橈紙闂/绛旀锛?-- ============================================

CREATE TABLE IF NOT EXISTS faqs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_faqs_created_at ON faqs(created_at DESC);

DROP TRIGGER IF EXISTS update_faqs_updated_at ON faqs;
CREATE TRIGGER update_faqs_updated_at
    BEFORE UPDATE ON faqs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE faqs IS '甯姪涓庡弽棣?- FAQ锛堥棶棰樹笌绛旀锛?;

-- 绀轰緥鏁版嵁锛堝彲鎸夐渶淇敼/鍒犻櫎锛?INSERT INTO faqs (question, answer)
VALUES
('杩欎釜绯荤粺鐨勬牳蹇冩祦绋嬫槸浠€涔堬紵', '绠€瑕佹祦绋嬶細鍔犲叆绀惧尯 鈫?娴忚/棰嗗彇浠诲姟 鈫?鎸夎姹傛彁浜ゅ嚟璇?鈫?浠诲姟鍒涘缓鑰呭鏍?鈫?瀹℃牳閫氳繃鍚庡彂鏀剧Н鍒?濂栧姳锛堟寜浠诲姟閰嶇疆锛夈€?),
('濡備綍棰嗗彇浠诲姟锛?, '杩涘叆浠诲姟鍒楄〃锛屾墦寮€浠诲姟璇︽儏鍚庣偣鍑烩€滈鍙栤€濄€傝嫢浠诲姟鎸囧畾浜嗗弬涓庤€呮垨宸叉弧鍛?杩囨湡锛屽皢鏃犳硶棰嗗彇銆?),
('鎻愪氦鍑瘉闇€瑕佸摢浜涘唴瀹癸紵', '鍙栧喅浜庝换鍔＄殑鍑瘉閰嶇疆锛氬彲鑳介渶瑕佹枃瀛楁弿杩般€佺収鐗?鏂囦欢銆丟PS 瀹氫綅绛夈€傛彁浜ゅ悗浼氳繘鍏モ€滃緟瀹℃牳鈥濈姸鎬併€?),
('澶氫汉浠诲姟濡備綍璁＄畻杩涘害锛?, '澶氫汉浠诲姟浼氫负姣忎釜鍙備笌鑰呯敓鎴愪竴鏉＄嫭绔嬩换鍔¤锛涙瘡涓汉鐨勯鍙栥€佹彁浜ゃ€佸鏍镐簰涓嶅奖鍝嶃€傚垪琛ㄩ〉浼氭眹鎬绘樉绀烘暣浣撹繘搴︺€?),
('瀹℃牳椹冲洖鍚庢垜璇ユ€庝箞鍋氾紵', '鍒涘缓鑰呭彲閫夋嫨鈥滈噸鏂版彁浜わ紙resubmit锛夆€濃€滈噸鏂板彂甯冿紙reclaim锛夆€濇垨鈥滅粓姝紙rejected锛夆€濄€備綘鍙寜鎻愮ず閲嶆柊鎻愪氦鍑瘉鎴栭噸鏂伴鍙栦换鍔°€?)
ON CONFLICT DO NOTHING;



-- === 022_create_notification_settings.sql ===
-- ============================================
-- 鐢ㄦ埛閫氱煡璁剧疆锛堟瘡鐢ㄦ埛涓€琛岋級
-- ============================================

CREATE TABLE IF NOT EXISTS user_notification_settings (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

  -- 鎺ㄩ€佹笭閬擄紙鍗犱綅锛氬厛瀛樺偍鍋忓ソ锛屾殏涓嶅疄闄呭彂閫侊級
  push_sms_enabled BOOLEAN NOT NULL DEFAULT false,
  push_email_enabled BOOLEAN NOT NULL DEFAULT false,

  -- 涓夌被娑堟伅寮€鍏?  community_enabled BOOLEAN NOT NULL DEFAULT true, -- 绀惧尯鍦堬細鐐硅禐/璇勮
  task_enabled BOOLEAN NOT NULL DEFAULT true,      -- 浠诲姟浜や簰锛氶鍙?鎻愪氦/瀹℃牳缁撴灉
  due_enabled BOOLEAN NOT NULL DEFAULT true,       -- 鍒版湡鎻愰啋锛?h/3h

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_user_notification_settings_updated_at ON user_notification_settings;
CREATE TRIGGER update_user_notification_settings_updated_at
  BEFORE UPDATE ON user_notification_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE user_notification_settings IS '鐢ㄦ埛閫氱煡璁剧疆锛氭笭閬撳亸濂戒笌涓夌被寮€鍏?;



-- === 023_create_notifications.sql ===
-- ============================================
-- 閫氱煡琛紙鎸夌敤鎴?绀惧尯瀛樺偍锛屾敮鎸佸凡璇?鍘婚噸锛?-- ============================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  community_id UUID, -- 鍙负绌猴細渚嬪鏈綊灞炵ぞ鍖虹殑閫氱煡

  category VARCHAR(20) NOT NULL CHECK (category IN ('community', 'task', 'due')),
  type VARCHAR(50) NOT NULL, -- 渚嬪 post_like / post_comment / task_claim / task_submit / task_approved / task_rejected / task_due_1h / event_due_1h

  title TEXT NOT NULL,
  body TEXT,
  data JSONB DEFAULT '{}'::jsonb,

  -- 鍘婚噸閿細鍚屼竴鐢ㄦ埛鍚屼竴 dedupe_key 鍙厑璁镐竴鏉★紙閬垮厤閲嶅鎻愰啋锛?  dedupe_key TEXT,

  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created_at ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_category_created_at ON notifications(user_id, category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read_at ON notifications(user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_community_id ON notifications(community_id) WHERE community_id IS NOT NULL;

-- 鍘婚噸锛氬悓 user_id + dedupe_key 鍙繚鐣?1 鏉?CREATE UNIQUE INDEX IF NOT EXISTS uniq_notifications_user_dedupe_key
  ON notifications(user_id, dedupe_key);

COMMENT ON TABLE notifications IS '绔欏唴娑堟伅閫氱煡锛堟寜鐢ㄦ埛銆佸垎绫诲瓨鍌紝鏀寔宸茶涓庡幓閲嶏級';



-- === 024_create_marketplace.sql ===
-- 绀惧尯鍟嗗煄锛氭爣绛俱€佸晢鍝併€佸浘銆佽瘎浠凤紙鎸夌ぞ鍖洪殧绂伙級

CREATE TABLE IF NOT EXISTS community_marketplace_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    color_hex VARCHAR(20) NOT NULL DEFAULT '#64748b',
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(community_id, name)
);
CREATE INDEX IF NOT EXISTS idx_cmkt_community ON community_marketplace_tags(community_id);

CREATE TABLE IF NOT EXISTS community_marketplace_listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    price NUMERIC(14, 2) NOT NULL CHECK (price >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'locked', 'sold', 'withdrawn')),
    buyer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    locked_at TIMESTAMP WITH TIME ZONE,
    sold_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cml_community_status ON community_marketplace_listings(community_id, status);
CREATE INDEX IF NOT EXISTS idx_cml_seller ON community_marketplace_listings(seller_id);
CREATE INDEX IF NOT EXISTS idx_cml_created ON community_marketplace_listings(community_id, created_at DESC);

DROP TRIGGER IF EXISTS update_cml_updated_at ON community_marketplace_listings;
CREATE TRIGGER update_cml_updated_at
    BEFORE UPDATE ON community_marketplace_listings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS community_marketplace_listing_images (
    listing_id UUID NOT NULL REFERENCES community_marketplace_listings(id) ON DELETE CASCADE,
    sort_order SMALLINT NOT NULL CHECK (sort_order >= 0 AND sort_order < 3),
    image_url TEXT NOT NULL,
    PRIMARY KEY (listing_id, sort_order)
);

CREATE TABLE IF NOT EXISTS community_marketplace_listing_tags (
    listing_id UUID NOT NULL REFERENCES community_marketplace_listings(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES community_marketplace_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (listing_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_cmlt_tag ON community_marketplace_listing_tags(tag_id);

CREATE TABLE IF NOT EXISTS community_marketplace_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    listing_id UUID NOT NULL REFERENCES community_marketplace_listings(id) ON DELETE CASCADE,
    buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating SMALLINT NOT NULL CHECK (rating >= 0 AND rating <= 5),
    content TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(listing_id)
);
CREATE INDEX IF NOT EXISTS idx_cmrev_community_created ON community_marketplace_reviews(community_id, created_at DESC);

-- 涓哄凡鏈夌ぞ鍖烘彃鍏ラ粯璁ゅ洓涓爣绛?INSERT INTO community_marketplace_tags (community_id, name, color_hex, sort_order)
SELECT c.id, t.name, t.color, t.ord
FROM communities c
CROSS JOIN (
    VALUES
        (0, '闂茬疆鐗╁搧', '#f87171'),
        (1, '鎶€鑳芥湇鍔?, '#3b82f6'),
        (2, '浠ｈ喘璺戣吙', '#eab308'),
        (3, '鐝嶈棌濂界墿', '#a855f7')
) AS t(ord, name, color)
ON CONFLICT (community_id, name) DO NOTHING;


-- === 025_community_events.sql ===
-- 绀惧尯娲诲姩锛氭棩鍘嗘爣绛俱€佹椿鍔ㄤ富浣撱€佸瓙閫夐」銆佹湡娆°€佹姤鍚?
CREATE TABLE IF NOT EXISTS community_calendar_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    color_hex VARCHAR(20) NOT NULL DEFAULT '#64748b',
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(community_id, name)
);
CREATE INDEX IF NOT EXISTS idx_cct_community ON community_calendar_tags(community_id);

CREATE TABLE IF NOT EXISTS community_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind VARCHAR(20) NOT NULL CHECK (kind IN ('single', 'composite', 'pack')),
    title VARCHAR(300) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    tag_id UUID REFERENCES community_calendar_tags(id) ON DELETE SET NULL,
    note_enabled BOOLEAN NOT NULL DEFAULT false,
    is_pinned BOOLEAN NOT NULL DEFAULT false,
    registration_start TIMESTAMP WITH TIME ZONE NOT NULL,
    registration_end TIMESTAMP WITH TIME ZONE NOT NULL,
    -- 鎶ュ悕浠樿垂鏃?Semi 杞处鐩爣锛堝彲涓庡彂甯冧汉涓嶅悓锛?    payment_address VARCHAR(256) NOT NULL DEFAULT '',
    pack_frequency VARCHAR(20) CHECK (pack_frequency IS NULL OR pack_frequency IN ('daily', 'weekly', 'custom')),
    pack_custom_weekdays SMALLINT[],
    pack_range_start DATE,
    pack_range_end DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ce_community ON community_events(community_id);
CREATE INDEX IF NOT EXISTS idx_ce_pinned ON community_events(community_id, is_pinned);

DROP TRIGGER IF EXISTS update_ce_updated_at ON community_events;
CREATE TRIGGER update_ce_updated_at
    BEFORE UPDATE ON community_events
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS community_event_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES community_events(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL DEFAULT '',
    price NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (price >= 0),
    sort_order INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_ceo_event ON community_event_options(event_id);

CREATE TABLE IF NOT EXISTS community_event_occurrences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES community_events(id) ON DELETE CASCADE,
    sequence_no INT NOT NULL,
    activity_start TIMESTAMP WITH TIME ZONE NOT NULL,
    activity_end TIMESTAMP WITH TIME ZONE NOT NULL,
    UNIQUE(event_id, sequence_no)
);
CREATE INDEX IF NOT EXISTS idx_ceo_ev ON community_event_occurrences(event_id);

CREATE TABLE IF NOT EXISTS community_event_participations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    occurrence_id UUID NOT NULL REFERENCES community_event_occurrences(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    option_id UUID REFERENCES community_event_options(id) ON DELETE SET NULL,
    remark TEXT NOT NULL DEFAULT '',
    status VARCHAR(20) NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(occurrence_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_cep_occ ON community_event_participations(occurrence_id);
CREATE INDEX IF NOT EXISTS idx_cep_user ON community_event_participations(user_id);

-- 榛樿鏃ュ巻鏍囩
INSERT INTO community_calendar_tags (community_id, name, color_hex, sort_order)
SELECT c.id, t.name, t.color, t.ord
FROM communities c
CROSS JOIN (
    VALUES
        (0, '鎴峰娲诲姩', '#f87171'),
        (1, '璇剧▼', '#3b82f6'),
        (2, '璁插骇', '#a855f7'),
        (3, '鑱氫細', '#eab308')
) AS t(ord, name, color)
ON CONFLICT (community_id, name) DO NOTHING;


-- === 026_community_events_pinned_at.sql ===
ALTER TABLE community_events ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ;


-- === 027_tags_archived.sql ===
ALTER TABLE community_marketplace_tags ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE community_calendar_tags ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false;


-- === 028_fix_notification_dedupe_index.sql ===
DROP INDEX IF EXISTS uniq_notifications_user_dedupe_key;
CREATE UNIQUE INDEX uniq_notifications_user_dedupe_key ON notifications(user_id, dedupe_key);


-- === 029_occurrence_registration_times.sql ===
ALTER TABLE community_event_occurrences
  ADD COLUMN IF NOT EXISTS registration_start TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS registration_end TIMESTAMP WITH TIME ZONE;



