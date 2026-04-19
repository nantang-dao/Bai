/**
 * 阶段 4：子任务 tasks 行合并/覆盖（详情展示 + 提交校验）
 *
 * 覆盖：
 * - finalize 返回 subtaskTaskId 后，GET /api/tasks/:id 返回的 proofConfig/description 等应合并子任务覆盖字段
 * - submitProof 校验优先使用子任务 proof_config（无则继承 task_info.proof_config）
 *
 * 用法：
 *   API_BASE_URL=http://127.0.0.1:3001 \
 *   AUTH_TOKEN_PUBLISHER=... \
 *   AUTH_TOKEN_MANAGER=... \
 *   npm run test:taskpool-subtask-overrides
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

async function createTaskpool(proofConfig: any) {
  const now = Date.now()
  const resp = await fetch(`${apiBaseUrl}/api/tasks`, {
    method: 'POST',
    headers: h(publisherToken!),
    body: JSON.stringify({
      title: `tp-subtask-override-${now}`,
      description: 'testTaskpoolSubtaskOverrides',
      reward: 1,
      participantLimit: 1,
      rewardDistributionMode: 'per_person',
      startDate: new Date(Date.now() - 120_000).toISOString(),
      deadline: new Date(Date.now() + 60 * 60_000).toISOString(),
      submitDeadline: dtLocalPlusMinutes(120),
      submissionInstructions: 'pool-inst',
      proofConfig,
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

async function finalize(taskInfoId: string, token: string) {
  const resp = await fetch(`${apiBaseUrl}/api/task-info/${taskInfoId}/subtasks/finalize`, {
    method: 'POST',
    headers: h(token),
    body: JSON.stringify({}),
  })
  return { resp, data: await mustJson(resp) }
}

async function getTask(taskId: string) {
  const resp = await fetch(`${apiBaseUrl}/api/tasks/${taskId}`)
  return { resp, data: await mustJson(resp) }
}

async function claimTask(taskId: string, token: string) {
  const resp = await fetch(`${apiBaseUrl}/api/tasks/${taskId}/claim`, {
    method: 'PATCH',
    headers: h(token),
    body: JSON.stringify({}),
  })
  return { resp, data: await mustJson(resp) }
}

async function submit(taskId: string, token: string, proof: any) {
  const resp = await fetch(`${apiBaseUrl}/api/tasks/${taskId}/submit`, {
    method: 'PATCH',
    headers: h(token),
    body: JSON.stringify({ proof: JSON.stringify(proof) }),
  })
  return { resp, data: await mustJson(resp) }
}

function isConnRefused(err: unknown): boolean {
  const c = err as { cause?: { code?: string } }
  return c?.cause?.code === 'ECONNREFUSED'
}

function assertProofConfigSubset(actual: any, expected: any, msg: string) {
  // 后端可能会为 proofConfig 注入内部字段（如 _assignedUserIds），这里仅断言我们关心的业务字段
  assert.ok(actual && typeof actual === 'object', `${msg}: actual 不是对象`)
  assert.ok(expected && typeof expected === 'object', `${msg}: expected 不是对象`)
  if (expected.description != null) {
    assert.deepEqual(actual.description, expected.description, `${msg}: description 字段不匹配`)
  }
  // 未来若扩展更多 proofConfig 维度，可在这里补充子集断言
}

async function main() {
  if (!publisherToken || !managerToken) {
    console.log(
      '[SKIP] testTaskpoolSubtaskOverrides：缺少 AUTH_TOKEN_PUBLISHER 或 AUTH_TOKEN_MANAGER（需要真实登录态）'
    )
    return
  }
  assert.notEqual(publisherToken, managerToken, '两枚 token 须为不同账号')

  // 场景 A：子任务覆盖 proofConfig/description 生效
  {
    const pool = await createTaskpool({ photo: { enabled: false } })
    let r = await claimPoolPrimary(pool.poolPrimaryTaskId, managerToken!)
    assert.equal(r.resp.status, 200, JSON.stringify(r.data))

    const subDesc = 'sub-desc'
    const subProof = { description: { enabled: true, minWords: 3 } }
    r = await createSubtask(pool.taskInfoId, managerToken!, {
      title: `子任务-${Date.now()}`,
      sortOrder: 0,
      description: subDesc,
      proofConfig: subProof,
      submissionInstructions: 'sub-inst',
    })
    assert.equal(r.resp.status, 201, JSON.stringify(r.data))

    const fin = await finalize(pool.taskInfoId, managerToken!)
    assert.equal(fin.resp.status, 200, JSON.stringify(fin.data))
    const subTaskId = (fin.data as any)?.subtaskMallSync?.taskIds?.[0]
    assert.ok(subTaskId, JSON.stringify(fin.data))

    const gt = await getTask(subTaskId)
    assert.equal(gt.resp.status, 200, JSON.stringify(gt.data))
    assert.equal((gt.data as any)?.listingKind, 'taskpool_subtask')
    assert.equal((gt.data as any)?.description, subDesc, '详情 description 应覆盖为子任务描述')
    assertProofConfigSubset((gt.data as any)?.proofConfig, subProof, '详情 proofConfig 应覆盖为子任务 proofConfig')

    // 校验：按子任务 proofConfig（需要 description）
    r = await claimTask(subTaskId, publisherToken!)
    assert.equal(r.resp.status, 200, JSON.stringify(r.data))

    r = await submit(subTaskId, publisherToken!, { ok: true })
    assert.equal(r.resp.status, 400, `期望缺少 description 时 400，得到 ${r.resp.status}: ${JSON.stringify(r.data)}`)

    r = await submit(subTaskId, publisherToken!, { description: 'abc' })
    assert.equal(r.resp.status, 200, JSON.stringify(r.data))
  }

  // 场景 B：子任务不配置 proofConfig → 继承 pool proofConfig
  {
    const poolProof = { description: { enabled: true, minWords: 2 } }
    const pool = await createTaskpool(poolProof)
    let r = await claimPoolPrimary(pool.poolPrimaryTaskId, managerToken!)
    assert.equal(r.resp.status, 200, JSON.stringify(r.data))

    r = await createSubtask(pool.taskInfoId, managerToken!, {
      title: `子任务-inherit-${Date.now()}`,
      sortOrder: 0,
      description: 'sub-desc2',
      // proofConfig 不传 → 继承
    })
    assert.equal(r.resp.status, 201, JSON.stringify(r.data))

    const fin = await finalize(pool.taskInfoId, managerToken!)
    assert.equal(fin.resp.status, 200, JSON.stringify(fin.data))
    const subTaskId = (fin.data as any)?.subtaskMallSync?.taskIds?.[0]
    assert.ok(subTaskId, JSON.stringify(fin.data))

    const gt = await getTask(subTaskId)
    assert.equal(gt.resp.status, 200, JSON.stringify(gt.data))
    assertProofConfigSubset((gt.data as any)?.proofConfig, poolProof, '详情 proofConfig 应继承 pool proofConfig')

    r = await claimTask(subTaskId, publisherToken!)
    assert.equal(r.resp.status, 200, JSON.stringify(r.data))

    r = await submit(subTaskId, publisherToken!, { ok: true })
    assert.equal(r.resp.status, 400, `期望继承 proofConfig 缺少 description 时 400，得到 ${r.resp.status}`)

    r = await submit(subTaskId, publisherToken!, { description: 'ab' })
    assert.equal(r.resp.status, 200, JSON.stringify(r.data))
  }

  console.log('testTaskpoolSubtaskOverrides: OK')
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

