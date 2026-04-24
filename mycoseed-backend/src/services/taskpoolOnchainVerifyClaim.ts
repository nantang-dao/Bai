import { decodeEventLog, isHex, parseAbiItem } from 'viem'
import { taskpoolConfig } from '../config/taskpool'
import { taskpoolReadPublicClient } from './taskpoolReadClient'
import { uuidToTaskPoolUint256 } from '../utils/taskpool/ids'
import { parseNtToWei } from '../utils/taskpool/amounts'

const taskClaimedEventAbi = [
  {
    type: 'event',
    name: 'TaskClaimed',
    inputs: [
      { indexed: true, name: 'poolId', type: 'uint256' },
      { indexed: true, name: 'taskId', type: 'uint256' },
      { indexed: true, name: 'assignee', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
    ],
  },
] as const

const taskClaimedParsed = parseAbiItem(
  'event TaskClaimed(uint256 indexed poolId, uint256 indexed taskId, address indexed assignee, uint256 amount)',
)

export type VerifyTaskpoolClaimByTxResult =
  | {
      ok: true
      txHash: `0x${string}`
      poolId: bigint
      taskId: bigint
      assignee: `0x${string}`
      amountWei: bigint
    }
  | { ok: false; txHash: `0x${string}` | null; error: string }

export async function verifyTaskpoolTaskClaimedByTx(opts: {
  taskInfoId: string
  taskRowId: string
  txHash: string
  claimerAddress: `0x${string}`
  rewardNtHuman: string
}): Promise<VerifyTaskpoolClaimByTxResult> {
  try {
    const tx = opts.txHash.trim()
    if (!isHex(tx) || tx.length !== 66) return { ok: false, txHash: null, error: 'tx_hash 非法' }
    const txHash = tx as `0x${string}`

    const expectedPoolId = uuidToTaskPoolUint256(opts.taskInfoId)
    const expectedTaskId = uuidToTaskPoolUint256(opts.taskRowId)
    const expectedAmountWei = parseNtToWei(opts.rewardNtHuman)

    const receipt = await taskpoolReadPublicClient.getTransactionReceipt({ hash: txHash })
    if (receipt.status !== 'success') {
      return { ok: false, txHash, error: '链上交易失败（receipt.status != success）' }
    }

    const proxy = taskpoolConfig.proxyAddress.toLowerCase()
    const logs = receipt.logs.filter((l) => l.address.toLowerCase() === proxy)

    for (const log of logs) {
      try {
        const decoded = decodeEventLog({ abi: taskClaimedEventAbi, data: log.data, topics: log.topics })
        if (decoded.eventName !== 'TaskClaimed') continue
        const args = decoded.args as any
        const poolId = args.poolId as bigint
        const taskId = args.taskId as bigint
        if (poolId !== expectedPoolId) continue
        if (taskId !== expectedTaskId) continue
        const assignee = (args.assignee as string).toLowerCase()
        if (assignee !== opts.claimerAddress.toLowerCase()) {
          return { ok: false, txHash, error: 'assignee 与当前用户地址不匹配' }
        }
        const amountWei = args.amount as bigint
        if (amountWei !== expectedAmountWei) {
          return { ok: false, txHash, error: 'amount 与期望不一致' }
        }
        return { ok: true, txHash, poolId, taskId, assignee: args.assignee as `0x${string}`, amountWei }
      } catch {
        // ignore
      }
    }

    return { ok: false, txHash, error: '未在 receipt logs 中找到匹配的 TaskClaimed 事件' }
  } catch (e: any) {
    return { ok: false, txHash: isHex(opts.txHash) ? (opts.txHash as `0x${string}`) : null, error: e?.message || 'verify failed' }
  }
}

/**
 * 在未持有 tx_hash 时，从代理合约按索引参数扫描 TaskClaimed 日志，返回最近一次匹配的链上交易哈希。
 * 用于 Semi 回跳失败但链上已领取后的补同步（分块查询，避免单次范围过大被 RPC 拒绝）。
 */
export async function findTaskClaimedTransactionHash(opts: {
  taskInfoId: string
  taskRowId: string
  assignee: `0x${string}`
  /** 从该区块起扫（通常为 PoolCreated / 建池交易所在块） */
  fromBlock: bigint
}): Promise<`0x${string}` | null> {
  const poolId = uuidToTaskPoolUint256(opts.taskInfoId)
  const taskId = uuidToTaskPoolUint256(opts.taskRowId)
  const proxy = taskpoolConfig.proxyAddress
  const assignee = opts.assignee

  const latest = await taskpoolReadPublicClient.getBlockNumber()
  let start = opts.fromBlock > latest ? latest : opts.fromBlock

  while (start <= latest) {
    let chunk = 40_000n
    while (chunk >= 2_000n) {
      const end = start + chunk - 1n > latest ? latest : start + chunk - 1n
      try {
        const logs = await taskpoolReadPublicClient.getLogs({
          address: proxy,
          event: taskClaimedParsed,
          args: { poolId, taskId, assignee },
          fromBlock: start,
          toBlock: end,
        })
        if (logs.length > 0) {
          return logs[logs.length - 1].transactionHash
        }
        start = end + 1n
        break
      } catch (e) {
        if (chunk <= 2_000n) throw e
        chunk = chunk / 2n
      }
    }
  }

  return null
}

