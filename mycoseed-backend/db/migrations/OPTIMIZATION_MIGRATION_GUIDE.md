# Tasks 表优化迁移指南

## 📋 优化内容总结

### 删除的字段：
1. ❌ `claimed_at` - 删除（多次领取会混淆，timeline 已记录）
2. ❌ `submitted_at` - 删除（多次提交会混淆，timeline 已记录）
3. ❌ `allow_repeat_claim` - 删除（任务总是可以重复领取和提交）
4. ❌ `timeline` - 移到 `task_timelines` 表
5. ❌ `proof` - 移到 `task_proofs` 表
6. ❌ `reject_reason` - 移到 `task_proofs` 表
7. ❌ `reject_option` - 移到 `task_proofs` 表
8. ❌ `discount` - 移到 `task_proofs` 表
9. ❌ `discount_reason` - 移到 `task_proofs` 表

### 保留的字段（tasks 核心表）：
- ✅ `id`, `task_info_id`, `creator_id`, `claimer_id`
- ✅ `reward`, `currency`, `weight_coefficient`, `participant_index`
- ✅ `status`, `is_claimed`
- ✅ `completed_at`, `created_at`, `updated_at`

### 新增的表：
1. ✅ `task_timelines` - 存储 timeline JSONB
2. ✅ `task_proofs` - 存储 proof 和审核相关字段

---

## 🚀 迁移步骤

### 步骤 1: 备份数据（重要！）

```sql
-- 在 Supabase SQL Editor 中执行
-- 导出 tasks 表数据（可选）
```

### 步骤 2: 创建新表

按顺序执行：

1. **006_create_task_timelines_table.sql** - 创建时间线表
2. **007_create_task_proofs_table.sql** - 创建凭证表

### 步骤 3: 执行迁移

执行 **008_refactor_tasks_table_optimized.sql** - 这会：
- 创建新的优化后的 tasks 表
- 迁移现有数据
- 删除旧表
- 重命名新表

### 步骤 4: 验证迁移

```sql
-- 检查 tasks 表字段
SELECT column_name 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'tasks'
ORDER BY ordinal_position;

-- 检查 task_timelines 表
SELECT COUNT(*) FROM task_timelines;

-- 检查 task_proofs 表
SELECT COUNT(*) FROM task_proofs;

-- 验证数据完整性
SELECT 
    (SELECT COUNT(*) FROM tasks) as tasks_count,
    (SELECT COUNT(*) FROM task_timelines) as timelines_count,
    (SELECT COUNT(*) FROM task_proofs) as proofs_count;
```

---

## ⚠️ 重要提示

1. **数据备份**：迁移前务必备份数据
2. **停机时间**：迁移过程需要短暂停机（约 1-5 分钟，取决于数据量）
3. **代码更新**：迁移后需要更新后端代码以支持新表结构
4. **测试验证**：在测试环境先验证迁移过程

---

## 📝 迁移后需要更新的代码

### 后端代码需要更新：

1. **查询逻辑**：
   - 列表查询：只查询 `tasks` 表
   - 详情查询：JOIN `task_timelines` 和 `task_proofs` 表

2. **时间线操作**：
   - 从 `tasks.timeline` 改为 `task_timelines.timeline`

3. **凭证操作**：
   - 从 `tasks.proof` 改为 `task_proofs.proof`

4. **删除的字段**：
   - 移除所有 `claimed_at` 和 `submitted_at` 的引用
   - 移除 `allow_repeat_claim` 的引用
   - 从 timeline 中获取领取和提交时间

---

## ✅ 迁移检查清单

- [ ] 已备份数据
- [ ] 已创建 `task_timelines` 表
- [ ] 已创建 `task_proofs` 表
- [ ] 已执行迁移脚本
- [ ] 已验证数据完整性
- [ ] 已更新后端代码
- [ ] 已测试所有功能

---

**最后更新**：2026-01-15
