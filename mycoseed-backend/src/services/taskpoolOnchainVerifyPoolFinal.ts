import { decodeEventLog, isHex } from 'viem'
import { taskpoolConfig } from '../config/taskpool'
import { taskpoolReadPublicClient } from './taskpoolReadClient'
import { uuidToTaskPoolUint256 } from '../utils/taskpool/ids'

const poolFinalApprovedEventAbi = [
  {
    type: 'event',
    name: 'PoolFinalApproved',
    inputs: [
      { indexed: true, name: 'poolId', type: 'uint256' },
      { indexed: true, name: 'publisher', type: 'address' },
      { indexed: true, name: 'manager', type: 'address' },
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
      publisher: `0x${string}`
      manager: `0x${string}`
      publicizeEligibleAt: bigint
      publicizeEndsAt: bigint
    }
  | { ok: false; txHash: `0x${string}` | null; error: string }

export async function verifyTaskpoolPoolFinalApprovedByTx(opts: {
  taskInfoId: string
  txHash: string
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
    for (const log of logs) {
      try {
        const decoded = decodeEventLog({ abi: poolFinalApprovedEventAbi, data: log.data, topics: log.topics })
        if (decoded.eventName !== 'PoolFinalApproved') continue
        const args = decoded.args as any
        const poolId = args.poolId as bigint
        if (poolId !== expectedPoolId) continue
        return {
          ok: true,
          txHash,
          poolId,
          publisher: args.publisher as `0x${string}`,
          manager: args.manager as `0x${string}`,
          publicizeEligibleAt: BigInt(args.publicizeEligibleAt as any),
          publicizeEndsAt: BigInt(args.publicizeEndsAt as any),
        }
      } catch {
        // ignore
      }
    }
    return { ok: false, txHash, error: '未在 receipt logs 中找到匹配的 PoolFinalApproved 事件' }
  } catch (e: any) {
    return { ok: false, txHash: isHex(opts.txHash) ? (opts.txHash as `0x${string}`) : null, error: e?.message || 'verify failed' }
  }
}

