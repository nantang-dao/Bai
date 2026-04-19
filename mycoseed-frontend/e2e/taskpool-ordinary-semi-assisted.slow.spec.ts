import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect, chromium, type Browser, type Page } from '@playwright/test'

// 加载后端 .env（AUTH_TOKEN_* 通常放在 mycoseed-backend/.env），再加载前端 .env 作为补充。
// 注意：不打印任何 env 值。
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.resolve(__dirname, '../../mycoseed-backend/.env') })
dotenv.config({ path: path.resolve(__dirname, '../.env') })

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

async function ensureCommunitySelected(page: Page) {
  await page.evaluate(
    ([k, v]) => {
      try {
        localStorage.setItem(k, v)
      } catch {}
    },
    [COMMUNITY_STORAGE_KEY, DEFAULT_COMMUNITY_UUID]
  )
  await page.reload({ waitUntil: 'domcontentloaded' })
  const hint = page.getByText('请先通过社区广场或左上角选择社区，再发布任务。')
  // 允许一点初始化延迟：最多重试几次
  for (let i = 0; i < 3; i++) {
    if ((await hint.count().catch(() => 0)) === 0) return
    await page.waitForTimeout(800)
    await page.reload({ waitUntil: 'domcontentloaded' })
  }
}

async function assertTokenValid(label: string, apiBaseURL: string, token: string) {
  const resp = await fetch(`${apiBaseURL}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
  if (!resp.ok) {
    const body = await resp.text().catch(() => '')
    throw new Error(`${label} token 无法通过 /api/auth/me 校验: ${resp.status} ${resp.statusText} ${body}`)
  }
}

async function waitForReturnCallback(popup: Page, pathPart: string, timeoutMs: number) {
  // Semi 会在同一 popup 内导航回 mycoseed 的 callback 页面
  console.log(`\n[MANUAL] 请在 Semi 页面完成交易确认，然后等待自动回跳到 ${pathPart} ...\n`)
  await popup.waitForURL((u) => u.pathname.includes(pathPart), { timeout: timeoutMs })
}

test('普通任务=单子任务池（Semi 手动签名辅助）@slow', async () => {
  test.setTimeout(1_800_000) // 30min（给你点多笔交易的缓冲）

  const publisherToken = process.env.AUTH_TOKEN_PUBLISHER
  const candidateToken = process.env.AUTH_TOKEN_CANDIDATE
  if (!publisherToken || !candidateToken) {
    throw new Error('请设置 AUTH_TOKEN_PUBLISHER 与 AUTH_TOKEN_CANDIDATE（不要在聊天里粘贴 token）')
  }
  if (publisherToken === candidateToken) {
    throw new Error('AUTH_TOKEN_PUBLISHER 与 AUTH_TOKEN_CANDIDATE 需为两个不同账号')
  }

  const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3003'
  const apiBaseURL = process.env.API_BASE_URL || 'http://127.0.0.1:3001'
  await assertTokenValid('publisher', apiBaseURL, publisherToken)
  await assertTokenValid('candidate', apiBaseURL, candidateToken)

  const semiBaseURL = process.env.NUXT_PUBLIC_SEMI_APP_URL || 'http://127.0.0.1:3000'
  console.log(`[info] mycoseed baseURL=${baseURL}`)
  console.log(`[info] apiBaseURL=${apiBaseURL}`)
  console.log(`[info] semiBaseURL=${semiBaseURL}`)

  const browser = await chromium.launch({
    // 用系统 Chrome，避免 Playwright 下载浏览器（更省磁盘）
    channel: 'chrome',
    headless: false,
    slowMo: Number(process.env.SLOW_MO_MS || '0') || 0,
  })

  try {
    // ================
    // Step1-3：发布普通任务 → Semi 预付（approve+deposit+createTaskPoolSelf）→ 回跳确权
    // ================
    const pub = await newAuthedPage(browser, baseURL, publisherToken)
    const pubPage = pub.page

    await pubPage.goto(`${baseURL}/tasks/create`, { waitUntil: 'domcontentloaded' })
    await expect(pubPage.getByRole('heading', { name: '创建任务' })).toBeVisible()
    await ensureCommunitySelected(pubPage)
    await expect(pubPage.getByText('请先通过社区广场或左上角选择社区，再发布任务。')).toHaveCount(0)

    const title = `E2E 普通任务(Semi) ${Date.now()}`
    await pubPage.getByPlaceholder('输入任务名称').fill(title)
    await pubPage.getByPlaceholder('描述任务的具体目标，开始、结束时间，地点等信息...').fill(
      'E2E：自动跑到 Semi 需要你确认交易时暂停；你点完会自动回跳并继续。'
    )

    await fillByLabel(pubPage, '参与人数', '1')
    await fillByLabel(pubPage, '每人积分 *', '1')
    await fillByLabel(pubPage, '领取截止时间 *', dtLocalPlusMinutes(60))
    await fillByLabel(pubPage, '提交截止时间 *', dtLocalPlusMinutes(120))

    const popupPromise = pubPage.waitForEvent('popup', { timeout: 30_000 })
    await pubPage.getByRole('button', { name: '发布任务' }).click()
    const prepayPopup = await popupPromise

    // 等你在 Semi 完成真实交易后回跳
    await waitForReturnCallback(prepayPopup, '/wallet/semi-prepay-callback', 1_200_000)

    await expect(prepayPopup.getByRole('heading', { name: 'Semi 预付结果' })).toBeVisible({ timeout: 60_000 })
    await expect(prepayPopup.getByText('预付已提交（success）')).toBeVisible({ timeout: 240_000 })
    await expect(prepayPopup.getByText('已同步预付结果到服务端（intent）。')).toBeVisible({ timeout: 240_000 })

    // 从发布页 sessionStorage 拿到 tasks.id（回跳页只展示 pool_uuid）
    const draft = await pubPage.evaluate(() => {
      try {
        return sessionStorage.getItem('semi_task_publish_draft')
      } catch {
        return null
      }
    })
    if (!draft) throw new Error('未在发布页 sessionStorage 找到 semi_task_publish_draft（无法继续后续 claim/approve）')
    const parsedDraft = JSON.parse(draft) as { taskId?: string; taskInfoId?: string }
    const taskId = String(parsedDraft.taskId || '')
    const taskInfoId = String(parsedDraft.taskInfoId || '')
    if (!taskId || !taskInfoId) throw new Error(`semi_task_publish_draft 缺少 taskId/taskInfoId: ${draft}`)

    // ================
    // Step4：candidate 领取（Semi claimTask）→ 回跳确权
    // ================
    const cand = await newAuthedPage(browser, baseURL, candidateToken)
    const candPage = cand.page

    await candPage.goto(`${baseURL}/tasks/${encodeURIComponent(taskId)}`, { waitUntil: 'domcontentloaded' })
    await expect(candPage.getByRole('button', { name: '领取任务' })).toBeVisible({ timeout: 60_000 })

    const claimPopupPromise = candPage.waitForEvent('popup', { timeout: 30_000 })
    await candPage.getByRole('button', { name: '领取任务' }).click()
    const claimPopup = await claimPopupPromise

    await waitForReturnCallback(claimPopup, '/wallet/semi-claim-callback', 1_200_000)
    await expect(claimPopup.getByRole('heading', { name: 'Semi 领取结果' })).toBeVisible({ timeout: 60_000 })
    await expect(claimPopup.getByText('领取已提交（success）')).toBeVisible({ timeout: 240_000 })
    await expect(claimPopup.getByText('已同步领取结果到服务端。')).toBeVisible({ timeout: 240_000 })

    // ================
    // Step5：candidate 提交链下凭证 → publisher 走 Semi 链上审核 approveSubtask → 回跳确权
    // ================
    await candPage.goto(`${baseURL}/tasks/${encodeURIComponent(taskId)}`, { waitUntil: 'domcontentloaded' })
    await expect(candPage.getByRole('button', { name: /提交任务/ })).toBeVisible({ timeout: 60_000 })
    await candPage.getByRole('button', { name: /提交任务/ }).click()

    await expect(candPage).toHaveURL(/\/tasks\/submit\?id=/, { timeout: 60_000 })
    // 若页面要求描述，则填入
    const desc = candPage.locator('textarea').first()
    if (await desc.isVisible().catch(() => false)) {
      await desc.fill('E2E：提交完成说明。')
    }
    await candPage.getByRole('button', { name: '提交任务' }).click()
    // 提交成功后通常回到详情页（或 toast）；这里以返回详情按钮可见为兜底
    await expect(candPage.getByRole('button', { name: '← 返回任务详情' })).toBeVisible({ timeout: 60_000 })

    const pubReview = await newAuthedPage(browser, baseURL, publisherToken)
    const pubReviewPage = pubReview.page
    await pubReviewPage.goto(`${baseURL}/tasks/review?id=${encodeURIComponent(taskId)}`, { waitUntil: 'domcontentloaded' })
    // review 页面标题可能是“审核任务/审核提交”，不强绑完整文案
    await expect(pubReviewPage.getByText(/审核/)).toBeVisible({ timeout: 60_000 })

    // 选择“通过”并提交（会弹 Semi）
    // 这里尽量点击页面上的“提交审核”主按钮（若 UI 文案变动再退回 fuzzy 匹配）
    const approveBtnPrimary = pubReviewPage.getByRole('button', { name: '提交审核' })
    const approveBtnFallback = pubReviewPage.getByRole('button', { name: /提交审核|审核通过|通过/ })
    const approveBtn = (await approveBtnPrimary.isVisible().catch(() => false)) ? approveBtnPrimary : approveBtnFallback.first()
    await expect(approveBtn).toBeVisible({ timeout: 60_000 })

    const approvePopupPromise = pubReviewPage.waitForEvent('popup', { timeout: 30_000 })
    await approveBtn.click({ force: true })
    const approvePopup = await approvePopupPromise

    await waitForReturnCallback(approvePopup, '/wallet/semi-approve-callback', 1_200_000)
    await expect(approvePopup.getByRole('heading', { name: 'Semi 审核结果' })).toBeVisible({ timeout: 60_000 })
    await expect(approvePopup.getByText('审核已提交（success）')).toBeVisible({ timeout: 240_000 })
    await expect(approvePopup.getByText('已同步审核结果到服务端。')).toBeVisible({ timeout: 240_000 })

    // ================
    // Step6：publisher 终审（finalApprovePool，Semi）→ 回跳确权
    // Step7 distribute：OP 主网 24h 公示期较长，默认不在 E2E 里强行执行（避免你等/花 gas 触发 revert）
    // ================
    await pubPage.goto(`${baseURL}/tasks/pool/${encodeURIComponent(taskInfoId)}/manage`, { waitUntil: 'domcontentloaded' })
    await expect(pubPage.getByRole('heading', { name: '任务池管理' })).toBeVisible({ timeout: 60_000 })

    const finalApproveBtn = pubPage.getByRole('button', { name: /终审（finalApprovePool）/ })
    await expect(finalApproveBtn).toBeVisible({ timeout: 60_000 })
    const finalPopupPromise = pubPage.waitForEvent('popup', { timeout: 30_000 })
    await finalApproveBtn.click({ force: true })
    const finalPopup = await finalPopupPromise

    await waitForReturnCallback(finalPopup, '/wallet/semi-final-approve-callback', 1_200_000)
    await expect(finalPopup.getByRole('heading', { name: 'Semi 终审结果' })).toBeVisible({ timeout: 60_000 })
    await expect(finalPopup.getByText('终审已提交（success）')).toBeVisible({ timeout: 240_000 })
    await expect(finalPopup.getByText('已同步终审结果到服务端。')).toBeVisible({ timeout: 240_000 })

    if (process.env.E2E_ALLOW_DISTRIBUTE === 'true') {
      const distributeBtn = pubPage.getByRole('button', { name: /结算（distribute）/ })
      await expect(distributeBtn).toBeVisible({ timeout: 60_000 })
      const distPopupPromise = pubPage.waitForEvent('popup', { timeout: 30_000 })
      await distributeBtn.click({ force: true })
      const distPopup = await distPopupPromise
      await waitForReturnCallback(distPopup, '/wallet/semi-distribute-callback', 1_200_000)
      await expect(distPopup.getByRole('heading', { name: 'Semi 结算结果' })).toBeVisible({ timeout: 60_000 })
    } else {
      console.log('[info] distribute 默认跳过（设置 E2E_ALLOW_DISTRIBUTE=true 才会尝试执行）')
    }

    await pub.context.close()
    await cand.context.close()
    await pubReview.context.close()
  } finally {
    await browser.close()
  }
})

