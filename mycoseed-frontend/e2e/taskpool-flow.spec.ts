import { test, expect } from '@playwright/test'

const COMMUNITY_STORAGE_KEY = 'mycoseed_current_community_id'
// 默认社区 UUID（与 utils/api.ts 一致）
const DEFAULT_COMMUNITY_UUID = '00000000-0000-0000-0000-000000000002'

async function fillByLabel(page: any, labelText: string, value: string) {
  // 该页面 label 没有 for/id 绑定，使用 “label -> 父容器 -> input/textarea” 更稳
  const container = page.locator('label', { hasText: labelText }).locator('..')
  const input = container.locator('input,textarea').first()
  await expect(input).toBeVisible()
  await input.fill(value)
}

function dtLocalPlusMinutes(mins: number) {
  const d = new Date(Date.now() + mins * 60_000)
  const pad = (n: number) => String(n).padStart(2, '0')
  // datetime-local: YYYY-MM-DDTHH:mm
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

test('任务池：创建 → 跳转管理页', async ({ page }) => {
  test.setTimeout(120_000)

  // 任务池创建依赖“已选择社区”，否则会被前端拦截不提交
  await page.addInitScript(([k, v]) => {
    localStorage.setItem(k, v)
  }, [COMMUNITY_STORAGE_KEY, DEFAULT_COMMUNITY_UUID])

  // 进入商城任务列表
  await page.goto('/tasks', { waitUntil: 'domcontentloaded' })

  // 进入任务池列表，再进入发布页
  await page.getByRole('button', { name: '任务池' }).click()
  await expect(page.getByRole('heading', { name: /^任务池$/ })).toBeVisible()
  await page.getByRole('button', { name: '发布任务' }).click()
  await expect(page.getByRole('heading', { name: '发布任务池' })).toBeVisible()
  await expect(page.getByText('请先通过社区广场或左上角选择社区，再发布任务池。')).toHaveCount(0)

  // 填表（最小必填）
  const title = `E2E 任务池 ${Date.now()}`
  await page.getByPlaceholder('主任务 / 任务池名称').fill(title)
  await page.getByPlaceholder('描述整体目标与规则…').fill('E2E 自动化创建任务池，用于验证创建→管理页链路。')

  // 参与人数/积分
  await fillByLabel(page, '参与人数 *', '1')
  await fillByLabel(page, '每人积分 *', '1')

  // 时间：领取截止、提交截止必填（创建页会校验顺序）
  await fillByLabel(page, '领取截止时间 *', dtLocalPlusMinutes(60))
  await fillByLabel(page, '提交截止时间 *', dtLocalPlusMinutes(120))

  // 提交
  await page.getByRole('button', { name: '创建并去管理页' }).click()

  // 断言：进入 manage 页
  await expect(page).toHaveURL(/\/tasks\/pool\/[0-9a-f-]{36}\/manage/i, { timeout: 60_000 })
  await expect(page.getByRole('heading', { name: '任务池管理' })).toBeVisible()

  // 页面上应展示 taskInfoId（验证拿到路由参数）
  await expect(page.getByText(/taskInfoId:/)).toBeVisible()
})

