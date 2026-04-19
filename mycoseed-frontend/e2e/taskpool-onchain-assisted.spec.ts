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

test('阶段4B：链上建池（需手动点 MetaMask 一次）', async () => {
  test.setTimeout(420_000)

  const managerToken = process.env.AUTH_TOKEN_MANAGER
  if (!managerToken) {
    throw new Error('请设置环境变量 AUTH_TOKEN_MANAGER（不要在聊天里粘贴 token）')
  }

  const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3003'
  const apiBaseURL = process.env.API_BASE_URL || 'http://127.0.0.1:3001'
  await assertTokenValid('manager', apiBaseURL, managerToken)

  const browser = await chromium.launch({
    headless: false,
    slowMo: Number(process.env.SLOW_MO_MS || '0') || 0,
  })

  try {
    // 1) manager 创建一个任务池并进入 manage 页
    const mgr = await newAuthedPage(browser, baseURL, managerToken)
    const page = mgr.page

    await page.goto(`${baseURL}/tasks`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: '任务池' }).click()
    await expect(page.getByRole('heading', { name: /^任务池$/ })).toBeVisible()
    await page.getByRole('button', { name: '发布任务' }).click()
    await expect(page.getByRole('heading', { name: '发布任务池' })).toBeVisible()
    await expect(page.getByText('请先通过社区广场或左上角选择社区，再发布任务池。')).toHaveCount(0)

    const title = `E2E 任务池(链上建池) ${Date.now()}`
    await page.getByPlaceholder('主任务 / 任务池名称').fill(title)
    await page.getByPlaceholder('描述整体目标与规则…').fill('E2E：manager 点一次 MetaMask，其余自动等待并校验 UI。')
    await fillByLabel(page, '参与人数 *', '1')
    await fillByLabel(page, '每人积分 *', '1')
    await fillByLabel(page, '领取截止时间 *', dtLocalPlusMinutes(60))
    await fillByLabel(page, '提交截止时间 *', dtLocalPlusMinutes(120))

    // 直接从创建接口响应拿 taskInfoId，再强制跳转 manage，避免偶发的路由来回跳转导致卡在 create 页
    const createRespPromise = page.waitForResponse(
      (r) => r.url().includes('/api/tasks') && r.request().method() === 'POST',
      { timeout: 60_000 }
    )
    await page.getByRole('button', { name: '创建并去管理页' }).click()
    const createResp = await createRespPromise
    if (!createResp.ok()) {
      const body = await createResp.text().catch(() => '')
      throw new Error(`创建任务池失败: ${createResp.status()} ${createResp.statusText()} ${body}`)
    }
    const created = (await createResp.json().catch(() => ({}))) as any
    const taskInfoId =
      created?.taskInfoId ||
      created?.task_info_id ||
      created?.taskInfo?.id ||
      created?.task_info?.id
    if (!taskInfoId || typeof taskInfoId !== 'string') {
      throw new Error(`创建接口未返回 taskInfoId，返回体：${JSON.stringify(created).slice(0, 500)}`)
    }
    const manageUrl = `${baseURL}/tasks/pool/${taskInfoId}/manage?title=${encodeURIComponent(title)}`
    await page.goto(manageUrl, { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: '任务池管理' })).toBeVisible({ timeout: 60_000 })

    // 2) 若未认领，先认领 manager（确保 canWrite）
    const claimBtn = page.getByRole('button', { name: '认领 Manager' })
    if (await claimBtn.isVisible().catch(() => false)) {
      await claimBtn.scrollIntoViewIfNeeded()
      await claimBtn.click({ force: true })
      const resp = await page.waitForResponse(
        (r) =>
          r.url().includes('/api/task-info/') &&
          r.url().includes('/claim-manager') &&
          r.request().method() === 'POST',
        { timeout: 60_000 }
      )
      if (!resp.ok()) {
        const body = await resp.text().catch(() => '')
        throw new Error(`认领失败: ${resp.status()} ${resp.statusText()} ${body}`)
      }
      await page.reload({ waitUntil: 'domcontentloaded' })
    }

    // 3) 点击链上建池按钮：这里会弹 MetaMask，你只需要手动确认一次
    const createBtn = page.getByRole('button', { name: '创建链上 TaskPool' })
    await expect(createBtn).toBeVisible()
    await createBtn.scrollIntoViewIfNeeded()
    await createBtn.click({ force: true })

    // 4) 自动等待：txHash/phase 出现（只要你在 MetaMask 点确认，测试会继续）
    await expect(page.getByText('createTaskPool txHash:')).toBeVisible({ timeout: 240_000 })
    await expect(page.getByText('TaskPool phase:')).toBeVisible({ timeout: 240_000 })
    await expect(page.getByText('pool_created')).toBeVisible({ timeout: 240_000 })

    // 按钮应变为“已建池”
    await expect(page.getByRole('button', { name: '已建池' })).toBeVisible({ timeout: 60_000 })

    await mgr.context.close()
  } finally {
    await browser.close()
  }
})

