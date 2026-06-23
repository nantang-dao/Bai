/**
 * 单元测试：待结清逻辑 & 任务列表组装纯函数
 * npm run test:pending-see
 */
import {
  computeEventPaymentStatus,
  sumActualPayments,
  priceToExpectedWei,
  isTaskPendingTransfer,
} from '../src/services/pendingPaymentsLogic'
import {
  buildFlatProfileTasks,
  buildGroupedPlazaTasks,
  type TaskWithRelations,
} from '../src/services/taskListAssemblyPure'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

function testComputeEventPaymentStatus() {
  assert(computeEventPaymentStatus(0n, 0n) === 'paid', '零预期应为 paid')
  assert(computeEventPaymentStatus(100n, 0n) === 'pending', '未付应为 pending')
  assert(computeEventPaymentStatus(100n, 50n) === 'partial', '不足应为 partial')
  assert(computeEventPaymentStatus(100n, 100n) === 'paid', '足额应为 paid')
  assert(computeEventPaymentStatus(100n, 200n) === 'paid', '超额应为 paid')
  console.log('[OK] computeEventPaymentStatus')
}

function testSumActualPayments() {
  const txs = [
    { sender_address: '0xABC', actual_amount: '30' },
    { sender_address: '0xabc', amount: '20' },
    { sender_address: '0xOTHER', actual_amount: '999' },
  ]
  assert(sumActualPayments(txs, '0xabc') === 50n, '应累加同地址付款')
  console.log('[OK] sumActualPayments')
}

function testPriceToExpectedWei() {
  assert(priceToExpectedWei(50) === 50000000000000000000n, '50 积分应对应 50e18 wei')
  assert(priceToExpectedWei(0) === 0n, '0 价格应为 0')
  console.log('[OK] priceToExpectedWei')
}

function testIsTaskPendingTransfer() {
  assert(
    isTaskPendingTransfer({ status: 'completed', transferred_at: null }, false) === true,
    '已完成无转账记录应为待转账'
  )
  assert(
    isTaskPendingTransfer({ status: 'completed', transferred_at: '2026-01-01' }, false) === false,
    '已标记转账应排除'
  )
  assert(
    isTaskPendingTransfer({ status: 'completed', transferred_at: null }, true) === false,
    '有链上记录应排除'
  )
  assert(isTaskPendingTransfer({ status: 'claimed', transferred_at: null }, false) === false, '未完成应排除')
  console.log('[OK] isTaskPendingTransfer')
}

const stubMap = (dbTask: any, taskInfo?: any) =>
  ({
    id: dbTask.id,
    title: taskInfo?.title || '',
    creatorId: dbTask.creator_id,
    claimerId: dbTask.claimer_id,
    status: dbTask.status,
  }) as any

function testBuildFlatProfileTasks() {
  const rows: TaskWithRelations[] = [
    {
      id: 't1',
      task_info_id: 'info1',
      creator_id: 'u1',
      claimer_id: 'u2',
      reward: 10,
      currency: 'NT',
      weight_coefficient: 1,
      participant_index: 1,
      status: 'completed',
      completed_at: null,
      transferred_at: null,
      created_at: '',
      updated_at: '',
      task_info: { id: 'info1', title: 'Task A' },
      task_timeline: { timeline: [] },
      task_proof: null,
    },
    {
      id: 't2',
      task_info_id: 'info1',
      creator_id: 'u1',
      claimer_id: 'u3',
      reward: 10,
      currency: 'NT',
      weight_coefficient: 1,
      participant_index: 2,
      status: 'claimed',
      completed_at: null,
      transferred_at: null,
      created_at: '',
      updated_at: '',
      task_info: { id: 'info1', title: 'Task A' },
      task_timeline: { timeline: [] },
      task_proof: null,
    },
  ]
  const flat = buildFlatProfileTasks(rows, {}, stubMap)
  assert(flat.length === 2, '扁平列表应保留每个 task 行')
  console.log('[OK] buildFlatProfileTasks')
}

function testBuildGroupedPlazaTasks() {
  const rows: TaskWithRelations[] = [
    {
      id: 't1',
      task_info_id: 'info1',
      creator_id: 'u1',
      claimer_id: 'u2',
      reward: 10,
      currency: 'NT',
      weight_coefficient: 1,
      participant_index: 1,
      status: 'claimed',
      completed_at: null,
      transferred_at: null,
      created_at: '',
      updated_at: '',
      task_info: { id: 'info1', title: 'Multi', participant_limit: 2 },
      task_timeline: { timeline: [] },
      task_proof: null,
    },
    {
      id: 't2',
      task_info_id: 'info1',
      creator_id: 'u1',
      claimer_id: null,
      reward: 10,
      currency: 'NT',
      weight_coefficient: 1,
      participant_index: 2,
      status: 'unclaimed',
      completed_at: null,
      transferred_at: null,
      created_at: '',
      updated_at: '',
      task_info: { id: 'info1', title: 'Multi', participant_limit: 2 },
      task_timeline: { timeline: [] },
      task_proof: null,
    },
  ]
  const grouped = buildGroupedPlazaTasks(rows, {}, stubMap)
  assert(grouped.length === 1, '广场列表应合并同一 task_info')
  console.log('[OK] buildGroupedPlazaTasks')
}

function main() {
  testComputeEventPaymentStatus()
  testSumActualPayments()
  testPriceToExpectedWei()
  testIsTaskPendingTransfer()
  testBuildFlatProfileTasks()
  testBuildGroupedPlazaTasks()
  console.log('\nAll pending-see unit tests passed.')
}

main()
