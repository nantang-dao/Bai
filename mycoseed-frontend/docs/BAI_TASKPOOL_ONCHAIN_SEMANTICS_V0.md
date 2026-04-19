# Bai 任务池链上语义 v0（阶段 5.1）

> **目的**：在实现阶段 5.2 / 5.3（Semi 支付页、回跳、订单状态、列表体验）之前，固定 **mycoseed 与 TaskPool 合约一致** 的链上语义，避免与 `buildSemiTransferUrl`（P2P 转账）等业务混淆。  
> **合约真理源**：`bai/contracts-project/contracts/taskpool合约信息.md`（下称《TaskPool 说明》）；实现以链上 `TaskPoolLogicV2` / `Proxy.sol` 为准，本文仅作产品与前后端对齐用。

---

## 1. 范围：只有「任务 / 任务池」，没有独立商品类型

- **v0 不包含**「非任务类 SKU / 独立商城 SKU」：当前产品形态下，用户所见「商城」即 **任务列表**，链上闭环围绕 **TaskPool + task_info / 子任务**。
- 文中若出现「订单」一词，均指 **链下业务单**（支付意图、履约跟踪），**不是** 链上另部署的「订单合约」；v0 **不要求** 将订单号作为独立 `bytes32` 写入自定义合约存储。

---

## 2. 链、资产与合约入口

| 项 | v0 约定 |
|----|--------|
| 链 | **Optimism**（与 `nuxt.config` / 环境变量 `NUXT_PUBLIC_CHAIN_ID` 一致，默认 `10`） |
| 支付资产 | **NT（ERC20）**，地址与合约 `pointToken` / 前端 `ntTokenAddress` 一致 |
| 任务池逻辑 | 经 **`TaskPoolProxy`** 对外（`deposit`、`createTaskPool`、`claimTask`、结算等） |

---

## 3. 资金主路径：Publisher 准备金必须进入合约 `credit`（核心）

与《TaskPool 说明》一致：

1. **Publisher** 通过 **`deposit(amount)`** 将 NT 转入合约，形成 **`credit[publisher]`**（记账余额，非直接打给某个「卖家地址」作为任务池主路径）。
2. **建池**时从 **`credit[publisher]`** 中锁定到池子 **`lockedBalance`**，再经领取、审核、分发等规则结算。

因此：

- **任务池场景下，「付钱」的默认语义 = 为 Publisher 增加可在合约内使用的 credit**，即走 **`approve` + `deposit`**（浏览器钱包或 **Semi `/taskpool/prepay`**，见 `docs/SEMI_PREPAY_PROTOCOL_V0.md`）。
- **`buildSemiTransferUrl`（`/transfer`，`to` = 某地址）** 表示 **ERC20 直接转账到该地址**，资金 **不进入** TaskPool `credit`，**不能替代** 上述任务池准备金路径；仅可用于 **与任务池结算无关** 的场景（例如展示、运营转账、Remark 相关演示等），**不得**与「任务池 Publisher 预存」混为一谈。

**结论（阶段 5.1 已定）**：任务池相关「付钱进系统」的默认链上语义 = **进合约 `credit[publisher]`**，不是「打到卖家/平台钱包地址」作为同一语义。

---

## 4. 角色与地址（与 Semi 一致）

与《TaskPool 说明》「角色 / 链上填谁」表一致，不重复贴全文。要点：

- **Publisher / Manager / Claimer** 在链上均为 **EVM 地址**；使用 Semi 时，应与用户在 **Optimism 上展示的地址（如 Safe）** 一致。
- **Manager** 为 `createTaskPool` 的 `msg.sender`（可为另一用户的 Safe 或运营配置的热钱包，以产品为准）。

---

## 5. 业务 ID 与 `poolId`

- **链下主键**：`task_info.id`（UUID）标识任务池业务实体；与 Semi 侧 `pool_uuid` 对齐时使用同一 UUID。
- **链上 `poolId`**：建池用的 `uint256` 必须由 **与 Semi 相同的派生规则** 从 UUID 计算（见《TaskPool 说明》：`hexToBigInt(keccak256(toBytes(uuid)))` 一类表述）；前后端、Semi 必须 **字节级一致**，否则无法与合约状态对齐。

---

## 6. 子任务权重与「谁还能改」

与产品约定一致（v0）：

- **领取（`claim`）成功时**：该子任务上 **claimer 与 weight（及对应锁定份额）即确定**，不应再当作「未分配」随意修改。
- **尚未被领取的子任务**：在《TaskPool 说明》允许的范围内，**仍可由规则允许的角色调整金额/权重或撤回**；已领取子任务与未领取子任务可同时存在于同一池内，**互不影响**（A 已固定不约束 B/C 是否仍可改，只要 B/C 仍处于未领取状态且满足合约与总额约束）。

（具体函数名与约束以 `TaskPoolLogicV2` 为准。）

---

## 7. 「订单」在链下与链上的含义（v0）

| 层次 | v0 约定 |
|------|--------|
| 链下 | 支付意图、对账、展示可用 **订单号 / 支付单号**（UUID 或业务号），并与 **`task_info_id` / `pool_uuid`、用户、金额、intent 状态** 绑定（可与现有 `taskpool_prepay_intents` 等扩展共存）。 |
| 链上 | **不强制** 单独「订单合约」；任务池状态以 **TaskPool 合约内池子与子任务状态** 与 **`credit`** 为准。 |

---

## 8. 与 Semi 协议的关系（指向 5.2）

- **预付进 `credit`**：已实现/约定见 **`SEMI_PREPAY_PROTOCOL_V0.md`**（`/taskpool/prepay`、回跳、`state`、白名单）。
- **阶段 5.2（实现说明）**：见 **`BAI_TASKPOOL_SEMI_PAYMENT_V0.md`** — 与预付 **共用** Semi 路由与回跳协议；mycoseed 侧增加 **链下支付单号 `client_reference`** 与 **列表 API**，**不要求** Semi 改代码即可对账与展示。

---

## 9. 非目标（v0 明确不写）

- 不在本文定义 **多链、多代币** 的完整矩阵（若扩展，另起版本号）。
- 不在本文展开 **Remark** 与 **TaskPool** 二选一写入的详细冲突处理（见《TaskPool 说明》及 Semi 转账页）。
- **阶段 5.3**（列表内嵌 / WebView）仅依赖本文与 5.2 的协议形态，不在此展开。

---

## 10. 文档变更

| 版本 | 日期 | 说明 |
|------|------|------|
| v0 | 2026-04 | 阶段 5.1 初稿：对齐《TaskPool 说明》与「资金进 credit」；排除非任务商品与 P2P 作为主路径的歧义。 |
