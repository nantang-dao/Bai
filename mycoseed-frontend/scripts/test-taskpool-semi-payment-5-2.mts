/**
 * 阶段 5.2：链下支付单 client_reference + GET prepay-intents 列表
 *
 * 需要：AUTH_TOKEN_PUBLISHER、已应用迁移 027（client_reference 列）
 * 运行：cd mycoseed-frontend && npm run taskpool:test-semi-payment-5-2
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
      title: `e2e-semi-pay-52-${now}`,
      description: 'script: 5.2 payment list',
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

const amountHuman = '1'
const taskInfoId = await createTaskPool()

const payRefA = `order-a-${Date.now()}`
const stateA = `st-a-${Date.now()}-xxxxxxxx`

let r = await fetch(`${apiBaseUrl}/api/task-info/${taskInfoId}/prepay-intent`, {
  method: 'POST',
  headers: h(publisherToken!),
  body: JSON.stringify({ state: stateA, amountHuman, clientReference: payRefA }),
})
let j = await mustJson(r)
assert.equal(r.ok, true, JSON.stringify(j))
assert.equal(j?.intent?.client_reference, payRefA)

r = await fetch(`${apiBaseUrl}/api/task-info/${taskInfoId}/prepay-complete`, {
  method: 'POST',
  headers: h(publisherToken!),
  body: JSON.stringify({
    state: stateA,
    status: 'success',
    user_op_hash: '0xaa',
    tx_hash: '0xbb',
  }),
})
j = await mustJson(r)
assert.equal(r.ok, true)
assert.equal(j?.intent?.status, 'success')

const payRefB = `order-b-${Date.now()}`
const stateB = `st-b-${Date.now()}-xxxxxxxx`
r = await fetch(`${apiBaseUrl}/api/task-info/${taskInfoId}/prepay-intent`, {
  method: 'POST',
  headers: h(publisherToken!),
  body: JSON.stringify({ state: stateB, amountHuman, clientReference: payRefB }),
})
j = await mustJson(r)
assert.equal(r.ok, true)
assert.equal(j?.intent?.status, 'pending')

r = await fetch(`${apiBaseUrl}/api/task-info/${taskInfoId}/prepay-intents?limit=10`, {
  headers: h(publisherToken!),
})
const listData = await mustJson(r)
assert.equal(r.ok, true)
const intents = listData?.intents as Array<{ client_reference?: string; status?: string }>
assert.ok(Array.isArray(intents))
assert.ok(intents.length >= 2, '应至少两条记录')
assert.equal(intents[0]?.client_reference, payRefB, '最新一条应为第二笔 pending')
assert.equal(intents[1]?.client_reference, payRefA, '上一笔成功')

r = await fetch(`${apiBaseUrl}/api/task-info/${taskInfoId}/prepay-intent/latest`, {
  headers: h(publisherToken!),
})
const latest = await mustJson(r)
assert.equal(latest?.intent?.client_reference, payRefB)

await withdraw(taskInfoId)

console.log('[mycoseed] test-taskpool-semi-payment-5-2: OK')
