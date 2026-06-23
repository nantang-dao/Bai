/**
 * 目标1（看见）前端逻辑单元测试
 * npm run test:pending-see
 */
import {
  isPublishedTaskPendingSettlement,
  getEventPaymentStatusLabel,
} from '../utils/taskStatus'
import type { Task } from '../utils/api'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

function testIsPublishedTaskPendingSettlement() {
  const base = { status: 'completed', transferredAt: undefined } as Task
  assert(isPublishedTaskPendingSettlement(base, false) === true, '应识别待转账')
  assert(isPublishedTaskPendingSettlement({ ...base, transferredAt: '2026-01-01' }, false) === false, '已标记应排除')
  assert(isPublishedTaskPendingSettlement(base, true) === false, '有链上记录应排除')
  assert(isPublishedTaskPendingSettlement({ status: 'claimed' } as Task, false) === false, '未完成应排除')
  console.log('[OK] isPublishedTaskPendingSettlement')
}

function testGetEventPaymentStatusLabel() {
  assert(getEventPaymentStatusLabel('pending') === '待付款', 'pending 文案')
  assert(getEventPaymentStatusLabel('partial') === '付款不足', 'partial 文案')
  assert(getEventPaymentStatusLabel('pending_transfer') === '待转账', 'pending_transfer 文案')
  console.log('[OK] getEventPaymentStatusLabel')
}

function main() {
  testIsPublishedTaskPendingSettlement()
  testGetEventPaymentStatusLabel()
  console.log('\nAll frontend pending-see tests passed.')
}

main()
