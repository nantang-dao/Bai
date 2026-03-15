# Supabase 数据库迁移步骤

## 📋 迁移前准备

### 1. 备份现有数据（如果数据库已有数据）

在 Supabase Dashboard → Database → Backups 中创建备份，或使用 SQL：

```sql
-- 导出所有表数据（可选，如果需要备份）
-- 在 Supabase Dashboard → SQL Editor 中执行
```

### 2. 检查当前表结构

在 Supabase SQL Editor 中执行以下查询，查看当前有哪些表：

```sql
-- 查看所有表
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

## 🚀 执行迁移（两种方式）

### 方式 1: 在 Supabase Dashboard 中执行（推荐）

#### 步骤：

1. **登录 Supabase Dashboard**
   - 访问 [https://app.supabase.com](https://app.supabase.com)
   - 选择你的项目

2. **打开 SQL Editor**
   - 点击左侧菜单的 **SQL Editor**
   - 点击 **New query**

3. **按顺序执行迁移文件**

   **⚠️ 重要：必须按顺序执行，因为存在外键依赖！**

   #### 步骤 3.1: 执行 001_create_users_table.sql
   - 复制 `001_create_users_table.sql` 的全部内容
   - 粘贴到 SQL Editor
   - 点击 **Run** 或按 `Ctrl+Enter` (Windows) / `Cmd+Enter` (Mac)
   - 确认执行成功（应该看到 "Success. No rows returned"）

   #### 步骤 3.2: 执行 002_create_auth_tokens_table.sql
   - 清空 SQL Editor（或新建查询）
   - 复制 `002_create_auth_tokens_table.sql` 的全部内容
   - 粘贴并执行

   #### 步骤 3.3: 执行 003_create_verification_tokens_table.sql
   - 清空 SQL Editor
   - 复制 `003_create_verification_tokens_table.sql` 的全部内容
   - 粘贴并执行

   #### 步骤 3.4: 执行 004_create_task_info_table.sql
   - 清空 SQL Editor
   - 复制 `004_create_task_info_table.sql` 的全部内容
   - 粘贴并执行

   #### 步骤 3.5: 执行 005_create_tasks_table.sql
   - 清空 SQL Editor
   - 复制 `005_create_tasks_table.sql` 的全部内容
   - 粘贴并执行

4. **验证迁移结果**

   执行以下查询检查所有表是否创建成功：

   ```sql
   -- 检查所有表
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
     AND table_type = 'BASE TABLE'
   ORDER BY table_name;
   
   -- 应该看到：
   -- auth_tokens
   -- task_info
   -- tasks
   -- users
   -- verification_tokens
   ```

### 方式 2: 使用 Supabase CLI（高级用户）

如果你安装了 Supabase CLI：

```bash
# 1. 登录 Supabase
supabase login

# 2. 链接到你的项目
supabase link --project-ref your-project-ref

# 3. 执行迁移
supabase db push
```

## ✅ 验证迁移

### 1. 检查所有表是否存在

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

### 2. 检查 tasks 表的所有字段

```sql
-- 查看 tasks 表的所有字段（详细）
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'tasks'
ORDER BY ordinal_position;
```

### 3. 检查 tasks 表的索引

```sql
-- 查看 tasks 表的所有索引
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public' 
  AND tablename = 'tasks'
ORDER BY indexname;
```

### 4. 检查外键约束

```sql
-- 查看 tasks 表的外键约束
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'tasks';
```

### 5. 检查 timeline 字段是否存在

```sql
-- 检查 timeline 字段
SELECT 
    column_name,
    data_type,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'tasks'
  AND column_name = 'timeline';
```

**预期结果**：
- `column_name`: `timeline`
- `data_type`: `jsonb`
- `column_default`: `'[]'::jsonb`

## 🔧 常见问题

### Q1: 如果表已存在怎么办？

如果表已存在，`CREATE TABLE IF NOT EXISTS` 不会报错，但**不会更新现有表结构**。

**解决方案**：
1. 如果表结构不同，需要手动迁移数据
2. 或者先删除旧表（⚠️ 会丢失数据！）：

```sql
-- ⚠️ 警告：这会删除表及其所有数据！
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS task_info CASCADE;
DROP TABLE IF EXISTS auth_tokens CASCADE;
DROP TABLE IF EXISTS verification_tokens CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 然后重新执行迁移文件
```

### Q2: 如果执行失败怎么办？

1. **查看错误信息**：SQL Editor 会显示具体错误
2. **检查依赖关系**：确保按顺序执行（001 → 005）
3. **检查权限**：确保有创建表的权限
4. **检查语法**：确保 SQL 语法正确

### Q3: 如何回滚迁移？

如果需要回滚，可以删除所有表：

```sql
-- ⚠️ 警告：这会删除所有表和数据！
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS task_info CASCADE;
DROP TABLE IF EXISTS auth_tokens CASCADE;
DROP TABLE IF EXISTS verification_tokens CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 删除函数（如果不再需要）
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
```

## 📝 迁移后检查清单

- [ ] 所有 5 个表都已创建
- [ ] tasks 表包含 `timeline` 字段（类型：jsonb）
- [ ] 所有外键约束正确
- [ ] 所有索引已创建
- [ ] 触发器已创建（updated_at 自动更新）
- [ ] 可以正常插入测试数据

## 🎯 测试插入数据

迁移完成后，可以测试插入数据：

```sql
-- 1. 创建测试用户
INSERT INTO users (phone, name) 
VALUES ('+1234567890', '测试用户')
RETURNING id;

-- 2. 创建任务信息
INSERT INTO task_info (title, description, start_date, deadline, creator_id)
VALUES (
    '测试任务',
    '这是一个测试任务',
    NOW(),
    NOW() + INTERVAL '7 days',
    (SELECT id FROM users LIMIT 1)
)
RETURNING id;

-- 3. 创建任务
INSERT INTO tasks (task_info_id, creator_id, reward, status, timeline)
VALUES (
    (SELECT id FROM task_info LIMIT 1),
    (SELECT id FROM users LIMIT 1),
    100.00,
    'unclaimed',
    '[{"status": "unclaimed", "timestamp": "' || NOW()::text || '"}]'::jsonb
)
RETURNING id, timeline;
```

---

**最后更新**：2026-01-15
