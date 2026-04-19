import { chromium, type FullConfig } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

/**
 * 可选：用环境变量 AUTH_TOKEN 生成/刷新 storageState。
 *
 * 用法（只在你本机终端里设置，不要提交/不要发出来）：
 *   AUTH_TOKEN=xxxx npm run test:e2e
 *
 * 生成：
 *   e2e/.auth/state.json
 */
export default async function globalSetup(config: FullConfig) {
  const authToken = process.env.AUTH_TOKEN
  if (!authToken) return

  const baseURL = config.projects[0]?.use?.baseURL as string | undefined
  if (!baseURL) return

  const statePath =
    (process.env.PLAYWRIGHT_STORAGE_STATE as string | undefined) || 'e2e/.auth/state.json'

  fs.mkdirSync(path.dirname(statePath), { recursive: true })

  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()

  // 先打开一次站点，确保同源 localStorage 可写
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' })

  // 你们的 API 鉴权读取 cookie（getCookie(AUTH_TOKEN_KEY)），
  // 同时登录回调也会写 localStorage，二者都写更稳。
  await page.evaluate((token) => {
    document.cookie = `auth_token=${encodeURIComponent(token)};path=/;SameSite=Lax`
    localStorage.setItem('auth_token', token)
  }, authToken)

  // 写出 storageState，后续用例将自动复用
  await context.storageState({ path: statePath })

  await browser.close()
}

