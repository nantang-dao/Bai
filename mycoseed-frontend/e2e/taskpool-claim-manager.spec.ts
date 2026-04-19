import { test, expect, chromium, type Browser, type Page } from '@playwright/test'

const COMMUNITY_STORAGE_KEY = 'mycoseed_current_community_id'
const DEFAULT_COMMUNITY_UUID = '00000000-0000-0000-0000-000000000002'

function dtLocalPlusMinutes(mins: number) {
  const d = new Date(Date.now() + mins * 60_000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

async function fillByLabel(page: Page, labelText: string, value: string) {
  const container = page.locator('label', { hasText: labelText }).locator('..')
  const input = container.locator('input,textarea').first()
  await expect(input).toBeVisible()
  await input.fill(value)
}

async function newAuthedPage(browser: Browser, baseURL: string, authToken: string) {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' })
  // 兼容某些环境 addCookies 行为不一致：直接在页面域下写 cookie + localStorage
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

test('阶段3：manager 认领后写权限切换（双账号）', async () => {
  test.setTimeout(240_000)

  const publisherToken = process.env.AUTH_TOKEN_PUBLISHER
  const managerToken = process.env.AUTH_TOKEN_MANAGER
  if (!publisherToken || !managerToken) {
    throw new Error('请设置环境变量 AUTH_TOKEN_PUBLISHER 与 AUTH_TOKEN_MANAGER（不要在聊天里粘贴 token）')
  }

  const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3003'
  const apiBaseURL = process.env.API_BASE_URL || 'http://127.0.0.1:3001'

  // 该用例里我们手动 launch 浏览器：强制弹窗以便观察动态过程
  const browser = await chromium.launch({
    headless: false,
    slowMo: Number(process.env.SLOW_MO_MS || '0') || 0,
  })
  try {
    // 1) publisher 创建任务池，拿到 taskInfoId
    const pub = await newAuthedPage(browser, baseURL, publisherToken)
    const publisherPage = pub.page

    await publisherPage.goto(`${baseURL}/tasks`, { waitUntil: 'domcontentloaded' })
    await publisherPage.getByRole('button', { name: '任务池' }).click()
    await expect(publisherPage.getByRole('heading', { name: /^任务池$/ })).toBeVisible()
    await publisherPage.getByRole('button', { name: '发布任务' }).click()
    await expect(publisherPage.getByRole('heading', { name: '发布任务池' })).toBeVisible()
    await expect(publisherPage.getByText('请先通过社区广场或左上角选择社区，再发布任务池。')).toHaveCount(0)

    const title = `E2E 任务池(双账号) ${Date.now()}`
    await publisherPage.getByPlaceholder('主任务 / 任务池名称').fill(title)
    await publisherPage.getByPlaceholder('描述整体目标与规则…').fill('E2E：publisher 创建；manager 认领并维护；publisher 写失败。')
    await fillByLabel(publisherPage, '参与人数 *', '1')
    await fillByLabel(publisherPage, '每人积分 *', '1')
    await fillByLabel(publisherPage, '领取截止时间 *', dtLocalPlusMinutes(60))
    await fillByLabel(publisherPage, '提交截止时间 *', dtLocalPlusMinutes(120))

    await publisherPage.getByRole('button', { name: '创建并去管理页' }).click()
    await expect(publisherPage).toHaveURL(/\/tasks\/pool\/[0-9a-f-]{36}\/manage/i, { timeout: 60_000 })

    const manageUrl = publisherPage.url()
    const taskInfoIdMatch = manageUrl.match(/\/tasks\/pool\/([0-9a-f-]{36})\/manage/i)
    const taskInfoId = taskInfoIdMatch?.[1]
    expect(taskInfoId).toBeTruthy()

    // 2) manager 打开同一个 manage 页并认领
    const mgr = await newAuthedPage(browser, baseURL, managerToken)
    const managerPage = mgr.page
    await managerPage.goto(manageUrl, { waitUntil: 'domcontentloaded' })
    await expect(managerPage.getByRole('heading', { name: '任务池管理' })).toBeVisible()

    const claimBtn = managerPage.getByRole('button', { name: '认领 Manager' })
    if (await claimBtn.isVisible().catch(() => false)) {
      await expect(claimBtn).toBeEnabled()
      const seen: string[] = []
      const onReq = (r: any) => {
        if (r.method?.() === 'POST') seen.push(r.url?.() || '')
      }
      managerPage.on('request', onReq)
      try {
        await claimBtn.scrollIntoViewIfNeeded()
        await claimBtn.click({ force: true })

        // 快速确认 click handler 触发（按钮会进入 loading 态）
        await expect(managerPage.getByRole('button', { name: /认领中/ })).toBeVisible({ timeout: 5_000 })

        const claimResp = await managerPage.waitForResponse(
          (r) =>
            r.url().includes(`/api/task-info/`) &&
            r.url().includes(`/claim-manager`) &&
            r.request().method() === 'POST',
          { timeout: 60_000 }
        )
        if (!claimResp.ok()) {
          const body = await claimResp.text().catch(() => '')
          throw new Error(`manager 认领失败: ${claimResp.status()} ${claimResp.statusText()} ${body}`)
        }
      } catch (e) {
        const uniq = Array.from(new Set(seen)).slice(-20)
        throw new Error(
          `manager 认领未触发后端请求（或未捕捉到响应）。最近 POST 请求：\n- ${uniq.join('\n- ')}\n\n原始错误: ${
            e instanceof Error ? e.message : String(e)
          }`
        )
      } finally {
        managerPage.off('request', onReq)
      }
    }

    // 认领后按钮应消失，且 Manager 行不再是“未认领”
    // 由于 taskMeta 可能异步加载，这里刷新一次保证状态落到 UI
    await managerPage.reload({ waitUntil: 'domcontentloaded' })
    await expect(managerPage.getByRole('button', { name: '认领 Manager' })).toHaveCount(0, { timeout: 60_000 })
    await expect(managerPage.getByText('Manager (链下):')).toBeVisible()
    await expect(managerPage.getByText('（未认领）')).toHaveCount(0)

    // 3) manager 添加子任务成功（列表出现）
    const subtaskTitle = `子任务-${Date.now()}`
    await managerPage.getByPlaceholder('例如：子任务 A').fill(subtaskTitle)
    const createRespPromise = managerPage.waitForResponse(
      (r) =>
        r.url().includes(`/api/task-info/`) &&
        r.url().includes(`/subtasks`) &&
        r.request().method() === 'POST'
    )
    await managerPage.getByRole('button', { name: '添加子任务' }).click()
    const createResp = await createRespPromise
    if (!createResp.ok()) {
      const body = await createResp.text().catch(() => '')
      throw new Error(`manager 创建子任务失败: ${createResp.status()} ${createResp.statusText()} ${body}`)
    }
    // createTaskSubtask 内部会 refreshSubtasks；给它一点时间渲染
    await expect(managerPage.getByText(subtaskTitle)).toBeVisible({ timeout: 60_000 })

    // 4) publisher 仍可读子任务（阶段1规则：creator 可读），用直连 API 验证更稳定
    {
      const resp = await publisherPage.request.get(`${apiBaseURL}/api/task-info/${taskInfoId}/subtasks`, {
        headers: { Authorization: `Bearer ${publisherToken}` },
      })
      if (!resp.ok()) {
        const body = await resp.text().catch(() => '')
        throw new Error(`publisher 读取子任务失败: ${resp.status()} ${resp.statusText()} ${body}`)
      }
      const json = (await resp.json()) as { subtasks?: Array<{ title?: string }> }
      const titles = (json.subtasks || []).map(s => s.title || '')
      expect(titles).toContain(subtaskTitle)
    }

    const forbiddenTitle = `publisher-should-fail-${Date.now()}`
    await publisherPage.getByPlaceholder('例如：子任务 A').fill(forbiddenTitle)
    const forbiddenRespPromise = publisherPage.waitForResponse(
      (r) =>
        r.url().includes(`/api/task-info/`) &&
        r.url().includes(`/subtasks`) &&
        r.request().method() === 'POST'
    )
    await publisherPage.getByRole('button', { name: '添加子任务' }).click()
    const forbiddenResp = await forbiddenRespPromise
    // 认领后 publisher 不应再有写权限：期望 403
    expect(forbiddenResp.status()).toBe(403)

    await Promise.all([pub.context.close(), mgr.context.close()])
  } finally {
    await browser.close()
  }
})

