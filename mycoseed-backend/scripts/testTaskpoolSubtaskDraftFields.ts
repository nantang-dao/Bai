/**
 * 子任务草稿字段增强：集成测试（2 账号即可）
 *
 * 覆盖：
 * - 创建任务池 → Manager 认领池主入口（写 manager_user_id）
 * - 创建子任务草稿（含新增字段）→ 读取确认字段存在
 * - 越界 submitDeadlineOverride（晚于 pool submitDeadline）→ 400
 * - PATCH 子任务草稿更新字段 → 读取确认更新生效
 *
 * 用法：
 *   API_BASE_URL=http://127.0.0.1:3001 \
 *   AUTH_TOKEN_PUBLISHER=... \
 *   AUTH_TOKEN_MANAGER=... \
 *   npm run test:taskpool-subtask-draft-fields
 */
import 'dotenv/config'
import assert from 'node:assert/strict'

const apiBaseUrl =
  process.env.API_BASE_URL || process.env.NUXT_PUBLIC_API_URL || 'http://127.0.0.1:3001'
const publisherToken = process.env.AUTH_TOKEN_PUBLISHER
const managerToken = process.env.AUTH_TOKEN_MANAGER || process.env.AUTH_TOKEN_CANDIDATE || publisherToken

function h(token: string) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
}

async function mustJson(resp: Response) {
  const txt = await resp.text()
  try {
    return JSON.parse(txt)
  } catch {
    throw new Error(`非 JSON(${resp.status}): ${txt.slice(0, 400)}`)
  }
}

function dtLocalPlusMinutes(mins: number) {
  const d = new Date(Date.now() + mins * 60_000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

async function createTaskpool() {
  const now = Date.now()
  const resp = await fetch(`${apiBaseUrl}/api/tasks`, {
    method: 'POST',
    headers: h(publisherToken!),
    body: JSON.stringify({
      title: `tp-subtask-fields-${now}`,
      description: 'testTaskpoolSubtaskDraftFields',
      reward: 1,
      participantLimit: 1,
      rewardDistributionMode: 'per_person',
      startDate: new Date(Date.now() - 120_000).toISOString(),
      deadline: new Date(Date.now() + 60 * 60_000).toISOString(),
      submitDeadline: dtLocalPlusMinutes(120), // 用 YYYY-MM-DDTHH:mm，匹配后端 parseLocalDateTime 逻辑
      submissionInstructions: 'n/a',
      proofConfig: { photo: { enabled: false } },
      useTaskpool: true,
      allowSplit: true,
    }),
  })
  const data = await mustJson(resp)
  assert.equal(resp.ok, true, `创建任务池失败: ${JSON.stringify(data)}`)
  assert.ok(data.id && data.taskInfoId, JSON.stringify(data))
  return { poolPrimaryTaskId: data.id as string, taskInfoId: data.taskInfoId as string }
}

async function claimPoolPrimary(taskId: string, token: string) {
  const resp = await fetch(`${apiBaseUrl}/api/tasks/${taskId}/claim`, {
    method: 'PATCH',
    headers: h(token),
    body: JSON.stringify({}),
  })
  return { resp, data: await mustJson(resp) }
}

async function createSubtask(taskInfoId: string, token: string, body: any) {
  const resp = await fetch(`${apiBaseUrl}/api/task-info/${taskInfoId}/subtasks`, {
    method: 'POST',
    headers: h(token),
    body: JSON.stringify(body),
  })
  return { resp, data: await mustJson(resp) }
}

async function patchSubtask(taskInfoId: string, subtaskId: string, token: string, body: any) {
  const resp = await fetch(`${apiBaseUrl}/api/task-info/${taskInfoId}/subtasks/${subtaskId}`, {
    method: 'PATCH',
    headers: h(token),
    body: JSON.stringify(body),
  })
  return { resp, data: await mustJson(resp) }
}

async function listSubtasks(taskInfoId: string, token: string) {
  const resp = await fetch(`${apiBaseUrl}/api/task-info/${taskInfoId}/subtasks`, {
    headers: h(token),
  })
  return { resp, data: await mustJson(resp) }
}

async function finalizeSubtasks(taskInfoId: string, token: string) {
  const resp = await fetch(`${apiBaseUrl}/api/task-info/${taskInfoId}/subtasks/finalize`, {
    method: 'POST',
    headers: h(token),
    body: JSON.stringify({}),
  })
  return { resp, data: await mustJson(resp) }
}

function isConnRefused(err: unknown): boolean {
  const c = err as { cause?: { code?: string } }
  return c?.cause?.code === 'ECONNREFUSED'
}

async function main() {
  if (!publisherToken || !managerToken) {
    console.log(
      '[SKIP] testTaskpoolSubtaskDraftFields：缺少 AUTH_TOKEN_PUBLISHER 或 AUTH_TOKEN_MANAGER（需要真实登录态）'
    )
    return
  }
  assert.notEqual(publisherToken, managerToken, '两枚 token 须为不同账号')

  const pool = await createTaskpool()
  let r = await claimPoolPrimary(pool.poolPrimaryTaskId, managerToken!)
  assert.equal(r.resp.status, 200, JSON.stringify(r.data))

  // 无权限：manager 已认领后，publisher 不再可编辑子任务草稿（应 403）
  r = await createSubtask(pool.taskInfoId, publisherToken!, { title: `pub-should-403-${Date.now()}`, sortOrder: 0 })
  assert.equal(r.resp.status, 403, `期望 publisher create=403，得到 ${r.resp.status}: ${JSON.stringify(r.data)}`)

  // 合法：submitDeadlineOverride <= pool submitDeadline
  const okDeadline = dtLocalPlusMinutes(60)
  r = await createSubtask(pool.taskInfoId, managerToken!, {
    title: `子任务-${Date.now()}`,
    sortOrder: 0,
    description: 'desc',
    submissionInstructions: 'inst',
    proofConfig: { description: { enabled: true, minWords: 3 } },
    participantLimit: 2,
    rewardNt: 0.5,
    submitDeadlineOverride: okDeadline,
  })
  assert.equal(r.resp.status, 201, JSON.stringify(r.data))
  const sub = (r.data as any)?.subtask
  assert.ok(sub?.id, JSON.stringify(r.data))
  assert.equal(sub.description, 'desc')
  assert.equal(sub.submissionInstructions, 'inst')
  assert.equal(sub.participantLimit, 2)

  // 越界：晚于 pool submitDeadline → 400
  const badDeadline = dtLocalPlusMinutes(200)
  r = await createSubtask(pool.taskInfoId, managerToken!, {
    title: `bad-${Date.now()}`,
    sortOrder: 1,
    submitDeadlineOverride: badDeadline,
  })
  assert.equal(r.resp.status, 400, `期望越界 400，得到 ${r.resp.status}: ${JSON.stringify(r.data)}`)

  // PATCH 更新
  r = await patchSubtask(pool.taskInfoId, sub.id, managerToken!, {
    description: 'desc2',
    participantLimit: 1,
  })
  assert.equal(r.resp.status, 200, JSON.stringify(r.data))
  assert.equal((r.data as any)?.subtask?.description, 'desc2')
  assert.equal((r.data as any)?.subtask?.participantLimit, 1)

  // GET 列表确认
  const l = await listSubtasks(pool.taskInfoId, managerToken!)
  assert.equal(l.resp.status, 200, JSON.stringify(l.data))
  const list = (l.data as any)?.subtasks || []
  assert.ok(Array.isArray(list) && list.find((x: any) => x.id === sub.id), '列表应包含已创建子任务')

  // 定稿后：不可再编辑/新增（应 400）
  const fin = await finalizeSubtasks(pool.taskInfoId, managerToken!)
  assert.equal(fin.resp.status, 200, JSON.stringify(fin.data))

  r = await createSubtask(pool.taskInfoId, managerToken!, { title: `after-finalize-${Date.now()}`, sortOrder: 99 })
  assert.equal(r.resp.status, 400, `期望定稿后 create=400，得到 ${r.resp.status}: ${JSON.stringify(r.data)}`)

  r = await patchSubtask(pool.taskInfoId, sub.id, managerToken!, { description: 'should-fail' })
  assert.equal(r.resp.status, 400, `期望定稿后 patch=400，得到 ${r.resp.status}: ${JSON.stringify(r.data)}`)

  console.log('testTaskpoolSubtaskDraftFields: OK')
}

main().catch((e) => {
  if (isConnRefused(e)) {
    console.error(
      `无法连接 ${apiBaseUrl}（ECONNREFUSED）。请先启动后端：npm run dev\n` +
        '若使用其它端口：export API_BASE_URL=http://127.0.0.1:<端口>'
    )
  } else {
    console.error(e)
  }
  process.exit(1)
})

