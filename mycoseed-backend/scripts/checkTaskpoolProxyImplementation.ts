import 'dotenv/config'
import { createPublicClient, http } from 'viem'
import { taskpoolConfig } from '../src/config/taskpool'

const proxyAbi = [
  {
    type: 'function',
    name: 'implementation',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: 'impl', type: 'address' }],
  },
] as const

async function main() {
  const expect = (process.env.TASKPOOL_EXPECT_IMPL || '').trim().toLowerCase()
  const client = createPublicClient({
    transport: http(taskpoolConfig.opRpcUrl, {
      timeout: 30_000,
    }),
  })

  const impl = await client.readContract({
    address: taskpoolConfig.proxyAddress,
    abi: proxyAbi,
    functionName: 'implementation',
  })

  console.log('[taskpool] proxy:', taskpoolConfig.proxyAddress)
  console.log('[taskpool] implementation:', impl)

  if (!expect) {
    console.log('[taskpool] TASKPOOL_EXPECT_IMPL 未设置，跳过一致性断言。')
    console.log('[taskpool] OK')
    return
  }

  if (String(impl).toLowerCase() !== expect) {
    throw new Error(`implementation 不匹配：got=${impl} expect=${expect}`)
  }

  console.log('[taskpool] OK')
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})

