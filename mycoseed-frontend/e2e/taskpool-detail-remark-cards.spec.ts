import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { encodeFunctionResult, keccak256, toBytes } from 'viem'
import { taskPoolAbi } from '../utils/taskpool/abi'
import { uuidToTaskPoolUint256 } from '../utils/taskpool/ids'

const POOLS_SELECTOR = 'ac4afa38'
const REMARK_PROXY_SELECTOR = '317c7e2b'
const GET_REMARKS_SELECTOR = '8b617b28'

const PUBLISHER_TEXT = 'e2e:链上发包者备注'
const ASSIGNEE_TEXT = 'e2e:链上接包者备注'
const FINAL_TOPIC0 = keccak256(toBytes('PoolFinalApproved(uint256,uint64,uint64)')).toLowerCase()

/** 进程环境优先（CI/脚本注入），其次读项目根 `.env`（本地开发） */
function readEnv(name: string): string {
  const fromProc = typeof process.env[name] === 'string' ? String(process.env[name]).trim() : ''
  if (fromProc) return fromProc
  return readEnvFromDotEnv(name)
}

/** 与本项目 `.env` 一致的简单读取（不向仓库提交密钥） */
function readEnvFromDotEnv(name: string): string {
  try {
    // Playwright 测试在 ESM 下运行，`__dirname` 可能不可用；用项目 cwd 更稳。
    const raw = fs.readFileSync(path.join(process.cwd(), '.env'), 'utf8')
    for (const line of raw.split('\n')) {
      const t = line.trim()
      if (!t || t.startsWith('#')) continue
      const idx = t.indexOf('=')
      if (idx === -1) continue
      const k = t.slice(0, idx).trim()
      if (k !== name) continue
      let v = t.slice(idx + 1).trim()
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1)
      }
      return v
    }
  } catch {
    /* ignore */
  }
  return ''
}

function parseEthCall(reqBody: unknown): {
  to?: string
  data?: string
} | null {
  const b = reqBody as { method?: string; params?: unknown[] } | null
  if (!b || b.method !== 'eth_call' || !Array.isArray(b.params) || !b.params[0])
    return null
  const p = b.params[0] as { to?: string; data?: string }
  return { to: p.to?.toLowerCase(), data: p.data }
}

function parseUint256PairFromGetRemarksCalldata(data: string): {
  poolId: bigint
  taskId: bigint
} | null {
  const d = String(data || '').toLowerCase()
  if (!d.startsWith('0x')) return null
  const hex = d.slice(2)
  if (hex.slice(0, 8) !== GET_REMARKS_SELECTOR) return null
  if (hex.length < 8 + 128) return null
  const poolHex = hex.slice(8, 8 + 64)
  const taskHex = hex.slice(8 + 64, 8 + 128)
  return { poolId: BigInt('0x' + poolHex), taskId: BigInt('0x' + taskHex) }
}

test.describe('TaskPool 任务详情：链上备注卡片（RPC mock）', () => {
  test('应分别展示发包者与接包者备注（含 remarkTaskRowId 与 task_info 不一致时）', async ({
    page,
  }) => {
    test.setTimeout(120_000)

    const rpcUrl = readEnv('NUXT_PUBLIC_OP_RPC_URL')
    const taskpoolProxy = readEnv('NUXT_PUBLIC_TASKPOOL_PROXY_ADDRESS').toLowerCase()
    if (!rpcUrl || !taskpoolProxy) {
      test.skip(true, '缺少 .env 中的 NUXT_PUBLIC_OP_RPC_URL 或 NUXT_PUBLIC_TASKPOOL_PROXY_ADDRESS')
    }

    const rpcHost = new URL(rpcUrl).hostname
    const remarkProxyAddr = '0x3333333333333333333333333333333333333333' as const

    const taskInfoId = randomUUID()
    const remarkRowId = randomUUID()
    /** 商城「池列表」行 id：与链上 remark 用的 task 行 id 刻意不同，覆盖后端 remarkTaskRowId */
    const listingRowId = randomUUID()

    const poolIdBn = uuidToTaskPoolUint256(taskInfoId)
    const remarkChainBn = uuidToTaskPoolUint256(remarkRowId)

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
        true,
        [remarkChainBn],
        true,
        0n,
        false,
      ],
    })

    const getRemarksAbi = [
      {
        type: 'function',
        name: 'getRemarks',
        stateMutability: 'view',
        inputs: [
          { name: 'poolId', type: 'uint256' },
          { name: 'taskId', type: 'uint256' },
        ],
        outputs: [
          { name: 'senderRemark', type: 'string' },
          { name: 'receiverRemark', type: 'string' },
          { name: 'timestamp', type: 'uint256' },
        ],
      },
    ] as const

    await page.route((url: URL) => url.hostname === rpcHost, async (route) => {
      const req = route.request()
      if (req.method() !== 'POST') return route.continue()
      let body: unknown
      try {
        body = req.postDataJSON()
      } catch {
        return route.continue()
      }
      const b = body as { id?: number | string; method?: string; params?: unknown[] }
      const idField = b.id ?? 0

      if (b.method === 'eth_blockNumber') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ jsonrpc: '2.0', id: idField, result: '0x3b9aca00' }),
        })
      }
      if (b.method === 'eth_getTransactionReceipt') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ jsonrpc: '2.0', id: idField, result: null }),
        })
      }
      if (b.method === 'eth_getLogs') {
        // 给详情页提供一个“已终审”事件，触发备注读取 gate
        try {
          const params0 = (b.params?.[0] ?? {}) as any
          const topics = Array.isArray(params0?.topics) ? (params0.topics as string[]) : []
          const t0 = String(topics[0] || '').toLowerCase()
          if (t0 === FINAL_TOPIC0) {
            return route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({
                jsonrpc: '2.0',
                id: idField,
                result: [
                  {
                    transactionHash: `0x${'a'.repeat(64)}`,
                    blockNumber: '0x1',
                    logIndex: '0x0',
                  },
                ],
              }),
            })
          }
        } catch {
          /* ignore */
        }
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ jsonrpc: '2.0', id: idField, result: [] }),
        })
      }
      if (b.method === 'eth_getCode') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: idField,
            result: '0x60006000',
          }),
        })
      }

      if (b.method === 'eth_call') {
        const parsed = parseEthCall(body)
        const data = (parsed?.data || '').toLowerCase()
        const to = (parsed?.to || '').toLowerCase()

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

        if (to === remarkProxyAddr.toLowerCase() && data.startsWith('0x' + GET_REMARKS_SELECTOR)) {
          const pair = parseUint256PairFromGetRemarksCalldata(data)
          if (!pair || pair.poolId !== poolIdBn) {
            return route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({
                jsonrpc: '2.0',
                id: idField,
                result: encodeFunctionResult({
                  abi: getRemarksAbi,
                  functionName: 'getRemarks',
                  result: ['', '', 0n],
                }),
              }),
            })
          }
          if (pair.taskId === 0n) {
            const r = encodeFunctionResult({
              abi: getRemarksAbi,
              functionName: 'getRemarks',
              result: ['', PUBLISHER_TEXT, 1700000000n],
            })
            return route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({ jsonrpc: '2.0', id: idField, result: r }),
            })
          }
          if (pair.taskId === remarkChainBn) {
            const r = encodeFunctionResult({
              abi: getRemarksAbi,
              functionName: 'getRemarks',
              result: [ASSIGNEE_TEXT, '', 1700000000n],
            })
            return route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({ jsonrpc: '2.0', id: idField, result: r }),
            })
          }
          const empty = encodeFunctionResult({
            abi: getRemarksAbi,
            functionName: 'getRemarks',
            result: ['', '', 0n],
          })
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ jsonrpc: '2.0', id: idField, result: empty }),
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

    const mockTask = {
      id: listingRowId,
      title: 'E2E TaskPool 备注卡片',
      description: 'mock',
      reward: 1,
      status: 'completed',
      deadline: new Date().toISOString(),
      creatorName: 'e2e',
      creatorId: randomUUID(),
      claimerId: randomUUID(),
      taskInfoId,
      useTaskpool: true,
      listingKind: 'taskpool_pool',
      remarkTaskRowId: remarkRowId,
      taskpoolCreateTxHash: null,
      taskpoolPhase: 'pool_created',
      communityId: '00000000-0000-0000-0000-000000000002',
      createdAt: new Date().toISOString(),
      timeline: [],
    }

    await page.route(`http://127.0.0.1:3001/api/tasks/${listingRowId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockTask),
      })
    })
    await page.route(`http://localhost:3001/api/tasks/${listingRowId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockTask),
      })
    })

    await page.goto(`/tasks/${listingRowId}`, { waitUntil: 'domcontentloaded' })

    await expect(page.getByTestId('taskpool-onchain-remark-publisher')).toContainText(PUBLISHER_TEXT, {
      timeout: 90_000,
    })
    await expect(page.getByTestId('taskpool-onchain-remark-assignee')).toContainText(ASSIGNEE_TEXT, {
      timeout: 90_000,
    })
  })
})
