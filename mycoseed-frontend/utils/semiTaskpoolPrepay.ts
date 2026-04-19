/**
 * Semi TaskPool 预付：拼链、解析回跳（与 semi-app /taskpool/prepay 及 SEMI_PREPAY_PROTOCOL_V0 对齐）
 */

/** 与 manage 页写入 sessionStorage 的 key 一致，用于回跳校验 state */
export const SEMI_TASKPOOL_PREPAY_STATE_KEY = 'semi_taskpool_prepay_state'

export type SemiPrepayCallbackStatus = 'success' | 'failed' | 'cancelled'

export type SemiPrepayCallbackParsed = {
  status: SemiPrepayCallbackStatus | null
  state: string | null
  chain_id: string | null
  pool_uuid: string | null
  user_op_hash: string | null
  tx_hash: string | null
  error_code: string | null
  error: string | null
}

/** 解析 `location.search` 或 `?a=1&b=2` */
export function parseSemiPrepayCallback(search: string): SemiPrepayCallbackParsed {
  const s = search.startsWith('?') ? search : `?${search}`
  const u = new URLSearchParams(s.slice(1))
  const rawStatus = u.get('status')
  const status: SemiPrepayCallbackStatus | null =
    rawStatus === 'success' || rawStatus === 'failed' || rawStatus === 'cancelled' ? rawStatus : null
  return {
    status,
    state: u.get('state'),
    chain_id: u.get('chain_id'),
    pool_uuid: u.get('pool_uuid'),
    user_op_hash: u.get('user_op_hash'),
    tx_hash: u.get('tx_hash'),
    error_code: u.get('error_code'),
    error: u.get('error'),
  }
}

export function buildSemiTaskpoolPrepayUrl(opts: {
  semiAppBaseUrl: string
  /** 完整 URL，须在 Semi 白名单内 */
  returnUrl: string
  state: string
  chainId: number
  tokenAddress: string
  taskpoolProxyAddress: string
  /** 人类可读十进制字符串，如 "12.5" */
  amountHuman: string
  poolUuid?: string
  /** 可选：同一笔 UserOp 里追加 createTaskPoolSelf（V3） */
  poolId?: string
  /** 逗号分隔的 uint256 十进制字符串（taskIds） */
  taskIds?: string
  /** 逗号分隔的 uint256 十进制字符串（taskMaxAmounts，单位=wei） */
  taskMaxAmounts?: string
  /** unix seconds */
  claimDeadline?: string
  /** unix seconds */
  credentialDeadline?: string
}): string {
  const base = opts.semiAppBaseUrl.replace(/\/+$/, '')
  const params = new URLSearchParams({
    chain_id: String(opts.chainId),
    token_address: opts.tokenAddress,
    taskpool_proxy: opts.taskpoolProxyAddress,
    amount: opts.amountHuman,
    return_url: opts.returnUrl,
    state: opts.state,
  })
  if (opts.poolUuid) params.set('pool_uuid', opts.poolUuid)
  if (opts.poolId) params.set('pool_id', opts.poolId)
  if (opts.taskIds) params.set('task_ids', opts.taskIds)
  if (opts.taskMaxAmounts) params.set('task_max_amounts', opts.taskMaxAmounts)
  if (opts.claimDeadline) params.set('claim_deadline', opts.claimDeadline)
  if (opts.credentialDeadline) params.set('credential_deadline', opts.credentialDeadline)
  return `${base}/taskpool/prepay?${params.toString()}`
}

export function buildSemiTaskpoolClaimUrl(opts: {
  semiAppBaseUrl: string
  /** 完整 URL，须在 Semi 白名单内 */
  returnUrl: string
  state: string
  chainId: number
  taskpoolProxyAddress: string
  poolId: string
  taskId: string
  amountWei: string
  sigDeadline: string
  signature: string
}): string {
  const base = opts.semiAppBaseUrl.replace(/\/+$/, '')
  const params = new URLSearchParams({
    chain_id: String(opts.chainId),
    taskpool_proxy: opts.taskpoolProxyAddress,
    pool_id: opts.poolId,
    task_id: opts.taskId,
    amount_wei: opts.amountWei,
    sig_deadline: opts.sigDeadline,
    signature: opts.signature,
    return_url: opts.returnUrl,
    state: opts.state,
  })
  return `${base}/taskpool/claim?${params.toString()}`
}

export function buildSemiTaskpoolApproveUrl(opts: {
  semiAppBaseUrl: string
  returnUrl: string
  state: string
  chainId: number
  taskpoolProxyAddress: string
  poolId: string
  taskId: string
}): string {
  const base = opts.semiAppBaseUrl.replace(/\/+$/, '')
  const params = new URLSearchParams({
    chain_id: String(opts.chainId),
    taskpool_proxy: opts.taskpoolProxyAddress,
    pool_id: opts.poolId,
    task_id: opts.taskId,
    return_url: opts.returnUrl,
    state: opts.state,
  })
  return `${base}/taskpool/approve?${params.toString()}`
}

export function buildSemiTaskpoolFinalApproveUrl(opts: {
  semiAppBaseUrl: string
  returnUrl: string
  state: string
  chainId: number
  taskpoolProxyAddress: string
  poolId: string
}): string {
  const base = opts.semiAppBaseUrl.replace(/\/+$/, '')
  const params = new URLSearchParams({
    chain_id: String(opts.chainId),
    taskpool_proxy: opts.taskpoolProxyAddress,
    pool_id: opts.poolId,
    return_url: opts.returnUrl,
    state: opts.state,
  })
  return `${base}/taskpool/final-approve?${params.toString()}`
}

export function buildSemiTaskpoolDistributeUrl(opts: {
  semiAppBaseUrl: string
  returnUrl: string
  state: string
  chainId: number
  taskpoolProxyAddress: string
  poolId: string
}): string {
  const base = opts.semiAppBaseUrl.replace(/\/+$/, '')
  const params = new URLSearchParams({
    chain_id: String(opts.chainId),
    taskpool_proxy: opts.taskpoolProxyAddress,
    pool_id: opts.poolId,
    return_url: opts.returnUrl,
    state: opts.state,
  })
  return `${base}/taskpool/distribute?${params.toString()}`
}

/** OP Mainnet 浏览器查看交易 */
export function optimismTxExplorerUrl(txHash: string): string {
  const h = txHash.startsWith('0x') ? txHash : `0x${txHash}`
  return `https://optimistic.etherscan.io/tx/${h}`
}

/** 任务池管理页路径（`taskInfoId` = `pool_uuid`） */
export function taskpoolManagePath(taskInfoId: string): string {
  const id = String(taskInfoId || '').trim()
  return `/tasks/pool/${encodeURIComponent(id)}/manage`
}
