import { test, expect } from '@playwright/test'

function h(token: string) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
}

test('taskpool 长链路 @slow：发布→认领→定稿→子任务完成→整单提交→Publisher 审核', async ({ request }) => {
  test.setTimeout(300_000)

  const publisherToken = process.env.AUTH_TOKEN_PUBLISHER
  const managerToken = process.env.AUTH_TOKEN_MANAGER
  if (!publisherToken || !managerToken) {
    throw new Error('请设置 AUTH_TOKEN_PUBLISHER 与 AUTH_TOKEN_MANAGER（不要在聊天里粘贴 token）')
  }
  if (publisherToken === managerToken) {
    throw new Error('两枚 token 须为不同账号')
  }

  const apiBaseURL = process.env.API_BASE_URL || 'http://127.0.0.1:3001'
  const now = Date.now()

  // 1) Publisher 创建任务池
  const createResp = await request.post(`${apiBaseURL}/api/tasks`, {
    headers: h(publisherToken),
    data: {
      title: `e2e-long-${now}`,
      description: 'taskpool-long-happy-path',
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
    },
  })
  expect(createResp.ok()).toBeTruthy()
  const created = (await createResp.json()) as { id?: string; taskInfoId?: string }
  const poolPrimaryTaskId = created.id
  const taskInfoId = created.taskInfoId
  expect(poolPrimaryTaskId).toBeTruthy()
  expect(taskInfoId).toBeTruthy()

  // 2) Manager 认领池主入口（写 manager_user_id）
  {
    const resp = await request.patch(`${apiBaseURL}/api/tasks/${poolPrimaryTaskId}/claim`, {
      headers: h(managerToken),
      data: {},
    })
    expect(resp.ok()).toBeTruthy()
  }

  // 3) Manager 创建子任务 + 定稿（生成商城子任务行）
  {
    const subResp = await request.post(`${apiBaseURL}/api/task-info/${taskInfoId}/subtasks`, {
      headers: h(managerToken),
      data: { title: `子任务-${now}`, sortOrder: 0 },
    })
    expect(subResp.status()).toBe(201)
  }

  const finResp = await request.post(`${apiBaseURL}/api/task-info/${taskInfoId}/subtasks/finalize`, {
    headers: h(managerToken),
    data: {},
  })
  expect(finResp.ok()).toBeTruthy()
  const finJson = await finResp.json()
  const subTaskId = finJson?.subtaskMallSync?.taskIds?.[0]
  expect(subTaskId).toBeTruthy()

  // 4) Gate：子任务未完成 → 整单提交 400
  {
    const resp = await request.post(`${apiBaseURL}/api/task-info/${taskInfoId}/overall-submission`, {
      headers: h(managerToken),
      data: { summary: `should-fail-${now}`, url: 'https://example.com/fail' },
    })
    expect(resp.status()).toBe(400)
  }

  // 5) Publisher 领取子任务并提交凭证；Manager 审核通过（子任务仅 Manager）
  {
    const claimResp = await request.patch(`${apiBaseURL}/api/tasks/${subTaskId}/claim`, {
      headers: h(publisherToken),
      data: {},
    })
    expect(claimResp.ok()).toBeTruthy()

    const submitResp = await request.patch(`${apiBaseURL}/api/tasks/${subTaskId}/submit`, {
      headers: h(publisherToken),
      data: { proof: JSON.stringify({ ok: true, t: Date.now() }) },
    })
    expect(submitResp.ok()).toBeTruthy()

    const approveResp = await request.patch(`${apiBaseURL}/api/tasks/${subTaskId}/approve`, {
      headers: h(managerToken),
      data: {},
    })
    expect(approveResp.ok()).toBeTruthy()
  }

  // 6) 子任务完成后 → Manager 整单提交 201
  {
    const resp = await request.post(`${apiBaseURL}/api/task-info/${taskInfoId}/overall-submission`, {
      headers: h(managerToken),
      data: { summary: `overall-${now}`, url: 'https://example.com/ok' },
    })
    expect(resp.status()).toBe(201)
  }

  // 7) Publisher 审核整单
  {
    const resp = await request.post(`${apiBaseURL}/api/task-info/${taskInfoId}/overall-submission/review`, {
      headers: h(publisherToken),
      data: { decision: 'approved', reason: 'ok' },
    })
    expect(resp.status()).toBe(200)
  }
})

