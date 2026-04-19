import assert from 'node:assert/strict'

/**
 * 子任务草稿逐条删除（高级版 C）：API 级脚本测试
 *
 * 需要：
 * - AUTH_TOKEN_PUBLISHER：创建者（认领前可维护草稿）
 * - AUTH_TOKEN_MANAGER：Manager（认领后可维护草稿；创建者无权）
 * - API_BASE_URL 或 NUXT_PUBLIC_API_URL：后端（默认 http://127.0.0.1:3001）
 */

const apiBaseUrl =
  process.env.API_BASE_URL || process.env.NUXT_PUBLIC_API_URL || 'http://127.0.0.1:3001'
const publisherToken = process.env.AUTH_TOKEN_PUBLISHER
const managerToken =
  process.env.AUTH_TOKEN_MANAGER?.trim() || process.env.AUTH_TOKEN_PUBLISHER?.trim()

assert.ok(publisherToken, '请设置 AUTH_TOKEN_PUBLISHER')
assert.ok(managerToken, '请设置 AUTH_TOKEN_MANAGER 或 AUTH_TOKEN_PUBLISHER（普通任务可同一账号）')

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

async function createPool(): Promise<string> {
  const now = Date.now()
  const resp = await fetch(`${apiBaseUrl}/api/tasks`, {
    method: 'POST',
    headers: h(publisherToken!),
    body: JSON.stringify({
      title: `subtask-del-${now}`,
      description: 'script subtask delete',
      reward: 1,
      participantLimit: 1,
      rewardDistributionMode: 'per_person',
      startDate: new Date(Date.now() + 60_000).toISOString(),
      deadline: new Date(Date.now() + 60 * 60_000).toISOString(),
      submitDeadline: new Date(Date.now() + 120 * 60_000).toISOString(),
      submissionInstructions: 'n/a',
      proofConfig: { photo: { enabled: false } },
      useTaskpool: true,
      allowSplit: true,
    }),
  })
  const data = await mustJson(resp)
  assert.equal(resp.ok, true, JSON.stringify(data))
  assert.ok(data.taskInfoId, JSON.stringify(data))
  return data.taskInfoId as string
}

async function createSubtask(tid: string, token: string): Promise<string> {
  const resp = await fetch(`${apiBaseUrl}/api/task-info/${tid}/subtasks`, {
    method: 'POST',
    headers: h(token),
    body: JSON.stringify({ title: `st-${Date.now()}`, sortOrder: 0 }),
  })
  const data = await mustJson(resp)
  assert.equal(resp.ok, true, JSON.stringify(data))
  assert.ok(data?.subtask?.id, JSON.stringify(data))
  return data.subtask.id as string
}

async function delSubtask(tid: string, subtaskId: string, token: string) {
  const resp = await fetch(`${apiBaseUrl}/api/task-info/${tid}/subtasks/${subtaskId}`, {
    method: 'DELETE',
    headers: h(token),
  })
  return { resp, data: await mustJson(resp) }
}

async function claimManager(tid: string) {
  const resp = await fetch(`${apiBaseUrl}/api/task-info/${tid}/claim-manager`, {
    method: 'POST',
    headers: h(managerToken!),
    body: JSON.stringify({}),
  })
  const data = await mustJson(resp)
  assert.equal(resp.ok, true, JSON.stringify(data))
}

async function finalize(tid: string) {
  const resp = await fetch(`${apiBaseUrl}/api/task-info/${tid}/subtasks/finalize`, {
    method: 'POST',
    headers: h(managerToken!),
    body: JSON.stringify({}),
  })
  const data = await mustJson(resp)
  assert.equal(resp.ok, true, JSON.stringify(data))
}

const tid = await createPool()

// 认领前：创建者可创建 & 删除
const st0 = await createSubtask(tid, publisherToken!)
let d = await delSubtask(tid, st0, publisherToken!)
assert.equal(d.resp.ok, true, JSON.stringify(d.data))

// 认领后：仅 Manager 可编辑（创建者无权）
await claimManager(tid)
const st1 = await createSubtask(tid, managerToken!)
const st2 = await createSubtask(tid, managerToken!)

d = await delSubtask(tid, st1, publisherToken!)
assert.equal(d.resp.ok, false, '认领后创建者不应能删除子任务草稿')

d = await delSubtask(tid, st1, managerToken!)
assert.equal(d.resp.ok, true, JSON.stringify(d.data))

// 定稿后：不可删除
await finalize(tid)
d = await delSubtask(tid, st2, managerToken!)
assert.equal(d.resp.ok, false, '定稿后不应能删除子任务草稿')

console.log('[taskpool] subtask delete: OK', { taskInfoId: tid })

