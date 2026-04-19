import assert from 'node:assert/strict'
import { createPublicClient, createWalletClient, http, type Address, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { optimism } from 'viem/chains'
import { taskPoolAbi } from '../utils/taskpool/abi'
import { buildCreatePoolMessage, signCreatePool } from '../utils/taskpool/eip712'
import { uuidToTaskPoolUint256 } from '../utils/taskpool/ids'

/**
 * 无弹窗真交易（方案一）：
 * - 用测试私钥直接发 createTaskPool（demo 参数）
 * - 成功后 PATCH 回写 taskpoolPhase/txHash 到后端
 *
 * 运行：
 * TASKPOOL_TEST_PRIVATE_KEY=0x... TASKPOOL_TASK_INFO_ID=<uuid> TASKPOOL_BACKEND_AUTH_TOKEN=... npm run taskpool:onchain-createpool-demo
 */

const chainId = Number(process.env.NUXT_PUBLIC_CHAIN_ID || '10')
assert.equal(chainId, 10, '本脚本当前仅用于 OP=10（可按需扩展）')

const proxyAddress = (process.env.NUXT_PUBLIC_TASKPOOL_PROXY_ADDRESS ||
  process.env.TASKPOOL_PROXY_ADDRESS) as Address | undefined
if (!proxyAddress) throw new Error('缺少 NUXT_PUBLIC_TASKPOOL_PROXY_ADDRESS / TASKPOOL_PROXY_ADDRESS')

const rpcUrl = (process.env.NUXT_PUBLIC_OP_RPC_URL || process.env.OP_RPC_URL) as string | undefined
if (!rpcUrl) throw new Error('缺少 NUXT_PUBLIC_OP_RPC_URL / OP_RPC_URL')

const pk = process.env.TASKPOOL_TEST_PRIVATE_KEY as `0x${string}` | undefined
if (!pk?.startsWith('0x')) throw new Error('缺少 TASKPOOL_TEST_PRIVATE_KEY（0x 开头）')

const taskInfoId = process.env.TASKPOOL_TASK_INFO_ID || ''
if (!taskInfoId) throw new Error('缺少 TASKPOOL_TASK_INFO_ID（task_info.id 的 UUID）')

const backendBaseUrl = process.env.API_BASE_URL || 'http://127.0.0.1:3001'
const backendAuth = process.env.TASKPOOL_BACKEND_AUTH_TOKEN || ''
if (!backendAuth) throw new Error('缺少 TASKPOOL_BACKEND_AUTH_TOKEN（后端 Bearer token，用于 PATCH 回写）')

const account = privateKeyToAccount(pk)
const chain = {
  ...optimism,
  rpcUrls: { ...optimism.rpcUrls, default: { http: [rpcUrl] } },
}

const publicClient = createPublicClient({ chain, transport: http(rpcUrl) })
const walletClient = createWalletClient({ chain, transport: http(rpcUrl), account })

const poolId = uuidToTaskPoolUint256(taskInfoId)
const nonce = (await publicClient.readContract({
  address: proxyAddress,
  abi: taskPoolAbi,
  functionName: 'creditNonces',
  args: [account.address as Address],
})) as bigint

const now = Math.floor(Date.now() / 1000)
const claimDeadline = BigInt(now + 86400 * 7)
const credentialDeadline = BigInt(now + 86400 * 8)
const sigDeadline = BigInt(now + 3600)

// demo 参数：同一地址兼任 publisher/manager；单子任务 taskId=1；lockedBalance=0；maxAmount=0
const msg = buildCreatePoolMessage({
  poolId,
  publisher: account.address,
  manager: account.address,
  taskIds: [1n],
  taskMaxAmounts: [0n],
  lockedBalance: 0n,
  claimDeadline,
  credentialDeadline,
  nonce,
  sigDeadline,
})

const sig = await signCreatePool(
  walletClient,
  account.address,
  chainId,
  proxyAddress as `0x${string}`,
  msg
)

const txHash = (await walletClient.writeContract({
  address: proxyAddress,
  abi: taskPoolAbi,
  functionName: 'createTaskPool',
  args: [poolId, account.address, [1n], [0n], 0n, claimDeadline, credentialDeadline, nonce, sigDeadline, sig as Hex],
})) as Hex

console.log('[taskpool] createTaskPool tx sent:', txHash)
await publicClient.waitForTransactionReceipt({ hash: txHash })
console.log('[taskpool] createTaskPool confirmed')

// 回写后端
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

console.log('[taskpool] backend patched: phase=pool_created txHash=', txHash)

