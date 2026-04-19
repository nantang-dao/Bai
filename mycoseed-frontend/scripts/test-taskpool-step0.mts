/**
 * Step0 自测：口径锁定
 * - UUID → poolId(uint256) 算法
 * - NT 金额单位：18 位 wei
 *
 * 用法：
 *   npm run taskpool:test-step0
 */
import assert from 'node:assert/strict'
import { keccak256, stringToBytes } from 'viem'
import {
  formatNtFromWei,
  normalizeUuidForTaskPool,
  parseNtToWei,
  uuidToTaskPoolUint256,
} from '../utils/taskpool/index.ts'

const UUID = '00000000-0000-0000-0000-000000000000'

function main() {
  // 1) poolId 算法：canonical uuid → uint256(keccak256(utf8(uuid)))
  const canonical = normalizeUuidForTaskPool(UUID)
  const byFormula = BigInt(keccak256(stringToBytes(canonical)))
  const byHelper = uuidToTaskPoolUint256(UUID)
  assert.equal(byHelper, byFormula)

  // 2) 金额单位：NT(18) ↔ wei
  assert.equal(parseNtToWei('1').toString(), '1000000000000000000')
  assert.equal(parseNtToWei('0.000000000000000001').toString(), '1')
  assert.equal(formatNtFromWei(1_000_000_000_000_000_000n), '1')

  console.log('[taskpool step0] OK')
  console.log('uuid:', UUID)
  console.log('poolId(uint256):', byHelper.toString())
  console.log('poolId(hex):', '0x' + byHelper.toString(16))
}

main()

