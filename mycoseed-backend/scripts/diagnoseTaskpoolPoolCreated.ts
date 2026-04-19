/**
 * 本地诊断：对某笔链上 tx 是否包含与 task_info.id 对应的 PoolCreated（与 prepay-complete 同源校验）。
 *
 * 用法（需与后端相同的 OP_RPC_URL、TASKPOOL_PROXY 等，见 src/config/taskpool）：
 *
 *   TASK_INFO_ID=<uuid> TX_HASH=0x... AMOUNT_HUMAN=12.5 npm run diagnose:taskpool-pool-created
 *
 * 依赖：dotenv 已加载（脚本内 import dotenv/config）
 */
import 'dotenv/config'
import { verifyTaskpoolPoolCreatedByTx } from '../src/services/taskpoolOnchainVerify'

async function main() {
  const taskInfoId = process.env.TASK_INFO_ID?.trim()
  const txHash = process.env.TX_HASH?.trim()
  const amountHuman = process.env.AMOUNT_HUMAN?.trim() || '0'
  if (!taskInfoId || !txHash) {
    console.error('请设置 TASK_INFO_ID 与 TX_HASH')
    process.exit(1)
  }
  const v = await verifyTaskpoolPoolCreatedByTx({ taskInfoId, txHash, amountHuman })
  console.log(JSON.stringify(v, (_k, x) => (typeof x === 'bigint' ? x.toString() : x), 2))
  process.exit(v.ok ? 0 : 2)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
