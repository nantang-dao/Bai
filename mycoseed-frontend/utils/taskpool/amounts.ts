import { formatUnits, parseUnits } from 'viem'

/** NT 精度：与 ERC20 常规一致为 18 */
export const NT_DECIMALS = 18 as const

/** 将人类可读的 NT（如 "1.23"）转为链上 wei（uint256） */
export function parseNtToWei(amount: string | number | bigint): bigint {
  if (typeof amount === 'bigint') return amount
  const s = typeof amount === 'number' ? String(amount) : String(amount).trim()
  if (!s) throw new Error('[taskpool] amount 为空，无法转换为 wei')
  return parseUnits(s, NT_DECIMALS)
}

/** 将链上 wei（uint256）转为人类可读 NT 字符串（不做四舍五入裁剪） */
export function formatNtFromWei(wei: bigint): string {
  return formatUnits(wei, NT_DECIMALS)
}

