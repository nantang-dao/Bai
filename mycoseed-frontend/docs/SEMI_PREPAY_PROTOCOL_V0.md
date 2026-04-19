# Semi 预付协议 v0（对齐代码现状 + 待实现约定）

> **目的**：在 Semi 与 mycoseed 各自演进前，固定一版「链下协议」：入口 URL 形态、参数、回跳、`state` 与状态码。  
> **范围**：仅覆盖 **TaskPool 合约 `deposit` 前置的 NT `approve` + `deposit`**（形成 `credit[publisher]`），不包含商店 Buy、不包含 `createTaskPool` 本身。  
> **状态（Semi）**：**阶段 1 已实现** — `semi-new/semi-app/pages/taskpool/prepay.client.vue` + `utils/SafeSmartAccount/operation.ts` 的 `taskpoolDepositToCredit`（单笔 UserOp：`approve` → `deposit`）+ `utils/mycoseedPrepayReturnUrl.ts` 白名单回跳。  
> **状态（mycoseed）**：**阶段 2 已实现** — `utils/semiTaskpoolPrepay.ts`（`buildSemiTaskpoolPrepayUrl` / `parseSemiPrepayCallback`）、`pages/wallet/semi-prepay-callback.vue`、任务池 `manage.vue`「用 Semi 预付」；自动化脚本 `npm run taskpool:test-semi-prepay-callback`。

---

## 1. 现状盘点（基于当前仓库）

### 1.1 mycoseed：浏览器注入钱包（类 MetaMask）

| 位置 | 行为 |
|------|------|
| `composables/useTaskPoolVerticalSlice.ts` | 通过 `(window as any).ethereum` 使用 `eth_requestAccounts`、`wallet_switchEthereumChain`，`viem` 的 `walletClient().writeContract` 调 **NT `approve`**、**TaskPoolProxy `deposit`**、`createTaskPool`、`claimTask` 等。未连接时抛错提示「未检测到钱包（如 MetaMask）」。 |
| `pages/dev/taskpool-vertical.vue` | 开发页：连接钱包 → approve → deposit → 建池等竖切流程，依赖上述 composable。 |
| `pages/tasks/pool/[taskInfoId]/manage.vue` | 「链上建池（demo）」按钮调用同一 composable，**用户需在浏览器内用注入钱包确认**。 |
| `e2e/taskpool-onchain-assisted.spec.ts` | E2E 注释中明确依赖 **手动点 MetaMask** 完成链上一步。 |

**结论**：当前 TaskPool 链上操作主路径是 **注入钱包**，**不是** Semi App 内 Safe。

### 1.2 mycoseed：Semi 相关（登录 + 打开转账页）

| 位置 | 行为 |
|------|------|
| `nuxt.config.ts` `runtimeConfig.public` | `semiAppUrl`（默认 dev `http://localhost:3000`）、`semiApiUrl`、`semiOAuthUrl`、`semiClientId`、`semiRedirectUri`；以及 `taskpoolProxyAddress`、`chainId`（默认 `10`）、`opRpcUrl`、`ntTokenAddress`。 |
| `utils/api.ts` `buildSemiTransferUrl` | 生成 **`{semiAppUrl}/transfer?...`**：`chain_id`、`token_address`、`to`、`amount`，可选 `pool_uuid`、`task_uuid`、`task_id`、`memo`、`receiver_remark`、`metadata`。 |
| `pages/auth/login.vue` + `pages/auth/callback.vue` | OAuth2 implicit：`buildOAuthUrl` → Semi `authorize`；回调页用 **`parseFragment` 读 `#access_token=...&state=...`**，与 **`sessionStorage.oauth_state`** 比对防 CSRF，再 `getSemiUserInfo` + `syncFromSemi`。 |

**结论**：已有成熟模式是 **HTTPS 打开 Semi 的 `/transfer`** 与 **OAuth fragment 回调**；**没有**「approve→deposit→回跳 mycoseed」的专用链接或落地页。

### 1.3 Semi App：`/transfer` 与批量 UserOp

| 位置 | 行为 |
|------|------|
| `semi-new/semi-app/pages/transfer.client.vue` `initForm` | 从 **`route.query`** 读取并填充表单：`chain_id`、`token_address`、`to`、`amount`、`metadata`、`pool_uuid`、`task_uuid`、`task_id`（兼容为 task 行 UUID）、`memo`、`receiver_remark` 等。 |
| 同文件 `handleTokenTransfer` | ERC20 走 `transferErc20`；若存在 **Remark 条件**，会设置 **`optionalCalls`**：在转账主 call 之外追加 **`remarkProxy.saveRemark`**（与 bai 的 `pool_uuid`/`task_uuid` 派生 uint256 逻辑一致）。 |

**结论**：Semi 已具备 **单笔 UserOp 内多笔 call** 的模式（`/transfer` 的 `optionalCalls`）。**TaskPool 预付** 现已有专用路由 **`/taskpool/prepay`**（见上「状态」）。

### 1.4 与「预付」相关的合约语义（产品/合约文档）

- `bai/contracts-project/contracts/taskpool合约信息.md`：Publisher 需先 **`deposit` 形成 `credit`**，建池时从 `credit` 锁定到池子。  
- 具体 ABI 调用见 mycoseed `utils/taskpool/abi.ts` + `useTaskPoolVerticalSlice.ts`（`approve` spender = `taskpoolProxyAddress`，`deposit(amount)`）。

---

## 2. 差距（剩余工作）

1. ~~**入口**~~：Semi 已实现 **`/taskpool/prepay`**，不复用 `/transfer`。  
2. **mycoseed 拼链接 + 落地页**：从任务池 UI 生成 §3.1 URL，并实现 **`return_url` 回调页**解析 `status`/`state`/`user_op_hash` 等。  
3. **协议统一**：链 ID、NT、Proxy 由 query 传入，须与 mycoseed 环境变量一致；Semi 侧 **return_url 白名单** 当前硬编码为：`http://localhost:3003`、`http://127.0.0.1:3003`、`https://bai.ntdao.xyz`（见 `semi-app/utils/mycoseedPrepayReturnUrl.ts`）。

---

## 3. Semi 预付协议 v0（建议约定）

以下 **Semi 与 mycoseed 实现时应对齐**；若单方变更，需同步版本号（v0.1、v1…）。

### 3.1 入口 URL（建议）

```
{SEMI_APP_ORIGIN}/taskpool/prepay?{QUERY}
```

- `SEMI_APP_ORIGIN`：与 `NUXT_PUBLIC_SEMI_APP_URL` 一致，不含尾部 `/`。  
- **实现**：`semi-new/semi-app/pages/taskpool/prepay.client.vue`（Nuxt 路由 **`/taskpool/prepay`**）。

### 3.2 Query 参数（v0）

| 参数 | 必填 | 说明 |
|------|------|------|
| `chain_id` | 是 | 例如 `10`（Optimism），与 mycoseed `runtimeConfig.public.chainId` 一致。 |
| `token_address` | 是 | NT ERC20，默认可与 `NUXT_PUBLIC_NT_TOKEN_ADDRESS` / `buildSemiTransferUrl` 默认一致。 |
| `taskpool_proxy` | 是 | TaskPool 代理合约地址，与 `NUXT_PUBLIC_TASKPOOL_PROXY_ADDRESS` 一致（`approve` 的 spender、`deposit` 的 to）。 |
| `amount` | 是 | **人类可读十进制字符串**（与 `buildSemiTransferUrl` 的 `amount` 口径一致），例如 `"100"`；Semi 端按 token `decimals` 转 `uint256`。 |
| `pool_uuid` | 否 | `task_info.id`（UUID），用于展示与日志；与现有 bai ↔ Semi `pool_uuid` 语义一致。 |
| `return_url` | 是 | 预付流程结束后 **浏览器跳转** 的绝对 HTTPS URL（mycoseed 落地页，见 §3.4）。 |
| `state` | 是 | 随机串；Semi **原样**附加在回跳 URL 上，mycoseed 用 **`sessionStorage`** 或短期后端存储比对，防 CSRF（对齐 `auth/callback` 的 `oauth_state` 思路）。 |

**禁止 / 须校验**

- `return_url`：**建议**只允许配置的白名单 origin（开发 / 预发 / 生产各配一组），防止钓鱼站盗参数。  
- `amount`：必须 `> 0`；上限可按产品再加。

### 3.3 Semi 内行为（已实现逻辑）

1. 用户已登录 Semi（Safe + UserOp，与 `/transfer` 一致）。  
2. 使用 `viem` **`parseUnits(amount, decimals)`** 得到 `amountWei`。  
3. **单笔 UserOp 内顺序执行**：`ERC20.approve(taskpool_proxy, amountWei)` → `TaskPoolProxy.deposit(amountWei)`（**不**根据 allowance 跳过 approve，MVP 行为简单可预期）。  
4. 成功：`window.location` → `return_url`，query 见 §3.5。链上失败：同样回跳并带 `status=failed` 与 `error_code` / `error`。  
5. `token_address` 须在 Semi `getTokenClass()` 列表中（与转账页一致）；否则初始化失败并提示。

### 3.4 mycoseed 落地页（建议）

```
{MYCOSEED_ORIGIN}/wallet/semi-prepay-callback?...
```

或挂在任务池域下，例如：

```
/tasks/pool/semi-prepay-callback
```

**职责**：解析 query → 校验 `state` → 展示成功/失败与交易链接；可选轮询链上 `credit`（v0 可不做）。

### 3.5 回跳 Query（附加在 `return_url` 后）

| 参数 | 说明 |
|------|------|
| `status` | `success` \| `failed` \| `cancelled`（用户主动退出/未确认） |
| `state` | 与请求时一致 |
| `chain_id` | 回显 |
| `pool_uuid` | 若有则回显 |
| `tx_hash` | 可选；若 UserOp 对应多笔内部交易，可用 **最终一条** 或 **userOperationHash**（需在文档/产品统一一种展示口径） |
| `error` | `failed` 时简短错误码或 message（宜再映射为 i18n） |

**错误码（建议枚举，便于自动化）**

| `error_code` | 含义 |
|--------------|------|
| `USER_REJECTED` | 用户在 Semi 内取消签名/密码 |
| `INSUFFICIENT_BALANCE` | NT 余额不足 |
| `ALLOWANCE_OR_DEPOSIT_FAILED` | 链上 revert（可细分版本再加） |
| `INVALID_PARAMS` | query 缺参或非法 |
| `RETURN_URL_REJECTED` | `return_url` 不在白名单 |

（实现时可只用 `error` 文本；稳定后再收敛为 `error_code`。）

### 3.6 示例链接（占位，需替换域名与地址）

**开发**

```
http://localhost:3000/taskpool/prepay?chain_id=10&token_address=0x7563cb33148cD2b929ed85e69F697be13b515Bd0&taskpool_proxy=<TASKPOOL_PROXY>&amount=50&pool_uuid=<TASK_INFO_UUID>&state=<RANDOM>&return_url=http%3A%2F%2Flocalhost%3A3003%2Fwallet%2Fsemi-prepay-callback
```

**生产（示意）**

```
https://www.semi.im/taskpool/prepay?chain_id=10&token_address=...&taskpool_proxy=...&amount=50&pool_uuid=...&state=...&return_url=https%3A%2F%2F<your-mycoseed-host>%2Fwallet%2Fsemi-prepay-callback
```

---

## 4. 与现有代码的对应关系（实现 checklist）

| 协议项 | 现状 |
|--------|------|
| Semi 路由 `/taskpool/prepay` | **已实现**（`prepay.client.vue`） |
| Semi 内 `approve`+`deposit` | **已实现**（`taskpoolDepositToCredit` in `operation.ts`） |
| `return_url` 白名单 | **已实现**（`mycoseedPrepayReturnUrl.ts`：localhost:3003、127.0.0.1:3003、bai.ntdao.xyz） |
| mycoseed 拼链接 | **已实现**：`utils/semiTaskpoolPrepay.ts` `buildSemiTaskpoolPrepayUrl`（`manage.vue` 调用） |
| mycoseed 回调页 | **已实现**：`/wallet/semi-prepay-callback`（`sessionStorage` 与 `state` 校验） |
| 环境变量 | mycoseed 已具备 `semiAppUrl`、`taskpoolProxyAddress`、`chainId`、`ntTokenAddress` |

---

## 5. 待你方确认（若与产品不一致再改 v0.1）

1. **入口路径** 是否采用 `/taskpool/prepay`，还是 Semi 侧已有命名规范？  
2. **`return_url` 白名单**：仅生产域名还是含 `localhost:3003`？  
3. **成功凭证**：对外展示以 **`tx_hash`** 为准还是以 **userOperation 哈希** 为准（AA 场景）？  
4. **`amount` 精度**：是否永远用 **人类可读 + 链上读 decimals**（与当前 `transfer` 一致）？

---

## 6. 文档维护

- **版本**：v0（2026-04-11）  
- **变更**：协议变更请 bump 版本号并在 PR 中 @ Semi / mycoseed 维护者。
