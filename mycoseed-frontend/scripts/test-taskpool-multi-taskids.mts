import assert from 'node:assert/strict'
import { uuidToTaskPoolUint256 } from '../utils/taskpool'

const TASK_INFO_ID = '00000000-0000-0000-0000-000000000000'
const TASK_IDS = [
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000003',
]

function main() {
  const poolId = uuidToTaskPoolUint256(TASK_INFO_ID)
  const taskIds = TASK_IDS.map(uuidToTaskPoolUint256)

  // 只做形状校验：uint256 且互不相等；不强行绑定某个常量值（避免将来更换派生规则）
  assert.ok(poolId > 0n)
  assert.equal(new Set(taskIds.map((x) => x.toString())).size, taskIds.length)

  console.log('[taskpool multi-taskids] OK')
  console.log('pool_uuid:', TASK_INFO_ID)
  console.log('poolId:', poolId.toString())
  console.log('task_uuids:', TASK_IDS.join(','))
  console.log('taskIds:', taskIds.map((x) => x.toString()).join(','))
}

main()

