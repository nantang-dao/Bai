/**
 * 阶段 5：子任务单人/多人复用（participantLimit 生效，且不串单）
 *
 * 用法：
 *   API_BASE_URL=http://127.0.0.1:3001 \
 *   AUTH_TOKEN_PUBLISHER=... \
 *   AUTH_TOKEN_MANAGER=... \
 *   npm run test:taskpool-subtask-participant-limit
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
      title: `tp-subtask-pl-${now}`,
      description: 'testTaskpoolSubtaskParticipantLimit',
      reward: 1,
      participantLimit: 1,
      rewardDistributionMode: 'per_person',
      startDate: new Date(Date.now() - 120_000).toISOString(),
      deadline: new Date(Date.now() + 60 * 60_000).toISOString(),
      submitDeadline: dtLocalPlusMinutes(120),
      submissionInstructions: 'pool-inst',
      proofConfig: { description: { enabled: true, minWords: 1 } },
      useTaskpool: true,
      allowSplit: true,
    }),
  })
  const data = await mustJson(resp)
  assert.equal(resp.ok, true, `创建任务池失败: ${JSON.stringify(data)}`)
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

async function approve(taskId: string, token: string, comments?: string) {
  const resp = await fetch(`${apiBaseUrl}/api/tasks/${taskId}/approve`, {
    method: 'PATCH',
    headers: h(token),
    body: JSON.stringify({ comments: comments || '' }),
  })
  return { resp, data: await mustJson(resp) }
}

async function getMe(token: string) {
  const resp = await fetch(`${apiBaseUrl}/api/auth/me`, { headers: h(token) })
  return { resp, data: await mustJson(resp) }
}

function findParticipantTaskId(taskPayload: any, claimerId: string): string | null {
  const list = taskPayload?.participantsList
  if (!Array.isArray(list)) return null
  const hit = list.find((p: any) => p?.claimerId === claimerId)
  return hit?.id || null
}

async function main() {
  if (!publisherToken || !managerToken) {
    console.log(
      '[SKIP] testTaskpoolSubtaskParticipantLimit：缺少 AUTH_TOKEN_PUBLISHER 或 AUTH_TOKEN_MANAGER（需要真实登录态）'
    )
    return
  }
  assert.notEqual(publisherToken, managerToken, '两枚 token 须为不同账号')

  // 单人子任务：publisher 领取提交，manager 审核；publisher 审核 403
  {
    const pool = await createTaskpool()
    let r = await claimPoolPrimary(pool.poolPrimaryTaskId, managerToken!)
    assert.equal(r.resp.status, 200, JSON.stringify(r.data))

    r = await createSubtask(pool.taskInfoId, managerToken!, {
      title: `单人子任务-${Date.now()}`,
      sortOrder: 0,
      participantLimit: 1,
      proofConfig: { description: { enabled: true, minWords: 1 } },
    })
    assert.equal(r.resp.status, 201, JSON.stringify(r.data))

    const fin = await finalize(pool.taskInfoId, managerToken!)
    assert.equal(fin.resp.status, 200, JSON.stringify(fin.data))
    const taskIds: string[] = (fin.data as any)?.subtaskMallSync?.taskIds || []
    assert.ok(taskIds.length >= 1, JSON.stringify(fin.data))
    const subTaskId = taskIds[0]

    r = await claimTask(subTaskId, publisherToken!)
    assert.equal(r.resp.status, 200, JSON.stringify(r.data))

    r = await submit(subTaskId, publisherToken!, { description: 'ok' })
    assert.equal(r.resp.status, 200, JSON.stringify(r.data))

    r = await approve(subTaskId, publisherToken!, 'try-non-manager')
    assert.equal(r.resp.status, 403, `期望非 Manager 审核 403，得到 ${r.resp.status}: ${JSON.stringify(r.data)}`)

    r = await approve(subTaskId, managerToken!, 'ok')
    assert.equal(r.resp.status, 200, JSON.stringify(r.data))
  }

  // 多人子任务（2 名额）：两账号分别领取→各自提交→仅 Manager 审核；不串单
  {
    const mePub = await getMe(publisherToken!)
    assert.equal(mePub.resp.status, 200, JSON.stringify(mePub.data))
    const publisherId = (mePub.data as any)?.user?.id || (mePub.data as any)?.id
    assert.ok(publisherId, `无法获取 publisherId: ${JSON.stringify(mePub.data)}`)

    const meMgr = await getMe(managerToken!)
    assert.equal(meMgr.resp.status, 200, JSON.stringify(meMgr.data))
    const managerId = (meMgr.data as any)?.user?.id || (meMgr.data as any)?.id
    assert.ok(managerId, `无法获取 managerId: ${JSON.stringify(meMgr.data)}`)

    const pool = await createTaskpool()
    let r = await claimPoolPrimary(pool.poolPrimaryTaskId, managerToken!)
    assert.equal(r.resp.status, 200, JSON.stringify(r.data))

    r = await createSubtask(pool.taskInfoId, managerToken!, {
      title: `多人子任务-${Date.now()}`,
      sortOrder: 0,
      participantLimit: 2,
      proofConfig: { description: { enabled: true, minWords: 1 } },
    })
    assert.equal(r.resp.status, 201, JSON.stringify(r.data))

    const fin = await finalize(pool.taskInfoId, managerToken!)
    assert.equal(fin.resp.status, 200, JSON.stringify(fin.data))
    const taskIds: string[] = (fin.data as any)?.subtaskMallSync?.taskIds || []
    assert.ok(taskIds.length >= 2, `期望至少生成 2 条子任务 tasks 行，得到: ${JSON.stringify(fin.data)}`)
    const repId = taskIds[0]

    // 账号1领取
    r = await claimTask(repId, publisherToken!)
    assert.equal(r.resp.status, 200, JSON.stringify(r.data))
    let gt = await getTask(repId)
    assert.equal(gt.resp.status, 200, JSON.stringify(gt.data))
    const seat1TaskIdA = findParticipantTaskId(gt.data, publisherId)
    assert.ok(seat1TaskIdA, `无法从 participantsList 找到 publisher seat: ${JSON.stringify(gt.data)}`)

    // 账号2领取（manager 作为第二个领取者）
    r = await claimTask(repId, managerToken!)
    assert.equal(r.resp.status, 200, JSON.stringify(r.data))
    gt = await getTask(repId)
    assert.equal(gt.resp.status, 200, JSON.stringify(gt.data))

    // participantsList 中应出现两个不同 claimerId
    const plist = (gt.data as any)?.participantsList
    assert.ok(Array.isArray(plist) && plist.length >= 2, `期望 participantsList>=2: ${JSON.stringify(gt.data)}`)
    const seat1TaskId = findParticipantTaskId(gt.data, publisherId)!
    const seat2TaskId = findParticipantTaskId(gt.data, managerId)!
    assert.ok(seat1TaskId && seat2TaskId, `期望两个领取者 seat 都存在: ${JSON.stringify(plist)}`)
    assert.notEqual(seat1TaskId, seat2TaskId, '两席位 taskId 不应相同（防串单）')

    // 各自提交（按各自 taskId）
    r = await submit(seat1TaskId, publisherToken!, { description: 'p1' })
    assert.equal(r.resp.status, 200, JSON.stringify(r.data))
    r = await submit(seat2TaskId, managerToken!, { description: 'p2' })
    assert.equal(r.resp.status, 200, JSON.stringify(r.data))

    // 非 Manager 审核 403（publisher 试图审核 seat2）
    r = await approve(seat2TaskId, publisherToken!, 'no')
    assert.equal(r.resp.status, 403, `期望非 Manager 审核 403，得到 ${r.resp.status}: ${JSON.stringify(r.data)}`)

    // Manager 审核两席位均成功
    r = await approve(seat1TaskId, managerToken!, 'ok1')
    assert.equal(r.resp.status, 200, JSON.stringify(r.data))
    r = await approve(seat2TaskId, managerToken!, 'ok2')
    assert.equal(r.resp.status, 200, JSON.stringify(r.data))
  }

  console.log('testTaskpoolSubtaskParticipantLimit: OK')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

