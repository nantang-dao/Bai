/**
 * 个人中心混排 Feed 单元测试
 * npm run test:participation-feed
 */
import type { Task, EventParticipationItem, EventPublicationItem } from '../utils/api'
import {
  buildAcceptedFeed,
  buildPublishedFeed,
  buildPendingPaymentFeed,
  filterPublishedTasks,
} from '../utils/participationFeed'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

const stubTask = (overrides: Partial<Task> = {}): Task =>
  ({
    id: 't1',
    title: '测试任务',
    status: 'claimed',
    creatorId: 'u1',
    claimerId: 'u2',
    createdAt: '2026-06-01T10:00:00Z',
    updatedAt: '2026-06-02T10:00:00Z',
    claimedAt: '2026-06-01T12:00:00Z',
    ...overrides,
  }) as Task

const stubEvent = (overrides: Partial<EventParticipationItem> = {}): EventParticipationItem => ({
  participationId: 'p1',
  eventId: 'e1',
  communityId: 'c1',
  title: '测试活动',
  registeredAt: '2026-06-03T10:00:00Z',
  amount: '10',
  paymentStatus: 'pending',
  sourceUrl: '/community/c1/events/e1',
  sortAt: '2026-06-03T10:00:00Z',
  ...overrides,
})

function testAcceptedFeedAllShowsBoth() {
  const feed = buildAcceptedFeed(
    [stubTask()],
    [stubEvent()],
    'all',
    () => '进行中',
    () => 'badge',
    () => '1天前'
  )
  assert(feed.length === 2, '全部应含任务+活动')
  assert(feed[0].kind === 'event', '较新的活动应排前')
  console.log('[OK] acceptedFeedAllShowsBoth')
}

function testAcceptedFeedFilterHidesEvents() {
  const feed = buildAcceptedFeed(
    [stubTask()],
    [stubEvent()],
    'to_submit',
    () => '待提交',
    () => 'badge',
    () => '1天前'
  )
  assert(feed.length === 1, '非全部筛选应隐藏活动')
  assert(feed[0].kind === 'task', '只剩任务')
  console.log('[OK] acceptedFeedFilterHidesEvents')
}

function testPublishedFeedPendingPayment() {
  const completed = stubTask({ status: 'completed', id: 't2' })
  const feed = buildPublishedFeed(
    [completed],
    [],
    'all',
    {},
    () => '',
    () => '',
    () => ''
  )
  assert(feed[0].needsPayment === true, '已完成未转账应标待付款')
  console.log('[OK] publishedFeedPendingPayment')
}

function testPendingPaymentFeedMerge() {
  const feed = buildPendingPaymentFeed(
    [
      {
        type: 'task_payout',
        id: 't1',
        title: '任务A',
        amount: '50',
        status: 'pending_transfer',
        sourceUrl: '/tasks/t1',
        sortAt: '2026-06-01T10:00:00Z',
      },
    ],
    [
      {
        type: 'event_registration',
        id: 'p1',
        title: '活动B',
        amount: '10',
        status: 'pending',
        sourceUrl: '/community/c1/events/e1',
        sortAt: '2026-06-03T10:00:00Z',
      },
    ]
  )
  assert(feed.length === 2, '应合并两类待付款')
  assert(feed[0].title === '活动B', '按时间排序')
  console.log('[OK] pendingPaymentFeedMerge')
}

function testFilterPublishedTasksPendingPayment() {
  const tasks = [
    stubTask({ status: 'completed', id: 'c1' }),
    stubTask({ status: 'claimed', id: 'c2' }),
  ]
  const filtered = filterPublishedTasks(tasks, 'pending_payment', {})
  assert(filtered.length === 1 && filtered[0].id === 'c1', '待付款筛只留待转账')
  console.log('[OK] filterPublishedTasksPendingPayment')
}

function main() {
  testAcceptedFeedAllShowsBoth()
  testAcceptedFeedFilterHidesEvents()
  testPublishedFeedPendingPayment()
  testPendingPaymentFeedMerge()
  testFilterPublishedTasksPendingPayment()
  console.log('\nAll participation-feed tests passed.')
}

main()
