import 'dotenv/config'

function mustEnv(name: string): string {
  const v = process.env[name]?.trim()
  if (!v) throw new Error(`[taskpool config] 缺少环境变量 ${name}`)
  return v
}

function optionalEnv(name: string): string | undefined {
  const v = process.env[name]?.trim()
  return v || undefined
}

function mustAddress(name: string): `0x${string}` {
  const v = mustEnv(name)
  if (!/^0x[0-9a-fA-F]{40}$/.test(v)) {
    throw new Error(`[taskpool config] ${name} 不是合法 EVM 地址：${v}`)
  }
  return v as `0x${string}`
}

function mustInt(name: string, fallback?: number): number {
  const raw = optionalEnv(name)
  const v = raw ? Number(raw) : fallback
  if (!Number.isInteger(v) || (v as number) <= 0) {
    throw new Error(`[taskpool config] ${name} 不是正整数：${raw}`)
  }
  return v as number
}

/**
 * TaskPool Step0 口径：链与合约常量
 * - 注意：后端只做“读配置与计算口径”；具体签名/交易步骤在后续 step 实现。
 */
export const taskpoolConfig = {
  chainId: mustInt('TASKPOOL_CHAIN_ID', 10),
  opRpcUrl:
    optionalEnv('OP_RPC_URL') ||
    'https://mainnet.optimism.io',
  proxyAddress: mustAddress('TASKPOOL_PROXY_ADDRESS'),
  adminAddress: mustAddress('TASKPOOL_ADMIN_ADDRESS'),
  ntTokenAddress: mustAddress('TASKPOOL_NT_TOKEN_ADDRESS'),
} as const

