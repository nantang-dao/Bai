# scripts 目录说明（部署顺序与用途）

这个目录按“业务域”拆分脚本，目的是让你一眼就知道：
- 这是部署哪个系统（remark / taskpool）
- 这是正常使用的脚本，还是历史遗留（legacy）

---

## 命名与归档规范（给以后的人/AI 用）

### 目录结构约定

- **正式脚本**放在对应业务域目录下：
  - `scripts/remark/`
  - `scripts/taskpool/`
- **历史遗留脚本**放在 `scripts/legacy/<domain>/` 下：
  - `scripts/legacy/remark/`
  - `scripts/legacy/taskpool/`

这样做的目标是：**你永远只需要记住“部署某个域，就去它的 deploy.ts”**，而旧版本只作为存档存在，不干扰日常使用。

### 文件命名约定

1. **正式脚本**
   - 文件名固定用：`deploy.ts`
   - 例如：
     - `scripts/remark/deploy.ts`
     - `scripts/taskpool/deploy.ts`

2. **legacy 脚本（必须带版本与特征）**
   - 文件名格式建议：
     - `deploy.v<版本>-<关键特征>.ts`
     - `upgrade.v<版本>-to-v<版本>-<关键特征>.ts`（如果真的需要保留升级脚本）
   - 例如：
     - `scripts/legacy/remark/deploy.v1-string-taskid.ts`

> 关键原则：legacy 脚本**不要**继续叫 `deploy.ts`，否则会让人误以为是“当前推荐脚本”。

### 什么时候需要把脚本/合约放进 legacy？

- **需要保留对比/回溯**（毕业设计答辩、论文、复现旧行为）→ 放 `legacy/`
- **完全不会再用且没必要对比** → 直接删除，减少噪音
- **正式脚本发生了破坏性变更**（参数/合约名/部署方式变化）→ 旧脚本归档到 `legacy/`，并在文件名写清关键差异

---

## 你日常只需要跑哪几个？

通常只需要 **2 个**脚本（对应 2 套合约系统）：

1. **部署备注上链系统（Remark）**
   - 脚本：`scripts/remark/deploy.ts`
   - 产物：`RemarkLogicV1 + Proxy`
   - 输出：`REMARK_PROXY_ADDRESS=...`

2. **部署预付质押系统（TaskPool）**
   - 脚本：`scripts/taskpool/deploy.ts`
   - 产物：`TaskPoolLogicV1 + Proxy`
   - 输出：`TASKPOOL_PROXY_ADDRESS=...`

> 你不需要把 `legacy/` 里的脚本也跑一遍。`legacy/` 只是为了保留历史实现，方便回溯或对比。

---

## 先后关系（有没有依赖顺序？）

- **逻辑上**：TaskPool 与 Remark 是两个独立系统。
  - TaskPool 管“钱、领取、结算”
  - Remark 管“备注上链”
- **采用方案 A（推荐）**：备注合约的写权限先归平台，再转交给 TaskPool Proxy，由 TaskPool 在 `markTaskCompleted` 时自动调用备注合约写入。
  - 部署顺序：**先部署 TaskPool**，记下 `TASKPOOL_PROXY_ADDRESS`；**再部署 Remark**，部署脚本中 `initialize(platformWallet)` 将 owner 设为平台地址。
  - 配置：对 TaskPool 调用 `setRemarkProxy(REMARK_PROXY_ADDRESS)`（由 admin 执行）；对 Remark Proxy 由**平台钱包**调用一次 `transferOwnership(TASKPOOL_PROXY_ADDRESS)`，将备注写权限交给 TaskPool Proxy。
  - 此后由 TaskPool 在审核通过时统一写入备注，无需平台长期持钥。
- **不接入自动备注**：不部署 Remark、不调用 `setRemarkProxy` 即可；`markTaskCompleted` 仍可传空字符串作为备注参数。

---

## legacy 目录是什么？

`scripts/legacy/` 里是“已废弃/仅供参考”的脚本：

- `legacy/remark/deploy.v1-string-taskid.ts`
  - 部署旧版备注合约（key 使用 string taskId）
  - 仅用于参考或复现旧逻辑，不建议在新环境使用

