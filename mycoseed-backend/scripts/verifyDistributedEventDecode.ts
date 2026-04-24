/**
 * 自检：Distributed 事件 ABI 与链上 `Distributed(uint256,uint256,uint256,bool)` 一致，
 * `decodeEventLog` 必须成功（避免 complete distribute 回跳 409）。
 */
import { decodeEventLog, encodeAbiParameters, keccak256, toBytes } from 'viem'

const distributedEventAbi = [
  {
    type: 'event',
    name: 'Distributed',
    inputs: [
      { indexed: true, name: 'poolId', type: 'uint256' },
      { indexed: false, name: 'paidOut', type: 'uint256' },
      { indexed: false, name: 'refund', type: 'uint256' },
      { indexed: false, name: 'refundToCredit', type: 'bool' },
    ],
  },
] as const

const topic0 = keccak256(toBytes('Distributed(uint256,uint256,uint256,bool)'))
const poolId = 1234567890123456789012345678901234567890123456789012345678901234n
const paidOut = 100n
const refund = 7n
const refundToCredit = true

const topic1 = (`0x${poolId.toString(16).padStart(64, '0')}`) as `0x${string}`
const data = encodeAbiParameters(
  [
    { type: 'uint256', name: 'paidOut' },
    { type: 'uint256', name: 'refund' },
    { type: 'bool', name: 'refundToCredit' },
  ],
  [paidOut, refund, refundToCredit]
)

const decoded = decodeEventLog({
  abi: distributedEventAbi,
  topics: [topic0, topic1],
  data,
})

if (decoded.eventName !== 'Distributed') throw new Error('event name mismatch')
const args = decoded.args as {
  poolId: bigint
  paidOut: bigint
  refund: bigint
  refundToCredit: boolean
}
if (args.poolId !== poolId) throw new Error('poolId mismatch')
if (args.paidOut !== paidOut) throw new Error('paidOut mismatch')
if (args.refund !== refund) throw new Error('refund mismatch')
if (args.refundToCredit !== refundToCredit) throw new Error('refundToCredit mismatch')

console.log('ok: Distributed decode matches TaskPoolLogicV4 event layout')
