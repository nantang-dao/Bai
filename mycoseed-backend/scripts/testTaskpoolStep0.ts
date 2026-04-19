/**
 * Step0 自测：口径锁定（后端侧）
 *
 * 用法：
 *   npm run test:taskpool-step0
 */
import assert from 'node:assert/strict'
import { keccak256, stringToBytes } from 'viem'
import { formatNtFromWei, parseNtToWei } from '../src/utils/taskpool/amounts'
import {
  normalizeUuidForTaskPool,
  uuidToTaskPoolUint256,
} from '../src/utils/taskpool/ids'

const UUID = '00000000-0000-0000-0000-000000000000'

function main() {
  const canonical = normalizeUuidForTaskPool(UUID)
  const byFormula = BigInt(keccak256(stringToBytes(canonical)))
  const byHelper = uuidToTaskPoolUint256(UUID)
  assert.equal(byHelper, byFormula)

  assert.equal(parseNtToWei('1').toString(), '1000000000000000000')
  assert.equal(parseNtToWei('0.000000000000000001').toString(), '1')
  assert.equal(formatNtFromWei(1_000_000_000_000_000_000n), '1')

  console.log('[taskpool step0 backend] OK')
  console.log('uuid:', UUID)
  console.log('poolId(uint256):', byHelper.toString())
  console.log('poolId(hex):', '0x' + byHelper.toString(16))
}

main()

