import type { Page } from '@playwright/test'

/** 半自动模式：`E2E_MANUAL_PAUSE=1` 时在关键步骤 `page.pause()`，便于手动完成 Semi / 钱包 */
export function isManualPauseEnabled(): boolean {
  const v = process.env.E2E_MANUAL_PAUSE
  return v === '1' || v === 'true' || v === 'yes'
}

/**
 * 仅在 `E2E_MANUAL_PAUSE=1` 时暂停。
 * 会打开 Playwright Inspector：你在浏览器里点「用 Semi 预付」、在 Semi 里确认后，在 Inspector 里点 **Resume** 继续（或结束）。
 * 建议：`PW_HEADLESS=0` 以便看到浏览器窗口。
 */
export async function maybePauseForSemiManual(page: Page, hint: string): Promise<void> {
  if (!isManualPauseEnabled()) return
  // eslint-disable-next-line no-console
  console.log(
    `\n[E2E_MANUAL_PAUSE] ${hint}\n→ 手动完成后在 Playwright Inspector 点击 Resume\n`
  )
  await page.pause()
}

/** 与半自动搭配：有头浏览器 */
export function e2eChromiumHeadless(): boolean {
  if (isManualPauseEnabled()) return false
  return process.env.PW_HEADLESS !== '0'
}
