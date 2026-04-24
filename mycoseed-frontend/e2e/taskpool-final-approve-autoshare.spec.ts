import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { encodeFunctionResult } from 'viem'
import { taskPoolAbi } from '../utils/taskpool/abi'

const COMMUNITY_STORAGE_KEY = 'mycoseed_current_community_id'
const DEFAULT_COMMUNITY_UUID = '00000000-0000-0000-0000-000000000002'

const POOLS_SELECTOR = 'ac4afa38'
const REMARK_PROXY_SELECTOR = '317c7e2b'

function readEnvFromDotEnv(name: string): string {
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), '.env'), 'utf8')
    for (const line of raw.split('\n')) {
      const t = line.trim()
      if (!t || t.startsWith('#')) continue
      const idx = t.indexOf('=')
      if (idx === -1) continue
      const k = t.slice(0, idx).trim()
      if (k !== name) continue
      let v = t.slice(idx + 1).trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
      return v
    }
  } catch {
    /* ignore */
  }
  return ''
}

function readEnv(name: string): string {
  const v = typeof process.env[name] === 'string' ? String(process.env[name]).trim() : ''
  return v || readEnvFromDotEnv(name)
}

test.describe('TaskPool：终审成功后自动回跳详情并弹分享（E2E mock）', () => {
  test('callback success + serverOk => redirect to /tasks/:id?reviewed=true and open share modal', async ({
    page,
    baseURL,
  }) => {
    test.setTimeout(120_000)

    const rpcUrl = readEnv('NUXT_PUBLIC_OP_RPC_URL')
    const taskpoolProxy = readEnv('NUXT_PUBLIC_TASKPOOL_PROXY_ADDRESS').toLowerCase()
    if (!rpcUrl || !taskpoolProxy) {
      test.skip(true, '缺少 .env 中的 NUXT_PUBLIC_OP_RPC_URL 或 NUXT_PUBLIC_TASKPOOL_PROXY_ADDRESS')
    }
    const rpcHost = new URL(rpcUrl).hostname

    const effectiveBaseURL = baseURL || process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3003'

    const userId = randomUUID()
    const taskInfoId = randomUUID()
    const taskId = randomUUID()
    const state = 'e2e_state_final_approve'
    const txHash = `0x${'b'.repeat(64)}`

    // 1) 先写入 sessionStorage state 与登录态（同源）
    await page.goto(effectiveBaseURL, { waitUntil: 'domcontentloaded' })
    await page.evaluate(
      ([uid, tok, k, v, taskInfoIdLocal, stateLocal]) => {
        document.cookie = `auth_token=${encodeURIComponent(tok)};path=/;SameSite=Lax`
        localStorage.setItem('auth_token', tok)
        localStorage.setItem(k, v)
        // 对齐 semiTaskpoolStateStorageKey('final_approve', taskInfoId) 的 key 生成规则
        sessionStorage.setItem(`semi_taskpool_state_v1_final_approve_${taskInfoIdLocal}`, stateLocal)
        ;(window as any).__E2E_UID__ = uid
      },
      [userId, 'e2e-token', COMMUNITY_STORAGE_KEY, DEFAULT_COMMUNITY_UUID, taskInfoId, state]
    )

    // 2) mock 后端：/api/auth/me、/api/task-info/...complete、/api/tasks/:id
    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        // 前端 `getMe()` 直接 `return response.json()`，期望是 user 对象本体
        body: JSON.stringify({ id: userId, name: 'e2e' }),
      })
    })

    // 兼容预检 OPTIONS：对该 endpoint 统一放行（mock 环境下不走真实后端）
    await page.route('**/api/task-info/*/taskpool/final-approve-complete', async (route) => {
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({
          status: 204,
          headers: {
            'access-control-allow-origin': '*',
            'access-control-allow-methods': 'POST, OPTIONS',
            'access-control-allow-headers': 'content-type, authorization',
          },
          body: '',
        })
        return
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify({ ok: true }),
      })
    })

    await page.route(`**/api/tasks/${taskId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify({
          id: taskId,
          title: 'E2E TaskPool AutoShare',
          description: 'mock',
          reward: 1,
          status: 'completed',
          creatorId: userId,
          creatorName: 'e2e',
          claimerId: randomUUID(),
          taskInfoId,
          useTaskpool: true,
          listingKind: 'taskpool_pool',
          communityId: DEFAULT_COMMUNITY_UUID,
          createdAt: new Date().toISOString(),
          timeline: [],
          remarkTaskRowId: randomUUID(),
        }),
      })
    })

    // 3) mock RPC：eth_getLogs 返回 PoolFinalApproved，以触发详情页 reviewer 自动弹分享 gate
    const remarkProxyAddr = '0x3333333333333333333333333333333333333333' as const
    const remarkProxyResult = encodeFunctionResult({
      abi: [
        {
          type: 'function',
          name: 'remarkProxy',
          stateMutability: 'view',
          inputs: [],
          outputs: [{ type: 'address' }],
        },
      ],
      functionName: 'remarkProxy',
      result: remarkProxyAddr,
    })
    const poolsResult = encodeFunctionResult({
      abi: taskPoolAbi,
      functionName: 'pools',
      result: [
        `0x${'1'.repeat(40)}` as `0x${string}`,
        `0x${'2'.repeat(40)}` as `0x${string}`,
        0n,
        0n,
        0n,
        0n,
        0n,
        false,
        false,
        [],
        true,
        0n,
        false,
      ],
    })

    await page.route((url: URL) => url.hostname === rpcHost, async (route) => {
      const req = route.request()
      if (req.method() !== 'POST') return route.continue()
      let body: any
      try {
        body = req.postDataJSON()
      } catch {
        return route.continue()
      }
      const idField = body?.id ?? 0

      if (body.method === 'eth_blockNumber') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ jsonrpc: '2.0', id: idField, result: '0x1' }),
        })
      }
      if (body.method === 'eth_getLogs') {
        // 不返回 PoolFinalApproved：依赖 pool_final_tx 注入，仍能弹分享
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ jsonrpc: '2.0', id: idField, result: [] }),
        })
      }
      if (body.method === 'eth_getCode') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ jsonrpc: '2.0', id: idField, result: '0x60006000' }),
        })
      }
      if (body.method === 'eth_call') {
        const to = String(body?.params?.[0]?.to || '').toLowerCase()
        const data = String(body?.params?.[0]?.data || '').toLowerCase()
        if (to === taskpoolProxy && data.startsWith('0x' + REMARK_PROXY_SELECTOR)) {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ jsonrpc: '2.0', id: idField, result: remarkProxyResult }),
          })
        }
        if (to === taskpoolProxy && data.startsWith('0x' + POOLS_SELECTOR)) {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ jsonrpc: '2.0', id: idField, result: poolsResult }),
          })
        }
        // default: empty
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ jsonrpc: '2.0', id: idField, result: '0x' }),
        })
      }
      return route.continue()
    })

    // 4) 打开 callback 页：应自动跳转到详情并弹分享
    const callbackUrl = `${effectiveBaseURL}/wallet/semi-final-approve-callback?taskInfoId=${encodeURIComponent(
      taskInfoId
    )}&taskId=${encodeURIComponent(taskId)}&status=success&state=${encodeURIComponent(state)}&tx_hash=${encodeURIComponent(
      txHash
    )}`

    await page.goto(callbackUrl, { waitUntil: 'domcontentloaded' })

    // 回跳页会 replace 到详情（query 随后被清空），只断言已进入详情页
    await expect(page).toHaveURL(new RegExp(`/tasks/${taskId}(\\?|$)`), { timeout: 60_000 })
    await expect(page.getByRole('heading', { name: '分享到社区圈' })).toBeVisible({ timeout: 25_000 })
  })
})

