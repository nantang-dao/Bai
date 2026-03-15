# Supabase 数据库迁移执行指南

## 方法 1: 使用 Supabase Dashboard（推荐，最简单）

### 步骤 1: 登录 Supabase Dashboard
1. 访问 [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. 登录你的账户
3. 选择你的项目

### 步骤 2: 打开 SQL Editor
1. 在左侧菜单中，点击 **SQL Editor**
2. 点击 **New query** 创建新查询

### 步骤 3: 执行迁移文件
1. 打开文件 `mycoseed-backend/db/migrations/013_refactor_multi_participant_tasks.sql`
2. 复制整个文件内容
3. 粘贴到 SQL Editor 中
4. 点击 **Run** 或按 `Ctrl+Enter` (Windows) / `Cmd+Enter` (Mac)

### 步骤 4: 验证迁移结果
1. 在左侧菜单中，点击 **Table Editor**
2. 检查以下表是否存在：
   - ✅ `task_info` 表（新表）
   - ✅ `tasks` 表（应该有新字段：`task_info_id`, `claimer_id`, `currency`, `weight_coefficient`, `participant_index`）
   - ❌ `task_claims` 表（应该已删除）

---

## 方法 2: 使用 Supabase CLI（适合命令行用户）

### 步骤 1: 安装 Supabase CLI

#### Windows (使用 Scoop)
```powershell
# 安装 Scoop（如果还没有）
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
irm get.scoop.sh | iex

# 安装 Supabase CLI
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

#### Windows (使用 npm)
```powershell
npm install -g supabase
```

#### Mac (使用 Homebrew)
```bash
brew install supabase/tap/supabase
```

#### Linux
```bash
# 下载最新版本
wget -qO- https://github.com/supabase/cli/releases/latest/download/supabase_windows_amd64.zip | unzip -q - -d /usr/local/bin
```

### 步骤 2: 登录 Supabase CLI
```powershell
# Windows PowerShell
supabase login
```

这会打开浏览器，让你登录 Supabase 账户。

### 步骤 3: 初始化 Supabase 项目（如果还没有）

如果你的项目还没有 Supabase CLI 配置，需要先初始化：

```powershell
# 在项目根目录执行
cd mycoseed-backend
supabase init
```

这会创建 `.supabase` 文件夹和 `supabase/config.toml` 配置文件。

### 步骤 4: 链接到远程 Supabase 项目

```powershell
# 获取你的项目引用 ID（在 Supabase Dashboard 的 Settings > General 中）
supabase link --project-ref your-project-ref-id
```

**如何获取 project-ref-id：**
1. 在 Supabase Dashboard 中，进入 **Settings** > **General**
2. 找到 **Reference ID**，复制它

### 步骤 5: 创建迁移文件（如果还没有）

迁移文件应该已经在 `db/migrations/013_refactor_multi_participant_tasks.sql`。

如果 Supabase CLI 需要特定格式，可以这样创建：

```powershell
# 创建新的迁移文件（Supabase CLI 会自动生成时间戳）
supabase migration new refactor_multi_participant_tasks
```

然后将 `013_refactor_multi_participant_tasks.sql` 的内容复制到新创建的文件中。

### 步骤 6: 推送迁移到远程数据库

```powershell
# 推送所有迁移文件到远程数据库
supabase db push
```

或者只推送特定迁移：

```powershell
# 查看待推送的迁移
supabase migration list

# 推送迁移
supabase db push
```

### 步骤 7: 验证迁移结果

```powershell
# 查看数据库状态
supabase db remote commit

# 或者直接在 Dashboard 中查看表结构
```

---

## 方法 3: 手动执行 SQL（如果上述方法都不行）

### 步骤 1: 打开 Supabase Dashboard SQL Editor

### 步骤 2: 分段执行迁移

如果一次性执行整个迁移文件遇到问题，可以分段执行：

#### 第一部分：创建 task_info 表
```sql
-- 创建 task_info 表
CREATE TABLE IF NOT EXISTS task_info (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    activity_id INTEGER DEFAULT 0,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    deadline TIMESTAMP WITH TIME ZONE NOT NULL,
    submit_deadline TIMESTAMP WITH TIME ZONE,
    participant_limit INTEGER,
    reward_distribution_mode VARCHAR(20) DEFAULT 'per_person',
    proof_config JSONB,
    submission_instructions TEXT,
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_task_info_creator_id ON task_info(creator_id);
CREATE INDEX IF NOT EXISTS idx_task_info_activity_id ON task_info(activity_id);
CREATE INDEX IF NOT EXISTS idx_task_info_created_at ON task_info(created_at DESC);
```

#### 第二部分：修改 tasks 表
```sql
-- 添加新字段
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS task_info_id UUID REFERENCES task_info(id) ON DELETE CASCADE;

ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS claimer_id UUID REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'ETH'
CHECK (currency IN ('ETH', 'NT', 'USDT', 'USDC', 'DAI'));

ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS weight_coefficient NUMERIC(5,2) DEFAULT 1.0;

ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS participant_index INTEGER DEFAULT 1;
```

#### 第三部分：删除旧字段（谨慎！）
```sql
-- 注意：这会删除数据，确保已迁移到 task_info 表
ALTER TABLE tasks
DROP COLUMN IF EXISTS title,
DROP COLUMN IF EXISTS description,
DROP COLUMN IF EXISTS activity_id,
DROP COLUMN IF EXISTS start_date,
DROP COLUMN IF EXISTS deadline,
DROP COLUMN IF EXISTS submit_deadline,
DROP COLUMN IF EXISTS participant_limit,
DROP COLUMN IF EXISTS reward_distribution_mode,
DROP COLUMN IF EXISTS proof_config,
DROP COLUMN IF EXISTS submission_instructions;
```

#### 第四部分：删除 task_claims 表
```sql
DROP TABLE IF EXISTS task_claims CASCADE;
```

---

## 验证迁移是否成功

执行以下 SQL 查询来验证：

```sql
-- 1. 检查 task_info 表是否存在
SELECT * FROM information_schema.tables 
WHERE table_name = 'task_info';

-- 2. 检查 tasks 表的新字段
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'tasks' 
AND column_name IN ('task_info_id', 'claimer_id', 'currency', 'weight_coefficient', 'participant_index');

-- 3. 检查 task_claims 表是否已删除
SELECT * FROM information_schema.tables 
WHERE table_name = 'task_claims';
-- 应该返回 0 行

-- 4. 查看 tasks 表的当前结构
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'tasks'
ORDER BY ordinal_position;
```

---

## 常见问题

### Q: 迁移执行失败，提示外键约束错误
**A:** 确保 `users` 表已存在，并且 `creator_id` 和 `claimer_id` 引用的用户 ID 是有效的 UUID。

### Q: 迁移执行失败，提示列已存在
**A:** 使用 `IF NOT EXISTS` 或 `IF EXISTS` 来避免重复创建/删除。

### Q: 如何回滚迁移？
**A:** 在 Supabase Dashboard 的 SQL Editor 中执行回滚 SQL，或者使用 `supabase migration repair` 命令。

### Q: 迁移后现有数据会丢失吗？
**A:** 迁移脚本包含数据迁移逻辑，但建议先备份数据库。可以在 Dashboard 的 Settings > Database > Backups 中创建备份。

---

## 推荐流程

1. **备份数据库**（在 Dashboard 中）
2. **使用方法 1（Dashboard）**执行迁移（最简单）
3. **验证迁移结果**（使用验证 SQL）
4. **测试应用**（确保功能正常）

如果遇到问题，告诉我具体的错误信息，我会帮你解决！
