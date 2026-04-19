import { test, expect } from '@playwright/test'

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

test('阶段8：整单提交 gate（子任务未全完成 → 400；完成后 → 201；Publisher 审核 → 200）', async ({
  request,
}) => {
  test.setTimeout(180_000)

  const publisherToken = process.env.AUTH_TOKEN_PUBLISHER
  const managerToken = process.env.AUTH_TOKEN_MANAGER
  if (!publisherToken || !managerToken) {
    throw new Error('请设置环境变量 AUTH_TOKEN_PUBLISHER 与 AUTH_TOKEN_MANAGER（不要在聊天里粘贴 token）')
  }
  if (publisherToken === managerToken) {
    throw new Error('AUTH_TOKEN_PUBLISHER 与 AUTH_TOKEN_MANAGER 须为两个不同账号')
  }

  const apiBaseURL = process.env.API_BASE_URL || 'http://127.0.0.1:3001'
  const now = Date.now()

  // 1) publisher 创建任务池（首行 listing_kind=taskpool_pool）
  const createResp = await request.post(`${apiBaseURL}/api/tasks`, {
    headers: h(publisherToken),
    data: {
      title: `e2e-overall-gate-${now}`,
      description: 'taskpool-overall-submission-gate',
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
  const created = (await createResp.json()) as { id?: string; taskInfoId?: string }
  if (!createResp.ok()) {
    const body = await createResp.text().catch(() => '')
    throw new Error(`创建任务池失败: ${createResp.status()} ${createResp.statusText()} ${body}`)
  }
  const poolPrimaryTaskId = created.id
  const taskInfoId = created.taskInfoId
  expect(poolPrimaryTaskId).toBeTruthy()
  expect(taskInfoId).toBeTruthy()

  // 2) manager 认领池主入口（写 manager_user_id）
  {
    const resp = await request.patch(`${apiBaseURL}/api/tasks/${poolPrimaryTaskId}/claim`, {
      headers: h(managerToken),
      data: {},
    })
    if (!resp.ok()) {
      const body = await resp.text().catch(() => '')
      throw new Error(`manager 认领池主入口失败: ${resp.status()} ${resp.statusText()} ${body}`)
    }
  }

  // 3) manager 创建子任务草稿 + 定稿进商城（拿到 subtask tasks.id）
  {
    const subResp = await request.post(`${apiBaseURL}/api/task-info/${taskInfoId}/subtasks`, {
      headers: h(managerToken),
      data: { title: `子任务-${now}`, sortOrder: 0 },
    })
    if (subResp.status() !== 201) {
      const body = await subResp.text().catch(() => '')
      throw new Error(`创建子任务草稿失败: ${subResp.status()} ${subResp.statusText()} ${body}`)
    }
  }

  const finResp = await request.post(`${apiBaseURL}/api/task-info/${taskInfoId}/subtasks/finalize`, {
    headers: h(managerToken),
    data: {},
  })
  if (!finResp.ok()) {
    const body = await finResp.text().catch(() => '')
    throw new Error(`子任务定稿失败: ${finResp.status()} ${finResp.statusText()} ${body}`)
  }
  const finJson = await finResp.json()
  const subTaskId = finJson?.subtaskMallSync?.taskIds?.[0]
  expect(subTaskId).toBeTruthy()

  // (A) 子任务未完成 → 整单提交 400
  {
    const overallResp = await request.post(`${apiBaseURL}/api/task-info/${taskInfoId}/overall-submission`, {
      headers: h(managerToken),
      data: { summary: `should-fail-${now}`, url: 'https://example.com/fail' },
    })
    expect(overallResp.status()).toBe(400)
  }

  // 完成子任务：publisher 领取 + 提交凭证；manager 审核通过（子任务仅 manager）
  {
    const claimResp = await request.patch(`${apiBaseURL}/api/tasks/${subTaskId}/claim`, {
      headers: h(publisherToken),
      data: {},
    })
    if (!claimResp.ok()) {
      const body = await claimResp.text().catch(() => '')
      throw new Error(`publisher 领取子任务失败: ${claimResp.status()} ${claimResp.statusText()} ${body}`)
    }

    const submitResp = await request.patch(`${apiBaseURL}/api/tasks/${subTaskId}/submit`, {
      headers: h(publisherToken),
      data: { proof: JSON.stringify({ ok: true, t: Date.now() }) },
    })
    if (!submitResp.ok()) {
      const body = await submitResp.text().catch(() => '')
      throw new Error(`publisher 提交子任务凭证失败: ${submitResp.status()} ${submitResp.statusText()} ${body}`)
    }

    const approveResp = await request.patch(`${apiBaseURL}/api/tasks/${subTaskId}/approve`, {
      headers: h(managerToken),
      data: {},
    })
    if (!approveResp.ok()) {
      const body = await approveResp.text().catch(() => '')
      throw new Error(`manager 审核子任务失败: ${approveResp.status()} ${approveResp.statusText()} ${body}`)
    }
  }

  // (B) 子任务完成后 → 整单提交 201
  const overallSummary = `overall-${now}`
  {
    const overallResp = await request.post(`${apiBaseURL}/api/task-info/${taskInfoId}/overall-submission`, {
      headers: h(managerToken),
      data: { summary: overallSummary, url: 'https://example.com/ok' },
    })
    expect(overallResp.status()).toBe(201)
  }

  // (C) Publisher 审核整单 → 200
  {
    const reviewResp = await request.post(`${apiBaseURL}/api/task-info/${taskInfoId}/overall-submission/review`, {
      headers: h(publisherToken),
      data: { decision: 'approved', reason: 'ok' },
    })
    expect(reviewResp.status()).toBe(200)
  }
})

