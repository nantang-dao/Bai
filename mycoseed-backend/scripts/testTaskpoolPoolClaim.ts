/**
 * API：任务池商城主入口行 PATCH /api/tasks/:id/claim
 * - 发布者也可领池主行 → Manager + claimer（200，claimRole=taskpool_manager）
 * - 同用户重复领取 409；已有他人 Manager 时他人再领 403
 *
 * 方式 A（推荐）：不设 POOL_PRIMARY_TASK_ID，脚本会先 POST /api/tasks 创建任务池
 *   （useTaskpool + participantLimit=1 → 首条 tasks 行为 listing_kind=taskpool_pool），再跑领取断言。
 *
 * 方式 B：已有一条池主行时，可设 POOL_PRIMARY_TASK_ID=tasks.id。
 *   若该 id 在库里不存在（404），脚本会自动改「创建新任务池」，并提示 unset 掉旧的 POOL_PRIMARY_TASK_ID。
 *
 * 需：后端 npm run dev、AUTH_TOKEN_PUBLISHER、AUTH_TOKEN_CANDIDATE（两个不同账号）
 *
 *   API_BASE_URL=http://127.0.0.1:3001 \
 *   AUTH_TOKEN_PUBLISHER=... \
 *   AUTH_TOKEN_CANDIDATE=... \
 *   npm run test:taskpool-pool-claim
 */
import 'dotenv/config'
import assert from 'node:assert/strict'

const apiBaseUrl =
  process.env.API_BASE_URL || process.env.NUXT_PUBLIC_API_URL || 'http://127.0.0.1:3001'
const publisherToken = process.env.AUTH_TOKEN_PUBLISHER
const candidateToken = process.env.AUTH_TOKEN_CANDIDATE
const poolTaskIdFromEnv = process.env.POOL_PRIMARY_TASK_ID?.trim()

function h(token: string) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
}

async function mustJson(resp: Response) {
  const txt = await resp.text()
  try {
    return JSON.parse(txt)
  } catch {
    throw new Error(`非 JSON(${resp.status}): ${txt.slice(0, 300)}`)
  }
}

/** 创建任务池：首行即为 taskpool_pool（与 tasksController createTask 一致） */
async function createTaskpoolWithPoolPrimary(): Promise<{ poolPrimaryTaskId: string; taskInfoId: string }> {
  const now = Date.now()
  const resp = await fetch(`${apiBaseUrl}/api/tasks`, {
    method: 'POST',
    headers: h(publisherToken!),
    body: JSON.stringify({
      title: `tp-pool-claim-${now}`,
      description: 'testTaskpoolPoolClaim auto-create',
      reward: 1,
      participantLimit: 1,
      rewardDistributionMode: 'per_person',
      // 报名必须已开始，否则 PATCH claim 会 400「任务尚未开始」（勿用「未来」的 startDate）
      startDate: new Date(Date.now() - 120_000).toISOString(),
      deadline: new Date(Date.now() + 60 * 60_000).toISOString(),
      submitDeadline: new Date(Date.now() + 120 * 60_000).toISOString(),
      submissionInstructions: 'n/a',
      proofConfig: { photo: { enabled: false } },
      useTaskpool: true,
      allowSplit: true,
    }),
  })
  const data = await mustJson(resp)
  assert.equal(resp.ok, true, `创建任务池失败: ${JSON.stringify(data)}`)
  const poolPrimaryTaskId = data.id as string | undefined
  const taskInfoId = data.taskInfoId as string | undefined
  assert.ok(poolPrimaryTaskId, JSON.stringify(data))
  assert.ok(taskInfoId, JSON.stringify(data))
  return { poolPrimaryTaskId, taskInfoId }
}

async function claim(taskId: string, token: string) {
  const resp = await fetch(`${apiBaseUrl}/api/tasks/${taskId}/claim`, {
    method: 'PATCH',
    headers: h(token),
    body: JSON.stringify({}),
  })
  return { resp, data: await mustJson(resp) }
}

async function claimManager(taskInfoId: string, token: string) {
  const resp = await fetch(`${apiBaseUrl}/api/task-info/${taskInfoId}/claim-manager`, {
    method: 'POST',
    headers: h(token),
    body: JSON.stringify({}),
  })
  return { resp, data: await mustJson(resp) }
}

async function main() {
  if (!publisherToken || !candidateToken) {
    console.log(
      '[SKIP] testTaskpoolPoolClaim：缺少 AUTH_TOKEN_PUBLISHER 或 AUTH_TOKEN_CANDIDATE（需要真实登录态）'
    )
    return
  }
  if (publisherToken === candidateToken) {
    console.error('AUTH_TOKEN_PUBLISHER 与 AUTH_TOKEN_CANDIDATE 须为两个不同账号')
    process.exit(1)
  }

  const preUrl = (id: string) => `${apiBaseUrl}/api/tasks/${id}`

  let poolTaskId: string

  if (poolTaskIdFromEnv) {
    console.log(`[使用环境变量] POOL_PRIMARY_TASK_ID=${poolTaskIdFromEnv}`)
    console.log(`[预检] GET ${preUrl(poolTaskIdFromEnv)}`)
    const preResp = await fetch(preUrl(poolTaskIdFromEnv))
    const preBody = await mustJson(preResp)

    if (preResp.ok) {
      poolTaskId = poolTaskIdFromEnv
      const lk = (preBody as any).listingKind ?? (preBody as any).listing_kind
      if (lk && lk !== 'taskpool_pool') {
        console.warn(`[预检] listing_kind=${lk}，期望 taskpool_pool（领取语义可能非池主入口）`)
      }
    } else if (preResp.status === 404) {
      console.warn(
        '[预检] 该 POOL_PRIMARY_TASK_ID 在当前库读不到（常为 task_info_id 或旧数据）。改为自动创建新任务池。'
      )
      console.warn('[提示] 可执行: unset POOL_PRIMARY_TASK_ID  （避免下次仍带上无效 id）')
      console.log(
        '[创建] POST /api/tasks（useTaskpool + participantLimit=1 → 首行 listing_kind=taskpool_pool）…'
      )
      const created = await createTaskpoolWithPoolPrimary()
      poolTaskId = created.poolPrimaryTaskId
      console.log(`[创建] tasks.id=${poolTaskId}`)
      console.log(`[创建] task_info.id=${created.taskInfoId}`)
      const pre2 = await fetch(preUrl(poolTaskId))
      const body2 = await mustJson(pre2)
      if (!pre2.ok) {
        console.error('[预检] 新建后仍失败:', pre2.status, JSON.stringify(body2))
        process.exit(1)
      }
    } else {
      console.error('[预检] 失败:', preResp.status, JSON.stringify(preBody))
      console.error(
        '请核对：tasks.id、SUPABASE_SERVICE_ROLE_KEY、与创建任务为同一 Supabase 项目。'
      )
      process.exit(1)
    }
  } else {
    console.log(
      '[创建] POST /api/tasks（useTaskpool + participantLimit=1 → 首行 listing_kind=taskpool_pool）…'
    )
    const created = await createTaskpoolWithPoolPrimary()
    poolTaskId = created.poolPrimaryTaskId
    console.log(`[创建] tasks.id=${poolTaskId}`)
    console.log(`[创建] task_info.id=${created.taskInfoId}`)

    console.log(`[预检] GET ${preUrl(poolTaskId)}`)
    const preResp = await fetch(preUrl(poolTaskId))
    const preBody = await mustJson(preResp)
    if (!preResp.ok) {
      console.error('[预检] 失败:', preResp.status, JSON.stringify(preBody))
      console.error(
        '请核对：后端 .env 使用 SUPABASE_SERVICE_ROLE_KEY；与创建任务为同一 Supabase 项目。'
      )
      process.exit(1)
    }
    const lk = (preBody as any).listingKind ?? (preBody as any).listing_kind
    if (lk && lk !== 'taskpool_pool') {
      console.warn(`[预检] listing_kind=${lk}，期望 taskpool_pool（领取语义可能非池主入口）`)
    }
  }

  // 1) 发布者领池主行 → 成功（发布者也可为 Manager）
  let r = await claim(poolTaskId, publisherToken!)
  assert.equal(r.resp.status, 200, JSON.stringify(r.data))
  assert.equal(r.data.success, true)
  assert.equal(r.data.claimRole, 'taskpool_manager')

  // 2) 发布者重复领取 → 409
  r = await claim(poolTaskId, publisherToken!)
  assert.equal(r.resp.status, 409, JSON.stringify(r.data))

  // 3) 他人无法再领（已有 Manager）
  r = await claim(poolTaskId, candidateToken!)
  assert.equal(r.resp.status, 403, JSON.stringify(r.data))

  // 4) claim-manager 在已有 Manager 时 403
  const taskInfoResp = await fetch(`${apiBaseUrl}/api/tasks/${poolTaskId}`)
  const taskPayload = await mustJson(taskInfoResp)
  const taskInfoId = taskPayload?.taskInfoId || taskPayload?.task_info_id
  assert.ok(taskInfoId, JSON.stringify(taskPayload))
  r = await claimManager(taskInfoId, candidateToken!)
  assert.equal(r.resp.status, 403, JSON.stringify(r.data))

  console.log('testTaskpoolPoolClaim: OK')
}

function isConnRefused(err: unknown): boolean {
  const c = err as { cause?: { code?: string } }
  return c?.cause?.code === 'ECONNREFUSED'
}

main().catch((e) => {
  if (isConnRefused(e)) {
    console.error(
      `无法连接 ${apiBaseUrl}（ECONNREFUSED）。请先在本目录启动后端：npm run dev\n` +
        '若使用其它端口：export API_BASE_URL=http://127.0.0.1:<端口>'
    )
  } else {
    console.error(e)
  }
  process.exit(1)
})
