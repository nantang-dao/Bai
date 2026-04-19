import { concat, keccak256, numberToHex, pad } from 'viem'

/** uint256 big-endian 32 字节，与 Solidity abi.encodePacked 单元素一致 */
function uint256ToBytes32(value: bigint): `0x${string}` {
  return pad(numberToHex(value, { size: 32 }))
}

/**
 * 对齐 TaskPoolLogicV2.createTaskPool：
 * `keccak256(abi.encodePacked(uint256[]))`。
 */
export function hashPackedUint256Array(
  values: readonly bigint[]
): `0x${string}` {
  if (values.length === 0) {
    return keccak256('0x')
  }
  const parts = values.map((v) => uint256ToBytes32(v))
  return keccak256(concat(parts as readonly `0x${string}`[]))
}
