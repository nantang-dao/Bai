/**
 * 阶段 2 + 4：Semi 预付回跳 — 纯逻辑测试（解析 URL、拼 Semi 链接、管理页路径、迁移顺序）
 *
 * 运行：cd mycoseed-frontend && npm run taskpool:test-semi-prepay-callback
 * 若 tsx 报 EPERM：node --import tsx scripts/test-semi-prepay-callback.mts
 */

import assert from 'node:assert/strict'
import {
  parseSemiPrepayCallback,
  buildSemiTaskpoolPrepayUrl,
  optimismTxExplorerUrl,
  taskpoolManagePath,
} from '../utils/semiTaskpoolPrepay'
import { TASKPOOL_SEMI_OPERATION_ORDER } from '../utils/taskpool/semiOperationRoadmap'

const p1 = parseSemiPrepayCallback(
  '?status=success&state=abc&chain_id=10&pool_uuid=uuid-1&user_op_hash=0xuh&tx_hash=0xth'
)
assert.equal(p1.status, 'success')
assert.equal(p1.state, 'abc')
assert.equal(p1.chain_id, '10')
assert.equal(p1.pool_uuid, 'uuid-1')
assert.equal(p1.user_op_hash, '0xuh')
assert.equal(p1.tx_hash, '0xth')

const p2 = parseSemiPrepayCallback('?status=failed&state=s1&error_code=USER_REJECTED&error=cancel')
assert.equal(p2.status, 'failed')
assert.equal(p2.error_code, 'USER_REJECTED')

const p3 = parseSemiPrepayCallback('?status=bad')
assert.equal(p3.status, null)

const url = buildSemiTaskpoolPrepayUrl({
  semiAppBaseUrl: 'http://localhost:3000',
  returnUrl: 'http://localhost:3003/wallet/semi-prepay-callback',
  state: 'st',
  chainId: 10,
  tokenAddress: '0x7563cb33148cD2b929ed85e69F697be13b515Bd0',
  taskpoolProxyAddress: '0x1111111111111111111111111111111111111111',
  amountHuman: '10',
  poolUuid: 'pool-uuid',
})
assert.ok(url.includes('/taskpool/prepay?'))
assert.ok(url.includes('chain_id=10'))
assert.ok(url.includes('return_url='))
assert.ok(url.includes('pool_uuid=pool-uuid'))

assert.ok(optimismTxExplorerUrl('0xabc').includes('optimistic.etherscan.io'))

assert.equal(taskpoolManagePath('11111111-1111-1111-1111-111111111111'), '/tasks/pool/11111111-1111-1111-1111-111111111111/manage')
assert.ok(taskpoolManagePath('a/b').includes(encodeURIComponent('a/b')))

assert.deepEqual([...TASKPOOL_SEMI_OPERATION_ORDER], [
  'prepay_deposit',
  'create_task_pool',
  'claim_task',
  'distribute_settle',
])

console.log('[mycoseed] test-semi-prepay-callback: OK')
