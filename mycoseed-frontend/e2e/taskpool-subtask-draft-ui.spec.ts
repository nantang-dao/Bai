import { test, expect, chromium, type Browser, type Page } from '@playwright/test'

const COMMUNITY_STORAGE_KEY = 'mycoseed_current_community_id'
const DEFAULT_COMMUNITY_UUID = '00000000-0000-0000-0000-000000000002'

async function newAuthedPage(browser: Browser, baseURL: string, authToken: string) {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' })
  await page.evaluate(
    ([token, k, v]) => {
      document.cookie = `auth_token=${encodeURIComponent(token)};path=/;SameSite=Lax`
      localStorage.setItem('auth_token', token)
      localStorage.setItem(k, v)
    },
    [authToken, COMMUNITY_STORAGE_KEY, DEFAULT_COMMUNITY_UUID]
  )
  await page.reload({ waitUntil: 'domcontentloaded' })
  return { context, page }
}

function dtLocalPlusMinutes(mins: number) {
  const d = new Date(Date.now() + mins * 60_000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function h(token: string) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
}

async function mustJson(resp: Response) {
  const txt = await resp.text()
  try {
    return JSON.parse(txt)
  } catch {
    return { _raw: txt.slice(0, 400) }
  }
}

test('子任务草稿 UI：可填写字段、刷新仍在、定稿后只读', async () => {
  test.setTimeout(240_000)

  const publisherToken = process.env.AUTH_TOKEN_PUBLISHER
  const managerToken = process.env.AUTH_TOKEN_MANAGER
  if (!publisherToken || !managerToken) {
    throw new Error('请设置 AUTH_TOKEN_PUBLISHER 与 AUTH_TOKEN_MANAGER（不要在聊天里粘贴 token）')
  }

  const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3003'
  const apiBaseURL = process.env.API_BASE_URL || 'http://127.0.0.1:3001'

  // API 播种：publisher 创建任务池，拿到 taskInfoId
  const now = Date.now()
  const createResp = await fetch(`${apiBaseURL}/api/tasks`, {
    method: 'POST',
    headers: h(publisherToken),
    body: JSON.stringify({
      title: `e2e-subtask-draft-ui-${now}`,
      description: 'taskpool-subtask-draft-ui',
      reward: 1,
      participantLimit: 1,
      rewardDistributionMode: 'per_person',
      startDate: new Date(Date.now() - 120_000).toISOString(),
      deadline: new Date(Date.now() + 60 * 60_000).toISOString(),
      submitDeadline: dtLocalPlusMinutes(120),
      submissionInstructions: 'n/a',
      proofConfig: { photo: { enabled: false } },
      useTaskpool: true,
      allowSplit: true,
    }),
  })
  const created = (await createResp.json().catch(() => ({}))) as any
  if (!createResp.ok) {
    throw new Error(`创建任务池失败: ${createResp.status} ${JSON.stringify(created)}`)
  }
  const taskInfoId = created.taskInfoId as string
  expect(taskInfoId).toBeTruthy()

  // 先用 API 把 Manager 认领掉，避免 UI 点击偶发网络/竞态导致 flaky
  {
    const claimResp = await fetch(`${apiBaseURL}/api/task-info/${taskInfoId}/claim-manager`, {
      method: 'POST',
      headers: h(managerToken),
      body: JSON.stringify({}),
    })
    const claimJson = await mustJson(claimResp)
    if (!claimResp.ok) {
      throw new Error(`API 认领 Manager 失败: ${claimResp.status} ${JSON.stringify(claimJson)}`)
    }
  }

  const browser = await chromium.launch({ headless: true })
  try {
    // manager 打开管理页
    const mgr = await newAuthedPage(browser, baseURL, managerToken)
    const page = mgr.page
    await page.goto(`${baseURL}/tasks/pool/${taskInfoId}/manage`, { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: '任务池管理' })).toBeVisible({ timeout: 60_000 })

    // 已由 API 认领：按钮应不出现（只读/权限由后端兜底）
    await expect(page.getByRole('button', { name: '认领 Manager' })).toHaveCount(0, { timeout: 60_000 })

    // 填“新子任务”字段并添加
    await page.getByTestId('new-subtask-title').fill(`子任务-${now}`)
    await page.getByTestId('new-subtask-description').fill('desc')
    await page.getByTestId('new-subtask-instructions').fill('inst')
    await page.getByTestId('new-subtask-participant-limit').fill('2')
    await page.getByTestId('new-subtask-reward').fill('0.5')
    await page.getByTestId('new-subtask-deadline').fill(dtLocalPlusMinutes(60))
    await page
      .getByTestId('new-subtask-proofconfig')
      .fill(JSON.stringify({ description: { enabled: true, minWords: 3 } }, null, 2))

    // 不依赖 toast 文案：等待创建子任务接口返回 201，再用列表断言作为 UI 级验收
    const createSubtaskResp = page.waitForResponse(
      async (r) => {
        if (r.request().method() !== 'POST') return false
        if (!r.url().includes('/api/task-info/')) return false
        // 注意：subtasks/finalize 也是 POST，但 url 不同
        if (!r.url().includes('/subtasks')) return false
        if (r.url().includes('/subtasks/finalize')) return false
        return true
      },
      { timeout: 60_000 }
    )
    await page.getByTestId('new-subtask-add').click()
    const resp = await createSubtaskResp
    if (resp.status() !== 201) {
      const body = await resp.text().catch(() => '')
      throw new Error(`创建子任务接口返回异常: ${resp.status()} ${resp.statusText()} ${body}`)
    }

    // 刷新后仍在：进入编辑区检查字段（用“编辑”展开）
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByText(`子任务-${now}`)).toBeVisible({ timeout: 30_000 })
    const editBtn = page.getByTestId('subtask-edit-btn').first()
    await expect(editBtn).toBeVisible({ timeout: 30_000 })
    await editBtn.click()
    await expect(page.getByTestId('edit-subtask-description')).toHaveValue('desc')
    await expect(page.getByTestId('edit-subtask-instructions')).toHaveValue('inst')

    // 定稿后：用接口响应 + DOM 文案做断言（不依赖 toast）
    const finalizeRespPromise = page.waitForResponse(
      (r) =>
        r.request().method() === 'POST' &&
        r.url().includes('/api/task-info/') &&
        r.url().includes('/subtasks/finalize'),
      { timeout: 60_000 }
    )
    await page.getByRole('button', { name: /子任务定稿/ }).click()
    const fin = await finalizeRespPromise
    if (fin.status() !== 200) {
      const body = await fin.text().catch(() => '')
      throw new Error(`定稿接口返回异常: ${fin.status()} ${fin.statusText()} ${body}`)
    }
    await expect(page.getByText('子任务已定稿，无法再添加或重复定稿。')).toBeVisible({ timeout: 60_000 })
    // 定稿后，新建表单区域应被隐藏
    await expect(page.getByTestId('new-subtask-title')).toHaveCount(0)

    await mgr.context.close()
  } finally {
    await browser.close()
  }
})

