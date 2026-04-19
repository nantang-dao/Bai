import { defineConfig, devices } from '@playwright/test'
import fs from 'node:fs'

/**
 * E2E：默认假设前端 dev 在 package.json 的端口 3003。
 * 用法见 e2e/README.md
 */
const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3003'
const defaultStatePath = process.env.PLAYWRIGHT_STORAGE_STATE || 'e2e/.auth/state.json'
const hasState = fs.existsSync(defaultStatePath)

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL,
    // 有 state 就复用；没有则让测试继续跑（例如 smoke）
    storageState: hasState ? defaultStatePath : undefined,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: baseURL,
    // 本地经常已经手动跑了 dev（并且端口固定 3003），这里强制复用避免抢端口
    reuseExistingServer: true,
    // 冷启动首次编译常 >2min（磁盘慢、大项目）；过短会误报 Timed out waiting ... webServer
    timeout: process.env.CI ? 180_000 : 300_000,
  },
})
