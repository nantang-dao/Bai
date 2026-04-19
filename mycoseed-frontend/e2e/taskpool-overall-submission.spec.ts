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

async function assertTokenValid(label: string, apiBaseURL: string, token: string) {
  const resp = await fetch(`${apiBaseURL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!resp.ok) {
    const body = await resp.text().catch(() => '')
    throw new Error(`${label} token 无法通过 /api/auth/me 校验: ${resp.status} ${resp.statusText} ${body}`)
  }
}

test('阶段4A：整单提交 + Publisher 只读视图（双账号）', async () => {
  test.setTimeout(300_000)

  const publisherToken = process.env.AUTH_TOKEN_PUBLISHER
  const managerToken = process.env.AUTH_TOKEN_MANAGER
  if (!publisherToken || !managerToken) {
    throw new Error('请设置环境变量 AUTH_TOKEN_PUBLISHER 与 AUTH_TOKEN_MANAGER（不要在聊天里粘贴 token）')
  }

  const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3003'
  const apiBaseURL = process.env.API_BASE_URL || 'http://127.0.0.1:3001'

  // 失败要尽早失败，避免 UI 跑半天才 401
  await assertTokenValid('publisher', apiBaseURL, publisherToken)
  await assertTokenValid('manager', apiBaseURL, managerToken)

  const browser = await chromium.launch({
    headless: false,
    slowMo: Number(process.env.SLOW_MO_MS || '0') || 0,
  })

  try {
    // 1) publisher 创建任务池，拿到 manageUrl / taskInfoId
    const pub = await newAuthedPage(browser, baseURL, publisherToken)
    const publisherPage = pub.page

    await publisherPage.goto(`${baseURL}/tasks`, { waitUntil: 'domcontentloaded' })
    await publisherPage.getByRole('button', { name: '任务池' }).click()
    // 精确匹配页面标题，避免命中卡片标题「E2E 任务池...」触发 strict mode
    await expect(publisherPage.getByRole('heading', { name: /^任务池$/ })).toBeVisible()
    await publisherPage.getByRole('button', { name: '发布任务' }).click()
    await expect(publisherPage.getByRole('heading', { name: '发布任务池' })).toBeVisible()
    // 已注入社区 localStorage，不应再提示“请先选择社区”
    await expect(publisherPage.getByText('请先通过社区广场或左上角选择社区，再发布任务池。')).toHaveCount(0)

    const title = `E2E 任务池(整单提交) ${Date.now()}`
    await publisherPage.getByPlaceholder('主任务 / 任务池名称').fill(title)
    await publisherPage.getByPlaceholder('描述整体目标与规则…').fill('E2E：manager 整单提交；publisher 只读。')
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

    // 2) manager 认领 + 整单提交（UI）
    const mgr = await newAuthedPage(browser, baseURL, managerToken)
    const managerPage = mgr.page
    await managerPage.goto(manageUrl, { waitUntil: 'domcontentloaded' })
    await expect(managerPage.getByRole('heading', { name: '任务池管理' })).toBeVisible()

    const claimBtn = managerPage.getByRole('button', { name: '认领 Manager' })
    if (await claimBtn.isVisible().catch(() => false)) {
      await claimBtn.scrollIntoViewIfNeeded()
      await claimBtn.click({ force: true })
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
      await managerPage.reload({ waitUntil: 'domcontentloaded' })
    }

    await expect(managerPage.getByText('整单提交（总凭证）')).toBeVisible({ timeout: 60_000 })
    const summary = `整单说明-${Date.now()}`
    const url = `https://example.com/${Date.now()}`

    // 卡片内填表：用 placeholder 精确定位，避免 strict mode 命中到“新子任务标题”输入框
    const overallCard = managerPage.locator('div', { has: managerPage.getByText('整单提交（总凭证）') }).first()
    await overallCard.getByPlaceholder('概述整单完成情况、审核要点…').fill(summary)
    await overallCard.getByPlaceholder('例如：https://...').fill(url)

    const overallRespPromise = managerPage.waitForResponse(
      (r) =>
        r.url().includes(`/api/task-info/`) &&
        r.url().includes(`/overall-submission`) &&
        r.request().method() === 'POST',
      { timeout: 60_000 }
    )
    await managerPage.getByRole('button', { name: '整单提交' }).click()
    const overallResp = await overallRespPromise
    if (!overallResp.ok()) {
      const body = await overallResp.text().catch(() => '')
      throw new Error(`manager 整单提交失败: ${overallResp.status()} ${overallResp.statusText()} ${body}`)
    }

    // 3) publisher：只读提示出现 + 输入/按钮禁用（UI 级）
    // 先等 manager_user_id 从后端落到列表元数据（避免偶发的旧缓存/竞态）
    await publisherPage.reload({ waitUntil: 'domcontentloaded' })
    await expect(publisherPage.getByText('Manager (链下):')).toBeVisible({ timeout: 30_000 })
    await expect(publisherPage.getByText('（未认领）')).toHaveCount(0, { timeout: 30_000 })
    await expect(publisherPage.getByText('只读模式')).toBeVisible({ timeout: 30_000 })
    await expect(publisherPage.getByText('该任务池已由 Manager 接管')).toBeVisible({ timeout: 30_000 })

    await expect(publisherPage.getByPlaceholder('例如：子任务 A')).toBeDisabled()
    await expect(publisherPage.getByRole('button', { name: '添加子任务' })).toBeDisabled()
    await expect(publisherPage.getByRole('button', { name: /子任务定稿/ })).toBeDisabled()
    await expect(publisherPage.getByRole('button', { name: '整单提交' })).toBeDisabled()

    // 4) publisher：仍可读整单提交，但提交应 403（接口级，更稳定）
    {
      const readResp = await publisherPage.request.get(
        `${apiBaseURL}/api/task-info/${taskInfoId}/overall-submission`,
        { headers: { Authorization: `Bearer ${publisherToken}` } }
      )
      if (!readResp.ok()) {
        const body = await readResp.text().catch(() => '')
        throw new Error(`publisher 读取整单提交失败: ${readResp.status()} ${readResp.statusText()} ${body}`)
      }
      const json = (await readResp.json()) as { submission?: { payload?: { summary?: string; url?: string } } | null }
      expect(json.submission?.payload?.summary || '').toContain(summary)
      expect(json.submission?.payload?.url || '').toContain(url)
    }

    {
      const writeResp = await publisherPage.request.post(
        `${apiBaseURL}/api/task-info/${taskInfoId}/overall-submission`,
        {
          headers: { Authorization: `Bearer ${publisherToken}` },
          data: { summary: `publisher-should-fail-${Date.now()}` },
        }
      )
      expect(writeResp.status()).toBe(403)
    }

    await Promise.all([pub.context.close(), mgr.context.close()])
  } finally {
    await browser.close()
  }
})

