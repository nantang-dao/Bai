import assert from 'node:assert/strict'

/**
 * 任务池撤回（交付块 5.1A）脚本测试（API 级）
 *
 * 需要：
 * - AUTH_TOKEN_PUBLISHER：创建者
 * - NUXT_PUBLIC_API_URL 或 API_BASE_URL：后端
 *
 * 流程：
 * 1) publisher 创建任务池
 * 2) publisher 撤回任务池（taskInfoId 维度）
 * 3) 再尝试认领 manager（应 404 或失败），证明已删除
 */

const apiBaseUrl =
  process.env.API_BASE_URL ||
  process.env.NUXT_PUBLIC_API_URL ||
  process.env.NUXT_PUBLIC_API_URL?.replace(/\/$/, '') ||
  'http://127.0.0.1:3001'
const publisherToken = process.env.AUTH_TOKEN_PUBLISHER
assert.ok(publisherToken, '请设置 AUTH_TOKEN_PUBLISHER')

function h(token: string) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
}

async function mustJson(resp: Response) {
  const txt = await resp.text()
  try {
    return JSON.parse(txt)
  } catch {
    throw new Error(`非 JSON 响应(${resp.status}): ${txt.slice(0, 300)}`)
  }
}

async function assertTokenValid() {
  const resp = await fetch(`${apiBaseUrl}/api/auth/me`, { headers: h(publisherToken!) })
  if (!resp.ok) {
    const data = await mustJson(resp).catch(() => ({}))
    throw new Error(`publisher token 无法通过 /api/auth/me 校验: ${resp.status} ${JSON.stringify(data)}`)
  }
}

async function createTaskPool(): Promise<string> {
  const now = Date.now()
  const resp = await fetch(`${apiBaseUrl}/api/tasks`, {
    method: 'POST',
    headers: h(publisherToken!),
    body: JSON.stringify({
      title: `e2e-taskpool-withdraw-${now}`,
      description: 'script: withdraw taskpool',
      reward: 1,
      participantLimit: 1,
      rewardDistributionMode: 'per_person',
      startDate: new Date(Date.now() + 1 * 60_000).toISOString(),
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
  const tid = data?.taskInfoId as string | undefined
  assert.ok(tid, `未返回 taskInfoId: ${JSON.stringify(data)}`)
  return tid
}

async function createSubtaskDraft(taskInfoId: string) {
  const resp = await fetch(`${apiBaseUrl}/api/task-info/${taskInfoId}/subtasks`, {
    method: 'POST',
    headers: h(publisherToken!),
    body: JSON.stringify({ title: `draft-${Date.now()}`, sortOrder: 0 }),
  })
  const data = await mustJson(resp)
  assert.equal(resp.ok, true, `创建子任务草稿失败: ${JSON.stringify(data)}`)
  assert.ok(data?.subtask?.id, `未返回 subtask: ${JSON.stringify(data)}`)
}

async function listSubtasksShould404(taskInfoId: string) {
  const resp = await fetch(`${apiBaseUrl}/api/task-info/${taskInfoId}/subtasks`, {
    headers: h(publisherToken!),
  })
  assert.equal(resp.ok, false, '撤回后子任务草稿应被级联删除（task_info 已不存在）')
}

async function withdraw(taskInfoId: string) {
  const resp = await fetch(`${apiBaseUrl}/api/task-info/${taskInfoId}/withdraw`, {
    method: 'POST',
    headers: h(publisherToken!),
    body: JSON.stringify({}),
  })
  const data = await mustJson(resp)
  assert.equal(resp.ok, true, `撤回失败: ${JSON.stringify(data)}`)
  assert.equal(data?.success, true, `撤回应 success=true: ${JSON.stringify(data)}`)
  assert.ok(data?.draft?.title, '撤回应返回 draft')
}

async function claimShouldFail(taskInfoId: string) {
  const resp = await fetch(`${apiBaseUrl}/api/task-info/${taskInfoId}/claim-manager`, {
    method: 'POST',
    headers: h(publisherToken!),
    body: JSON.stringify({}),
  })
  assert.equal(resp.ok, false, '撤回后不应还能认领')
}

await assertTokenValid()
const taskInfoId = await createTaskPool()
await createSubtaskDraft(taskInfoId)
await withdraw(taskInfoId)
await listSubtasksShould404(taskInfoId)
await claimShouldFail(taskInfoId)

console.log('[taskpool] withdraw: OK', { taskInfoId })

