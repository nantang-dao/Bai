import { decodeEventLog, isHex } from 'viem'
import { taskpoolConfig } from '../config/taskpool'
import { taskpoolReadPublicClient } from './taskpoolReadClient'
import { parseNtToWei } from '../utils/taskpool/amounts'
import { uuidToTaskPoolUint256 } from '../utils/taskpool/ids'

const poolCreatedEventAbi = [
  {
    type: 'event',
    name: 'PoolCreated',
    inputs: [
      { indexed: true, name: 'poolId', type: 'uint256' },
      { indexed: true, name: 'publisher', type: 'address' },
      { indexed: true, name: 'manager', type: 'address' },
      { indexed: false, name: 'lockedBalance', type: 'uint256' },
      { indexed: false, name: 'claimDeadline', type: 'uint256' },
      { indexed: false, name: 'credentialDeadline', type: 'uint256' },
    ],
  },
] as const

export type VerifyTaskpoolCreateByTxResult =
  | {
      ok: true
      txHash: `0x${string}`
      poolId: bigint
      publisher: `0x${string}`
      manager: `0x${string}`
      lockedBalance: bigint
      claimDeadline: bigint
      credentialDeadline: bigint
      warnings: string[]
    }
  | {
      ok: false
      txHash: `0x${string}` | null
      error: string
    }

/**
 * 在 OP 主网上用 tx receipt 验证：该笔 tx 是否真的对 TaskPool Proxy 发出了 PoolCreated(poolId, ...)。
 * - 仅用于“回跳后链上确权”，不改变任何链上状态。
 */
export async function verifyTaskpoolPoolCreatedByTx(opts: {
  taskInfoId: string
  txHash: string
  /** 人类可读金额（与 intent 一致），用于核对 lockedBalance */
  amountHuman: string
}): Promise<VerifyTaskpoolCreateByTxResult> {
  try {
    const tx = opts.txHash.trim()
    if (!isHex(tx) || tx.length !== 66) {
      return { ok: false, txHash: null, error: 'tx_hash 非法' }
    }
    const txHash = tx as `0x${string}`

    const expectedPoolId = uuidToTaskPoolUint256(opts.taskInfoId)
    const expectedLocked = parseNtToWei(opts.amountHuman)
    const warnings: string[] = []

    const receipt = await taskpoolReadPublicClient.getTransactionReceipt({ hash: txHash })
    if (receipt.status !== 'success') {
      return { ok: false, txHash, error: '链上交易失败（receipt.status != success）' }
    }

    const proxy = taskpoolConfig.proxyAddress.toLowerCase()
    const matches = receipt.logs.filter((l) => l.address.toLowerCase() === proxy)

    for (const log of matches) {
      try {
        const decoded = decodeEventLog({
          abi: poolCreatedEventAbi,
          data: log.data,
          topics: log.topics,
        })
        if (decoded.eventName !== 'PoolCreated') continue
        const args = decoded.args as any
        const poolId = args.poolId as bigint
        if (poolId !== expectedPoolId) continue

        const lockedBalance = args.lockedBalance as bigint
        if (lockedBalance !== expectedLocked) {
          warnings.push(
            `lockedBalance 与期望不一致：onchain=${lockedBalance.toString()} expected=${expectedLocked.toString()}`
          )
        }

        return {
          ok: true,
          txHash,
          poolId,
          publisher: args.publisher as `0x${string}`,
          manager: args.manager as `0x${string}`,
          lockedBalance,
          claimDeadline: args.claimDeadline as bigint,
          credentialDeadline: args.credentialDeadline as bigint,
          warnings,
        }
      } catch {
        // ignore non-matching logs
      }
    }

    return {
      ok: false,
      txHash,
      error: `未在 receipt logs 中找到匹配的 PoolCreated(poolId=${expectedPoolId.toString()})（请确认 Semi 是否已把 createTaskPoolSelf 打进同一笔 tx）`,
    }
  } catch (e: any) {
    return {
      ok: false,
      txHash: isHex(opts.txHash) ? (opts.txHash as `0x${string}`) : null,
      error: e?.message || 'verify failed',
    }
  }
}

