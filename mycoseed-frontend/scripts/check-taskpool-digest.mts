import {
  buildCreatePoolMessage,
  hashCreatePoolTypedData,
} from '../utils/taskpool/index.ts'

const proxy = '0x3A612F0e8D3942fEb6E2f48AfEbaCFa5ED7bb749'
const msg = buildCreatePoolMessage({
  poolId: 42n,
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
const h = hashCreatePoolTypedData(10, proxy as `0x${string}`, msg)
console.log('taskIdsHash:', msg.taskIdsHash)
console.log('CreatePool digest (viem):', h)
console.log('期望与 contracts-project verify-eip712.ts 输出一致')
