/**
 * 阶段 8：整单提交 gate（必须子任务全部 completed）
 *
 * - 仅 2 账号即可（Publisher + Manager）
 * - 流程：创建任务池 → Manager 认领 → 创建子任务 → 定稿（生成子任务商城行）→
 *   (A) 未完成直接整单提交：400
 *   (B) 领取子任务 + 提交凭证 + Manager 审核通过 → 再整单提交：201
 *   (C) Publisher 审核整单：200
 *
 * 用法：
 *   API_BASE_URL=http://127.0.0.1:3001 \
 *   AUTH_TOKEN_PUBLISHER=... \
 *   AUTH_TOKEN_MANAGER=... \
 *   npm run test:taskpool-overall-gate
 */
import 'dotenv/config'
import assert from 'node:assert/strict'

const apiBaseUrl =
  process.env.API_BASE_URL || process.env.NUXT_PUBLIC_API_URL || 'http://127.0.0.1:3001'
const publisherToken = process.env.AUTH_TOKEN_PUBLISHER
const managerToken = process.env.AUTH_TOKEN_MANAGER || publisherToken

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

async function post(url: string, token: string, body: any) {
  const resp = await fetch(url, { method: 'POST', headers: h(token), body: JSON.stringify(body ?? {}) })
  return { resp, data: await mustJson(resp) }
}
async function patch(url: string, token: string, body: any) {
  const resp = await fetch(url, { method: 'PATCH', headers: h(token), body: JSON.stringify(body ?? {}) })
  return { resp, data: await mustJson(resp) }
}

async function createTaskpool(): Promise<{ poolPrimaryTaskId: string; taskInfoId: string }> {
  const now = Date.now()
  const resp = await fetch(`${apiBaseUrl}/api/tasks`, {
    method: 'POST',
    headers: h(publisherToken!),
    body: JSON.stringify({
      title: `tp-overall-gate-${now}`,
      description: 'testTaskpoolOverallSubmissionGate',
      reward: 1,
      participantLimit: 1,
      rewardDistributionMode: 'per_person',
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
  assert.ok(data.id && data.taskInfoId, JSON.stringify(data))
  return { poolPrimaryTaskId: data.id as string, taskInfoId: data.taskInfoId as string }
}

function isConnRefused(err: unknown): boolean {
  const c = err as { cause?: { code?: string } }
  return c?.cause?.code === 'ECONNREFUSED'
}

async function main() {
  if (!publisherToken || !managerToken) {
    console.log(
      '[SKIP] testTaskpoolOverallSubmissionGate：缺少 AUTH_TOKEN_PUBLISHER 或 AUTH_TOKEN_MANAGER（需要真实登录态）'
    )
    return
  }
  const publisherIsManager = publisherToken === managerToken
  if (publisherIsManager) {
    console.log('[提示] 普通任务模式：Publisher=Manager，将以单账号完成 manager 操作；子任务领取/提交尽量用 Candidate（若提供）')
  }

  const workerToken = process.env.AUTH_TOKEN_CANDIDATE || publisherToken

  const { poolPrimaryTaskId, taskInfoId } = await createTaskpool()

  // Manager 认领池主入口（写 manager_user_id）
  let r = await patch(`${apiBaseUrl}/api/tasks/${poolPrimaryTaskId}/claim`, managerToken!, {})
  assert.equal(r.resp.status, 200, JSON.stringify(r.data))

  // Manager 创建子任务并定稿 → 获取子任务商城 tasks.id
  r = await post(`${apiBaseUrl}/api/task-info/${taskInfoId}/subtasks`, managerToken!, {
    title: `子任务-${Date.now()}`,
    sortOrder: 0,
  })
  assert.equal(r.resp.status, 201, JSON.stringify(r.data))

  const fin = await post(`${apiBaseUrl}/api/task-info/${taskInfoId}/subtasks/finalize`, managerToken!, {})
  assert.equal(fin.resp.status, 200, JSON.stringify(fin.data))
  const subTaskId = (fin.data as any)?.subtaskMallSync?.taskIds?.[0]
  assert.ok(subTaskId, JSON.stringify(fin.data))

  // (A) 未完成子任务：整单提交应 400
  r = await post(`${apiBaseUrl}/api/task-info/${taskInfoId}/overall-submission`, managerToken!, {
    summary: `should-fail-${Date.now()}`,
    url: 'https://example.com/fail',
  })
  assert.equal(r.resp.status, 400, `期望未完成时 400，得到 ${r.resp.status}: ${JSON.stringify(r.data)}`)

  // 完成子任务：worker 领取并提交 → manager 审核通过（子任务仅 manager）
  r = await patch(`${apiBaseUrl}/api/tasks/${subTaskId}/claim`, workerToken!, {})
  assert.equal(r.resp.status, 200, JSON.stringify(r.data))

  r = await patch(`${apiBaseUrl}/api/tasks/${subTaskId}/submit`, workerToken!, {
    proof: JSON.stringify({ ok: true, t: Date.now() }),
  })
  assert.equal(r.resp.status, 200, JSON.stringify(r.data))

  r = await patch(`${apiBaseUrl}/api/tasks/${subTaskId}/approve`, managerToken!, {})
  assert.equal(r.resp.status, 200, JSON.stringify(r.data))

  // (B) 子任务完成后：整单提交应 201
  const summary = `overall-${Date.now()}`
  r = await post(`${apiBaseUrl}/api/task-info/${taskInfoId}/overall-submission`, managerToken!, {
    summary,
    url: 'https://example.com/ok',
  })
  assert.equal(r.resp.status, 201, JSON.stringify(r.data))

  // (C) Publisher 审核整单
  r = await post(`${apiBaseUrl}/api/task-info/${taskInfoId}/overall-submission/review`, publisherToken!, {
    decision: 'approved',
    reason: 'ok',
  })
  assert.equal(r.resp.status, 200, JSON.stringify(r.data))

  console.log('testTaskpoolOverallSubmissionGate: OK')
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

