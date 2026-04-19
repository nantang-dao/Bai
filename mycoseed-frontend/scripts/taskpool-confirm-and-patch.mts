import assert from 'node:assert/strict'
import { createPublicClient, http, type Hex } from 'viem'
import { optimism } from 'viem/chains'

/**
 * 方案 1（仅手动点 MetaMask 一次）后处理脚本：
 * - 等 createTaskPool 交易确认（RPC 轮询）
 * - PATCH 回写后端 taskpoolPhase / taskpoolCreateTxHash
 * - 打印回写结果（用于肉眼验收）
 *
 * 运行示例：
 * TASKPOOL_TASK_INFO_ID=<uuid> TASKPOOL_CREATE_TX_HASH=0x... TASKPOOL_BACKEND_AUTH_TOKEN=... \\
 * NUXT_PUBLIC_OP_RPC_URL=https://mainnet.optimism.io API_BASE_URL=http://127.0.0.1:3001 \\
 * npm run taskpool:confirm-and-patch
 */

const taskInfoId = process.env.TASKPOOL_TASK_INFO_ID || ''
if (!taskInfoId) throw new Error('缺少 TASKPOOL_TASK_INFO_ID（task_info.id UUID）')

const txHash = (process.env.TASKPOOL_CREATE_TX_HASH || '') as Hex
if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
  throw new Error('缺少/无效 TASKPOOL_CREATE_TX_HASH（形如 0x + 64 hex）')
}

const rpcUrl = process.env.NUXT_PUBLIC_OP_RPC_URL || process.env.OP_RPC_URL || ''
if (!rpcUrl) throw new Error('缺少 NUXT_PUBLIC_OP_RPC_URL / OP_RPC_URL')

const backendBaseUrl = process.env.API_BASE_URL || 'http://127.0.0.1:3001'
const backendAuth = process.env.TASKPOOL_BACKEND_AUTH_TOKEN || ''
if (!backendAuth) throw new Error('缺少 TASKPOOL_BACKEND_AUTH_TOKEN（后端 Bearer token）')

const timeoutMs = Number(process.env.TASKPOOL_CONFIRM_TIMEOUT_MS || '240000') || 240_000

const chain = {
  ...optimism,
  rpcUrls: { ...optimism.rpcUrls, default: { http: [rpcUrl] } },
}

const publicClient = createPublicClient({ chain, transport: http(rpcUrl) })

console.log('[taskpool] waiting receipt:', txHash)
const receipt = await publicClient.waitForTransactionReceipt({
  hash: txHash,
  timeout: timeoutMs,
})

if (receipt.status !== 'success') {
  throw new Error(`[taskpool] tx failed: status=${receipt.status}`)
}

console.log('[taskpool] confirmed in block:', receipt.blockNumber.toString())

const patchResp = await fetch(`${backendBaseUrl}/api/task-info/${taskInfoId}/taskpool`, {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${backendAuth}`,
  },
  body: JSON.stringify({
    taskpoolPhase: 'pool_created',
    taskpoolCreateTxHash: txHash,
  }),
})

if (!patchResp.ok) {
  const body = await patchResp.text().catch(() => '')
  throw new Error(`[taskpool] PATCH 回写失败: ${patchResp.status} ${patchResp.statusText} ${body}`)
}

const patched = (await patchResp.json().catch(() => ({}))) as any
const taskInfo = patched?.taskInfo
assert.ok(taskInfo, '[taskpool] PATCH 返回体缺少 taskInfo')

// patchTaskpoolMeta 后端 select('*') 返回 snake_case
assert.equal(taskInfo.taskpool_phase, 'pool_created')
assert.equal(taskInfo.taskpool_create_tx_hash, txHash)

console.log('[taskpool] backend patched OK:', {
  taskInfoId,
  taskpool_phase: taskInfo.taskpool_phase,
  taskpool_create_tx_hash: taskInfo.taskpool_create_tx_hash,
})

