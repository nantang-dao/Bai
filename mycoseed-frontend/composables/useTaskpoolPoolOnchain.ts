import { createPublicClient, http, type Address } from 'viem'
import { optimism } from 'viem/chains'
import { useRuntimeConfig } from 'nuxt/app'
import { taskPoolAbi } from '~/utils/taskpool/abi'
import { uuidToTaskPoolUint256 } from '~/utils/taskpool'

export type TaskpoolPoolRow = {
  publisher: Address
  manager: Address
  lockedBalance: bigint
  allocated: bigint
  claimDeadline: bigint
  publicizeEligibleAt: bigint
  publicizeEndsAt: bigint
  paused: boolean
  settled: boolean
  taskIds: readonly bigint[]
  exists: boolean
  credentialDeadline: bigint
  poolRejected: boolean
}

function mapPoolTuple(row: readonly unknown[]): TaskpoolPoolRow {
  return {
    publisher: row[0] as Address,
    manager: row[1] as Address,
    lockedBalance: row[2] as bigint,
    allocated: row[3] as bigint,
    claimDeadline: row[4] as bigint,
    publicizeEligibleAt: row[5] as bigint,
    publicizeEndsAt: row[6] as bigint,
    paused: row[7] as boolean,
    settled: row[8] as boolean,
    taskIds: row[9] as readonly bigint[],
    exists: row[10] as boolean,
    credentialDeadline: row[11] as bigint,
    poolRejected: row[12] as boolean,
  }
}

/**
 * 只读：从 TaskPool Proxy 读取 pools(poolId)。用于任务详情页展示公示期与是否可结算。
 */
export function useTaskpoolPoolOnchain() {
  const config = useRuntimeConfig()

  function publicClient() {
    const rpcUrl = String(config.public.opRpcUrl || '')
    const chainId = Number(config.public.chainId ?? 10)
    const chain = {
      ...optimism,
      id: chainId,
      rpcUrls: {
        ...optimism.rpcUrls,
        default: { http: [rpcUrl] },
      },
    }
    return createPublicClient({
      chain,
      transport: http(rpcUrl),
    })
  }

  async function readPoolByTaskInfoId(taskInfoId: string): Promise<TaskpoolPoolRow | null> {
    if (!import.meta.client) return null
    const proxy = String(config.public.taskpoolProxyAddress || '').trim() as Address
    if (!proxy || proxy === '0x0000000000000000000000000000000000000000') {
      throw new Error('未配置 NUXT_PUBLIC_TASKPOOL_PROXY_ADDRESS')
    }
    const id = String(taskInfoId || '').trim()
    if (!id) return null
    const poolId = uuidToTaskPoolUint256(id)
    const raw = await publicClient().readContract({
      address: proxy,
      abi: taskPoolAbi,
      functionName: 'pools',
      args: [poolId],
    })
    return mapPoolTuple(raw as readonly unknown[])
  }

  /** 是否已终审开公示（链上 publicizeEndsAt 已写入） */
  function isPublicizeStarted(p: TaskpoolPoolRow): boolean {
    return p.publicizeEndsAt > 0n
  }

  /** 当前时间是否已超过公示结束时间（可尝试 distribute，仍需链上成功为准） */
  function isPublicizeEnded(p: TaskpoolPoolRow, nowSec: bigint): boolean {
    if (!isPublicizeStarted(p)) return false
    return nowSec >= p.publicizeEndsAt
  }

  /** 领取者视角：可展示「打开 Semi 结算」的前提（不含业务 phase，仅链上） */
  function canAttemptDistribute(p: TaskpoolPoolRow, nowSec: bigint): boolean {
    if (!p.exists || p.settled || p.paused || p.poolRejected) return false
    return isPublicizeEnded(p, nowSec)
  }

  return {
    readPoolByTaskInfoId,
    isPublicizeStarted,
    isPublicizeEnded,
    canAttemptDistribute,
  }
}
