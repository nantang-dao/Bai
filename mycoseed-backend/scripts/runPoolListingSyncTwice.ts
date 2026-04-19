/**
 * 幂等校验：对同一 task_info_id 连续两次 ensure，池主 task id 应一致。
 *
 * 需环境变量：SUPABASE_URL、SUPABASE_SERVICE_ROLE_KEY（或 ANON_KEY）、TASK_INFO_ID（use_taskpool=true 的任务）
 *
 *   TASK_INFO_ID=xxx npx tsx scripts/runPoolListingSyncTwice.ts
 */
import assert from 'node:assert/strict'
import { ensureTaskpoolPoolPrimaryListing } from '../src/services/taskpoolMallSync'

async function main() {
  const taskInfoId = process.env.TASK_INFO_ID?.trim()
  if (!taskInfoId) {
    console.error('请设置 TASK_INFO_ID')
    process.exit(1)
  }
  if (!process.env.SUPABASE_URL || !(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)) {
    console.error('请设置 SUPABASE_URL 与 SUPABASE_SERVICE_ROLE_KEY（或 SUPABASE_ANON_KEY）')
    process.exit(1)
  }

  const first = await ensureTaskpoolPoolPrimaryListing(taskInfoId)
  const second = await ensureTaskpoolPoolPrimaryListing(taskInfoId)
  assert.equal(first.poolPrimaryTaskId, second.poolPrimaryTaskId, '两次同步应指向同一池主任务行')
  console.log('pool-listing-sync idempotent: OK', { poolPrimaryTaskId: first.poolPrimaryTaskId, first, second })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
