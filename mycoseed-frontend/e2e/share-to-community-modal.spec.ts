import { test, expect } from '@playwright/test'

const COMMUNITY_STORAGE_KEY = 'mycoseed_current_community_id'
const DEFAULT_COMMUNITY_UUID = '00000000-0000-0000-0000-000000000002'

/**
 * 诊断「分享到社区圈」弹窗是否出现。
 *
 * 环境变量：
 * - AUTH_TOKEN：必填，与 README 一致
 * - SHARE_MODAL_TEST_TASK_ID：必填，一条已完成且已标记转账的任务 UUID（与 token 用户为发布者/可审核者一致）
 *
 * 运行（示例）：
 * AUTH_TOKEN=xxx SHARE_MODAL_TEST_TASK_ID=uuid npx playwright test e2e/share-to-community-modal.spec.ts
 */
async function withAuthedPage(page: any, baseURL: string, token: string) {
  const diag: string[] = []
  page.on('console', (msg) => {
    const t = `[${msg.type()}] ${msg.text()}`
    diag.push(t)
  })
  page.on('pageerror', (err) => {
    diag.push(`[pageerror] ${err.message}`)
  })

  await page.goto(baseURL, { waitUntil: 'domcontentloaded' })
  await page.evaluate(
    ([tok, k, v]) => {
      document.cookie = `auth_token=${encodeURIComponent(tok)};path=/;SameSite=Lax`
      localStorage.setItem('auth_token', tok)
      localStorage.setItem(k, v)
    },
    [token, COMMUNITY_STORAGE_KEY, DEFAULT_COMMUNITY_UUID]
  )
  await page.reload({ waitUntil: 'domcontentloaded' })
  return { page, diag }
}

test.describe('分享到社区圈（诊断）', () => {
  test('从审核回跳 query：应出现「分享到社区圈」弹层', async ({ page, baseURL }) => {
    test.setTimeout(120_000)

    const token = process.env.AUTH_TOKEN
    const taskId = process.env.SHARE_MODAL_TEST_TASK_ID
    test.skip(!token || !taskId, '请设置 AUTH_TOKEN 与 SHARE_MODAL_TEST_TASK_ID（见本文件顶部注释）')

    const effectiveBaseURL = baseURL || process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3003'
    const { diag } = await withAuthedPage(page, effectiveBaseURL, token!)

    await test.step('打开任务详情并带上 reviewed + share=reviewer', async () => {
      const url = `${effectiveBaseURL}/tasks/${taskId}?reviewed=true&share=reviewer`
      await page.goto(url, { waitUntil: 'networkidle' }).catch(() =>
        page.goto(url, { waitUntil: 'domcontentloaded' })
      )
      await test.info().attach('current-url.txt', {
        body: page.url(),
        contentType: 'text/plain',
      })
    })

    await test.step('断言：弹层标题「分享到社区圈」', async () => {
      const heading = page.getByRole('heading', { name: '分享到社区圈' })
      try {
        await expect(heading).toBeVisible({ timeout: 25_000 })
      } catch (e) {
        // 失败时附加更多诊断信息
        await test.info().attach('console-errors.txt', {
          body: diag.join('\n') || '(no console logs captured)',
          contentType: 'text/plain',
        })
        await test.info().attach('page-url.txt', {
          body: page.url(),
          contentType: 'text/plain',
        })
        await test.info().attach('page-content.html', {
          body: await page.content(),
          contentType: 'text/html',
        })
        await test.info().attach('screenshot.png', {
          body: await page.screenshot({ fullPage: true }),
          contentType: 'image/png',
        })
        throw e
      }
    })
  })
})
