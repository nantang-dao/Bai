/**
 * 阶段 5.3：任务池列表「Semi 预付」快捷入口 → 管理页 Semi 区块
 *
 * 需要：AUTH_TOKEN_PUBLISHER、后端、前端 dev；与 taskpool-semi-prepay-history 相同环境变量
 *
 * 半自动（手动点 Semi / 钱包）：`E2E_MANUAL_PAUSE=1`（会自动有头浏览器）。例：
 * `E2E_MANUAL_PAUSE=1 AUTH_TOKEN_PUBLISHER=... npx playwright test e2e/taskpool-pool-list-semi-cta.spec.ts`
 */

import { test, expect, chromium, type Browser } from '@playwright/test'
import { e2eChromiumHeadless, isManualPauseEnabled, maybePauseForSemiManual } from './helpers/manualPause'

const COMMUNITY_STORAGE_KEY = 'mycoseed_current_community_id'
const DEFAULT_COMMUNITY_UUID = '00000000-0000-0000-0000-000000000002'

async function assertTokenValid(apiBaseURL: string, token: string) {
  const resp = await fetch(`${apiBaseURL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!resp.ok) {
    const body = await resp.text().catch(() => '')
    throw new Error(`token 无法通过 /api/auth/me: ${resp.status} ${body}`)
  }
}

async function createTaskPoolViaApi(apiBaseURL: string, token: string): Promise<string> {
  const now = Date.now()
  const resp = await fetch(`${apiBaseURL}/api/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      title: `e2e-pool-list-semi-${now}`,
      description: 'e2e 5.3 list cta',
      reward: 1,
      participantLimit: 1,
      rewardDistributionMode: 'per_person',
      startDate: new Date(Date.now() + 60_000).toISOString(),
      deadline: new Date(Date.now() + 60 * 60_000).toISOString(),
      submitDeadline: new Date(Date.now() + 120 * 60_000).toISOString(),
      submissionInstructions: 'n/a',
      proofConfig: { photo: { enabled: false } },
      useTaskpool: true,
      allowSplit: true,
    }),
  })
  const data = (await resp.json().catch(() => ({}))) as { taskInfoId?: string }
  if (!resp.ok) throw new Error(`创建任务池失败: ${resp.status} ${JSON.stringify(data)}`)
  if (!data.taskInfoId) throw new Error('未返回 taskInfoId')
  return data.taskInfoId
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

test('任务池列表：Semi 预付快捷入口进入管理页并可见 Semi 区块', async () => {
  test.setTimeout(isManualPauseEnabled() ? 600_000 : 180_000)

  const publisherToken = process.env.AUTH_TOKEN_PUBLISHER
  if (!publisherToken) throw new Error('请设置 AUTH_TOKEN_PUBLISHER')

  const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3003'
  const apiBaseURL = process.env.API_BASE_URL || 'http://127.0.0.1:3001'

  await assertTokenValid(apiBaseURL, publisherToken)
  const taskInfoId = await createTaskPoolViaApi(apiBaseURL, publisherToken)

  const browser = await chromium.launch({
    headless: e2eChromiumHeadless(),
  })

  try {
    const { context, page } = await newAuthedPage(browser, baseURL, publisherToken)
    await page.goto(`${baseURL}/tasks/pool`, { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: /^任务池$/ })).toBeVisible({ timeout: 60_000 })

    const card = page.locator('.cursor-pointer').filter({ hasText: taskInfoId }).first()
    await expect(card).toBeVisible({ timeout: 30_000 })
    const cta = card.getByTestId('taskpool-list-semi-prepay')
    await expect(cta).toBeVisible({ timeout: 15_000 })
    await cta.click()

    await expect(page).toHaveURL(new RegExp(`/tasks/pool/${taskInfoId}/manage`, 'i'), { timeout: 60_000 })
    await expect(page.getByRole('heading', { name: '任务池管理' })).toBeVisible()
    await expect(page.getByTestId('taskpool-semi-prepay-section')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('button', { name: '用 Semi 预付' })).toBeVisible()

    await maybePauseForSemiManual(
      page,
      '可点击「用 Semi 预付」→ 在 Semi App 完成 approve/deposit → 回跳后回到本页或点 Resume 结束暂停。'
    )

    await context.close()
  } finally {
    await browser.close()
  }
})
