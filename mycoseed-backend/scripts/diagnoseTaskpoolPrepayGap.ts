/**
 * 自动排查：taskpool_prepay_intents = success 且带 tx_hash，但 task_info.taskpool_create_tx_hash 仍为空的行。
 * 对每笔调用与 prepay-complete 相同的 verifyTaskpoolPoolCreatedByTx，并打印结论。
 *
 * 需：后端 .env（SUPABASE_*、OP_RPC_URL、TASKPOOL_PROXY_ADDRESS 等，与 taskpool.ts 一致）
 *
 *   npm run diagnose:taskpool-prepay-gap
 *
 * 可选环境变量：
 *   DIAGNOSE_LIMIT=20   最多检查几条 intent（默认 15）
 */
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { verifyTaskpoolPoolCreatedByTx } from '../src/services/taskpoolOnchainVerify'

function j(x: unknown) {
  return JSON.stringify(
    x,
    (_k, v) => (typeof v === 'bigint' ? v.toString() : v),
    2
  )
}

async function main() {
  const url = process.env.SUPABASE_URL?.trim()
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)?.trim()
  if (!url || !key) {
    console.error('缺少 SUPABASE_URL 与 SUPABASE_SERVICE_ROLE_KEY（或 ANON_KEY）')
    process.exit(1)
  }

  const limit = Math.min(50, Math.max(1, Number(process.env.DIAGNOSE_LIMIT) || 15))
  const supabase = createClient(url, key)

  const { data: intents, error: ie } = await supabase
    .from('taskpool_prepay_intents')
    .select('id, task_info_id, tx_hash, amount_human, status, updated_at, state_token')
    .eq('status', 'success')
    .not('tx_hash', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (ie) throw ie
  if (!intents?.length) {
    console.log('没有「success + 有 tx_hash」的预付记录。')
    return
  }

  const gaps: typeof intents = []
  for (const row of intents) {
    const tid = row.task_info_id as string
    const { data: ti, error: te } = await supabase
      .from('task_info')
      .select('id, taskpool_create_tx_hash, use_taskpool, planned_lock_nt')
      .eq('id', tid)
      .maybeSingle()
    if (te) throw te
    if (!ti) {
      console.warn(`[skip] intent ${row.id} 对应 task_info 不存在: ${tid}`)
      continue
    }
    if (!(ti as any).use_taskpool) continue
    if ((ti as any).taskpool_create_tx_hash) continue
    gaps.push(row)
  }

  if (!gaps.length) {
    console.log(
      `已检查最近 ${intents.length} 条成功预付：未发现「链上未写回 taskpool_create_tx_hash」的缺口（或均为非 taskpool）。`
    )
    return
  }

  console.log(`发现 ${gaps.length} 条「预付成功但 task_info 仍无建池 tx 哈希」记录，开始链上校验…\n`)

  let anyFail = false
  for (const row of gaps) {
    const tx = String(row.tx_hash || '').trim()
    const taskInfoId = String(row.task_info_id)
    const amountHuman = String((row as any).amount_human ?? '').trim() || '0'

    console.log('========')
    console.log('task_info_id:', taskInfoId)
    console.log('tx_hash:', tx)
    console.log('amount_human (intent):', amountHuman)

    const v = await verifyTaskpoolPoolCreatedByTx({ taskInfoId, txHash: tx, amountHuman })
    console.log('verifyTaskpoolPoolCreatedByTx:', j(v))

    if (v.ok) {
      console.log(
        '→ 链上校验 **通过**：说明当前 OP_RPC_URL + TASKPOOL_PROXY_ADDRESS 下能读到 PoolCreated；' +
          '库未更新更可能是当时 prepay-complete 未成功写库、或旧进程配置不同、或需补一次回写。'
      )
    } else {
      anyFail = true
      console.log('→ 链上校验 **未通过**：原因见上，请对照 TASKPOOL_PROXY_ADDRESS / RPC / tx 是否同一网络。')
    }
    console.log('')
  }

  process.exit(anyFail ? 2 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
