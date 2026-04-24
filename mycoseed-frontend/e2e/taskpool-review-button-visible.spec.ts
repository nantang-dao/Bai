import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'

const COMMUNITY_STORAGE_KEY = 'mycoseed_current_community_id'
const DEFAULT_COMMUNITY_UUID = '00000000-0000-0000-0000-000000000002'

test.describe('任务详情：发包者审核入口可见（回归测试）', () => {
  test('participantLimit 缺失但 participantsList>1：创建者应看到“审核任务”按钮', async ({ page, baseURL }) => {
    test.setTimeout(120_000)
    const effectiveBaseURL = baseURL || process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3003'

    const creatorId = randomUUID()
    const taskInfoId = randomUUID()
    const poolListingId = randomUUID()
    const participantTaskId = randomUUID()

    // 登录态 + 当前社区
    await page.goto(effectiveBaseURL, { waitUntil: 'domcontentloaded' })
    await page.evaluate(
      ([tok, k, v]) => {
        document.cookie = `auth_token=${encodeURIComponent(tok)};path=/;SameSite=Lax`
        localStorage.setItem('auth_token', tok)
        localStorage.setItem(k, v)
      },
      ['e2e-token', COMMUNITY_STORAGE_KEY, DEFAULT_COMMUNITY_UUID]
    )

    // getUserStore.getUser 依赖 /api/auth/me
    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify({ id: creatorId, name: 'e2e-creator' }),
      })
    })

    // 任务详情首次请求：pool listing（故意不带 participantLimit）
    await page.route(`**/api/tasks/${poolListingId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify({
          id: poolListingId,
          title: 'E2E Pool Listing',
          description: 'mock',
          reward: 1,
          status: 'submitted',
          creatorId,
          creatorName: 'e2e-creator',
          taskInfoId,
          useTaskpool: true,
          listingKind: 'taskpool_pool',
          communityId: DEFAULT_COMMUNITY_UUID,
          createdAt: new Date().toISOString(),
          participantsList: [
            {
              id: participantTaskId,
              name: '参与者A',
              claimedAt: new Date().toISOString(),
              submittedAt: new Date().toISOString(),
              status: 'submitted',
              claimerId: randomUUID(),
            },
            {
              id: randomUUID(),
              name: '参与者B',
              claimedAt: new Date().toISOString(),
              status: 'claimed',
              claimerId: randomUUID(),
            },
          ],
          timeline: [],
        }),
      })
    })

    // 当切换到参与者任务行后，会再请求该 participantTaskId
    await page.route(`**/api/tasks/${participantTaskId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify({
          id: participantTaskId,
          title: 'E2E Participant Task',
          description: 'mock',
          reward: 1,
          status: 'submitted',
          creatorId,
          creatorName: 'e2e-creator',
          claimerId: randomUUID(),
          claimerName: '参与者A',
          taskInfoId,
          useTaskpool: true,
          listingKind: 'taskpool_pool',
          communityId: DEFAULT_COMMUNITY_UUID,
          createdAt: new Date().toISOString(),
          submittedAt: new Date().toISOString(),
          participantsList: [],
          timeline: [],
        }),
      })
    })

    await page.goto(`${effectiveBaseURL}/tasks/${poolListingId}`, { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('button', { name: '审核任务' })).toBeVisible({ timeout: 25_000 })
  })
})

