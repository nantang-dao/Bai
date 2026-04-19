/**
 * 领域校验自检（无 Jest 时替代单测）：`npm run test:domain`
 */
import assert from 'node:assert/strict'
import {
  assertValidTaskListingRow,
  isTaskListingKind,
  TASK_LISTING_KINDS,
} from '../src/types/taskListingKind'

assert.equal(TASK_LISTING_KINDS.length, 3)
assert.ok(isTaskListingKind('standard'))
assert.ok(!isTaskListingKind('invalid'))

assertValidTaskListingRow('standard', null)
assertValidTaskListingRow('taskpool_pool', undefined)
assert.throws(() => assertValidTaskListingRow('standard', '550e8400-e29b-41d4-a716-446655440000'))
assert.throws(() => assertValidTaskListingRow('taskpool_subtask', null))
assertValidTaskListingRow('taskpool_subtask', '550e8400-e29b-41d4-a716-446655440000')

console.log('taskListingKind: OK')
