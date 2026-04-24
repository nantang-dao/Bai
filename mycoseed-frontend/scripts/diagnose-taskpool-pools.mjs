import 'dotenv/config'
import { keccak256, toBytes, stringToBytes, hexToBigInt } from 'viem'

function assertEnv(name) {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env: ${name}`)
  return v
}

const rpcUrl = assertEnv('NUXT_PUBLIC_OP_RPC_URL')
const proxy = assertEnv('NUXT_PUBLIC_TASKPOOL_PROXY_ADDRESS')

const taskInfoId = process.argv[2]
if (!taskInfoId) {
  console.error('Usage: node scripts/diagnose-taskpool-pools.mjs <taskInfoId(uuid)>')
  process.exit(1)
}

const selector = '0x' + keccak256(toBytes('pools(uint256)')).slice(2, 10)
function normalizeUuidForTaskPool(uuid) {
  const s = String(uuid || '').trim().toLowerCase()
  const re = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
  if (!re.test(s)) throw new Error(`[taskpool] invalid uuid: ${String(uuid).slice(0, 64)}`)
  return s
}
function uuidToTaskPoolUint256(uuid) {
  const canonical = normalizeUuidForTaskPool(uuid)
  const h = keccak256(stringToBytes(canonical))
  return hexToBigInt(h)
}
const poolId = uuidToTaskPoolUint256(taskInfoId)
const poolIdHex = poolId.toString(16).padStart(64, '0')
const calldata = `${selector}${poolIdHex}`

function hexToBigIntLocal(hexNo0x) {
  if (!hexNo0x) return 0n
  return BigInt('0x' + hexNo0x)
}

function tryDecodeRevert(hex) {
  if (!hex || !hex.startsWith('0x')) return null
  const body = hex.slice(2)
  if (body.length === 0) return 'EMPTY(0x)'
  // Error(string)
  if (body.startsWith('08c379a0') && body.length >= 8 + 64 * 2) {
    try {
      const lenHex = body.slice(8 + 64, 8 + 64 * 2)
      const len = Number(hexToBigIntLocal(lenHex))
      const dataHex = body.slice(8 + 64 * 2, 8 + 64 * 2 + len * 2)
      const bytes = new Uint8Array((dataHex.match(/.{1,2}/g) ?? []).map((b) => parseInt(b, 16)))
      const msg = new TextDecoder().decode(bytes)
      return `Error(string): ${msg || '(empty)'}`
    } catch {
      return 'Error(string)'
    }
  }
  // Panic(uint256)
  if (body.startsWith('4e487b71') && body.length >= 8 + 64) {
    const code = body.slice(8, 8 + 64).replace(/^0+/, '') || '0'
    return `Panic(0x${code})`
  }
  if (body.length >= 8) return `CustomError(0x${body.slice(0, 8)})`
  return null
}

async function rpc(method, params) {
  const resp = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
  })
  const json = await resp.json()
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  if (json.error) throw new Error(json.error.message || 'RPC error')
  return json.result
}

const code = await rpc('eth_getCode', [proxy, 'latest'])
console.log('proxy:', proxy)
console.log('rpcUrl:', rpcUrl)
console.log('selector:', selector)
console.log('taskInfoId:', taskInfoId)
console.log('poolId:', poolId.toString())
console.log('poolIdHex:', '0x' + poolIdHex)
console.log('eth_getCode:', code === '0x' ? '0x (NO CODE!)' : `len=${(code.length - 2) / 2} bytes`)

const result = await rpc('eth_call', [{ to: proxy, data: calldata }, 'latest'])
const revert = tryDecodeRevert(result)
console.log('eth_call.result:', result === '0x' ? '0x (EMPTY)' : `0x… len=${(result.length - 2) / 2} bytes`)
if (revert) console.log('maybeRevert:', revert)
if (result && result !== '0x') {
  const bytes = (result.length - 2) / 2
  const minBytes = 32 * 13
  console.log('expectedAtLeast:', `${minBytes} bytes (13 slots head)`)
  console.log('hasFullHead:', bytes >= minBytes)
}

