import { decodeEventLog, isHex } from 'viem'
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

