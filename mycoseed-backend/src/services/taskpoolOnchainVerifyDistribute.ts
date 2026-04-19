import { decodeEventLog, isHex } from 'viem'
import { taskpoolConfig } from '../config/taskpool'
import { taskpoolReadPublicClient } from './taskpoolReadClient'
import { uuidToTaskPoolUint256 } from '../utils/taskpool/ids'

const distributedEventAbi = [
  {
    type: 'event',
    name: 'Distributed',
    inputs: [
      { indexed: true, name: 'poolId', type: 'uint256' },
      { indexed: false, name: 'totalPaid', type: 'uint256' },
      { indexed: false, name: 'refund', type: 'uint256' },
    ],
  },
] as const

export type VerifyTaskpoolDistributeByTxResult =
  | { ok: true; txHash: `0x${string}`; poolId: bigint; totalPaid: bigint; refund: bigint }
  | { ok: false; txHash: `0x${string}` | null; error: string }

export async function verifyTaskpoolDistributedByTx(opts: {
  taskInfoId: string
  txHash: string
}): Promise<VerifyTaskpoolDistributeByTxResult> {
  try {
    const tx = opts.txHash.trim()
    if (!isHex(tx) || tx.length !== 66) return { ok: false, txHash: null, error: 'tx_hash 非法' }
    const txHash = tx as `0x${string}`
    const expectedPoolId = uuidToTaskPoolUint256(opts.taskInfoId)

    const receipt = await taskpoolReadPublicClient.getTransactionReceipt({ hash: txHash })
    if (receipt.status !== 'success') return { ok: false, txHash, error: '链上交易失败' }

    const proxy = taskpoolConfig.proxyAddress.toLowerCase()
    const logs = receipt.logs.filter((l) => l.address.toLowerCase() === proxy)
    for (const log of logs) {
      try {
        const decoded = decodeEventLog({ abi: distributedEventAbi, data: log.data, topics: log.topics })
        if (decoded.eventName !== 'Distributed') continue
        const args = decoded.args as any
        const poolId = args.poolId as bigint
        if (poolId !== expectedPoolId) continue
        return { ok: true, txHash, poolId, totalPaid: args.totalPaid as bigint, refund: args.refund as bigint }
      } catch {
        // ignore
      }
    }
    return { ok: false, txHash, error: '未在 receipt logs 中找到匹配的 Distributed 事件' }
  } catch (e: any) {
    return { ok: false, txHash: isHex(opts.txHash) ? (opts.txHash as `0x${string}`) : null, error: e?.message || 'verify failed' }
  }
}

