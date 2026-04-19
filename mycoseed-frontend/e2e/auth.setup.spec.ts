import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

/**
 * 运行一次：手动完成 Semi OAuth 登录，然后保存 storageState。
 *
 * 生成：
 * - e2e/.auth/state.json
 */
test('save auth state', async ({ page }) => {
  await page.goto('/tasks', { waitUntil: 'domcontentloaded' })

  // 登录成功后，任务列表页通常会出现“创建任务”按钮（仅登录可见）
  await expect(page.getByRole('button', { name: '创建任务' })).toBeVisible({ timeout: 120_000 })

  const outDir = path.resolve('e2e/.auth')
  fs.mkdirSync(outDir, { recursive: true })
  await page.context().storageState({ path: path.join(outDir, 'state.json') })
})

