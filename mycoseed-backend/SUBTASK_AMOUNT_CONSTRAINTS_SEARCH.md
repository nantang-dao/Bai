# 后端子任务金额约束相关代码搜索结果

## 📋 总结

**当前发现的关键问题：**
- ❌ **未找到**对"子任务总金额不超过任务池总激励"的验证逻辑
- ❌ **未找到**对 `max_amount_nt` 字段的约束验证（仅有存储和读取）
- ❌ **未找到**`planned_lock_nt` 与子任务金额总和的校验
- ✅ **已有**子任务的基础金额字段和商城同步逻辑
- ✅ **已有**参与者限制 (`participant_limit`) 的处理

---

## 1️⃣ 类型定义与数据结构

### 1.1 子任务草稿定义 (`src/types/task.ts`)

**位置：** [src/types/task.ts](src/types/task.ts#L194-L208)

```typescript
/** 子任务草稿行 */
export interface TaskSubtaskDraft {
    id: string
    taskInfoId: string
    subtaskUuid: string
    title: string
    sortOrder: number
    maxAmountNt?: number | null           // ⚠️ 子任务最大金额（未验证）
    description?: string
    submissionInstructions?: string
    proofConfig?: any
    participantLimit?: number | null      // ✅ 参与者限制
    rewardNt?: number | null              // ⚠️ 子任务奖励（未验证）
    submitDeadlineOverride?: string | null
    createdAt?: string
    updatedAt?: string
}
```

### 1.2 任务信息类型 (`src/types/task.ts`)

**位置：** [src/types/task.ts](src/types/task.ts#L44-L75)

```typescript
export interface TaskInfo {
    // ...
    /** 计划锁入池的 NT 总额（预留校验）*/
    plannedLockNt?: number | null         // ⚠️ 总池激励（无校验）
    taskpoolPhase?: TaskpoolPhase
    // ...
    subtasksFinalized?: boolean           // ✅ 子任务定稿标记
}
```

### 1.3 任务行类型 (`src/types/task.ts`)

**位置：** [src/types/task.ts](src/types/task.ts#L120-L145)

```typescript
export interface Task {
    // ...
    reward: number                        // 奖励金额
    // ...
    /** 商城任务行语义 */
    listingKind?: TaskListingKind         // 'standard' | 'taskpool_pool' | 'taskpool_subtask'
    /** 子任务可领行时关联 task_subtasks.id */
    poolSubtaskId?: string | null         // ⚠️ 指向对应之任务
}
```

---

## 2️⃣ 子任务管理接口 (Controller)

### 2.1 创建子任务 (`src/controllers/taskInfoController.ts`)

**位置：** [src/controllers/taskInfoController.ts](src/controllers/taskInfoController.ts#L199-L260)

```typescript
export const createSubtask = async (req: AuthRequest, res: Response) => {
  // ...
  const {
    title,
    sortOrder,
    maxAmountNt,            // ⚠️ 接收 maxAmountNt 但无金额约束验证
    subtaskUuid,
    description,
    submissionInstructions,
    proofConfig,
    participantLimit,
    rewardNt,               // ⚠️ 接收 rewardNt 但无验证
    submitDeadlineOverride,
  } = req.body || {}

  const row: Record<string, unknown> = {
    task_info_id: taskInfoId,
    title: typeof title === 'string' ? title : '子任务',
    sort_order: typeof sortOrder === 'number' ? sortOrder : 0
  }

  if (subtaskUuid) row.subtask_uuid = subtaskUuid

  // ⚠️ 仅做数字验证，无金额上限约束
  if (maxAmountNt != null && !Number.isNaN(Number(maxAmountNt))) {
    row.max_amount_nt = Number(maxAmountNt)
  }

  // ✅ 参与者限制存储
  if (participantLimit != null && !Number.isNaN(Number(participantLimit))) 
    row.participant_limit = Number(participantLimit)

  // ⚠️ 奖励存储但无验证
  if (rewardNt != null && !Number.isNaN(Number(rewardNt))) 
    row.reward_nt = Number(rewardNt)

  // ... 插入数据库
}
```

**问题分析：**
- ❌ 无检查：`maxAmountNt` 是否超过 `planned_lock_nt`
- ❌ 无检查：`maxAmountNt` 与同任务其他子任务总和是否超限
- ❌ 无检查：`rewardNt` 的有效性

### 2.2 修改子任务 (`src/controllers/taskInfoController.ts`)

**位置：** [src/controllers/taskInfoController.ts](src/controllers/taskInfoController.ts#L260-L310)

```typescript
export const patchSubtask = async (req: AuthRequest, res: Response) => {
  // ...
  const body = req.body || {}
  const patch: Record<string, unknown> = {}

  if (typeof body.title === 'string') patch.title = body.title
  if (typeof body.sortOrder === 'number') patch.sort_order = body.sortOrder

  // ⚠️ 仅做数字验证，无金额约束检查
  if (body.maxAmountNt != null && !Number.isNaN(Number(body.maxAmountNt))) 
    patch.max_amount_nt = Number(body.maxAmountNt)

  if (typeof body.description === 'string') patch.description = body.description
  if (typeof body.submissionInstructions === 'string') 
    patch.submission_instructions = body.submissionInstructions
  if (body.proofConfig !== undefined) patch.proof_config = body.proofConfig

  // ✅ 参与者限制修改
  if (body.participantLimit != null && !Number.isNaN(Number(body.participantLimit))) 
    patch.participant_limit = Number(body.participantLimit)

  // ⚠️ 奖励修改但无验证
  if (body.rewardNt != null && !Number.isNaN(Number(body.rewardNt))) 
    patch.reward_nt = Number(body.rewardNt)

  // ... 更新数据库
}
```

**问题分析：** 与 `createSubtask` 同样的问题

### 2.3 定稿子任务 (`src/controllers/taskInfoController.ts`)

**位置：** [src/controllers/taskInfoController.ts](src/controllers/taskInfoController.ts#L350-L390)

```typescript
export const finalizeSubtasks = async (req: AuthRequest, res: Response) => {
  try {
    const { taskInfoId } = req.params
    const userId = req.user?.id

    if (!userId) return res.status(401).json({ error: '未授权' })

    const gate = await loadTaskInfoForSubtasks(taskInfoId)
    if (!gate.ok) return res.status(gate.status).json({ error: gate.error })
    if (!canWriteSubtasks(userId, gate.taskInfo)) {
      return res.status(403).json({ error: '仅 Manager 可定稿子任务' })
    }
    if (gate.taskInfo.subtasks_finalized) {
      return res.status(400).json({ error: '子任务已定稿，不可重复定稿' })
    }

    // ❌ 定稿前未验证子任务金额总和是否超过 planned_lock_nt
    const { error } = await supabase
      .from('task_info')
      .update({ subtasks_finalized: true })
      .eq('id', taskInfoId)

    if (error) throw error

    // 定稿后调用商城同步
    let mallSync: Awaited<ReturnType<typeof ensureTaskpoolPoolPrimaryListing>> | undefined
    let subtaskMallSync: Awaited<ReturnType<typeof ensureSubtaskMallListings>> | undefined
    if (gate.taskInfo.use_taskpool) {
      try {
        mallSync = await ensureTaskpoolPoolPrimaryListing(taskInfoId)
        subtaskMallSync = await ensureSubtaskMallListings(taskInfoId)  // ⚠️ 见下文
      } catch (me: any) {
        console.error('[finalizeSubtasks] mall sync', me)
        return res.status(500).json({ error: me?.message || '定稿成功但商城同步失败' })
      }
    }
    res.json({ ok: true, mallSync, subtaskMallSync })
  } catch (e: any) {
    console.error('[finalizeSubtasks]', e)
    res.status(500).json({ error: e?.message || '定稿失败' })
  }
}
```

**问题分析：**
- ❌ **关键缺失**：定稿前应验证所有子任务的 `max_amount_nt` 总和是否超过 `planned_lock_nt`

### 2.4 PATCH 任务池草稿 (`src/controllers/taskInfoController.ts`)

**位置：** [src/controllers/taskInfoController.ts](src/controllers/taskInfoController.ts#L751-L890)

```typescript
export const patchTaskPoolDraft = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ error: '未授权' })
    const { taskInfoId } = req.params

    const gate = await gateTaskPoolDraftEdit(taskInfoId, userId)
    if (!gate.ok) return res.status(gate.status).json({ error: gate.error })

    const {
      title,
      description,
      reward,                    // 单人奖励
      participantLimit: plRaw,   // 参与者数量
      startDate,
      deadline,
      submitDeadline,
      submissionInstructions,
      proofConfig,
    } = body

    const rewardNum = Number(reward)
    if (Number.isNaN(rewardNum) || rewardNum < 1) {
      return res.status(400).json({ error: 'reward 无效' })
    }

    const participantLimit = typeof plRaw === 'number' ? plRaw : parseInt(String(plRaw || '1'), 10)
    if (Number.isNaN(participantLimit) || participantLimit < 1) {
      return res.status(400).json({ error: 'participantLimit 无效' })
    }

    // ...时间验证...

    // ✅ 计算计划锁入金额
    const plannedLockNt = rewardNum * participantLimit
    const participantLimitCol = participantLimit > 1 ? participantLimit : null

    const { error: updInfoErr } = await supabase
      .from('task_info')
      .update({
        title: title.trim(),
        description: description.trim(),
        start_date: normalizeDateTime(startDate),
        deadline: normalizeDateTime(deadline),
        submit_deadline: normalizeDateTime(submitDeadline),
        participant_limit: participantLimitCol,
        submission_instructions: typeof submissionInstructions === 'string' ? submissionInstructions : ti.submission_instructions,
        proof_config: mergedProof,
        planned_lock_nt: plannedLockNt,  // ⚠️ 设置总激励但无与子任务验证
      })
      .eq('id', taskInfoId)

    // ... 创建或更新任务行 ...
  }
}
```

**问题分析：**
- ✅ 计算 `planned_lock_nt = reward * participantLimit`
- ❌ 无校验：修改 `planned_lock_nt` 后是否与已有子任务金额冲突

---

## 3️⃣ 商城同步逻辑 (`src/services/taskpoolMallSync.ts`)

### 3.1 子任务商城行同步 (`ensureSubtaskMallListings`)

**位置：** [src/services/taskpoolMallSync.ts](src/services/taskpoolMallSync.ts#L137-L265)

```typescript
export async function ensureSubtaskMallListings(taskInfoId: string): Promise<EnsureSubtaskMallResult> {
  const { data: info, error: infoErr } = await supabase
    .from('task_info')
    .select('id, creator_id, use_taskpool, planned_lock_nt, subtasks_finalized')
    .eq('id', taskInfoId)
    .single()

  // ...检查任务存在、已启用 TaskPool、子任务已定稿...

  // ✅ 读取所有子任务
  const { data: drafts, error: dErr } = await supabase
    .from('task_subtasks')
    .select('id, title, sort_order, max_amount_nt, participant_limit')  // ⚠️ 读取 max_amount_nt
    .eq('task_info_id', taskInfoId)
    .order('sort_order', { ascending: true })

  if (dErr) throw dErr
  const subList = drafts || []
  if (subList.length === 0) {
    return { ok: true, created: 0, skipped: 0, taskIds: [] }
  }

  // ...后续处理...

  const n = subList.length
  const plannedNum = row.planned_lock_nt != null ? Number(row.planned_lock_nt) : NaN
  
  // ✅ 计算默认奖励（总激励 / 子任务数）
  const defaultReward =
    !Number.isNaN(plannedNum) && plannedNum > 0 && n > 0 
      ? (plannedNum / n).toFixed(2) 
      : '1'

  // ... 遍历子任务...
  for (const sub of subList) {
    const neededRaw = (sub as any).participant_limit
    const needed =
      neededRaw != null && !Number.isNaN(Number(neededRaw)) && Number(neededRaw) > 1 
        ? Number(neededRaw) 
        : 1

    const existingCount = existingCountBySubId[sub.id] || 0
    if (existingCount >= needed) {
      skipped++
      continue
    }

    // ⚠️ 金额策略：优先使用 max_amount_nt，否则用默认奖励
    const reward =
      sub.max_amount_nt != null && Number(sub.max_amount_nt) > 0
        ? String(Number(sub.max_amount_nt))
        : defaultReward

    const toCreate = needed - existingCount
    for (let i = 0; i < toCreate; i++) {
      const participant_index = maxPI + 1 + offset
      offset++

      // ✅ 为每个子任务创建可领的 tasks 行
      const { data: ins, error: insErr } = await supabase
        .from('tasks')
        .insert({
          task_info_id: taskInfoId,
          creator_id: creatorId,
          claimer_id: null,
          reward,                           // ⚠️ 使用 max_amount_nt 或默认奖励
          currency: 'NT',
          weight_coefficient: 1,
          participant_index,
          status: 'unclaimed',
          listing_kind: 'taskpool_subtask',
          pool_subtask_id: sub.id,
        })
        .select('id')
        .single()

      if (insErr) throw insErr
      // ...创建时间线...

      taskIds.push(tid)
      created++
    }
  }

  return { ok: true, created, skipped, taskIds }
}
```

**关键发现：**

| 字段 | 存储位置 | 来源逻辑 |
|------|--------|--------|
| `max_amount_nt` | `task_subtasks.max_amount_nt` | 用户在创建/编辑子任务时设置 |
| `participant_limit` | `task_subtasks.participant_limit` | 用户在创建/编辑子任务时设置 |
| `reward` (tasks.reward) | `tasks.reward` | 优先 `max_amount_nt * participant_limit` / 子任务数，否则默认 |
| `planned_lock_nt` | `task_info.planned_lock_nt` | 在 `patchTaskPoolDraft` 中设置为 `reward * participantLimit` |

**问题分析：**
- ❌ **关键缺失**：无验证所有子任务的总金额是否超过 `planned_lock_nt`
- ⚠️ 金额来源有三种可能性：
  1. 子任务的 `max_amount_nt`（如果设置）
  2. 默认奖励 = `planned_lock_nt / 子任务数`
  3. 如果 `max_amount_nt` 为 0 或 null，使用默认
- ❌ 无防护：某个子任务的 `max_amount_nt` 可能超过默认奖励，导致总和超限

### 3.2 池主商城行同步 (`ensureTaskpoolPoolPrimaryListing`)

**位置：** [src/services/taskpoolMallSync.ts](src/services/taskpoolMallSync.ts#L8-L136)

```typescript
export async function ensureTaskpoolPoolPrimaryListing(taskInfoId: string): Promise<EnsurePoolListingResult> {
  const { data: info, error: infoErr } = await supabase
    .from('task_info')
    .select('id, creator_id, use_taskpool, planned_lock_nt')  // ✅ 读取 planned_lock_nt
    .eq('id', taskInfoId)
    .single()

  if (infoErr || !info) {
    throw new Error('任务信息不存在')
  }

  // ... 处理池主行 ...

  const rewardFallback =
    planned != null && !Number.isNaN(Number(planned)) 
      ? String(Number(planned)) 
      : '1'

  // ... 幂等逻辑 ...
}
```

**问题分析：**
- 此函数仅处理池主行的 `listing_kind=taskpool_pool`
- 无金额约束逻辑

---

## 4️⃣ 现有的验证函数

### 4.1 权限检查函数

**位置：** [src/controllers/taskInfoController.ts](src/controllers/taskInfoController.ts#L114-L135)

```typescript
function canReadSubtasks(userId: string, row: TaskInfoSubtaskRow): boolean {
  if (row.creator_id === userId) return true
  if (row.manager_user_id != null && row.manager_user_id === userId) return true
  return false
}

/** 修改子任务 / 定稿 / PATCH taskpool 元数据：... */
function canWriteSubtasks(userId: string, row: TaskInfoSubtaskRow): boolean {
  if (row.manager_user_id != null) {
    return row.manager_user_id === userId
  }
  return row.creator_id === userId
}
```

### 4.2 提交截止时间验证

**位置：** [src/controllers/taskInfoController.ts](src/controllers/taskInfoController.ts#L157-L170)

```typescript
function checkSubtaskSubmitDeadlineGate(
  poolSubmitDeadlineRaw: string | null | undefined,
  subtaskSubmitDeadlineRaw: string | null | undefined
): { ok: true } | { ok: false; message: string } {
  if (!subtaskSubmitDeadlineRaw) return { ok: true }
  const pool = parseLocalDateTime(poolSubmitDeadlineRaw || undefined)
  const sub = parseLocalDateTime(subtaskSubmitDeadlineRaw || undefined)
  if (!pool) return { ok: false, message: '任务池提交截止时间缺失或无效，无法设置子任务截止' }
  if (!sub) return { ok: false, message: '子任务提交截止时间格式无效' }
  if (sub.getTime() > pool.getTime()) {
    return { ok: false, message: '子任务提交截止不得晚于任务池提交截止' }
  }
  return { ok: true }
}
```

**启发：** 可参考此模式为金额约束创建验证函数

---

## 5️⃣ 影响分析

### 需要添加验证的关键点

| # | 验证点 | 位置 | 优先级 | 说明 |
|---|-----|------|-------|------|
| 1 | 子任务金额总和校验 | `createSubtask` | 🔴 高 | 新建子任务时检查是否超过 `planned_lock_nt` |
| 2 | 子任务金额总和校验 | `patchSubtask` | 🔴 高 | 修改子任务时检查是否超过 `planned_lock_nt` |
| 3 | 定稿前金额验证 | `finalizeSubtasks` | 🔴 高 | **关键**：定稿前验证，防止上链前出现金额问题 |
| 4 | 池激励修改时校验 | `patchTaskPoolDraft` | 🟡 中 | 修改总激励后是否与子任务金额冲突 |
| 5 | 单子任务上限 | `createSubtask` / `patchSubtask` | 🟡 中 | 单个子任务的 `max_amount_nt` 是否过大 |
| 6 | 参与者数量冲突 | `ensureSubtaskMallListings` | 🟡 中 | 子任务的 `participant_limit` 是否与总数冲突 |

### 可能的边界情况

```text
场景 1：create A (max_amount=100) + create B (max_amount=100) + planned_lock=150
  问题：两个子任务总和超限
  现状：无检查 ❌

场景 2：create A (max_amount=0, participant_limit=10) + planned_lock=50
  问题：A 使用默认奖励 (50/1=50) ≠ (50/10=5)
  现状：商城同步时计算默认奖励但无约束 ⚠️

场景 3：finalize → ensureSubtaskMallListings (选奖励) → 实际金额超 planned_lock_nt
  问题：定稿后才发现金额问题，已写 DB
  现状：无定稿前验证 ❌

场景 4：patch A (max_amount=200) 在 planned_lock=150 的任务
  问题：单个子任务超过总池激励
  现状：无检查 ❌

场景 5：patchTaskPoolDraft (planned_lock 从 200 改为 50) + 已有 子任务A max_amount=150
  问题：总激励缩小但子任务金额要求未改
  现状：无检查 ❌
```

---

## 6️⃣ 相关文件汇总

| 文件 | 相关函数 | 约束涉及 |
|------|--------|---------|
| [taskInfoController.ts](src/controllers/taskInfoController.ts) | `createSubtask`, `patchSubtask`, `finalizeSubtasks`, `patchTaskPoolDraft` | ❌ 无金额验证 |
| [taskpoolMallSync.ts](src/services/taskpoolMallSync.ts) | `ensureSubtaskMallListings` | ⚠️ 有金额分配，无约束 |
| [task.ts](src/types/task.ts) | `TaskSubtaskDraft`, `TaskInfo` | ✅ 类型完整，无约束注释 |
| [taskListingKind.ts](src/types/taskListingKind.ts) | `TaskListingKind` | ✅ 分类完整 |

---

## 🔧 建议修复方案框架

### 验证函数模板（可参考 `checkSubtaskSubmitDeadlineGate`）

```typescript
async function validateSubtaskAmountConstraints(
  taskInfoId: string,
  proposedSubtask: { maxAmountNt?: number | null }
): Promise<{ ok: true } | { ok: false; message: string }> {
  // 1. 获取 task_info.planned_lock_nt
  // 2. 获取所有现有子任务的 max_amount_nt 总和
  // 3. 检查 proposedSubtask.maxAmountNt + 现有总和 <= planned_lock_nt
  // 4. 返回验证结果
}
```

### 集成点

- `createSubtask` 前调用验证
- `patchSubtask` 前调用验证
- `finalizeSubtasks` 前调用验证并锁定子任务金额

---

## 📎 附录：所有相关搜索匹配

### max_amount_nt 用法

1. **taskpoolMallSync.ts:166** - 查询字段
2. **taskpoolMallSync.ts:224** - 条件判断
3. **taskpoolMallSync.ts:225** - 值转换
4. **taskInfoController.ts:145** - 映射 (mapSubtaskRow)
5. **taskInfoController.ts:232** - 创建时赋值
6. **taskInfoController.ts:277** - 更新时赋值

### planned_lock_nt 用法

1. **taskInfoController.ts:76** - 查询字段
2. **taskInfoController.ts:834** - 在 patchTaskPoolDraft 中计算
3. **taskpoolMallSync.ts:34,144,204** - 读取和使用

### participant_limit 用法

1. **taskInfoController.ts:226,238,282** - 子任务
2. **taskInfoController.ts:768,805,831** - 池总数

---

**生成时间：** 2026-04-14  
**搜索范围：** `/mycoseed-backend/src/`  
**搜索关键词：** `maxAmountNt|max_amount_nt|pool_total|pool_incentive|planned_lock_nt|subtask.*amount|createSubtask|patchSubtask|finalizeSubtasks|patchTaskPoolDraft`
