/**
 * 阶段 4.2：TaskPool 链上步骤迁移到 Semi 的推荐顺序（风险/频次：预付 → 建池 → 领取 → 结算）。
 * 每步可独立 Semi 路由或未来统一「合约调用页」；此处仅作产品与测试的稳定约定。
 */
export const TASKPOOL_SEMI_OPERATION_ORDER = [
  'prepay_deposit',
  'create_task_pool',
  'claim_task',
  'distribute_settle',
] as const

export type TaskpoolSemiOperationId = (typeof TASKPOOL_SEMI_OPERATION_ORDER)[number]
