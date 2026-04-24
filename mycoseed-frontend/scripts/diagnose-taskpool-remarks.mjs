import 'dotenv/config'
import { decodeFunctionResult, keccak256, stringToBytes, hexToBigInt } from 'viem'

function assertEnv(name) {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env: ${name}`)
  return v
}

const rpcUrl = assertEnv('NUXT_PUBLIC_OP_RPC_URL')
const proxy = assertEnv('NUXT_PUBLIC_TASKPOOL_PROXY_ADDRESS')

const taskInfoId = process.argv[2]
const taskRowId = process.argv[3] || ''
if (!taskInfoId) {
  console.error('Usage: node scripts/diagnose-taskpool-remarks.mjs <taskInfoId(uuid)> [taskRowUuid(uuid)]')
  process.exit(1)
}

const REMARK_PROXY_SELECTOR = '0x317c7e2b' // remarkProxy()
const GET_REMARKS_SELECTOR = '0x8b617b28' // getRemarks(uint256,uint256)

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

function uint256ToHex32(v) {
  return v.toString(16).padStart(64, '0')
}

function encodeGetRemarksCalldata(poolId, taskId) {
  return `${GET_REMARKS_SELECTOR}${uint256ToHex32(poolId)}${uint256ToHex32(taskId)}`
}

function decodeRemarkProxyAddress(result) {
  const hex = String(result || '')
  if (!hex.startsWith('0x')) throw new Error('invalid eth_call result')
  const body = hex.slice(2).padStart(64, '0')
  return `0x${body.slice(24)}`
}

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
]

function decodeGetRemarks(result) {
  const decoded = decodeFunctionResult({
    abi: getRemarksAbi,
    functionName: 'getRemarks',
    data: result,
  })
  const [senderRemark, receiverRemark, timestamp] = decoded
  return {
    senderRemark: String(senderRemark || ''),
    receiverRemark: String(receiverRemark || ''),
    timestamp: BigInt(timestamp || 0n),
  }
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

const poolId = uuidToTaskPoolUint256(taskInfoId)
console.log('proxy:', proxy)
console.log('rpcUrl:', rpcUrl)
console.log('taskInfoId:', taskInfoId)
console.log('poolId(uint256):', poolId.toString())

const remarkProxy = decodeRemarkProxyAddress(await rpc('eth_call', [{ to: proxy, data: REMARK_PROXY_SELECTOR }, 'latest']))
console.log('remarkProxy:', remarkProxy)

const pub = decodeGetRemarks(await rpc('eth_call', [{ to: remarkProxy, data: encodeGetRemarksCalldata(poolId, 0n) }, 'latest']))
console.log('\ngetRemarks(poolId, taskId=0) => publisher pool-level remark lives in receiverRemark slot:')
console.log({
  senderRemark: pub.senderRemark,
  receiverRemark: pub.receiverRemark,
  timestamp: pub.timestamp.toString(),
})

if (taskRowId) {
  const chainTaskId = uuidToTaskPoolUint256(taskRowId)
  console.log('\ntaskRowId:', taskRowId)
  console.log('taskRow chainTaskId(uint256):', chainTaskId.toString())
  if (chainTaskId === poolId) {
    console.log('\nNOTE: taskRowId hashes equal poolId (usually means you passed task_info_id as taskRowId). Skipping per-row read.')
  } else {
    const row = decodeGetRemarks(
      await rpc('eth_call', [{ to: remarkProxy, data: encodeGetRemarksCalldata(poolId, chainTaskId) }, 'latest'])
    )
    console.log('\ngetRemarks(poolId, taskRowId) => assignee remark lives in senderRemark slot:')
    console.log({
      senderRemark: row.senderRemark,
      receiverRemark: row.receiverRemark,
      timestamp: row.timestamp.toString(),
    })
  }
}
