import { hashTypedData, type WalletClient } from 'viem'
import { signTypedData } from 'viem/actions'
import { hashPackedUint256Array } from './packed'

/** 与 TaskPoolLogicV2 一致 */
export const TASKPOOL_EIP712_NAME = 'TaskPool' as const
export const TASKPOOL_EIP712_VERSION = '4' as const

export function taskPoolDomain(
  chainId: number,
  verifyingContract: `0x${string}`
) {
  return {
    name: TASKPOOL_EIP712_NAME,
    version: TASKPOOL_EIP712_VERSION,
    chainId,
    verifyingContract,
  } as const
}

/** primaryType CreateTaskPool — 字段顺序与合约 typehash 一致 */
export const taskPoolCreateTypes = {
  CreateTaskPool: [
    { name: 'poolId', type: 'uint256' },
    { name: 'publisher', type: 'address' },
    { name: 'manager', type: 'address' },
    { name: 'taskIdsHash', type: 'bytes32' },
    { name: 'taskMaxAmountsHash', type: 'bytes32' },
    { name: 'lockedBalance', type: 'uint256' },
    { name: 'claimDeadline', type: 'uint256' },
    { name: 'credentialDeadline', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'sigDeadline', type: 'uint256' },
  ],
} as const

/** primaryType ClaimTask */
export const taskPoolClaimTypes = {
  ClaimTask: [
    { name: 'poolId', type: 'uint256' },
    { name: 'taskId', type: 'uint256' },
    { name: 'claimer', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'taskClaimNonce', type: 'uint256' },
    { name: 'sigDeadline', type: 'uint256' },
  ],
} as const

export type CreatePoolMessage = {
  poolId: bigint
  publisher: `0x${string}`
  manager: `0x${string}`
  taskIdsHash: `0x${string}`
  taskMaxAmountsHash: `0x${string}`
  lockedBalance: bigint
  claimDeadline: bigint
  credentialDeadline: bigint
  nonce: bigint
  sigDeadline: bigint
}

export type ClaimTaskMessage = {
  poolId: bigint
  taskId: bigint
  claimer: `0x${string}`
  amount: bigint
  taskClaimNonce: bigint
  sigDeadline: bigint
}

/**
 * 由原始 taskIds / maxAmounts 构造 CreatePool 消息（含合约同款双 hash）。
 * manager 必须等于将发送 createTaskPool 的交易发送者（msg.sender）。
 */
export function buildCreatePoolMessage(params: {
  poolId: bigint
  publisher: `0x${string}`
  manager: `0x${string}`
  taskIds: readonly bigint[]
  taskMaxAmounts: readonly bigint[]
  lockedBalance: bigint
  claimDeadline: bigint
  credentialDeadline: bigint
  nonce: bigint
  sigDeadline: bigint
}): CreatePoolMessage {
  return {
    poolId: params.poolId,
    publisher: params.publisher,
    manager: params.manager,
    taskIdsHash: hashPackedUint256Array(params.taskIds),
    taskMaxAmountsHash: hashPackedUint256Array(params.taskMaxAmounts),
    lockedBalance: params.lockedBalance,
    claimDeadline: params.claimDeadline,
    credentialDeadline: params.credentialDeadline,
    nonce: params.nonce,
    sigDeadline: params.sigDeadline,
  }
}

/** 离线 digest（与合约 `eth_signTypedData` / `SignatureChecker` 验签一致） */
export function hashCreatePoolTypedData(
  chainId: number,
  proxyAddress: `0x${string}`,
  message: CreatePoolMessage
): `0x${string}` {
  return hashTypedData({
    domain: taskPoolDomain(chainId, proxyAddress),
    types: taskPoolCreateTypes,
    primaryType: 'CreateTaskPool',
    message,
  })
}

export function hashClaimTaskTypedData(
  chainId: number,
  proxyAddress: `0x${string}`,
  message: ClaimTaskMessage
): `0x${string}` {
  return hashTypedData({
    domain: taskPoolDomain(chainId, proxyAddress),
    types: taskPoolClaimTypes,
    primaryType: 'ClaimTask',
    message,
  })
}

/** Publisher 对建池参数做 EIP-712 签名 */
export async function signCreatePool(
  wallet: WalletClient,
  account: `0x${string}`,
  chainId: number,
  proxyAddress: `0x${string}`,
  message: CreatePoolMessage
): Promise<`0x${string}`> {
  return signTypedData(wallet, {
    account,
    domain: taskPoolDomain(chainId, proxyAddress),
    types: taskPoolCreateTypes,
    primaryType: 'CreateTaskPool',
    message,
  })
}

/** 领取人对 Claim 参数签名（验签人为 Manager 或 Admin） */
export async function signClaimTask(
  wallet: WalletClient,
  account: `0x${string}`,
  chainId: number,
  proxyAddress: `0x${string}`,
  message: ClaimTaskMessage
): Promise<`0x${string}`> {
  return signTypedData(wallet, {
    account,
    domain: taskPoolDomain(chainId, proxyAddress),
    types: taskPoolClaimTypes,
    primaryType: 'ClaimTask',
    message,
  })
}
