# 创建 Supabase Storage 存储桶

## 问题说明

应用需要以下两个存储桶来存储文件：
- `avatars` - 用户头像
- `task-proofs` - 任务凭证文件

## 创建方法

### 方法 1: 使用 Supabase Dashboard（推荐）

1. **登录 Supabase Dashboard**
   - 访问 [https://app.supabase.com](https://app.supabase.com)
   - 选择你的项目

2. **打开 Storage**
   - 点击左侧菜单的 **Storage**
   - 点击 **New bucket** 按钮

3. **创建 avatars 存储桶**
   - Bucket name: `avatars`
   - Public bucket: ✅ **勾选**（头像需要公开访问）
   - File size limit: `5 MB`（可选）
   - Allowed MIME types: `image/*`（可选）
   - 点击 **Create bucket**

4. **创建 task-proofs 存储桶**
   - Bucket name: `task-proofs`
   - Public bucket: ⚠️ **根据需求决定**（如果凭证需要公开访问则勾选，否则不勾选）
   - File size limit: `10 MB`（可选）
   - Allowed MIME types: `image/*,application/pdf`（可选）
   - 点击 **Create bucket**

### 方法 2: 使用 Supabase SQL Editor

在 Supabase Dashboard 的 SQL Editor 中执行以下 SQL：

```sql
-- 创建 avatars 存储桶（公开）
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880,  -- 5MB in bytes
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 创建 task-proofs 存储桶（私有，需要认证）
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'task-proofs',
  'task-proofs',
  false,  -- 私有存储桶，需要认证才能访问
  10485760,  -- 10MB in bytes
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;
```

### 方法 3: 使用 Supabase CLI

```bash
# 创建 avatars 存储桶
supabase storage create avatars --public

# 创建 task-proofs 存储桶（私有）
supabase storage create task-proofs
```

## 设置存储桶策略（可选）

如果需要更细粒度的访问控制，可以在 Supabase Dashboard 的 Storage → Policies 中设置：

### avatars 存储桶策略

```sql
-- 允许所有人读取
CREATE POLICY "Public Access" ON storage.objects
FOR SELECT
USING (bucket_id = 'avatars');

-- 允许认证用户上传
CREATE POLICY "Authenticated users can upload avatars" ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.role() = 'authenticated'
);

-- 允许用户更新自己的头像
CREATE POLICY "Users can update own avatars" ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```

### task-proofs 存储桶策略

```sql
-- 允许认证用户读取
CREATE POLICY "Authenticated users can read proofs" ON storage.objects
FOR SELECT
USING (
  bucket_id = 'task-proofs' 
  AND auth.role() = 'authenticated'
);

-- 允许认证用户上传
CREATE POLICY "Authenticated users can upload proofs" ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'task-proofs' 
  AND auth.role() = 'authenticated'
);
```

## 验证

创建完成后，可以通过以下方式验证：

1. **在 Dashboard 中查看**
   - 进入 Storage 页面
   - 应该能看到 `avatars` 和 `task-proofs` 两个存储桶

2. **通过 SQL 查询**
   ```sql
   SELECT * FROM storage.buckets;
   ```

3. **测试上传**
   - 尝试通过应用上传头像
   - 检查是否成功

## 注意事项

- **公共 vs 私有**：`avatars` 通常设置为公开，`task-proofs` 根据需求决定
- **文件大小限制**：建议设置合理的限制，避免存储空间浪费
- **MIME 类型限制**：可以限制允许的文件类型，提高安全性
- **存储策略**：根据应用需求设置合适的访问策略

---

**最后更新**：2026-01-16

