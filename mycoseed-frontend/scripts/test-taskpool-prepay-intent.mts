/**
 * 阶段 3：Semi 预付 intent API（登记 state → 回跳 complete → 查询 latest）
 *
 * 需要：AUTH_TOKEN_PUBLISHER、API_BASE_URL 或 NUXT_PUBLIC_API_URL
 * 运行：cd mycoseed-frontend && npm run taskpool:test-prepay-intent
 * 若 tsx EPERM：node --import tsx scripts/test-taskpool-prepay-intent.mts
 */

import assert from 'node:assert/strict'

const apiBaseUrl =
  process.env.API_BASE_URL ||
  process.env.NUXT_PUBLIC_API_URL ||
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

async function createTaskPool(): Promise<string> {
  const now = Date.now()
  const resp = await fetch(`${apiBaseUrl}/api/tasks`, {
    method: 'POST',
    headers: h(publisherToken!),
    body: JSON.stringify({
      title: `e2e-prepay-intent-${now}`,
      description: 'script: prepay intent',
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

async function withdraw(taskInfoId: string) {
  const resp = await fetch(`${apiBaseUrl}/api/task-info/${taskInfoId}/withdraw`, {
    method: 'POST',
    headers: h(publisherToken!),
    body: JSON.stringify({}),
  })
  const data = await mustJson(resp)
  assert.equal(resp.ok, true, `撤回失败: ${JSON.stringify(data)}`)
}

const state = `st-${Date.now()}-xxxxxxxx`

// 与创建任务 reward=1、participantLimit=1 对应的 planned_lock_nt
const amountHuman = '1'

const taskInfoId = await createTaskPool()

let r = await fetch(`${apiBaseUrl}/api/task-info/${taskInfoId}/prepay-intent`, {
  method: 'POST',
  headers: h(publisherToken!),
  body: JSON.stringify({ state, amountHuman: '999' }),
})
assert.equal(r.ok, false, '错误金额应拒绝')
await r.json().catch(() => ({}))

r = await fetch(`${apiBaseUrl}/api/task-info/${taskInfoId}/prepay-intent`, {
  method: 'POST',
  headers: h(publisherToken!),
  body: JSON.stringify({ state, amountHuman, clientReference: 'phase5-2-client-ref-smoke' }),
})
const startData = await mustJson(r)
assert.equal(r.ok, true, `prepay-intent 失败: ${JSON.stringify(startData)}`)
assert.equal(startData?.intent?.status, 'pending')
assert.equal(startData?.intent?.client_reference, 'phase5-2-client-ref-smoke')

r = await fetch(`${apiBaseUrl}/api/task-info/${taskInfoId}/prepay-complete`, {
  method: 'POST',
  headers: h(publisherToken!),
  body: JSON.stringify({
    state,
    status: 'success',
    user_op_hash: '0xdead',
    tx_hash: '0xbeef',
  }),
})
const doneData = await mustJson(r)
assert.equal(r.ok, true, `prepay-complete 失败: ${JSON.stringify(doneData)}`)
assert.equal(doneData?.intent?.status, 'success')

r = await fetch(`${apiBaseUrl}/api/task-info/${taskInfoId}/prepay-intent/latest`, {
  headers: h(publisherToken!),
})
const latestData = await mustJson(r)
assert.equal(r.ok, true)
assert.equal(latestData?.intent?.status, 'success')
assert.equal(latestData?.intent?.client_reference, 'phase5-2-client-ref-smoke')

r = await fetch(`${apiBaseUrl}/api/task-info/${taskInfoId}/prepay-complete`, {
  method: 'POST',
  headers: h(publisherToken!),
  body: JSON.stringify({
    state,
    status: 'success',
    user_op_hash: '0xdead',
    tx_hash: '0xbeef',
  }),
})
const idem = await mustJson(r)
assert.equal(r.ok, true)
assert.equal(idem?.alreadyFinalized, true)

await withdraw(taskInfoId)

console.log('[mycoseed] test-taskpool-prepay-intent: OK')
