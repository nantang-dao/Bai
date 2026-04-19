/**
 * TaskPool V2 链下工具：UUID → uint256、encodePacked 哈希、EIP-712（CreatePool / ClaimTask）。
 * verifyingContract 必须填 **Proxy**；EIP712 version 与合约一致为 "4"。
 */
export {
  normalizeUuidForTaskPool,
  uuidToTaskPoolUint256,
} from './ids'
export { NT_DECIMALS, formatNtFromWei, parseNtToWei } from './amounts'
export { hashPackedUint256Array } from './packed'
export { erc20Abi, taskPoolAbi } from './abi'
export {
  TASKPOOL_EIP712_NAME,
  TASKPOOL_EIP712_VERSION,
  taskPoolDomain,
  taskPoolCreateTypes,
  taskPoolClaimTypes,
  buildCreatePoolMessage,
  hashCreatePoolTypedData,
  hashClaimTaskTypedData,
  signCreatePool,
  signClaimTask,
  type CreatePoolMessage,
  type ClaimTaskMessage,
} from './eip712'
