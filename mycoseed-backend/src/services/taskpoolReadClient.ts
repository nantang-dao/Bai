import { createPublicClient, http } from 'viem'
import { optimism } from 'viem/chains'
import { taskpoolConfig } from '../config/taskpool'

/**
 * OP 主网只读客户端：统一超时与重试，避免默认公网 RPC（mainnet.optimism.io）易触发 viem 默认超时，
 * 导致 prepay-complete / 链上校验误报失败。
 */
export const taskpoolReadPublicClient = createPublicClient({
  chain: optimism,
  transport: http(taskpoolConfig.opRpcUrl, {
    timeout: 60_000,
    retryCount: 2,
  }),
})
