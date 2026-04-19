/**
 * 阶段 5.2：manage 页「Semi 预付记录」表格（数据由 API 播种，不弹 Semi）
 *
 * 需要：
 * - 后端可访问（API_BASE_URL / 默认 3001），且已应用迁移 026、027
 * - AUTH_TOKEN_PUBLISHER
 * - 前端 dev（PLAYWRIGHT_BASE_URL / 默认 3003）
 *
 * 运行：cd mycoseed-frontend && AUTH_TOKEN_PUBLISHER=... npx playwright test e2e/taskpool-semi-prepay-history.spec.ts
 *
 * 半自动：`E2E_MANUAL_PAUSE=1` — 断言通过后暂停，便于查看表格或再点「用 Semi 预付」。
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

async function createTaskPoolViaApi(
  apiBaseURL: string,
  token: string
): Promise<{ taskInfoId: string }> {
  const now = Date.now()
  const resp = await fetch(`${apiBaseURL}/api/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      title: `e2e-prepay-history-${now}`,
      description: 'e2e semi prepay table',
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
  const data = (await resp.json().catch(() => ({}))) as { taskInfoId?: string; error?: string }
  if (!resp.ok) {
    throw new Error(`创建任务池失败: ${resp.status} ${JSON.stringify(data)}`)
  }
  const taskInfoId = data.taskInfoId
  if (!taskInfoId) throw new Error(`未返回 taskInfoId: ${JSON.stringify(data)}`)
  return { taskInfoId }
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

test('manage：Semi 预付记录表展示支付单号（API 播种）', async () => {
  test.setTimeout(isManualPauseEnabled() ? 600_000 : 180_000)

  const publisherToken = process.env.AUTH_TOKEN_PUBLISHER
  if (!publisherToken) {
    throw new Error('请设置 AUTH_TOKEN_PUBLISHER')
  }

  const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3003'
  const apiBaseURL = process.env.API_BASE_URL || 'http://127.0.0.1:3001'

  await assertTokenValid(apiBaseURL, publisherToken)

  const { taskInfoId } = await createTaskPoolViaApi(apiBaseURL, publisherToken)

  const payRef = `e2e-pay-${Date.now()}`
  const state = `e2e-st-${Date.now()}-xxxxxxxx`

  const startResp = await fetch(`${apiBaseURL}/api/task-info/${taskInfoId}/prepay-intent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publisherToken}` },
    body: JSON.stringify({
      state,
      amountHuman: '1',
      clientReference: payRef,
    }),
  })
  const startJson = await startResp.json().catch(() => ({}))
  if (!startResp.ok) {
    throw new Error(`prepay-intent 失败: ${startResp.status} ${JSON.stringify(startJson)}`)
  }

  const doneResp = await fetch(`${apiBaseURL}/api/task-info/${taskInfoId}/prepay-complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publisherToken}` },
    body: JSON.stringify({
      state,
      status: 'success',
      user_op_hash: '0xe2e0001',
      tx_hash: '0xe2e0002',
    }),
  })
  const doneJson = await doneResp.json().catch(() => ({}))
  if (!doneResp.ok) {
    throw new Error(`prepay-complete 失败: ${doneResp.status} ${JSON.stringify(doneJson)}`)
  }

  const browser = await chromium.launch({
    headless: e2eChromiumHeadless(),
  })

  try {
    const { context, page } = await newAuthedPage(browser, baseURL, publisherToken)
    await page.goto(`${baseURL}/tasks/pool/${taskInfoId}/manage`, { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: '任务池管理' })).toBeVisible({ timeout: 60_000 })

    await expect(page.getByTestId('taskpool-prepay-history')).toBeVisible({ timeout: 30_000 })
    const row = page.getByTestId('taskpool-prepay-row').filter({ hasText: payRef })
    await expect(row).toBeVisible()
    await expect(row.getByText('成功')).toBeVisible()

    await maybePauseForSemiManual(page, '表格已由 API 播种；可在此查看 UI，或再手动点「用 Semi 预付」做真实联调。')

    await context.close()
  } finally {
    await browser.close()
  }
})
