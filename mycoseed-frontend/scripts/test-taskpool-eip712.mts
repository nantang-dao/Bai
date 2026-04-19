import assert from 'node:assert/strict'
import {
  concat,
  hashTypedData,
  hexToBigInt,
  keccak256,
  numberToHex,
  pad,
  stringToBytes,
} from 'viem'
import {
  buildCreatePoolMessage,
  hashCreatePoolTypedData,
  hashPackedUint256Array,
  normalizeUuidForTaskPool,
  taskPoolCreateTypes,
  taskPoolDomain,
  uuidToTaskPoolUint256,
} from '../utils/taskpool/index'

function uint256ToBytes32(value: bigint): `0x${string}` {
  return pad(numberToHex(value, { size: 32 }))
}

function hashPackedUint256Array_Independent(values: readonly bigint[]): `0x${string}` {
  if (values.length === 0) return keccak256('0x')
  return keccak256(concat(values.map(uint256ToBytes32)))
}

// 1) UUID normalize + id derivation
{
  const raw = '  00000000-0000-0000-0000-000000000042  '
  const canonical = normalizeUuidForTaskPool(raw)
  assert.equal(canonical, '00000000-0000-0000-0000-000000000042')

  const expected = hexToBigInt(keccak256(stringToBytes(canonical)))
  const got = uuidToTaskPoolUint256(raw)
  assert.equal(got, expected, 'uuidToTaskPoolUint256 should equal keccak256(utf8(uuid))')
}

// 2) packed uint256[] hash aligns with abi.encodePacked(uint256[])
{
  const values = [0n, 1n, 2n, 123456789n]
  const got = hashPackedUint256Array(values)
  const expected = hashPackedUint256Array_Independent(values)
  assert.equal(got, expected, 'hashPackedUint256Array mismatch')
}

// 3) CreatePool message hashes + EIP-712 digest wiring
{
  const chainId = 10
  const verifyingContract = '0x3A612F0e8D3942fEb6E2f48AfEbaCFa5ED7bb749' as const
  const poolId = 42n
  const taskIds = [1n, 2n]
  const taskMaxAmounts = [100n, 200n]

  const msg = buildCreatePoolMessage({
    poolId,
    publisher: '0x0000000000000000000000000000000000000001',
    manager: '0x0000000000000000000000000000000000000002',
    taskIds,
    taskMaxAmounts,
    lockedBalance: 300n,
    claimDeadline: 1000n,
    credentialDeadline: 2000n,
    nonce: 0n,
    sigDeadline: 9999999999n,
  })

  assert.equal(msg.taskIdsHash, hashPackedUint256Array(taskIds), 'taskIdsHash mismatch')
  assert.equal(
    msg.taskMaxAmountsHash,
    hashPackedUint256Array(taskMaxAmounts),
    'taskMaxAmountsHash mismatch'
  )

  const digest = hashCreatePoolTypedData(chainId, verifyingContract, msg)
  const digest2 = hashTypedData({
    domain: taskPoolDomain(chainId, verifyingContract),
    types: taskPoolCreateTypes,
    primaryType: 'CreateTaskPool',
    message: msg,
  })
  assert.equal(digest, digest2, 'hashCreatePoolTypedData should be pure wrapper over hashTypedData')
}

console.log('[taskpool] eip712 tests: OK')

