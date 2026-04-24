import { decodeEventLog, isHex } from 'viem'
import { taskpoolConfig } from '../config/taskpool'
import { taskpoolReadPublicClient } from './taskpoolReadClient'
import { uuidToTaskPoolUint256 } from '../utils/taskpool/ids'

/** 必须与链上 TaskPoolLogic V2/V3/V4 一致：`Distributed(uint256,uint256,uint256,bool)` */
const distributedEventAbi = [
  {
    type: 'event',
    name: 'Distributed',
    inputs: [
      { indexed: true, name: 'poolId', type: 'uint256' },
      { indexed: false, name: 'paidOut', type: 'uint256' },
      { indexed: false, name: 'refund', type: 'uint256' },
      { indexed: false, name: 'refundToCredit', type: 'bool' },
    ],
  },
] as const

export type VerifyTaskpoolDistributeByTxResult =
  | {
      ok: true
      txHash: `0x${string}`
      poolId: bigint
      /** 合约字段 `paidOut`（历史字段名 totalPaid 兼容） */
      paidOut: bigint
      refund: bigint
      refundToCredit: boolean
      totalPaid: bigint
    }
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
        const paidOut = args.paidOut as bigint
        const refund = args.refund as bigint
        const refundToCredit = Boolean(args.refundToCredit)
        return {
          ok: true,
          txHash,
          poolId,
          paidOut,
          refund,
          refundToCredit,
          totalPaid: paidOut,
        }
      } catch {
        // ignore
      }
    }
    return { ok: false, txHash, error: '未在 receipt logs 中找到匹配的 Distributed 事件' }
  } catch (e: any) {
    return { ok: false, txHash: isHex(opts.txHash) ? (opts.txHash as `0x${string}`) : null, error: e?.message || 'verify failed' }
  }
}

