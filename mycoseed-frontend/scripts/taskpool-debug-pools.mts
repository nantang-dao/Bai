import { uuidToTaskPoolUint256 } from '../utils/taskpool/ids'

type Hex = `0x${string}`
type Address = `0x${string}`

function hexToBigInt(hexNo0x: string): bigint {
  if (!hexNo0x) return 0n
  return BigInt(`0x${hexNo0x}`)
}

function encodeUint256(v: bigint): Hex {
  const hex = v.toString(16).padStart(64, '0')
  return `0x${hex}`
}

function tryDecodeRevert(result: Hex): string | null {
  const body = result.slice(2)
  // Error(string)
  if (body.startsWith('08c379a0') && body.length >= 8 + 64 * 2) {
    try {
      const lenHex = body.slice(8 + 64, 8 + 64 * 2)
      const len = Number(hexToBigInt(lenHex))
      const dataStart = 8 + 64 * 2
      const dataHex = body.slice(dataStart, dataStart + len * 2)
      const bytes = new Uint8Array(
        dataHex.match(/.{1,2}/g)?.map((b) => parseInt(b, 16)) ?? [],
      )
      const msg = new TextDecoder().decode(bytes)
      return msg || 'Error(string)'
    } catch {
      return 'Error(string)'
    }
  }
  // Panic(uint256)
  if (body.startsWith('4e487b71') && body.length >= 8 + 64) {
    const code = body.slice(8, 8 + 64)
    return `Panic(0x${code.replace(/^0+/, '') || '0'})`
  }
  if (body.length >= 8) return `CustomError(0x${body.slice(0, 8)})`
  return null
}

async function rpc(rpcUrl: string, method: string, params: unknown[]) {
  const resp = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
  })
  const json = (await resp.json()) as { result?: unknown; error?: { message?: string } }
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  if (json.error) throw new Error(json.error.message || 'RPC error')
  return json.result
}

async function main() {
  const taskInfoId = process.argv[2]
  if (!taskInfoId) {
    console.error('Usage: tsx scripts/taskpool-debug-pools.mts <taskInfoId>')
    process.exit(1)
  }

  const rpcUrl = String(process.env.NUXT_PUBLIC_OP_RPC_URL || '').trim()
  const proxy = String(process.env.NUXT_PUBLIC_TASKPOOL_PROXY_ADDRESS || '').trim() as Address
  if (!rpcUrl) throw new Error('Missing NUXT_PUBLIC_OP_RPC_URL')
  if (!proxy || !proxy.startsWith('0x')) throw new Error('Missing NUXT_PUBLIC_TASKPOOL_PROXY_ADDRESS')

  const poolId = uuidToTaskPoolUint256(taskInfoId)
  const selector = '0xac4afa38' // pools(uint256)
  const data = (selector + encodeUint256(poolId).slice(2)) as Hex

  console.log('[taskpool-debug] chainId=10')
  console.log('[taskpool-debug] proxy=', proxy)
  console.log('[taskpool-debug] taskInfoId=', taskInfoId)
  console.log('[taskpool-debug] poolId=', poolId.toString())

  const code = (await rpc(rpcUrl, 'eth_getCode', [proxy, 'latest'])) as Hex
  console.log('[taskpool-debug] codeLen=', code === '0x' ? 0 : (code.length - 2) / 2)

  const result = (await rpc(rpcUrl, 'eth_call', [{ to: proxy, data }, 'latest'])) as Hex
  console.log('[taskpool-debug] resultLenBytes=', result === '0x' ? 0 : (result.length - 2) / 2)
  console.log('[taskpool-debug] resultPrefix=', result.slice(0, 10))

  const reason = result === '0x' ? 'EMPTY(0x)' : tryDecodeRevert(result)
  if (reason) {
    console.log('[taskpool-debug] looks like revert =>', reason)
  } else {
    console.log('[taskpool-debug] not a known revert payload')
  }
}

main().catch((e) => {
  console.error('[taskpool-debug] failed:', e)
  process.exit(1)
})

