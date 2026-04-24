import { keccak256, stringToBytes, hexToBigInt } from 'viem'
import fs from 'node:fs'
import path from 'node:path'

function loadDotEnvIfPresent() {
  // Lightweight .env loader to avoid adding deps.
  const envPath = path.resolve(process.cwd(), '.env')
  if (!fs.existsSync(envPath)) return
  const raw = fs.readFileSync(envPath, 'utf8')
  for (const line of raw.split('\n')) {
    const s = line.trim()
    if (!s || s.startsWith('#')) continue
    const eq = s.indexOf('=')
    if (eq === -1) continue
    const key = s.slice(0, eq).trim()
    let val = s.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = val
  }
}

function normalizeUuidForTaskPool(uuid) {
  const s = String(uuid || '').trim().toLowerCase()
  const re = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
  if (!re.test(s)) throw new Error(`invalid uuid: ${uuid}`)
  return s
}

function uuidToTaskPoolUint256(uuid) {
  const canonical = normalizeUuidForTaskPool(uuid)
  const h = keccak256(stringToBytes(canonical))
  return hexToBigInt(h)
}

const POOLS_SELECTOR = '0xac4afa38'
function uint256ToHex32(v) {
  return v.toString(16).padStart(64, '0')
}
function encodePoolsCalldata(poolId) {
  return `${POOLS_SELECTOR}${uint256ToHex32(poolId)}`
}

async function rpc(url, method, params) {
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
  })
  const json = await resp.json().catch(() => ({}))
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  if (json?.error) throw new Error(json.error.message || 'RPC error')
  return json.result
}

function tryDecodeRevert(hex) {
  if (typeof hex !== 'string' || !hex.startsWith('0x')) return null
  const body = hex.slice(2)
  if (!body) return 'empty result (0x)'
  if (body.startsWith('00000000')) return null
  if (body.startsWith('08c379a0') && body.length >= 8 + 64 * 2) {
    try {
      const lenHex = body.slice(8 + 64, 8 + 64 * 2)
      const len = Number(BigInt(`0x${lenHex}`))
      const dataHex = body.slice(8 + 64 * 2, 8 + 64 * 2 + len * 2)
      const bytes = new Uint8Array(dataHex.match(/.{1,2}/g)?.map((b) => parseInt(b, 16)) ?? [])
      const msg = new TextDecoder().decode(bytes)
      return msg || 'Error(string)'
    } catch {
      return 'Error(string)'
    }
  }
  if (body.startsWith('4e487b71') && body.length >= 8 + 64) {
    const code = body.slice(8, 8 + 64)
    return `Panic(0x${code.replace(/^0+/, '') || '0'})`
  }
  if (body.length >= 8) return `CustomError(0x${body.slice(0, 8)})`
  return null
}

async function main() {
  loadDotEnvIfPresent()

  const uuid = process.argv[2]
  if (!uuid) {
    console.log('Usage: node scripts/taskpool-debug.mjs <taskInfoId(uuid)>')
    process.exit(1)
  }

  const rpcUrl =
    process.env.NUXT_PUBLIC_OP_RPC_URL ||
    process.env.OP_RPC_URL ||
    process.env.NUXT_OP_RPC_URL ||
    ''
  const proxy =
    process.env.NUXT_PUBLIC_TASKPOOL_PROXY_ADDRESS ||
    process.env.TASKPOOL_PROXY_ADDRESS ||
    ''

  console.log('[env] rpcUrl:', rpcUrl ? `${rpcUrl.slice(0, 32)}...` : '(missing)')
  console.log('[env] proxy:', proxy || '(missing)')
  if (!rpcUrl) throw new Error('missing rpc url env (NUXT_PUBLIC_OP_RPC_URL)')
  if (!proxy) throw new Error('missing proxy env (NUXT_PUBLIC_TASKPOOL_PROXY_ADDRESS)')

  const poolId = uuidToTaskPoolUint256(uuid)
  console.log('[input] uuid:', normalizeUuidForTaskPool(uuid))
  console.log('[derived] poolId:', poolId.toString())

  const code = await rpc(rpcUrl, 'eth_getCode', [proxy, 'latest'])
  console.log('[eth_getCode] len:', (code?.length ?? 0), 'isEmpty:', code === '0x')

  const data = encodePoolsCalldata(poolId)
  console.log('[eth_call] data selector:', data.slice(0, 10), 'data len:', data.length)
  const result = await rpc(rpcUrl, 'eth_call', [{ to: proxy, data }, 'latest'])
  console.log('[eth_call] result len:', (result?.length ?? 0), 'head:', String(result).slice(0, 18))

  const reason = tryDecodeRevert(result)
  if (reason) console.log('[eth_call] looks like revert:', reason)

  // For convenience: if it looks like a normal pools() return, show slot 6 (publicizeEndsAt)
  if (typeof result === 'string' && result.startsWith('0x') && result.length >= 2 + 64 * 12) {
    const body = result.slice(2)
    const slot6 = body.slice(6 * 64, 7 * 64)
    const publicizeEndsAt = BigInt(`0x${slot6}`)
    console.log('[pools] publicizeEndsAt:', publicizeEndsAt.toString())
  } else {
    console.log('[pools] not enough bytes to decode pools head')
  }
}

main().catch((e) => {
  console.error('[taskpool-debug] failed:', e?.message || e)
  process.exit(1)
})

