import { isAddress, type Address } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { taskpoolConfig } from '../config/taskpool'
import { taskpoolReadPublicClient } from './taskpoolReadClient'
import { parseNtToWei } from '../utils/taskpool/amounts'
import { uuidToTaskPoolUint256 } from '../utils/taskpool/ids'
import { taskPoolAbi } from '../utils/taskpool/abi'

export type ClaimIntentResult =
  | {
      ok: true
      chainId: number
      verifyingContract: `0x${string}`
      message: {
        poolId: string
        taskId: string
        claimer: `0x${string}`
        amountWei: string
        taskClaimNonce: string
        sigDeadline: string
      }
      signature: `0x${string}`
      signer: `0x${string}`
    }
  | { ok: false; status: number; error: string }

const domain = {
  name: 'TaskPool',
  version: '4',
} as const

const types = {
  ClaimTask: [
    { name: 'poolId', type: 'uint256' },
    { name: 'taskId', type: 'uint256' },
    { name: 'claimer', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'taskClaimNonce', type: 'uint256' },
    { name: 'sigDeadline', type: 'uint256' },
  ],
} as const

function getSignerPrivateKey(): `0x${string}` | null {
  const raw = (process.env.TASKPOOL_CLAIM_SIGNER_PRIVATE_KEY || '').trim()
  if (!raw) return null
  const pk = raw.startsWith('0x') ? raw : `0x${raw}`
  return pk as `0x${string}`
}

export async function buildTaskpoolClaimIntent(opts: {
  taskInfoId: string
  taskRowId: string
  claimerAddress: string
  /** 单人 NT（如 1.23），将转为 wei */
  rewardNtHuman: string
}): Promise<ClaimIntentResult> {
  const pk = getSignerPrivateKey()
  if (!pk) {
    return {
      ok: false,
      status: 501,
      error:
        '服务器尚未配置 Claim 签名人私钥（TASKPOOL_CLAIM_SIGNER_PRIVATE_KEY）。该部分先占位，待你回来确认签名执行方式后再接。',
    }
  }

  if (!isAddress(opts.claimerAddress)) {
    return { ok: false, status: 400, error: 'claimerAddress 非法' }
  }
  const claimer = opts.claimerAddress as Address

  const poolId = uuidToTaskPoolUint256(opts.taskInfoId)
  const taskId = uuidToTaskPoolUint256(opts.taskRowId)
  const amountWei = parseNtToWei(opts.rewardNtHuman)

  const task = await taskpoolReadPublicClient.readContract({
    address: taskpoolConfig.proxyAddress,
    abi: taskPoolAbi,
    functionName: 'poolTasks',
    args: [poolId, taskId],
  })

  const exists = task[5] as boolean
  if (!exists) {
    return { ok: false, status: 409, error: '链上 taskId 不存在（池未建好或 taskId 派生不一致）' }
  }

  const taskClaimNonce = task[3] as bigint
  const sigDeadline = BigInt(Math.floor(Date.now() / 1000) + 10 * 60) // 10 分钟

  const account = privateKeyToAccount(pk)

  const digestMessage = {
    poolId,
    taskId,
    claimer,
    amount: amountWei,
    taskClaimNonce,
    sigDeadline,
  } as const

  const sig = await account.signTypedData({
    domain: {
      ...domain,
      chainId: BigInt(taskpoolConfig.chainId),
      verifyingContract: taskpoolConfig.proxyAddress,
    },
    types,
    primaryType: 'ClaimTask',
    message: digestMessage,
  })

  return {
    ok: true,
    chainId: taskpoolConfig.chainId,
    verifyingContract: taskpoolConfig.proxyAddress,
    message: {
      poolId: poolId.toString(),
      taskId: taskId.toString(),
      claimer: claimer as `0x${string}`,
      amountWei: amountWei.toString(),
      taskClaimNonce: taskClaimNonce.toString(),
      sigDeadline: sigDeadline.toString(),
    },
    signature: sig as `0x${string}`,
    signer: account.address,
  }
}

