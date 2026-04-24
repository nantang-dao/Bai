import { decodeEventLog, isHex } from 'viem'
import { taskpoolConfig } from '../config/taskpool'
import { taskpoolReadPublicClient } from './taskpoolReadClient'
import { uuidToTaskPoolUint256 } from '../utils/taskpool/ids'
import { taskPoolAbi } from '../utils/taskpool/abi'

/** 与 TaskPoolLogicV3/V4 合约一致：仅 indexed poolId，时间戳为非 indexed */
const poolFinalApprovedEventAbi = [
  {
    type: 'event',
    name: 'PoolFinalApproved',
    inputs: [
      { indexed: true, name: 'poolId', type: 'uint256' },
      { indexed: false, name: 'publicizeEligibleAt', type: 'uint64' },
      { indexed: false, name: 'publicizeEndsAt', type: 'uint64' },
    ],
  },
] as const

export type VerifyTaskpoolFinalByTxResult =
  | {
      ok: true
      txHash: `0x${string}`
      poolId: bigint
      publicizeEligibleAt: bigint
      publicizeEndsAt: bigint
    }
  | { ok: false; txHash: `0x${string}` | null; error: string }

/**
 * 校验 receipt 中存在 PoolFinalApproved(poolId==taskInfoId)，且 poolId 与 task_info 对应。
 * 若传入 expectedCompletedTaskRowId（子任务 tasks.id），则额外读链上 poolTasks 校验 status==Completed（V4 终局一笔语义）。
 */
export async function verifyTaskpoolPoolFinalApprovedByTx(opts: {
  taskInfoId: string
  txHash: string
  /** V4：终局后要求该子任务行在链上为 Completed */
  expectedCompletedTaskRowId?: string
}): Promise<VerifyTaskpoolFinalByTxResult> {
  try {
    const tx = opts.txHash.trim()
    if (!isHex(tx) || tx.length !== 66) return { ok: false, txHash: null, error: 'tx_hash 非法' }
    const txHash = tx as `0x${string}`
    const expectedPoolId = uuidToTaskPoolUint256(opts.taskInfoId)

    const receipt = await taskpoolReadPublicClient.getTransactionReceipt({ hash: txHash })
    if (receipt.status !== 'success') return { ok: false, txHash, error: '链上交易失败' }

    const proxy = taskpoolConfig.proxyAddress.toLowerCase()
    const logs = receipt.logs.filter((l) => l.address.toLowerCase() === proxy)
    let found: { poolId: bigint; publicizeEligibleAt: bigint; publicizeEndsAt: bigint } | null = null
    for (const log of logs) {
      try {
        const decoded = decodeEventLog({ abi: poolFinalApprovedEventAbi, data: log.data, topics: log.topics })
        if (decoded.eventName !== 'PoolFinalApproved') continue
        const args = decoded.args as any
        const poolId = args.poolId as bigint
        if (poolId !== expectedPoolId) continue
        found = {
          poolId,
          publicizeEligibleAt: BigInt(args.publicizeEligibleAt as any),
          publicizeEndsAt: BigInt(args.publicizeEndsAt as any),
        }
        break
      } catch {
        // ignore
      }
    }
    if (!found) return { ok: false, txHash, error: '未在 receipt logs 中找到匹配的 PoolFinalApproved 事件' }

    const rowId = typeof opts.expectedCompletedTaskRowId === 'string' ? opts.expectedCompletedTaskRowId.trim() : ''
    if (rowId) {
      const expectedTaskId = uuidToTaskPoolUint256(rowId)
      const row = await taskpoolReadPublicClient.readContract({
        address: taskpoolConfig.proxyAddress,
        abi: taskPoolAbi,
        functionName: 'poolTasks',
        args: [expectedPoolId, expectedTaskId],
      })
      const status = Number((row as readonly unknown[])[4])
      if (status !== 1) {
        return { ok: false, txHash, error: `终局交易后子任务链上状态非 Completed（status=${status}）` }
      }
    }

    return {
      ok: true,
      txHash,
      poolId: found.poolId,
      publicizeEligibleAt: found.publicizeEligibleAt,
      publicizeEndsAt: found.publicizeEndsAt,
    }
  } catch (e: any) {
    return { ok: false, txHash: isHex(opts.txHash) ? (opts.txHash as `0x${string}`) : null, error: e?.message || 'verify failed' }
  }
}
