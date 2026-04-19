# Bai 任务池列表 · Semi 入口体验 v0（阶段 5.3）

> **目的**：在 **任务池列表**（`/tasks/pool`）为创建者提供 **Semi 预付** 的快捷入口，减少「先进管理页再找按钮」的路径；**不**在列表内嵌 Semi WebView/SDK（无则仍跳转 Semi App）。  
> **链路与协议**：与 **`SEMI_PREPAY_PROTOCOL_V0.md`**、**`BAI_TASKPOOL_SEMI_PAYMENT_V0.md`** 一致；列表侧 **不拼 Semi URL**，仅 **`router.push` 到管理页并带 `focus=semi-prepay`**。

---

## 1. 行为

| 项 | 说明 |
|----|------|
| 展示条件 | 当前用户为 **任务池创建者**、`useTaskpool`、**尚无** `taskpoolCreateTxHash`、**有计划锁仓**（`plannedLockNt > 0`） |
| 交互 | 卡片内按钮 **「Semi 预付（入金 credit）」**，`@click.stop` 避免触发整张卡进管理页 |
| 跳转 | `/tasks/pool/:taskInfoId/manage?title=…&focus=semi-prepay` |
| 管理页 | 当 **Semi 预付卡片**可见时，滚动至 `#taskpool-semi-prepay`，随后 **`router.replace` 去掉 `focus` query**（保留 `title` 等） |

## 2. 与「内嵌」的关系

- **v0**：列表 **仅多一个入口**，真实支付仍在 **Semi App**（与管理页「用 Semi 预付」相同）。  
- 若未来 Semi 提供 **SDK / WebView**，可在列表或管理页替换为内嵌容器，**协议层（return_url、state）可不变**。

## 3. 测试

- E2E：`e2e/taskpool-pool-list-semi-cta.spec.ts`（API 建池 → 列表 → 点击快捷入口 → 管理页出现 Semi 区块）。

---

| 版本 | 日期 | 说明 |
|------|------|------|
| v0 | 2026-04 | 阶段 5.3 初稿 |
