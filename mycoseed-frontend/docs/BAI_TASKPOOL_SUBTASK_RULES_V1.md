# TaskPool 子任务规则收尾说明 V1

本文档用于收敛当前 TaskPool 子任务实现口径，覆盖：

- 子任务字段的继承 / 覆盖规则
- 子任务截止时间约束
- 子任务单人 / 多人规则
- 回归测试命令

## 1. 角色与审核规则

- `taskpool_pool`：商城中的任务池主入口；领取该行等于认领 `Manager`
- `taskpool_subtask`：任务池子任务在商城中的可领取行
- 子任务提交后，仅 `task_info.manager_user_id` 可 `approve / reject`
- 若 Publisher 同时就是 Manager，则仍可审核
- 非 Manager 对子任务执行审核接口时必须返回 `403`

## 2. 子任务字段继承 / 覆盖

子任务草稿存储在 `task_subtasks`，商城详情与提交校验基于 `tasks + task_info + task_subtasks` 合并后的有效配置。

### 2.1 覆盖优先级

对于 `listing_kind = taskpool_subtask`：

1. 若子任务字段有值，则优先使用 `task_subtasks`
2. 若子任务字段为空，则回退继承 `task_info`

### 2.2 当前已生效字段

- `title`
- `description`
- `submission_instructions`
- `proof_config`
- `submit_deadline_override`
- `participant_limit`

### 2.3 具体规则

- `title`：详情展示为 `池标题 · 子任务标题`
- `description`：子任务有值则覆盖父任务池描述
- `submission_instructions`：子任务有值则覆盖父任务池提交说明
- `proof_config`：子任务有值则覆盖；否则继承父任务池
- `submit_deadline_override`：子任务有值则作为详情展示与提交时的有效截止；否则继承父任务池 `submit_deadline`
- `participant_limit`：子任务有值则决定该子任务在商城生成多少个席位行；否则继承父任务池默认单席位语义

## 3. 截止时间约束

- 子任务独立审核截止对应 `submitDeadline / credentialDeadline`
- 数据库存储字段：`task_subtasks.submit_deadline_override`
- 后端强校验：`subtask.submit_deadline_override <= task_info.submit_deadline`
- 若越界，创建 / 更新子任务草稿必须返回 `400`

说明：

- 当前未单独引入子任务 `claimDeadline`
- 子任务若未填写 `submit_deadline_override`，则完全继承父任务池截止时间

## 4. 子任务单人 / 多人规则

## 4.1 单人子任务

- `participant_limit = 1` 或为空时，商城只生成 1 条 `tasks` 行
- 领取、提交、审核均对这 1 条任务行操作

## 4.2 多人子任务

- 当子任务 `participant_limit > 1` 时，`finalize` 后会为同一个 `pool_subtask_id` 生成多条 `tasks` 行
- 每条 `tasks` 行代表一个独立席位
- 每个领取者只可领取该子任务组中的 1 个席位
- 每个席位独立提交凭证
- 每个席位独立审核，不要求等其他席位一起完成

## 4.3 防串单规则

子任务多人场景下，所有“组内操作”必须按 `pool_subtask_id` 收敛：

- 领取未满员席位：只在同一 `pool_subtask_id` 组内查找
- 详情页 `participantsList`：只展示同一 `pool_subtask_id` 组内席位
- 提交凭证：只能提交自己领取的那一条 `tasks` 行
- 审核：只审核传入 `taskId` 对应的那一条席位，不跨参与者串审

## 5. 迁移说明

为支持多人子任务，已新增：

- `db/migrations/030_taskpool_subtask_multi_seats.sql`

作用：

- 删除旧的唯一索引 `idx_tasks_unique_pool_subtask`
- 改为普通索引 `idx_tasks_pool_subtask_id`

原因：

- 旧索引要求同一个 `pool_subtask_id` 只能有 1 条 `tasks` 行
- 多人子任务需要同一个 `pool_subtask_id` 对应多个席位行

## 6. 回归测试

## 6.1 前端 E2E

默认排除 `@slow`：

```bash
cd bai/mycoseed-frontend
npm run test:e2e:taskpool
```

按需本地执行慢测：

```bash
cd bai/mycoseed-frontend
npm run test:e2e:slow
```

## 6.2 后端脚本矩阵

```bash
cd bai/mycoseed-backend
npm run test:taskpool-pool-claim
npm run test:taskpool-subtask-review
npm run test:taskpool-overall-gate
npm run test:taskpool-delete-edit-gates
npm run test:taskpool-subtask-draft-fields
npm run test:taskpool-subtask-overrides
npm run test:taskpool-subtask-participant-limit
```

## 6.3 运行前提

- 后端服务已启动
- 前端服务已启动（跑 E2E 时）
- 已应用数据库 migration，至少包含：
  - `028_tasks_listing_kind.sql`
  - `029_task_subtasks_fields.sql`
  - `030_taskpool_subtask_multi_seats.sql`
- 本地测试所需 token 已在当前终端环境中设置

## 7. 当前验收口径

满足以下条件即可视为本阶段完成：

- 子任务详情页展示覆盖 / 继承后的有效字段
- 子任务提交校验按有效 `proof_config` 生效
- 子任务 `submit_deadline_override` 不可晚于父任务池截止
- 单人子任务可正常领取 → 提交 → Manager 审核
- 多人子任务可在同一 `pool_subtask_id` 下生成多个席位，且不串单
- 非 Manager 审核子任务返回 `403`
- 非 `@slow` 的 taskpool E2E 与后端脚本矩阵回归不红

