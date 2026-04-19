## 目标

手动跑通「普通任务 = 单子任务池（TaskPool + Semi 预付）」完整链路，并对照期望产出/事件/回写字段做验收。

本清单假设：
- OP 主网（chainId=10）
- Semi 本地：`http://127.0.0.1:3000`
- MycoSeed 前端本地：`http://127.0.0.1:3003`
- MycoSeed 后端本地：`http://127.0.0.1:3001`

---

## 0. 启动检查（必须）

### 0.1 必须启动的三个服务

- **Semi App**（端口 3000）
- **MycoSeed Backend**（端口 3001）
- **MycoSeed Frontend**（端口 3003）

用端口确认：

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
lsof -nP -iTCP:3001 -sTCP:LISTEN
lsof -nP -iTCP:3003 -sTCP:LISTEN
```

### 0.2 前端运行时配置（必须）

前端需要：
- `NUXT_PUBLIC_API_URL=http://127.0.0.1:3001`
- `NUXT_PUBLIC_SEMI_APP_URL=http://127.0.0.1:3000`
- `NUXT_PUBLIC_TASKPOOL_PROXY_ADDRESS=0x3A612F0e8D3942fEb6E2f48AfEbaCFa5ED7bb749`
- `NUXT_PUBLIC_NT_TOKEN_ADDRESS=0x7563cb33148cD2b929ed85e69F697be13b515Bd0`
- `NUXT_PUBLIC_CHAIN_ID=10`

后端需要（读链/验链）：
- `TASKPOOL_PROXY_ADDRESS=0x3A612F0e8D3942fEb6E2f48AfEbaCFa5ED7bb749`
- `TASKPOOL_ADMIN_ADDRESS=0x25a83feBdC5ee938950377014e3BB93c6b12d2e5`
- `TASKPOOL_NT_TOKEN_ADDRESS=0x7563cb33148cD2b929ed85e69F697be13b515Bd0`
- `OP_RPC_URL`（推荐稳定 OP RPC，避免 `mainnet.optimism.io` 超时）

---

## 1. Step1-3：发布（Semi 一笔：approve + deposit + createTaskPoolSelf）

### 入口

MycoSeed 前端：`/tasks/create`

### 操作步骤

- 用 Publisher 登录
- 创建任务：最小必填
  - 参与人数 ≥ 1
  - 每人积分（reward）
  - 领取截止时间、提交截止时间（顺序正确）
- 点击 **“发布任务”**（会打开 Semi 弹窗）
- 在 Semi 弹窗里确认交易（一次确认，内部批量执行）
- Semi 回跳：`/wallet/semi-prepay-callback`

### 期望（前端 UI）

- 回调页显示：
  - `预付已提交（success）`
  - `tx_hash`（OP 交易哈希）
  - `已同步预付结果到服务端（intent）。`
- 回到任务池管理页（或刷新后）应看到：
  - `createTaskPool txHash`（同一笔 tx hash）
  - `TaskPool phase: pool_created`

### 期望（链上）

- 交易中应出现（同一 tx）：
  - `Deposited(publisher, amount)`
  - `PoolCreated(poolId, publisher, manager, lockedBalance, claimDeadline, credentialDeadline)`

### 期望（后端回写）

- `task_info.taskpool_create_tx_hash` 被写入
- `task_info.taskpool_phase = pool_created`
- `task_info.taskpool_create_status = confirmed`

---

## 2. Step4：领取（Semi：claimTask）

### 入口

任务详情页：`/tasks/:id`

### 操作步骤

- 用 Candidate 登录
- 点击 **“领取任务”**（会打开 Semi 弹窗）
- Semi 里确认 claim 交易
- Semi 回跳：`/wallet/semi-claim-callback?taskId=...`

### 期望

- 回调页显示 success + `已同步领取结果到服务端。`
- 任务详情页刷新后状态变为 claimed（或 UI 有领取者信息）

---

## 3. Step5（链下提交）+ Step5（链上审核：approveSubtask）

### 3.1 Candidate 提交（链下）

- 任务详情页点击 **“提交任务”**
- 进入 `/tasks/submit?id=...`
- 填写最小证明（文字说明即可）
- 提交成功后返回任务详情页，状态为 submitted/under_review（以页面显示为准）

### 3.2 Publisher 审核通过（Semi）

- Publisher 打开审核页：`/tasks/review?id=...`
- 选择通过并提交（会打开 Semi 弹窗）
- Semi 里确认 `approveSubtask`
- 回跳：`/wallet/semi-approve-callback?taskId=...`

#### 期望

- 回调页显示 success + `已同步审核结果到服务端。`
- 任务状态变为 completed

---

## 4. Step6：终审（Semi：finalApprovePool）

### 入口

任务池管理：`/tasks/pool/:taskInfoId/manage`

### 操作步骤

- Publisher 点击：**“终审（finalApprovePool）”**（会打开 Semi）
- Semi 里确认交易
- 回跳：`/wallet/semi-final-approve-callback?taskInfoId=...`

### 期望

- 回调页 success + 已同步到服务端
- 管理页出现“公示期”相关信息（若 UI 已展示）

---

## 5. Step7：结算（Semi：distribute）

### 注意（OP 主网 24h 公示期）

默认需要等待 24h 公示期结束才能成功 distribute。手测时建议先验证“公示期内 distribute 失败（revert）”是否提示清晰。

### 入口

任务池管理：`/tasks/pool/:taskInfoId/manage`

### 操作步骤

- 点击 **“结算（distribute）”**（Semi）
- 公示期内预期失败；公示期后预期成功
- 回跳：`/wallet/semi-distribute-callback?taskInfoId=...`

### 期望（成功时）

- `Distributed(poolId, ...)` 事件出现
- Candidate 收到 NT
- Publisher 退款（或 credit 增加）

---

## 常见问题定位

- **Semi 弹窗打不开**：浏览器拦截了弹窗；允许弹窗后重试
- **回调页 state mismatch**：本地 sessionStorage 不一致（换浏览器/清缓存）；回到发起页重新点
- **claim intent 409**：后端未写入 `taskpool_create_tx_hash`（验链未完成/失败）；稍后刷新或从管理页重试

