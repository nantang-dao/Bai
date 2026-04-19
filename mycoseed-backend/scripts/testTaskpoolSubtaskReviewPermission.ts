/**
 * 阶段 7：子任务凭证仅 Manager 可 approve/reject；Publisher 非 Manager 试操作必须 403；
 * Publisher 若同时是 Manager（manager_user_id=本人）则可审。
 *
 * - Unit：纯函数分支断言（无需任何 token）
 * - Integration：只需 2 个账号即可跑通（Publisher + Manager）
 *   - Claimant（领取并提交凭证者）默认复用 Publisher；也可提供 AUTH_TOKEN_CANDIDATE 覆盖
 *
 * 用法：
 *   API_BASE_URL=http://127.0.0.1:3001 \
 *   AUTH_TOKEN_PUBLISHER=... \
 *   AUTH_TOKEN_MANAGER=... \
 *   npm run test:taskpool-subtask-review
 *
 * 可选：
 *   AUTH_TOKEN_CANDIDATE=...  # 第三个账号（不提供也能跑）
 */
import 'dotenv/config'
import assert from 'node:assert/strict'
import { checkTaskApproveRejectPermission } from '../src/utils/taskReviewPermission'

const apiBaseUrl =
  process.env.API_BASE_URL || process.env.NUXT_PUBLIC_API_URL || 'http://127.0.0.1:3001'

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

function runUnit() {
  const creator = '00000000-0000-0000-0000-0000000000c1'
  const mgr = '00000000-0000-0000-0000-0000000000c2'
  const other = '00000000-0000-0000-0000-0000000000c3'

  assert.equal(
    checkTaskApproveRejectPermission('taskpool_subtask', { creator_id: creator, manager_user_id: mgr }, other).ok,
    false
  )
  assert.equal(
    checkTaskApproveRejectPermission('taskpool_subtask', { creator_id: creator, manager_user_id: mgr }, mgr).ok,
    true
  )
  assert.equal(
    checkTaskApproveRejectPermission('taskpool_subtask', { creator_id: creator, manager_user_id: null }, creator).ok,
    false
  )
  assert.equal(
    checkTaskApproveRejectPermission('taskpool_subtask', { creator_id: creator, manager_user_id: creator }, creator).ok,
    true
  )
  assert.equal(
    checkTaskApproveRejectPermission('standard', { creator_id: creator, manager_user_id: null }, other).ok,
    false
  )
  assert.equal(
    checkTaskApproveRejectPermission('standard', { creator_id: creator, manager_user_id: null }, creator).ok,
    true
  )

  console.log('[unit] checkTaskApproveRejectPermission: OK')
}

async function createTaskpool(token: string): Promise<{ poolPrimaryTaskId: string; taskInfoId: string }> {
  const now = Date.now()
  const resp = await fetch(`${apiBaseUrl}/api/tasks`, {
    method: 'POST',
    headers: h(token),
    body: JSON.stringify({
      title: `tp-subtask-review-${now}`,
      description: 'testTaskpoolSubtaskReviewPermission',
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

async function patch(url: string, token: string, body: any) {
  const resp = await fetch(url, { method: 'PATCH', headers: h(token), body: JSON.stringify(body ?? {}) })
  return { resp, data: await mustJson(resp) }
}

async function post(url: string, token: string, body: any) {
  const resp = await fetch(url, { method: 'POST', headers: h(token), body: JSON.stringify(body ?? {}) })
  return { resp, data: await mustJson(resp) }
}

async function runIntegration() {
  const publisherToken = process.env.AUTH_TOKEN_PUBLISHER
  const managerTokenRaw = process.env.AUTH_TOKEN_MANAGER
  const candidateToken = process.env.AUTH_TOKEN_CANDIDATE

  if (!publisherToken) {
    console.log('[集成] 跳过（需至少设置 AUTH_TOKEN_PUBLISHER）')
    return
  }

  // 普通任务（单子任务池）常见：Publisher = Manager
  const managerToken = managerTokenRaw || publisherToken

  // 领取并提交凭证者：优先用 Candidate（若提供）；否则复用 Publisher（会降低覆盖度，但不阻塞）
  const claimantToken = candidateToken || publisherToken

  const publisherIsManager = publisherToken === managerToken

  if (!publisherIsManager) {
    // 分支 1：Publisher ≠ Manager；Publisher 审子任务 → 403；Manager → 200
    const pool1 = await createTaskpool(publisherToken)

    let r = await patch(`${apiBaseUrl}/api/tasks/${pool1.poolPrimaryTaskId}/claim`, managerToken, {})
    assert.equal(r.resp.status, 200, JSON.stringify(r.data))

    r = await post(`${apiBaseUrl}/api/task-info/${pool1.taskInfoId}/subtasks`, managerToken, {
      title: `子任务-${Date.now()}`,
      sortOrder: 0,
    })
    assert.equal(r.resp.status, 201, JSON.stringify(r.data))

    const fin = await post(`${apiBaseUrl}/api/task-info/${pool1.taskInfoId}/subtasks/finalize`, managerToken, {})
    assert.equal(fin.resp.status, 200, JSON.stringify(fin.data))
    const subId1 = (fin.data as any)?.subtaskMallSync?.taskIds?.[0]
    assert.ok(subId1, JSON.stringify(fin.data))

    r = await patch(`${apiBaseUrl}/api/tasks/${subId1}/claim`, claimantToken, {})
    assert.equal(r.resp.status, 200, JSON.stringify(r.data))

    r = await patch(`${apiBaseUrl}/api/tasks/${subId1}/submit`, claimantToken, {
      proof: JSON.stringify({ ok: true, t: Date.now() }),
    })
    assert.equal(r.resp.status, 200, JSON.stringify(r.data))

    r = await patch(`${apiBaseUrl}/api/tasks/${subId1}/approve`, publisherToken, {})
    assert.equal(
      r.resp.status,
      403,
      `期望 Publisher 非 Manager approve=403，得到 ${r.resp.status}: ${JSON.stringify(r.data)}`
    )

    r = await patch(`${apiBaseUrl}/api/tasks/${subId1}/reject`, publisherToken, {
      reason: 'integration smoke',
      rejectOption: 'resubmit',
    })
    assert.equal(
      r.resp.status,
      403,
      `期望 Publisher 非 Manager reject=403，得到 ${r.resp.status}: ${JSON.stringify(r.data)}`
    )

    r = await patch(`${apiBaseUrl}/api/tasks/${subId1}/approve`, managerToken, {})
    assert.equal(r.resp.status, 200, JSON.stringify(r.data))
    assert.equal((r.data as any)?.success, true)

    console.log('[集成] 分支1 OK：Publisher≠Manager，Publisher 403，Manager 200')
  } else {
    console.log('[集成] 分支1 跳过：当前为普通任务模式（Publisher=Manager）')
  }

  // 分支 2：Publisher 自己认领池主成为 Manager；Publisher 可审
  // 领取并提交凭证者尽量用 candidate（若提供），否则复用 managerToken
  const pool2 = await createTaskpool(publisherToken)
  let r = await patch(`${apiBaseUrl}/api/tasks/${pool2.poolPrimaryTaskId}/claim`, publisherToken, {})
  assert.equal(r.resp.status, 200, JSON.stringify(r.data))

  r = await post(`${apiBaseUrl}/api/task-info/${pool2.taskInfoId}/subtasks`, publisherToken, {
    title: `子任务-pub-mgr-${Date.now()}`,
    sortOrder: 0,
  })
  assert.equal(r.resp.status, 201, JSON.stringify(r.data))

  const fin2 = await post(`${apiBaseUrl}/api/task-info/${pool2.taskInfoId}/subtasks/finalize`, publisherToken, {})
  assert.equal(fin2.resp.status, 200, JSON.stringify(fin2.data))
  const subId2 = (fin2.data as any)?.subtaskMallSync?.taskIds?.[0]
  assert.ok(subId2, JSON.stringify(fin2.data))

  const proofSubmitterToken = candidateToken || managerToken
  r = await patch(`${apiBaseUrl}/api/tasks/${subId2}/claim`, proofSubmitterToken, {})
  assert.equal(r.resp.status, 200, JSON.stringify(r.data))

  r = await patch(`${apiBaseUrl}/api/tasks/${subId2}/submit`, proofSubmitterToken, {
    proof: JSON.stringify({ ok: true, t: Date.now() }),
  })
  assert.equal(r.resp.status, 200, JSON.stringify(r.data))

  r = await patch(`${apiBaseUrl}/api/tasks/${subId2}/approve`, publisherToken, {})
  assert.equal(r.resp.status, 200, JSON.stringify(r.data))
  assert.equal((r.data as any)?.success, true)

  console.log('[集成] 分支2 OK：Publisher=Manager，Publisher approve 200')
}

function isConnRefused(err: unknown): boolean {
  const c = err as { cause?: { code?: string } }
  return c?.cause?.code === 'ECONNREFUSED'
}

async function main() {
  runUnit()
  try {
    await runIntegration()
  } catch (e) {
    if (isConnRefused(e)) {
      console.error(
        `无法连接 ${apiBaseUrl}（ECONNREFUSED）。请先在本目录启动后端：npm run dev\n` +
          '若使用其它端口：export API_BASE_URL=http://127.0.0.1:<端口>'
      )
    }
    throw e
  }
  console.log('testTaskpoolSubtaskReviewPermission: 全部通过')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

