import { hexToBigInt, keccak256, stringToBytes } from 'viem'

/**
 * poolId / taskId 与链上一致：`uint256(keccak256(UTF-8 bytes of canonical UUID string))`.
 *
 * canonical：trim、转小写、保持带连字符的 8-4-4-4-12 形式（与 RFC 4122 常见打印形式一致）。
 */
export function normalizeUuidForTaskPool(uuid: string): string {
  const s = uuid.trim().toLowerCase()
  const re =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
  if (!re.test(s)) {
    throw new Error(
      `[taskpool] 无效 UUID，无法派生链上 id：${uuid.slice(0, 64)}`
    )
  }
  return s
}

/** 从 UUID（或等于 UUID 的 task_info.id）派生 poolId / taskId */
export function uuidToTaskPoolUint256(uuid: string): bigint {
  const canonical = normalizeUuidForTaskPool(uuid)
  const h = keccak256(stringToBytes(canonical))
  return hexToBigInt(h)
}

