# Playwright E2E（mycoseed-frontend）

## 一次性环境

```bash
cd mycoseed-frontend
npm install
npx playwright install chromium
```

## 运行测试

- **自动拉起 dev**：`npm run test:e2e`（`playwright.config.ts` 里配置了 `webServer: npm run dev`）。
- **已有 dev 在跑**：`PLAYWRIGHT_BASE_URL=http://127.0.0.1:3003 npx playwright test`（避免重复起服务时，可临时注释 config 里的 `webServer`）。
- **可视化调试**：`npm run test:e2e:ui`

## 临时登录（最省事）

如果你今天只想“跑通自动化流程”而不想折腾 OAuth/持久化登录态，可以在本机终端用环境变量注入：

```bash
AUTH_TOKEN=你的token npm run test:e2e
```

它会在测试启动前把 `auth_token` 写入 `localStorage` 并导出到 `e2e/.auth/state.json`（该目录已被 `.gitignore` 忽略）。

## 半自动 E2E（Semi / 钱包由你点）

部分任务池用例支持在自动化跑完后 **暂停**，由你在浏览器里完成 **Semi App / 钱包** 操作，再在 Playwright Inspector 里 **Resume**。

```bash
E2E_MANUAL_PAUSE=1 AUTH_TOKEN_PUBLISHER=你的token npx playwright test e2e/taskpool-pool-list-semi-cta.spec.ts
```

- 设置 `E2E_MANUAL_PAUSE=1` 时，Chromium 会 **强制有头**（无需再设 `PW_HEADLESS=0`）。
- 未设置时行为与原来一致，**不会暂停**，适合 CI。

涉及文件：`e2e/helpers/manualPause.ts`，当前接入 `taskpool-pool-list-semi-cta.spec.ts`、`taskpool-semi-prepay-history.spec.ts`。

## 双账号（Publisher / Manager）

阶段 3 的权限切换需要两套 token（只在你本机终端设置，不要提交/不要粘贴到聊天）：

```bash
AUTH_TOKEN_PUBLISHER=xxx AUTH_TOKEN_MANAGER=yyy npx playwright test e2e/taskpool-claim-manager.spec.ts --timeout=240000
```

## 分享到社区圈弹窗（诊断用）

用于确认「从审核页回跳 `?reviewed=true&share=reviewer`」时是否出现「分享到社区圈」标题。需要：

- `AUTH_TOKEN`：与任务发布者（审核者）一致
- `SHARE_MODAL_TEST_TASK_ID`：一条**已完成且已标记转账**的任务行 UUID

```bash
AUTH_TOKEN=xxx SHARE_MODAL_TEST_TASK_ID=任务UUID npx playwright test e2e/share-to-community-modal.spec.ts
```

报告里会附带当前 URL 与控制台 error 摘要，便于对照前端/接口问题。

## 写新用例

在 `e2e/` 下新增 `*.spec.ts`，使用 `page.goto('/tasks')` 等与站点路径一致的 URL。登录态可用 `storageState` 或 `test.step` 里调用你的登录 API（见官方文档 *Authentication*）。

更多说明见项目外层的答复或 [Playwright 文档](https://playwright.dev/docs/intro)。
