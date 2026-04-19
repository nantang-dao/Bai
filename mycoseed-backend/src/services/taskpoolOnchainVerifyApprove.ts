import { decodeEventLog, isHex } from 'viem'
import { taskpoolConfig } from '../config/taskpool'
import { taskpoolReadPublicClient } from './taskpoolReadClient'
import { uuidToTaskPoolUint256 } from '../utils/taskpool/ids'

const subtaskApprovedEventAbi = [
  {
    type: 'event',
    name: 'SubtaskApproved',
    inputs: [
      { indexed: true, name: 'poolId', type: 'uint256' },
      { indexed: true, name: 'taskId', type: 'uint256' },
      { indexed: true, name: 'manager', type: 'address' },
    ],
  },
] as const

export type VerifyTaskpoolApproveByTxResult =
  | { ok: true; txHash: `0x${string}`; poolId: bigint; taskId: bigint; manager: `0x${string}` }
  | { ok: false; txHash: `0x${string}` | null; error: string }

export async function verifyTaskpoolSubtaskApprovedByTx(opts: {
  taskInfoId: string
  taskRowId: string
  txHash: string
}): Promise<VerifyTaskpoolApproveByTxResult> {
  try {
    const tx = opts.txHash.trim()
    if (!isHex(tx) || tx.length !== 66) return { ok: false, txHash: null, error: 'tx_hash 非法' }
    const txHash = tx as `0x${string}`

    const expectedPoolId = uuidToTaskPoolUint256(opts.taskInfoId)
    const expectedTaskId = uuidToTaskPoolUint256(opts.taskRowId)

    const receipt = await taskpoolReadPublicClient.getTransactionReceipt({ hash: txHash })
    if (receipt.status !== 'success') return { ok: false, txHash, error: '链上交易失败' }

    const proxy = taskpoolConfig.proxyAddress.toLowerCase()
    const logs = receipt.logs.filter((l) => l.address.toLowerCase() === proxy)

    for (const log of logs) {
      try {
        const decoded = decodeEventLog({ abi: subtaskApprovedEventAbi, data: log.data, topics: log.topics })
        if (decoded.eventName !== 'SubtaskApproved') continue
        const args = decoded.args as any
        const poolId = args.poolId as bigint
        const taskId = args.taskId as bigint
        if (poolId !== expectedPoolId) continue
        if (taskId !== expectedTaskId) continue
        return { ok: true, txHash, poolId, taskId, manager: args.manager as `0x${string}` }
      } catch {
        // ignore
      }
    }

    return { ok: false, txHash, error: '未在 receipt logs 中找到匹配的 SubtaskApproved 事件' }
  } catch (e: any) {
    return { ok: false, txHash: isHex(opts.txHash) ? (opts.txHash as `0x${string}`) : null, error: e?.message || 'verify failed' }
  }
}

