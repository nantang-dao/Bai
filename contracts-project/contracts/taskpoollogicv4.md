# TaskPoolLogicV4 规格说明（草案）

> 本文档汇总 V4 设计意图，便于实现 `TaskPoolLogicV4.sol` 及前后端对齐。  
> 与 `TaskPoolLogicV3.sol` 的差异：子任务 **manager 日常审核不上链**；**publisher 终局一笔** 同时完成「剩余已认领 Open → Completed」与「开启公示」；链上时间规则 **极简**（见下文）。

---

## 1. 设计目标

| 目标 | 说明 |
|------|------|
| 减少半状态 | 避免「manager 链上 approve 成功 + publisher 终局失败」等两笔链上组合导致的不同步。 |
| 职责清晰 | **Manager**：子任务协作、打回、取消（链下为主 + 必要链上操作）；**Publisher**：整池通过时链上终局并开公示。 |
| 资金与状态闭环 | 认领、金额锁定仍在 **链上按子任务粒度**；终局前不允许悬挂的「未认领 Open」阻塞流程。 |
| 工程可维护 | 评审轮次、打回次数等 **不绑链上时钟**；链下以后端校验为准。 |

---

## 2. 角色与链上/链下分工

### 2.1 Manager

- **链下（主路径）**：子任务审核、打回、整包提交给 publisher 等流程以后端与产品为准。  
- **链上（保留）**：  
  - **未认领**：`cancelUnclaimedTask`（`claimDeadline` 前，业务取消）。  
  - **未认领过期**：`expireUnclaimedTask`（`claimDeadline` 后，时间到期清理）。  
  - 若仍需「已认领但链上要否决」的兜底，可保留 `rejectSubtask` / `cancelClaimedTask` 等（与 V3 对齐程度由实现时决定），但 **不把「评审第几轮」绑在 `credentialDeadline` 上**。

### 2.2 Publisher

- **链上（唯一「通过」路径）**：调用 **终局函数**（名称待定，如 `finalApprovePoolAndPublicize`）：  
  - 将池中 **所有仍为 `Open` 且已认领**（`assignee != 0` 且 `amount > 0`）的子任务 **一律设为 `Completed`**。  
  - **跳过** 已为 `Cancelled` / `Expired` 等非 `Open` 的任务。  
  - **同一笔交易内** 写入公示窗口：`publicizeEligibleAt`、`publicizeEndsAt`。  
- **链下**：publisher **打回** 不上链（无链上状态变更）；链下记录审计即可。

### 2.3 Admin

- **兜底**：异常状态、暂停、人工关池/退款等（具体函数集合在实现时列出）。  
- 与终局、公示期的 **互斥顺序** 在合约注释与本文档中写清。

---

## 3. 终局（Publisher 通过）— 完备性与语义

### 3.1 前置条件（建议强制）

1. **不存在「未认领且仍为 `Open`」的子任务**（`assignee == 0` 的 Open 必须先被 manager/admin `cancel` 或 `expire`）。否则 **revert**。  
2. 池未 `settled`、未处于非法状态；若已有公示中逻辑，与 V3 一致：**公示期内冻结**影响归属的变更。  
3. `remarkProxy` 相关：若沿用 V3 备注批量规则，终局时一次性写入 publisher remark + 按任务 assignee remark；**数组长度与 taskId 对齐**、存在性校验（与 V3 `BadRemarkBatch` 思路一致）。

### 3.2 终局对任务状态的处理（已拍板）

- **仍 `Open` 且已认领** → **一律 `Completed`**（整包通过，不在第一版要求 per-task 异构终态列表）。  
- **已 `Cancelled` / `Expired` 等** → **不修改**。  
- **不**在常规路径依赖 **`approveSubtask`** 将子任务标为 Completed（与 V3 主路径分离）。

### 3.3 信任模型（已拍板）

- **第一版不要求** manager 对批量结果做 EIP-712 签名上链；终局由 **publisher** 发起，链上语义为 **publisher 对整池结果负责**。  
- 若未来需要「链上可验证 manager 已认可某快照」，再以 V4.1/V5 扩展。

---

## 4. 链上时间（极简）

### 4.1 保留

| 字段/概念 | 用途 |
|-----------|------|
| **`claimDeadline`** | 领取阶段硬截止；之后可对未认领任务 `expireUnclaimed`；之前可 `cancelUnclaimed`。 |
| **`publicizeEligibleAt` / `publicizeEndsAt`** | 公示窗口起止；由终局交易写入。 |

### 4.2 弱化或不再作为状态机硬约束

| 字段 | 说明 |
|------|------|
| **`credentialDeadline`** | **不作为**「评审轮次 / 打回补交」的链上强制条件（可与建池字段兼容保留，但不参与 `require` 评审流程）。凭证与打回以 **链下后端校验** 为准。 |

### 4.3 公示窗口长度（可配置）

- 使用 **存储变量** `publicizeWindowSeconds`（类型可用 `uint64`）+ **`onlyAdmin` setter**。  
- 终局：`publicizeEndsAt = publicizeEligibleAt + publicizeWindowSeconds`。  
- **测试阶段建议默认 60 秒**；主网再调，**无需为改时长重新部署实现**（仅管理员发交易改存储）。

### 4.4 链下时间（权威于「用户体验」）

- 所有对用户可见的「不能领、不能交、已过期」提示与拦截 —— **以后端校验为准**。  
- **工程建议**：与链上 `claimDeadline` 展示/校验 **使用同一数据源或链上镜像**，避免「后端说能领、链上 claim revert」。

---

## 5. 未认领清理：`cancelUnclaimed` vs `expireUnclaimed`（已拍板）

| 函数 | 建议调用时机 | 语义 |
|------|----------------|------|
| **`cancelUnclaimedTask`** | **`claimDeadline` 之前** | Manager/admin 主动撤销未认领子任务。 |
| **`expireUnclaimedTask`** | **`claimDeadline` 之后** | 到期清理未认领 Open（可由 manager/admin，或可选 `anyone` 以降低运营负担）。 |

终局前置：只要求 **结果上** 不存在未认领 Open，**不区分** 是 cancel 还是 expire 清掉的。

---

## 6. 公示期与冻结（建议与 V3 对齐）

- **公示进行中**：禁止会影响资金归属与子任务状态的 manager 常规操作（与 V3 `PublicizingOrSettled` 类逻辑一致）。  
- **公示时长**：见 §4.3。

---

## 7. 与 V3 / 旧文档的关系

- **`TaskPoolLogicV3.sol`**：迁移至 `contracts/legacy/` 后仅作历史参考；**老池**测试阶段可不迁移状态机。  
- **`taskpool.md`**：其中部分描述（如 manager 链上 `approveSubtask` 为主路径）在 **V4 主路径** 上不再成立；以 **本文档** 为 V4 权威。  
- **新实现文件**：`TaskPoolLogicV4.sol`（新建）；Proxy 升级指向新实现由部署脚本/运维流程处理。

---

## 8. 实现清单（提醒）

- [ ] 终局函数 + 前置条件（无未认领 Open、批量 Open→Completed、写公示）。  
- [ ] `publicizeWindowSeconds` + admin setter；默认值测试用 60。  
- [ ] `claimDeadline` + `cancelUnclaimed` / `expireUnclaimed` 与终局互斥。  
- [ ] 移除或旁路 V3 中依赖 `credentialDeadline` 的 **评审轮次** 硬约束（保留字段则文档注明「不参与 require」）。  
- [ ] Admin 兜底与 pause 策略。  
- [ ] 链下：`task_info.deadline` 等与链上 `claimDeadline` **对齐策略**（后端建池/同步）。  
- [ ] Semi / bai 前端：去掉「approve + final 两笔」主路径，改为 **单笔终局**（薄池与普通池统一终局形态，细节按接口再拆）。

---

## 9. 版本与变更

| 日期 | 说明 |
|------|------|
| 2026-04-22 | 初稿：根据产品讨论整理 V4 规格。 |
| 2026-04-22 | 补充：`V4_CHAINOFF_SYNC_NOTES.md` 记录 Semi / Bai 链下同步与部署注意。 |

后续若修改终局函数签名、是否保留 `rejectSubtask`、或增加池级 deadline，请在本文件更新对应章节并 bump 版本说明。
