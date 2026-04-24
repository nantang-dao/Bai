# TaskPool V4 链下 / Semi 同步说明（给维护者）

## 已对齐的行为

1. **薄池（participant_limit=1）**  
   - Semi 页面 `/taskpool/approve-and-finalize` 现在只发 **一笔** `finalApprovePool`（不再先 `approveSubtask`）。  
   - Bai 回跳 `/wallet/semi-approve-finalize-callback` 会把 `final_tx_hash` 缺省时用 `tx_hash` 补上。  
   - 后端 `POST /api/tasks/:id/taskpool-approve-finalize-complete`：若 **未传 `approve_tx_hash`** 或 **与 `final_tx_hash` 相同**，走 **V4 单笔**校验；否则仍按 **V3 两笔**兼容。

2. **链上事件解析**  
   - `PoolFinalApproved` 在合约里一直是 **`poolId` indexed + 两个 `uint64` 时间戳**（无 publisher/manager 字段）。后端 `taskpoolOnchainVerifyPoolFinal.ts` 已与链上一致；旧版里误写的 indexed 已修正。

3. **V4 单笔校验子任务**  
   - 薄池确权时除解析 `PoolFinalApproved` 外，会 **读 `poolTasks(poolId, taskId)`**，要求对应子任务 `status == Completed(1)`。

## 你需要自己确认的环境项

- **Proxy 必须已升级到 `TaskPoolLogicV4` 实现**；否则 Semi 仍会调旧逻辑（例如仍要求先 approve）。部署见 `contracts-project/scripts/taskpool/`。  
- **公示时长**：由链上 `publicizeWindowSeconds`（admin 可调）决定；测试默认在 `initialize` 里为 **60 秒**，不是固定 24 小时。

## 未改 / 有意保留

- **非薄池** 审核仍走 `/taskpool/approve` + `approveSubtask` + `taskpool-approve-complete`（manager 链上子任务通过）。  
- **多人池终审** 仍走 `/taskpool/final-approve` + `taskpool/final-approve-complete`（与薄池路径分离）。

若回归发现「终审接口只验事件不验子任务」不够用，再给 `final-approve-complete` 加与薄池相同的 `poolTasks` 读校验即可。

## 本地检查

- **mycoseed-frontend**：`npm run typecheck` 已通过。  
- **semi-app**：仓库内 `nuxi typecheck` 仍有若干**既有** TS 报错（与本次改动无关）；本次仅改动了 `approve-and-finalize` / `final-approve` 文案与终局逻辑，未触碰报错的 `operation.ts` paymaster 类型等。
