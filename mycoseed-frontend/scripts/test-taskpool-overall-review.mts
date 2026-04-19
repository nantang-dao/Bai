import assert from 'node:assert/strict'

/**
 * 交付块 5：API 层最小自动化（不走 UI）
 *
 * 需要：
 * - API_BASE_URL（默认 http://127.0.0.1:3001）
 * - AUTH_TOKEN_PUBLISHER（作为创建者/Reviewer）
 * - AUTH_TOKEN_MANAGER（作为 Manager）
 *
 * 流程：
 * 1) publisher 创建任务池(useTaskpool=true)
 * 2) manager 认领 manager_user_id
 * 3) manager 整单提交（status=under_review）
 * 4) publisher 审核通过（status=approved，且有 review 记录）
 */

const apiBaseUrl =
  process.env.API_BASE_URL ||
  process.env.NUXT_PUBLIC_API_URL ||
  process.env.NUXT_PUBLIC_API_URL?.replace(/\/$/, '') ||
  'http://127.0.0.1:3001'
const publisherToken = process.env.AUTH_TOKEN_PUBLISHER
const managerToken =
  process.env.AUTH_TOKEN_MANAGER?.trim() || process.env.AUTH_TOKEN_PUBLISHER?.trim()

assert.ok(publisherToken, '请设置 AUTH_TOKEN_PUBLISHER')
assert.ok(managerToken, '请设置 AUTH_TOKEN_MANAGER 或 AUTH_TOKEN_PUBLISHER（普通任务可同一账号）')

function maskTok(tok: string) {
  const t = tok.trim()
  if (t.length <= 8) return `${t.slice(0, 2)}…${t.slice(-2)}`
  return `${t.slice(0, 4)}…${t.slice(-4)}`
}

console.log('[taskpool] overall review script starting', {
  apiBaseUrl,
  publisherToken: maskTok(publisherToken),
  managerToken: maskTok(managerToken),
})

function h(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }
}

async function mustJson(resp: Response) {
  const txt = await resp.text()
  try {
    return JSON.parse(txt)
  } catch {
    throw new Error(`非 JSON 响应(${resp.status}): ${txt.slice(0, 300)}`)
  }
}

async function assertTokenValid(label: string, token: string) {
  const resp = await fetch(`${apiBaseUrl}/api/auth/me`, { headers: h(token) })
  if (!resp.ok) {
    const data = await mustJson(resp).catch(() => ({}))
    throw new Error(`${label} token 无法通过 /api/auth/me 校验: ${resp.status} ${JSON.stringify(data)}`)
  }
}

async function createTaskPoolAsPublisher(): Promise<string> {
  const now = Date.now()
  const resp = await fetch(`${apiBaseUrl}/api/tasks`, {
    method: 'POST',
    headers: h(publisherToken!),
    body: JSON.stringify({
      title: `e2e-taskpool-overall-review-${now}`,
      description: 'script: overall submission review flow',
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

async function claimManager(taskInfoId: string) {
  const resp = await fetch(`${apiBaseUrl}/api/task-info/${taskInfoId}/claim-manager`, {
    method: 'POST',
    headers: h(managerToken!),
    body: JSON.stringify({}),
  })
  const data = await mustJson(resp)
  assert.equal(resp.ok, true, `认领 manager 失败: ${JSON.stringify(data)}`)
}

async function submitOverall(taskInfoId: string) {
  const resp = await fetch(`${apiBaseUrl}/api/task-info/${taskInfoId}/overall-submission`, {
    method: 'POST',
    headers: h(managerToken!),
    body: JSON.stringify({
      summary: `summary-${Date.now()}`,
      url: `https://example.com/${Date.now()}`,
    }),
  })
  const data = await mustJson(resp)
  assert.equal(resp.ok, true, `整单提交失败: ${JSON.stringify(data)}`)
  assert.equal(data?.submission?.status, 'under_review', `status 应为 under_review: ${JSON.stringify(data)}`)
}

async function approveOverall(taskInfoId: string) {
  const resp = await fetch(`${apiBaseUrl}/api/task-info/${taskInfoId}/overall-submission/review`, {
    method: 'POST',
    headers: h(publisherToken!),
    body: JSON.stringify({
      decision: 'approved',
      reason: 'ok',
    }),
  })
  const data = await mustJson(resp)
  assert.equal(resp.ok, true, `审核失败: ${JSON.stringify(data)}`)
  assert.equal(data?.submission?.status, 'approved', `status 应为 approved: ${JSON.stringify(data)}`)
}

async function assertGet(taskInfoId: string) {
  const resp = await fetch(`${apiBaseUrl}/api/task-info/${taskInfoId}/overall-submission`, {
    headers: h(publisherToken!),
  })
  const data = await mustJson(resp)
  assert.equal(resp.ok, true, `GET overall-submission 失败: ${JSON.stringify(data)}`)
  assert.equal(data?.submission?.status, 'approved', `GET status 应为 approved: ${JSON.stringify(data)}`)
  assert.ok(Array.isArray(data?.reviews), 'GET 应返回 reviews 数组')
  assert.ok(data.reviews.length >= 1, `reviews 至少 1 条: ${JSON.stringify(data)}`)
  assert.equal(data.reviews[0].decision, 'approved')
}

await assertTokenValid('publisher', publisherToken!)
await assertTokenValid('manager', managerToken!)

const taskInfoId = await createTaskPoolAsPublisher()
await claimManager(taskInfoId)
await submitOverall(taskInfoId)
await approveOverall(taskInfoId)
await assertGet(taskInfoId)

console.log('[taskpool] overall review flow: OK', { taskInfoId })

