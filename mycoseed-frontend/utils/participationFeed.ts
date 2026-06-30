import type {
  Task,
  EventParticipationItem,
  EventPublicationItem,
  PendingPaymentItem,
} from '~/utils/api'
import {
  mapPublishedTaskToFilter,
  mapClaimedTaskToFilter,
  isPublishedTaskPendingSettlement,
} from '~/utils/taskStatus'

export type FeedItemKind = 'task' | 'event'

export interface StandardFeedItem {
  id: string
  kind: FeedItemKind
  title: string
  sortAt: string
  sourceUrl: string
  statusText?: string
  statusBadgeClass?: string
  needsPayment: boolean
  amountLabel?: string
  dateLabel?: string
  description?: string
  /** 原始任务（kind=task 时） */
  task?: Task
  /** 原始活动（kind=event 时） */
  event?: EventParticipationItem | EventPublicationItem
}

export interface PendingFeedItem {
  id: string
  type: PendingPaymentItem['type']
  title: string
  amount: string
  status: PendingPaymentItem['status']
  sourceUrl: string
  sortAt: string
  typeLabel: string
}

function parseSortTime(iso: string): number {
  const t = new Date(iso).getTime()
  return Number.isNaN(t) ? 0 : t
}

function sortFeedDesc(items: StandardFeedItem[]): StandardFeedItem[] {
  return [...items].sort((a, b) => parseSortTime(b.sortAt) - parseSortTime(a.sortAt))
}

function eventNeedsPayment(ev: EventParticipationItem): boolean {
  return ev.paymentStatus === 'pending' || ev.paymentStatus === 'partial'
}

function formatRelativeTime(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor(diff / (1000 * 60))
  if (days > 0) return `${days}天前`
  if (hours > 0) return `${hours}小时前`
  if (minutes > 0) return `${minutes}分钟前`
  return '刚刚'
}

/** 我参与的：任务 + 报名活动混排；filter !== 'all' 时隐藏活动（方案 A） */
export function buildAcceptedFeed(
  tasks: Task[],
  events: EventParticipationItem[],
  activeFilter: string,
  getTaskStatusText: (status: string, task: Task) => string,
  getTaskStatusBadgeClass: (status: string, task: Task) => string,
  formatTaskDate: (task: Task) => string
): StandardFeedItem[] {
  const showEvents = activeFilter === 'all'

  const taskItems: StandardFeedItem[] = tasks.map((task) => ({
    id: `task-${task.id}`,
    kind: 'task',
    title: task.title,
    sortAt: task.claimedAt || task.updatedAt || task.createdAt,
    sourceUrl: `/tasks/${task.id}`,
    statusText: task.status !== 'completed' ? getTaskStatusText(task.status, task) : undefined,
    statusBadgeClass: task.status !== 'completed' ? getTaskStatusBadgeClass(task.status, task) : undefined,
    needsPayment: false,
    dateLabel: formatTaskDate(task),
    description: task.description,
    task,
  }))

  const eventItems: StandardFeedItem[] = showEvents
    ? events.map((ev) => ({
        id: `event-${ev.eventId}`,
        kind: 'event' as const,
        title: ev.title,
        sortAt: ev.sortAt,
        sourceUrl: ev.sourceUrl,
        needsPayment: eventNeedsPayment(ev),
        amountLabel: ev.amount ? `${ev.amount} 积分` : undefined,
        dateLabel: `报名于 ${formatRelativeTime(ev.registeredAt)}`,
        event: ev,
      }))
    : []

  return sortFeedDesc([...taskItems, ...eventItems])
}

/** 我发布的：任务 + 发起活动混排；filter !== 'all' 时隐藏活动（方案 A） */
export function buildPublishedFeed(
  tasks: Task[],
  events: EventPublicationItem[],
  activeFilter: string,
  hasChainTxMap: Record<string, boolean>,
  getTaskStatusText: (status: string, task: Task) => string,
  getTaskStatusBadgeClass: (status: string, task: Task) => string,
  formatTaskDate: (task: Task) => string
): StandardFeedItem[] {
  const showEvents = activeFilter === 'all'

  const taskItems: StandardFeedItem[] = tasks.map((task) => {
    const needsPayment = isPublishedTaskPendingSettlement(task, !!hasChainTxMap[task.id])
    return {
      id: `task-${task.id}`,
      kind: 'task' as const,
      title: task.title,
      sortAt: task.updatedAt || task.createdAt,
      sourceUrl: `/tasks/${task.id}`,
      statusText: task.status !== 'completed' ? getTaskStatusText(task.status, task) : undefined,
      statusBadgeClass: task.status !== 'completed' ? getTaskStatusBadgeClass(task.status, task) : undefined,
      needsPayment,
      dateLabel: formatTaskDate(task),
      description: task.description,
      task,
    }
  })

  const eventItems: StandardFeedItem[] = showEvents
    ? events.map((ev) => ({
        id: `event-${ev.eventId}`,
        kind: 'event' as const,
        title: ev.title,
        sortAt: ev.sortAt,
        sourceUrl: ev.sourceUrl,
        needsPayment: false,
        dateLabel: `创建于 ${formatRelativeTime(ev.createdAt)}`,
        event: ev,
      }))
    : []

  return sortFeedDesc([...taskItems, ...eventItems])
}

/** 待付款 Tab：合并 asPublisher + asParticipant */
export function buildPendingPaymentFeed(
  asPublisher: PendingPaymentItem[],
  asParticipant: PendingPaymentItem[]
): PendingFeedItem[] {
  const mapItem = (item: PendingPaymentItem): PendingFeedItem => ({
    id: `${item.type}-${item.id}`,
    type: item.type,
    title: item.title,
    amount: item.amount,
    status: item.status,
    sourceUrl: item.sourceUrl,
    sortAt: item.sortAt,
    typeLabel: item.type === 'task_payout' ? '任务结算' : '活动报名',
  })

  return [...asPublisher.map(mapItem), ...asParticipant.map(mapItem)].sort(
    (a, b) => parseSortTime(b.sortAt) - parseSortTime(a.sortAt)
  )
}

/** 筛选我发布的任务（活动由 buildPublishedFeed 方案 A 处理） */
export function filterPublishedTasks(tasks: Task[], activeFilter: string, hasChainTxMap: Record<string, boolean>): Task[] {
  if (activeFilter === 'all') return tasks
  if (activeFilter === 'pending_payment') {
    return tasks.filter((t) => isPublishedTaskPendingSettlement(t, !!hasChainTxMap[t.id]))
  }
  return tasks.filter((t) => mapPublishedTaskToFilter(t) === activeFilter)
}

/** 筛选我参与的任务 */
export function filterAcceptedTasks(tasks: Task[], activeFilter: string): Task[] {
  if (activeFilter === 'all') return tasks
  return tasks.filter((t) => mapClaimedTaskToFilter(t) === activeFilter)
}
