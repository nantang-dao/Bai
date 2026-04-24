import type { Address, Hex } from 'viem'
import { decodeFunctionResult, keccak256, toBytes, toHex } from 'viem'
import { optimism } from 'viem/chains'
import { useRuntimeConfig } from 'nuxt/app'
import { uuidToTaskPoolUint256 } from '~/utils/taskpool'

export type TaskpoolPoolRow = {
  publisher: Address
  manager: Address
  lockedBalance: bigint
  allocated: bigint
  claimDeadline: bigint
  publicizeEligibleAt: bigint
  publicizeEndsAt: bigint
  paused: boolean
  settled: boolean
  taskIds: readonly bigint[]
  exists: boolean
  credentialDeadline: bigint
  poolRejected: boolean
}

export type TaskpoolPoolEventRef = {
  txHash: Hex
  blockNumber: bigint
  logIndex?: bigint
}

export type TaskpoolRemarkRow = {
  senderRemark: string
  receiverRemark: string
  timestamp: bigint
}

export type TaskpoolSplitRemarks = {
  /** 接包者凭证备注（TaskPool 终审批量写入：saveRemark(poolId, taskRowId, assigneeRemark, "")） */
  assigneeRemark: string
  /** 发包者整池总评（TaskPool 终审批量写入：saveRemark(poolId, 0, "", publisherRemark)） */
  publisherRemark: string
  assigneeTimestamp: bigint
  publisherTimestamp: bigint
}

function hexToBigIntSafe(hexNo0x: string): bigint {
  if (!hexNo0x) return 0n
  return BigInt(`0x${hexNo0x}`)
}

function tryDecodeRevert(result: Hex): string | null {
  const hex = String(result || '')
  if (!hex.startsWith('0x')) return null
  const body = hex.slice(2)
  if (body.startsWith('00000000')) return null
  // Error(string) selector: 0x08c379a0
  if (body.startsWith('08c379a0') && body.length >= 8 + 64 * 2) {
    try {
      // layout: selector(4) + offset(32) + len(32) + data(len)
      const lenHex = body.slice(8 + 64, 8 + 64 * 2)
      const len = Number(hexToBigIntSafe(lenHex))
      const dataStart = 8 + 64 * 2
      const dataHex = body.slice(dataStart, dataStart + len * 2)
      const bytes = new Uint8Array(
        dataHex.match(/.{1,2}/g)?.map((b) => parseInt(b, 16)) ?? []
      )
      const msg = new TextDecoder().decode(bytes)
      return msg || 'Error(string)'
    } catch {
      return 'Error(string)'
    }
  }
  // Panic(uint256) selector: 0x4e487b71
  if (body.startsWith('4e487b71') && body.length >= 8 + 64) {
    const code = body.slice(8, 8 + 64)
    return `Panic(0x${code.replace(/^0+/, '') || '0'})`
  }
  // Custom error / unknown: expose first 4 bytes selector
  if (body.length >= 8) return `CustomError(0x${body.slice(0, 8)})`
  return null
}

function slot(hexNo0x: string, idx: number): string {
  return hexNo0x.slice(idx * 64, (idx + 1) * 64)
}

function slotAddress(hexNo0x: string, idx: number): Address {
  const s = slot(hexNo0x, idx)
  return (`0x${s.slice(24)}`) as Address
}

function slotBool(hexNo0x: string, idx: number): boolean {
  return hexToBigIntSafe(slot(hexNo0x, idx)) !== 0n
}

function decodePoolsResult(result: Hex): TaskpoolPoolRow {
  const hex = String(result || '')
  if (!hex.startsWith('0x')) throw new Error('invalid eth_call result')
  const body = hex.slice(2)
  if (body.length === 0) throw new Error('eth_call returned empty result (0x)')
  // Two layouts exist onchain:
  // - V3/V2 getter: includes dynamic taskIds => head has 13 slots (taskIds offset at index 9)
  // - Legacy getter: taskIds not in getter => total 12 slots, with exists at index 9
  if (body.length < 64 * 12) {
    const reason = tryDecodeRevert(result)
    if (reason) throw new Error(`eth_call reverted: ${reason}`)
    throw new Error('eth_call result too short')
  }

  const publisher = slotAddress(body, 0)
  const manager = slotAddress(body, 1)
  const lockedBalance = hexToBigIntSafe(slot(body, 2))
  const allocated = hexToBigIntSafe(slot(body, 3))
  const claimDeadline = hexToBigIntSafe(slot(body, 4))
  const publicizeEligibleAt = hexToBigIntSafe(slot(body, 5))
  const publicizeEndsAt = hexToBigIntSafe(slot(body, 6))
  const paused = slotBool(body, 7)
  const settled = slotBool(body, 8)

  let taskIds: bigint[] = []
  let exists = false
  let credentialDeadline = 0n
  let poolRejected = false

  if (body.length >= 64 * 13) {
    // New layout with dynamic taskIds offset at slot 9.
    const taskIdsOffset = Number(hexToBigIntSafe(slot(body, 9)))
    exists = slotBool(body, 10)
    credentialDeadline = hexToBigIntSafe(slot(body, 11))
    poolRejected = slotBool(body, 12)

    if (taskIdsOffset >= 0 && body.length >= (taskIdsOffset + 32) * 2) {
      const off = taskIdsOffset * 2
      const len = Number(hexToBigIntSafe(body.slice(off, off + 64)))
      const start = off + 64
      const out: bigint[] = []
      for (let i = 0; i < len; i++) {
        const w = body.slice(start + i * 64, start + (i + 1) * 64)
        if (w.length === 64) out.push(hexToBigIntSafe(w))
      }
      taskIds = out
    }
  } else {
    // Legacy layout without taskIds in getter: exists at slot 9.
    exists = slotBool(body, 9)
    credentialDeadline = hexToBigIntSafe(slot(body, 10))
    poolRejected = slotBool(body, 11)
  }

  return {
    publisher,
    manager,
    lockedBalance,
    allocated,
    claimDeadline,
    publicizeEligibleAt,
    publicizeEndsAt,
    paused,
    settled,
    taskIds,
    exists,
    credentialDeadline,
    poolRejected,
  }
}

/**
 * 只读：从 TaskPool Proxy 读取 pools(poolId)。用于任务详情页展示公示期与是否可结算。
 */
export function useTaskpoolPoolOnchain() {
  const config = useRuntimeConfig()

  // pools(uint256) selector. Keep it constant to avoid ABI encoding edge cases.
  const POOLS_SELECTOR = '0xac4afa38' as const
  const REMARK_PROXY_SELECTOR = '0x317c7e2b' as const // remarkProxy()
  const GET_REMARKS_SELECTOR = '0x8b617b28' as const // getRemarks(uint256,uint256)

  function uint256ToHex32(v: bigint): Hex {
    const hex = v.toString(16).padStart(64, '0')
    return (`0x${hex}`) as Hex
  }

  function encodePoolsCalldata(poolId: bigint): Hex {
    // calldata = selector(4 bytes) + uint256(32 bytes)
    const arg = uint256ToHex32(poolId).slice(2)
    return (`${POOLS_SELECTOR}${arg}`) as Hex
  }

  function encodeRemarkProxyCalldata(): Hex {
    return REMARK_PROXY_SELECTOR as Hex
  }

  function encodeGetRemarksCalldata(poolId: bigint, taskId: bigint): Hex {
    const a = uint256ToHex32(poolId).slice(2)
    const b = uint256ToHex32(taskId).slice(2)
    return (`${GET_REMARKS_SELECTOR}${a}${b}`) as Hex
  }

  async function ethCall(rpcUrl: string, to: Address, data: Hex): Promise<Hex> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)
    try {
      const resp = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'eth_call',
          params: [{ to, data }, 'latest'],
        }),
      })
      const json = (await resp.json()) as { result?: Hex; error?: { message?: string } }
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`)
      }
      if (json.error) {
        throw new Error(json.error.message || 'RPC error')
      }
      if (!json.result) {
        throw new Error('RPC missing result')
      }
      return json.result
    } finally {
      clearTimeout(timeout)
    }
  }

  function decodeRemarkProxyResult(result: Hex): Address {
    const hex = String(result || '')
    if (!hex.startsWith('0x')) throw new Error('invalid eth_call result')
    const body = hex.slice(2).padStart(64, '0')
    // address is right-most 20 bytes of the 32-byte slot
    return (`0x${body.slice(24)}`) as Address
  }

  function decodeGetRemarksResult(result: Hex): TaskpoolRemarkRow {
    const abi = [
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

    const decoded = decodeFunctionResult({
      abi,
      functionName: 'getRemarks',
      data: result,
    }) as readonly [string, string, bigint]

    const [senderRemark, receiverRemark, timestamp] = decoded
    return {
      senderRemark: String(senderRemark || ''),
      receiverRemark: String(receiverRemark || ''),
      timestamp: BigInt(timestamp || 0n),
    }
  }

  /**
   * 只读：读取 TaskPool 终审写入的两段备注（与 `RemarkLogicV1` + `TaskPoolLogicV4` 对齐）。
   *
   * 合约语义（见 `RemarkLogicV1.sol` 顶部注释 + `TaskPoolLogicV4._saveFinalRemarks`）：
   * - `saveRemark(poolId, 0, "", publisherRemark)`：publisher 备注写入 **receiverRemarks**（`getRemarks` 的第二个返回值）
   * - `saveRemark(poolId, taskRowId, assigneeRemark, "")`：assignee 备注写入 **senderRemarks**（`getRemarks` 的第一个返回值）
   *
   * 因此这里需要 **两次** `getRemarks`：
   * - `(poolId, 0)`：publisher
   * - `(poolId, uuidToTaskPoolUint256(taskRowUuid))`：assignee
   */
  async function readTaskpoolSplitRemarksByTaskInfoId(
    taskInfoId: string,
    taskRowId: string
  ): Promise<TaskpoolSplitRemarks | null> {
    if (!import.meta.client) return null
    const proxy = String(config.public.taskpoolProxyAddress || '').trim() as Address
    if (!proxy || proxy === '0x0000000000000000000000000000000000000000') {
      throw new Error('未配置 NUXT_PUBLIC_TASKPOOL_PROXY_ADDRESS')
    }
    const rpcUrl = String(config.public.opRpcUrl || '').trim()
    if (!rpcUrl) throw new Error('未配置 NUXT_PUBLIC_OP_RPC_URL')

    const id = String(taskInfoId || '').trim()
    const rowId = String(taskRowId || '').trim()
    if (!id) return null
    const poolId = uuidToTaskPoolUint256(id)

    const addrRes = await ethCall(rpcUrl, proxy, encodeRemarkProxyCalldata())
    const remarkProxy = decodeRemarkProxyResult(addrRes)
    if (!remarkProxy || remarkProxy === '0x0000000000000000000000000000000000000000') return null

    const publisherRes = await ethCall(rpcUrl, remarkProxy, encodeGetRemarksCalldata(poolId, 0n))
    let publisherRow: TaskpoolRemarkRow
    try {
      publisherRow = decodeGetRemarksResult(publisherRes)
    } catch {
      publisherRow = { senderRemark: '', receiverRemark: '', timestamp: 0n }
    }
    // 合约约定 taskId=0 时 publisher 写在 receiver 槽；兼容异常/旧数据：另一侧非空则合并
    const publisherRemark = String(
      publisherRow.receiverRemark || publisherRow.senderRemark || ''
    ).trim()
    const publisherTimestamp = publisherRow.timestamp || 0n

    let assigneeRemark = ''
    let assigneeTimestamp = 0n
    // 若误把 task_info_id 当成 taskRowId（两者 keccak 后相同），不要尝试读取“自己这条槽位”的 assignee 备注
    if (rowId) {
      const chainTaskId = uuidToTaskPoolUint256(rowId)
      if (chainTaskId !== poolId) {
        const assigneeRes = await ethCall(rpcUrl, remarkProxy, encodeGetRemarksCalldata(poolId, chainTaskId))
        let assigneeRow: TaskpoolRemarkRow
        try {
          assigneeRow = decodeGetRemarksResult(assigneeRes)
        } catch {
          assigneeRow = { senderRemark: '', receiverRemark: '', timestamp: 0n }
        }
        assigneeRemark = String(assigneeRow.senderRemark || assigneeRow.receiverRemark || '').trim()
        assigneeTimestamp = assigneeRow.timestamp || 0n
      }
    }

    if (!publisherRemark && !assigneeRemark && !publisherTimestamp && !assigneeTimestamp) return null
    return { assigneeRemark, publisherRemark, assigneeTimestamp, publisherTimestamp }
  }

  /**
   * @deprecated 历史命名；请优先使用 `readTaskpoolSplitRemarksByTaskInfoId`。
   *
   * 为兼容旧调用点，这里把 `TaskpoolRemarkRow` 映射回 **RemarkLogic 原始字段语义**：
   * - senderRemark：接包者备注（assignee）
   * - receiverRemark：发包者备注（publisher）
   */
  async function readPublisherRemarkByTaskInfoId(
    taskInfoId: string,
    taskRowId: string
  ): Promise<TaskpoolRemarkRow | null> {
    const split = await readTaskpoolSplitRemarksByTaskInfoId(taskInfoId, taskRowId)
    if (!split) return null
    const ts =
      split.assigneeTimestamp > split.publisherTimestamp
        ? split.assigneeTimestamp
        : split.publisherTimestamp
    return {
      senderRemark: split.assigneeRemark,
      receiverRemark: split.publisherRemark,
      timestamp: ts,
    }
  }

  async function ethGetCode(rpcUrl: string, address: Address): Promise<Hex> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)
    try {
      const resp = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'eth_getCode',
          params: [address, 'latest'],
        }),
      })
      const json = (await resp.json()) as { result?: Hex; error?: { message?: string } }
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      if (json.error) throw new Error(json.error.message || 'RPC error')
      if (!json.result) throw new Error('RPC missing result')
      return json.result
    } finally {
      clearTimeout(timeout)
    }
  }

  async function ethGetBlockNumber(rpcUrl: string): Promise<bigint> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)
    try {
      const resp = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'eth_blockNumber',
          params: [],
        }),
      })
      const json = (await resp.json()) as { result?: Hex; error?: { message?: string } }
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      if (json.error) throw new Error(json.error.message || 'RPC error')
      if (!json.result) throw new Error('RPC missing result')
      return BigInt(json.result)
    } finally {
      clearTimeout(timeout)
    }
  }

  async function ethGetTransactionReceipt(
    rpcUrl: string,
    txHash: Hex
  ): Promise<{ blockNumber?: Hex } | null> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)
    try {
      const resp = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'eth_getTransactionReceipt',
          params: [txHash],
        }),
      })
      const json = (await resp.json()) as { result?: any; error?: { message?: string } }
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      if (json.error) throw new Error(json.error.message || 'RPC error')
      return json.result || null
    } finally {
      clearTimeout(timeout)
    }
  }

  async function ethGetLogs(
    rpcUrl: string,
    args: { address: Address; fromBlock: Hex; toBlock: Hex; topics: Hex[] }
  ): Promise<Array<{ transactionHash?: Hex; blockNumber?: Hex; logIndex?: Hex }>> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15_000)
    try {
      const resp = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'eth_getLogs',
          params: [
            {
              address: args.address,
              fromBlock: args.fromBlock,
              toBlock: args.toBlock,
              topics: args.topics,
            },
          ],
        }),
      })
      const json = (await resp.json()) as { result?: any[]; error?: { message?: string } }
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      if (json.error) throw new Error(json.error.message || 'RPC error')
      return Array.isArray(json.result) ? json.result : []
    } finally {
      clearTimeout(timeout)
    }
  }

  function topic0(sig: string): Hex {
    return keccak256(toBytes(sig)) as Hex
  }

  function topicUint256(v: bigint): Hex {
    return toHex(v, { size: 32 }) as Hex
  }

  function pickLatestEventRef(
    logs: Array<{ transactionHash?: Hex; blockNumber?: Hex; logIndex?: Hex }>
  ): TaskpoolPoolEventRef | null {
    let best: TaskpoolPoolEventRef | null = null
    for (const l of logs || []) {
      const txHash = l.transactionHash
      const bn = l.blockNumber
      if (!txHash || !bn) continue
      const blockNumber = BigInt(bn)
      const logIndex = l.logIndex != null ? BigInt(l.logIndex) : undefined
      const cur: TaskpoolPoolEventRef = { txHash, blockNumber, logIndex }
      if (!best) {
        best = cur
        continue
      }
      if (cur.blockNumber > best.blockNumber) {
        best = cur
        continue
      }
      if (cur.blockNumber === best.blockNumber) {
        const a = cur.logIndex ?? 0n
        const b = best.logIndex ?? 0n
        if (a > b) best = cur
      }
    }
    return best
  }

  async function readPoolEventRefsByTaskInfoId(input: {
    taskInfoId: string
    /** 建池交易哈希（可选，用于缩小日志扫描范围） */
    taskpoolCreateTxHash?: string | null | undefined
  }): Promise<{ finalApproved: TaskpoolPoolEventRef | null; distributed: TaskpoolPoolEventRef | null }> {
    if (!import.meta.client) return { finalApproved: null, distributed: null }
    const proxy = String(config.public.taskpoolProxyAddress || '').trim() as Address
    if (!proxy || proxy === '0x0000000000000000000000000000000000000000') {
      throw new Error('未配置 NUXT_PUBLIC_TASKPOOL_PROXY_ADDRESS')
    }
    const rpcUrl = String(config.public.opRpcUrl || '').trim()
    if (!rpcUrl) throw new Error('未配置 NUXT_PUBLIC_OP_RPC_URL')

    const id = String(input.taskInfoId || '').trim()
    if (!id) return { finalApproved: null, distributed: null }
    const poolId = uuidToTaskPoolUint256(id)

    let fromBlock: bigint | null = null
    const createHashRaw = String(input.taskpoolCreateTxHash || '').trim()
    const createHash =
      createHashRaw && createHashRaw.startsWith('0x') && createHashRaw.length === 66
        ? (createHashRaw as Hex)
        : null
    if (createHash) {
      try {
        const rec = await ethGetTransactionReceipt(rpcUrl, createHash)
        if (rec?.blockNumber) fromBlock = BigInt(rec.blockNumber)
      } catch {
        // ignore, fallback below
      }
    }
    if (fromBlock == null) {
      // fallback: scan a recent window to avoid full-chain logs
      const latest = await ethGetBlockNumber(rpcUrl)
      const window = 200_000n
      fromBlock = latest > window ? latest - window : 0n
    }

    const finalTopic0 = topic0('PoolFinalApproved(uint256,uint64,uint64)')
    const distTopic0 = topic0('Distributed(uint256,uint256,uint256,bool)')
    const poolIdTopic = topicUint256(poolId)

    const [finalLogs, distLogs] = await Promise.all([
      ethGetLogs(rpcUrl, {
        address: proxy,
        fromBlock: toHex(fromBlock) as Hex,
        toBlock: 'latest' as any,
        topics: [finalTopic0, poolIdTopic],
      }),
      ethGetLogs(rpcUrl, {
        address: proxy,
        fromBlock: toHex(fromBlock) as Hex,
        toBlock: 'latest' as any,
        topics: [distTopic0, poolIdTopic],
      }),
    ])

    return {
      finalApproved: pickLatestEventRef(finalLogs),
      distributed: pickLatestEventRef(distLogs),
    }
  }

  async function readPoolByTaskInfoId(taskInfoId: string): Promise<TaskpoolPoolRow | null> {
    if (!import.meta.client) return null
    const proxy = String(config.public.taskpoolProxyAddress || '').trim() as Address
    if (!proxy || proxy === '0x0000000000000000000000000000000000000000') {
      throw new Error('未配置 NUXT_PUBLIC_TASKPOOL_PROXY_ADDRESS')
    }
    const rpcUrl = String(config.public.opRpcUrl || '').trim()
    if (!rpcUrl) {
      throw new Error('未配置 NUXT_PUBLIC_OP_RPC_URL')
    }
    const id = String(taskInfoId || '').trim()
    if (!id) return null
    const poolId = uuidToTaskPoolUint256(id)
    try {
      const data = encodePoolsCalldata(poolId)
      const result = await ethCall(rpcUrl, proxy, data)
      if (result === '0x') {
        const code = await ethGetCode(rpcUrl, proxy).catch(() => '0x' as Hex)
        if (code === '0x') {
          throw new Error('TaskPool 合约地址无代码（请检查 NUXT_PUBLIC_TASKPOOL_PROXY_ADDRESS）')
        }
        throw new Error('链上调用返回空结果（可能是合约 revert / ABI 不匹配 / RPC 节点异常）')
      }
      // Manual decoding: avoid viem decode path for large uint256 edge cases.
      return decodePoolsResult(result)
    } catch (e) {
      console.error('[taskpool] read pools via eth_call failed', {
        e,
        chainId: optimism.id,
        proxy,
        poolId: poolId.toString(),
      })
      const msg = e instanceof Error ? e.message : ''
      if (msg) throw new Error(msg)
      throw new Error('链上状态读取失败，请稍后重试')
    }
  }

  /** 是否已终审开公示（链上 publicizeEndsAt 已写入） */
  function isPublicizeStarted(p: TaskpoolPoolRow): boolean {
    return p.publicizeEndsAt > 0n
  }

  /** 当前时间是否已超过公示结束时间（可尝试 distribute，仍需链上成功为准） */
  function isPublicizeEnded(p: TaskpoolPoolRow, nowSec: bigint): boolean {
    if (!isPublicizeStarted(p)) return false
    return nowSec >= p.publicizeEndsAt
  }

  /** 领取者视角：可展示「打开 Semi 结算」的前提（不含业务 phase，仅链上） */
  function canAttemptDistribute(p: TaskpoolPoolRow, nowSec: bigint): boolean {
    if (!p.exists || p.settled || p.paused || p.poolRejected) return false
    return isPublicizeEnded(p, nowSec)
  }

  return {
    readPoolByTaskInfoId,
    readPoolEventRefsByTaskInfoId,
    readTaskpoolSplitRemarksByTaskInfoId,
    readPublisherRemarkByTaskInfoId,
    isPublicizeStarted,
    isPublicizeEnded,
    canAttemptDistribute,
  }
}
