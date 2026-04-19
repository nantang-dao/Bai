社区版 TaskPool 的争议处理：不仲裁、不保证金，只做“超时回收”。
发布任务时就写一个截止时间（deadline）。合约规则是：只有发布者（或平台）确认完成，奖励才会发给接包者；如果到期还没确认完成，发布者就能调用 expire/close 把该池子里“未完成部分”的奖励退回自己（或退回 credit[publisher]）。
所以“有争议”的结果就是：不给钱 + 等到期自动按规则回退（合约不判断谁对谁错）。

把押金机制去除。

资金与结算:
资金来源：发包者先 deposit 预存 NT 到合约；建池时从 credit[publisher] 锁定 lockedReward。
发钱条件：只有发包者/平台把子任务 审核通过（completed），该子任务的奖励才会发给接包者。
结算规则：按子任务 weight 给所有已 completed 的接包者分配；剩余未完成部分退回发包者（退到 credit[publisher]）。

争议处理（无仲裁）
不仲裁：发生争议时，链上不裁决。
结果机制：未被审核通过的部分就是“未完成”，最终奖励会回到发包者；接包者不满意由前后端流程处理，平台可兜底。

删仲裁和保证金

时间
领取截止 claimDeadline：链上 claim 须不晚于该时间。
凭证提交截止 credentialDeadline：建池时与 Publisher EIP-712 签名一并写入，须晚于 claimDeadline。链上规定：仅当当前时间已过 credentialDeadline，Manager/Admin 才可对「已领取但未完成」的子任务执行 cancelClaimedTask（避免接包者履约中途被撤）。旧版池该字段为 0 时，取消已领取子任务回退为须已过 claimDeadline。
产品层仍可对提交 UI 做额外限制。
到期后允许：发包者/平台仍可对已提交内容做「审核通过」。

权限与兜底
审核权：发包者为主；保留 admin（平台）可审核通过，用于防止发包者恶意卡审不放款。

close / expire（防死锁）
无人认领：允许关闭整池，全部退回发包者。
有人认领：只能回收“未完成部分”，已完成部分照常可发放，避免资金死锁。

备注与凭证
Remark：链上只存 remark（可选），不参与结算依据；有 remarkProxy 就写，没有就跳过。TaskPool V2：Manager 通过子任务时不写备注；Publisher 终审开启公示时一次性写入整单评语 + 各已完成子任务接包者评语（链下先收集）。
completionProofURI/备注：当作可选字符串记录/事件留档，不做真实性校验。
这个暂时不用，社区这边没有证据上链的需求，先不写，以后有需求再改。

在链上 EIP-712 建池 时用的 poolId，必须在 TS/后端用 和 semi 完全相同的公式（hexToBigInt(keccak256(toBytes(uuid)))）算出来；bai 链下需要用和semi一模一样的算法从UUID算出。

领取只靠前后端松约束，改claimDeadline，方便发包者修改。

领取时定权重，审核只确认：和现在类似，但那就不是「审核时才最终」，而是「领取时最终」，和你这句话要二选一。

publisher 一键 expire 全池未领取：「一键 expire / 撤销后悔」：只处理仍未领取的子任务（把这部分从池里作废，对应锁定资金退回 publisher/credit）。硬条件：池里只要有一条子任务已经 completed（审核通过），就禁止再执行这种「整池后悔」——否则等于否定已完成工作，确实「很坏」。
单笔「撤回未领取子任务」：
含义：只动这一条子任务；它从未被 claim，把对应锁定份额退回发包者（或退回 credit），该子任务标记为已作废/已撤回。

每个子任务自己的截止，修改当前的池级 claimDeadline，releaseTaskAndSetDeadline。链上对「取消已领取子任务」检查凭证提交截止 credentialDeadline（见上「时间」一节）。

Optimism +  NT 地址 +  Remark Proxy

建池时的「发布者地址」= 用户在这条链上显示的那个钱包地址（和 Semi 里的一致）

不是「TaskPool 独占 Remark」；Semi 转账页也能写 Remark，和 TaskPool 是两条路，后写的会覆盖先写的（同一个任务 ID 上）。

msg.sender

TaskPool 里要记的是 链上地址，每条规则一句话：

角色	链上填谁	通俗说
Publisher（发包者）	谁出钱、谁在建池参数里当 publisher	用 Semi 就填 evm_chain_address（Safe），和 NT 在谁名下一致。
Manager（拆任务的人）	谁发起 createTaskPool，合约里 msg.sender 就是 manager	可以是 另一个用户的 Safe，也可以是你们 后端/运营热钱包（看产品设计）。
领取者（claim）	谁调用 claimTask，谁就是领取者	来领任务的用户，用他自己的 Semi 钱包发交易 → 填 他自己的 evm_chain_address（Safe）。
TaskPool：发包者 / 领任务的人，都用「各自在这条链上的那个 Safe 地址」

Distribute 的资金来源与路径（结算口径）：Publisher 先 deposit 将 NT 预存到合约形成 credit[publisher]。创建池/子任务并被领取时，按领取时确定的 weight 从 credit[publisher] 中划出对应额度并计入 pool.lockedBalance（锁定）。任务进入结算后，distribute 仅从 pool.lockedBalance 向各接包者转账已审核通过的份额；被撤回/过期/未完成的份额保留在 pool.lockedBalance ，在24h公示期后转入 credit[publisher]，由 publisher 自行 withdraw 取回。

Publisher（发包者）：
仅拥有“最终大任务/整池”的最终审核权与驳回权（例如：finalApprovePool / finalRejectPool / requestFinalize）。
不参与子任务的审核/打回/改权重/撤回（避免 publisher 直接干预分配过程）。

Manager（拆任务的人）：
仅拥有子任务的审核与打回权（例如：approveSubtask / rejectSubtask）。
不拥有最终大任务的权限（不能触发最终结算、不能推翻最终结果）。

Admin（平台）：
仅在争议/作恶风险时介入：可暂停自动结算、并在暂停后执行兜底结算/解锁/按运营裁决处理。

claimTask 成功时即写入 claimer 与 weight，并据此锁定对应金额；只有子任务审核失败，manager重新发布子任务，这个时候子任务重新回归未领取状态的时候，才可以由manager改动金额。所有未领取的任务都可以改金额/撤回。注意所有子任务金额总数不得超过publisher一开始发布的总金额。“所有未领取的任务都可以改金额/撤回”，这个权限参考manager和publisher各自的权限。

结算触发与自动分发：当 Publisher 对“最终大任务”点击最后一次审核通过后，合约写入 finalizeEligibleAt 并进入 24 小时冷静期；冷静期内禁止 cancel/expire/回收/改权重 等会影响资金归属的操作，以防 publisher/manager 作恶。冷静期结束后，任何人都可调用 distribute 触发结算：合约从池子的 lockedBalance 直接向已完成子任务的接包者转账 NT；未完成/被撤回/过期的剩余资金作为 refund 退回 Publisher。若 refund 直接转账失败，则不影响接包者的分发，失败部分记入 credit[publisher] 由 Publisher 之后手动 withdraw 取回。若发生申诉，Admin 可对该池 pause 以阻止自动结算，并在处理后再恢复或执行兜底结算。
这里的 Credit 主要是“兜底与可提取余额”，不是结算前置容器；结算前的资金归属应该都体现在 Pool 的 lockedBalance 里。

仲裁执行者（预留）与兜底分发：合约保留 arbitrationExecutor（仲裁执行者）地址（默认初始化为 admin，并允许 admin 后续更新它。），用于在申诉/争议场景下执行链下裁决的最终发钱与退款。arbitrationExecutor 默认等于 admin，且可由 admin 随时更新为独立合约/多签地址。被 pause 的池子中，只有 arbitrationExecutor 可调用 adminDistribute(poolId, recipients, amounts, refundTo) 一次性完成分发与退款；该接口需满足“总额不超出池内可分配余额、且只能执行一次（执行后池子结算关闭）”，以避免超发与重复结算。

publisher「发错了整池退款」只会在完全没人领任务时成立。这个时候也应该还没有manager来领任务。