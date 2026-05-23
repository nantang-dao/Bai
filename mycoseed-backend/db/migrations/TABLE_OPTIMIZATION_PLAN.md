# Tasks 表优化分表方案

## 📊 当前问题分析

### 当前 tasks 表包含的字段：
1. **核心字段**（小，频繁查询）：
   - id, task_info_id, creator_id, claimer_id
   - reward, currency, weight_coefficient, participant_index
   - status, is_claimed, allow_repeat_claim
   - created_at, updated_at

2. **大字段**（大，不常查询）：
   - `timeline` (JSONB) - 可能很大，包含所有状态变更历史
   - `proof` (TEXT) - 凭证内容，可能很长

3. **审核相关字段**（中等，按需查询）：
   - reject_reason, reject_option
   - discount, discount_reason

4. **时间戳字段**（小，频繁查询）：
   - claimed_at, submitted_at, completed_at

### 性能瓶颈：
- **timeline** 字段是 JSONB 数组，随着状态变更会不断增长，影响查询性能
- **proof** 字段可能包含大量文本或 JSON，影响主表查询速度
- 所有字段在一个表中，即使只需要基本信息也要加载所有字段

---

## 🎯 优化方案：三表分离

### 方案概述

将 tasks 表拆分为 3 个表：

1. **`tasks`** - 核心表（保留最常查询的小字段）
2. **`task_timelines`** - 时间线表（存储 timeline JSONB）
3. **`task_proofs`** - 凭证表（存储 proof 和审核相关字段）

### 表结构设计

#### 1. `tasks` 表（核心表）
**用途**：存储任务的核心信息，用于快速查询和列表展示

**字段**：
- `id` (UUID, PK)
- `task_info_id` (UUID, FK → task_info)
- `creator_id` (UUID, FK → users)
- `claimer_id` (UUID, FK → users, nullable)
- `reward` (NUMERIC)
- `currency` (VARCHAR)
- `weight_coefficient` (NUMERIC)
- `participant_index` (INTEGER)
- `status` (TEXT)
- `is_claimed` (BOOLEAN)
- `allow_repeat_claim` (BOOLEAN)
- `claimed_at` (TIMESTAMPTZ)
- `submitted_at` (TIMESTAMPTZ)
- `completed_at` (TIMESTAMPTZ)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

**特点**：
- ✅ 只包含小字段，查询速度快
- ✅ 列表查询时不需要 JOIN 其他表
- ✅ 索引优化，支持快速筛选和排序

---

#### 2. `task_timelines` 表（时间线表）
**用途**：存储任务的时间线历史，按需加载

**字段**：
- `id` (UUID, PK)
- `task_id` (UUID, FK → tasks, UNIQUE) - 一对一关系
- `timeline` (JSONB, DEFAULT '[]'::jsonb)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

**特点**：
- ✅ 大字段分离，不影响主表查询
- ✅ 一对一关系，通过 task_id 关联
- ✅ 使用 GIN 索引优化 JSONB 查询
- ✅ 按需加载，不需要时间线时不查询

---

#### 3. `task_proofs` 表（凭证表）
**用途**：存储任务凭证和审核相关信息

**字段**：
- `id` (UUID, PK)
- `task_id` (UUID, FK → tasks, UNIQUE) - 一对一关系
- `proof` (TEXT) - 完成凭证
- `reject_reason` (TEXT) - 驳回理由
- `reject_option` (TEXT) - 驳回选项
- `discount` (NUMERIC) - 打折百分数
- `discount_reason` (TEXT) - 打折理由
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

**特点**：
- ✅ 大字段分离，不影响主表查询
- ✅ 一对一关系，通过 task_id 关联
- ✅ 只在查看详情或审核时加载
- ✅ 可以独立索引和优化

---

## 📈 性能提升预期

### 查询性能提升：

1. **列表查询**（最常见）：
   - **之前**：需要加载所有字段，包括 timeline 和 proof
   - **之后**：只查询 tasks 表，速度快 3-5 倍

2. **详情查询**：
   - **之前**：一次性加载所有字段
   - **之后**：按需 JOIN，只加载需要的表

3. **时间线查询**：
   - **之前**：每次查询都要加载整个 timeline JSONB
   - **之后**：独立表，可以优化 JSONB 查询

4. **存储优化**：
   - **之前**：所有数据在一个表，索引大
   - **之后**：分离后，每个表的索引更小，查询更快

---

## 🔄 数据迁移策略

### 迁移步骤：

1. **创建新表结构**：
   - 创建 `task_timelines` 表
   - 创建 `task_proofs` 表
   - 修改 `tasks` 表（删除 timeline, proof 等字段）

2. **数据迁移**：
   - 从旧 `tasks` 表复制数据到新表
   - 将 timeline 数据迁移到 `task_timelines`
   - 将 proof 等数据迁移到 `task_proofs`

3. **验证数据完整性**：
   - 检查所有数据是否迁移成功
   - 验证外键关系

4. **删除旧表**：
   - 删除旧的 `tasks` 表
   - 重命名新表为 `tasks`

---

## ⚠️ 注意事项

### 优点：
- ✅ 查询性能显著提升
- ✅ 表结构更清晰，易于维护
- ✅ 可以独立优化每个表
- ✅ 支持按需加载，减少内存占用

### 缺点：
- ⚠️ 需要修改后端代码（JOIN 查询）
- ⚠️ 迁移过程需要停机或使用双写策略
- ⚠️ 增加了表数量，但查询逻辑更复杂

### 建议：
- ✅ 先备份数据
- ✅ 在测试环境验证
- ✅ 逐步迁移，确保数据完整性
- ✅ 更新后端代码以支持新表结构

---

## 📝 实施计划

### Phase 1: 准备阶段
1. 创建新的迁移文件
2. 备份现有数据
3. 在测试环境验证

### Phase 2: 迁移阶段
1. 创建新表结构
2. 迁移数据
3. 验证数据完整性

### Phase 3: 代码更新
1. 更新后端查询逻辑
2. 更新前端数据映射
3. 测试所有功能

### Phase 4: 清理阶段
1. 删除旧表
2. 清理临时数据
3. 性能监控

---

## ❓ 确认问题

请确认以下问题：

1. **是否同意此分表方案？**
   - [ ] 同意，继续执行
   - [ ] 需要修改方案

2. **迁移时机**：
   - [ ] 立即迁移（需要停机）
   - [ ] 等待合适时机

3. **数据备份**：
   - [ ] 已备份
   - [ ] 需要我提供备份脚本

---

**如果同意，我将创建新的迁移文件并执行迁移。**
