import { test, expect } from '@playwright/test'

test.describe('smoke', () => {
  test('首页可访问', async ({ page }) => {
    const res = await page.goto('/', { waitUntil: 'domcontentloaded' })
    expect(res?.ok() ?? false).toBeTruthy()
  })
})
