# Bai 任务池 Semi 支付与链下订单状态 v0（阶段 5.2）

> **目的**：在 **不新增 Semi 路由、不改变 `/taskpool/prepay` 链上语义** 的前提下，把「Semi 支付页 + 回跳 + mycoseed 侧状态」与阶段 1～3 的 **deep link 协议** 对齐，并支持 **链下支付单** 列表与对账。  
> **链上语义**：仍以 **`deposit` → `credit[publisher]`** 为准，见 **`BAI_TASKPOOL_ONCHAIN_SEMANTICS_V0.md`**。  
> **Semi 真理源**：`docs/SEMI_PREPAY_PROTOCOL_V0.md`。

---

## 1. 与阶段 1 的复用关系

| 能力 | 约定 |
|------|------|
| Semi 入口 | `{SEMI_APP}/taskpool/prepay?...`（与预付相同 query：`chain_id`、`token_address`、`taskpool_proxy`、`amount`、`return_url`、`state`，以及 `pool_uuid` = `task_info.id`） |
| 回跳 | `return_url` 指向 mycoseed 落地页（如 `/wallet/semi-prepay-callback`），query 含 `status`、`state`、`pool_uuid`、`user_op_hash`、`tx_hash` 等（见 SEMI_PREPAY_PROTOCOL） |
| 白名单 | Semi 侧校验 `return_url` origin（`mycoseedPrepayReturnUrl`）；新增环境域名时 **只改 Semi 白名单**，协议不变 |

**结论**：阶段 5.2 **不要求** Semi 新增页面；若仅扩展 mycoseed 的订单/支付单状态，**Semi 代码可为零变更**。

---

## 2. mycoseed 侧：链下「支付单」模型

沿用表 **`taskpool_prepay_intents`**（阶段 3），并扩展：

| 字段 | 说明 |
|------|------|
| `client_reference` | 可选；前端在发起 `POST /api/task-info/:id/prepay-intent` 时生成的 **支付单号**（建议 `crypto.randomUUID()`），长度 ≤128，用于列表展示与对账 |
| 其余 | `state_token`、`status`（pending→success/failed/cancelled/superseded）、`amount_human`、`tx_hash` 等不变 |

**为何不把支付单号塞进 Semi URL？**  
回跳参数由 Semi 统一拼接；额外业务号 **只存 mycoseed**，避免 Semi 为 5.2 再发版；`pool_uuid` + `state` + 库表已足够关联一次支付。

---

## 3. API（仅创建者）

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/task-info/:taskInfoId/prepay-intent` | body 增加可选 **`clientReference`** |
| `POST` | `/api/task-info/:taskInfoId/prepay-complete` | 不变（回跳后同步） |
| `GET` | `/api/task-info/:taskInfoId/prepay-intent/latest` | 最近一条（含 `client_reference`） |
| `GET` | `/api/task-info/:taskInfoId/prepay-intents?limit=` | **阶段 5.2 新增**：历史列表，`limit` 默认 20、最大 50 |

---

## 4. 前端行为（manage）

- 点击「用 Semi 预付」时：生成 **`clientReference`**，与 `state` 一并 `POST prepay-intent`，再打开 Semi。
- 摘要文案展示最近一条记录的 **支付单号**（若有）。
- **「Semi 预付记录」表格**：调用 `GET prepay-intents` 展示最近最多 20 条（时间、状态、金额、支付单号、tx 摘要）；空态提示暂无记录。E2E：`e2e/taskpool-semi-prepay-history.spec.ts`（API 播种数据，不依赖真实 Semi）。

---

## 5. 与 5.3 的关系

列表侧快捷入口与滚动定位见 **`BAI_TASKPOOL_LIST_SEMI_UX_V0.md`**（`/tasks/pool` 按钮 → 管理页 `#taskpool-semi-prepay`）；协议与 deep link 不变。

---

## 6. 变更记录

| 版本 | 日期 | 说明 |
|------|------|------|
| v0 | 2026-04 | 阶段 5.2：`client_reference` + `GET prepay-intents`；Semi 侧零变更路径说明。 |
