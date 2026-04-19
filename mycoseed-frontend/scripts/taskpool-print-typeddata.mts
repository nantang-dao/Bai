import {
  buildCreatePoolMessage,
  hashCreatePoolTypedData,
  taskPoolCreateTypes,
  taskPoolDomain,
  uuidToTaskPoolUint256,
} from '../utils/taskpool/index'

// 用于肉眼验收：打印 domain/types/message/digest
// 运行：npm run taskpool:print-typeddata

const chainId = Number(process.env.NUXT_PUBLIC_CHAIN_ID || '10')
const verifyingContract =
  (process.env.NUXT_PUBLIC_TASKPOOL_PROXY_ADDRESS ||
    '0x3A612F0e8D3942fEb6E2f48AfEbaCFa5ED7bb749') as `0x${string}`

const poolUuid = process.env.TASKPOOL_UUID || '00000000-0000-0000-0000-000000000042'
const poolId = uuidToTaskPoolUint256(poolUuid)

const msg = buildCreatePoolMessage({
  poolId,
  publisher: '0x0000000000000000000000000000000000000001',
  manager: '0x0000000000000000000000000000000000000002',
  taskIds: [1n, 2n],
  taskMaxAmounts: [100n, 200n],
  lockedBalance: 300n,
  claimDeadline: 1000n,
  credentialDeadline: 2000n,
  nonce: 0n,
  sigDeadline: 9999999999n,
})

const domain = taskPoolDomain(chainId, verifyingContract)
const digest = hashCreatePoolTypedData(chainId, verifyingContract, msg)

console.log('domain =', domain)
console.log('types =', taskPoolCreateTypes)
console.log('message =', msg)
console.log('digest =', digest)

