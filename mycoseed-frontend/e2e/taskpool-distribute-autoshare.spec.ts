import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { encodeFunctionResult } from 'viem'
import { taskPoolAbi } from '../utils/taskpool/abi'
import { uuidToTaskPoolUint256 } from '../utils/taskpool/ids'

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

test.describe('TaskPool：结算成功后自动回跳详情并弹分享（claimer, E2E mock）', () => {
  test('distribute callback success + serverOk => redirect to /tasks/:id?share=claimer and open share modal', async ({
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

    const taskInfoId = randomUUID()
    const taskId = randomUUID()
    const claimerId = randomUUID()
    const state = 'e2e_state_distribute'
    const txHash = `0x${'c'.repeat(64)}`

    const poolIdBn = uuidToTaskPoolUint256(taskInfoId)

    // 1) 先写入 sessionStorage state 与登录态（同源）
    await page.goto(effectiveBaseURL, { waitUntil: 'domcontentloaded' })
    await page.evaluate(
      ([tok, k, v, taskInfoIdLocal, stateLocal]) => {
        document.cookie = `auth_token=${encodeURIComponent(tok)};path=/;SameSite=Lax`
        localStorage.setItem('auth_token', tok)
        localStorage.setItem(k, v)
        sessionStorage.setItem(`semi_taskpool_state_v1_distribute_${taskInfoIdLocal}`, stateLocal)
      },
      ['e2e-token', COMMUNITY_STORAGE_KEY, DEFAULT_COMMUNITY_UUID, taskInfoId, state]
    )

    // 2) mock 后端：/api/auth/me、/api/task-info/...distribute-complete、/api/tasks/:id
    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify({ id: claimerId, name: 'e2e-claimer' }),
      })
    })

    await page.route('**/api/task-info/*/taskpool/distribute-complete', async (route) => {
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
          title: 'E2E TaskPool Distribute AutoShare',
          description: 'mock',
          reward: 1,
          status: 'completed',
          creatorId: randomUUID(),
          creatorName: 'e2e',
          claimerId,
          claimerName: 'e2e-claimer',
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

    // 3) mock RPC：pools(poolId) 返回 settled=true，保证详情页可直接弹分享
    const remarkProxyAddr = '0x3333333333333333333333333333333333333333' as const
    const remarkProxyResult = encodeFunctionResult({
      abi: [
        { type: 'function', name: 'remarkProxy', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
      ],
      functionName: 'remarkProxy',
      result: remarkProxyAddr,
    })

    const poolsSettledResult = encodeFunctionResult({
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
        true, // settled = true
        [poolIdBn], // dummy taskIds
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

      if (body.method === 'eth_getLogs') {
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
            body: JSON.stringify({ jsonrpc: '2.0', id: idField, result: poolsSettledResult }),
          })
        }
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ jsonrpc: '2.0', id: idField, result: '0x' }),
        })
      }
      return route.continue()
    })

    // 4) 打开 distribute callback 页：应自动跳转到详情并弹分享
    const callbackUrl = `${effectiveBaseURL}/wallet/semi-distribute-callback?taskInfoId=${encodeURIComponent(
      taskInfoId
    )}&taskId=${encodeURIComponent(taskId)}&status=success&state=${encodeURIComponent(state)}&tx_hash=${encodeURIComponent(
      txHash
    )}`

    await page.goto(callbackUrl, { waitUntil: 'domcontentloaded' })

    await expect(page).toHaveURL(new RegExp(`/tasks/${taskId}.*share=claimer`), { timeout: 60_000 })
    await expect(page.getByRole('heading', { name: '分享到社区圈' })).toBeVisible({ timeout: 25_000 })
  })
})

