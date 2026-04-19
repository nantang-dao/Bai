import assert from 'node:assert/strict'

/**
 * 任务池主信息编辑：GET + PATCH pool-draft（API）
 *
 * AUTH_TOKEN_PUBLISHER、AUTH_TOKEN_MANAGER
 * API_BASE_URL 或 NUXT_PUBLIC_API_URL
 */

const apiBaseUrl =
  process.env.API_BASE_URL ||
  process.env.NUXT_PUBLIC_API_URL ||
  'http://127.0.0.1:3001'
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
      title: `pool-draft-${now}`,
      description: 'script pool-draft',
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

async function getDraft(tid: string, token: string) {
  const resp = await fetch(`${apiBaseUrl}/api/task-info/${tid}/pool-draft`, { headers: h(token) })
  return { resp, data: await mustJson(resp) }
}

async function patchDraft(tid: string, body: Record<string, unknown>) {
  const resp = await fetch(`${apiBaseUrl}/api/task-info/${tid}/pool-draft`, {
    method: 'PATCH',
    headers: h(publisherToken!),
    body: JSON.stringify(body),
  })
  return { resp, data: await mustJson(resp) }
}

const tid = await createPool()

let g = await getDraft(tid, publisherToken!)
assert.equal(g.resp.ok, true, JSON.stringify(g.data))
const d0 = g.data.draft as Record<string, unknown>
const baseTitle = String(d0.title || '')

const newTitle = `${baseTitle}-patched-${Date.now()}`
const p = await patchDraft(tid, {
  title: newTitle,
  description: String(d0.description || ''),
  reward: Number(d0.reward || 1),
  participantLimit: Number(d0.participantLimit || 1),
  startDate: String(d0.startDate || ''),
  deadline: String(d0.deadline || ''),
  submitDeadline: String(d0.submitDeadline || ''),
})
assert.equal(p.resp.ok, true, JSON.stringify(p.data))

g = await getDraft(tid, publisherToken!)
assert.equal((g.data.draft as any).title, newTitle)

const claimResp = await fetch(`${apiBaseUrl}/api/task-info/${tid}/claim-manager`, {
  method: 'POST',
  headers: h(managerToken!),
  body: JSON.stringify({}),
})
const claimData = await mustJson(claimResp)
assert.equal(claimResp.ok, true, JSON.stringify(claimData))

const g2 = await getDraft(tid, publisherToken!)
assert.equal(g2.resp.ok, false, '认领后创建者 GET 应失败')
assert.ok(
  String(g2.data.error || '').includes('Manager'),
  `期望错误含 Manager，实际: ${JSON.stringify(g2.data)}`
)

console.log('[taskpool] pool-draft GET/PATCH: OK', { taskInfoId: tid })
