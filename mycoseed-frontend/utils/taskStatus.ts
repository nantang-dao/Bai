import type { Task } from '~/utils/api'
import { parseBeijingTime, getCurrentBeijingDate } from '~/utils/time'

type TimelineStatus = Task['status'] | 'resubmit' | 'reclaim'

/** 检查任务是否已领取 */
export function isTaskClaimed(task: Task): boolean {
  return !!task.claimerId
}

/** 检查任务是否已过期（过了领取截止日期） */
export function isTaskExpired(task: Task): boolean {
  if (!task.deadline) return false

  const deadline = parseBeijingTime(task.deadline)
  if (!deadline) return false

  const now = getCurrentBeijingDate()
  if (now.getTime() <= deadline.getTime()) return false

  if (task.participantLimit && task.participantLimit > 1) return true
  return !isTaskClaimed(task)
}

/** 检查任务是否已截止（过了提交截止日期且已领取但未完成/未在审核中） */
export function isTaskOverdue(task: Task): boolean {
  const submitDeadline = task.submitDeadline
  if (!submitDeadline) {
    if (!task.deadline) return false
    const deadline = parseBeijingTime(task.deadline)
    if (!deadline) return false
    const now = getCurrentBeijingDate()
    const isClaimed = !!task.claimerId
    const isNotSubmitted = task.status !== 'completed' && task.status !== 'submitted' && task.status !== 'under_review'
    return now.getTime() > deadline.getTime() && isClaimed && isNotSubmitted
  }

  const deadline = parseBeijingTime(submitDeadline)
  if (!deadline) return false

  const now = getCurrentBeijingDate()
  const isClaimed = !!task.claimerId
  const isNotSubmitted = task.status !== 'completed' && task.status !== 'under_review'
  return now.getTime() > deadline.getTime() && isClaimed && isNotSubmitted
}

/** 检查任务是否被终止（永久驳回） */
export function isTaskRejected(task: Task): boolean {
  if (task.timeline && Array.isArray(task.timeline) && task.timeline.length > 0) {
    const lastStatus = task.timeline[task.timeline.length - 1]
    return lastStatus.status === 'rejected'
  }
  return task.status === 'rejected' && task.rejectOption === 'rejected'
}

/** 从时间线获取最新状态 */
export function getLatestStatusFromTimeline(task: Task): TimelineStatus | null {
  if (task.timeline && Array.isArray(task.timeline) && task.timeline.length > 0) {
    const lastStatus = task.timeline[task.timeline.length - 1]
    return lastStatus.status as TimelineStatus
  }
  return null
}

/** 检查多人任务是否未领完 */
export function isTaskNotFullyClaimed(task: Task): boolean {
  if (task.participantLimit && task.participantLimit > 1) {
    const currentParticipants = task.participantsList?.filter(p => p.claimerId && p.claimedAt).length || 0
    return currentParticipants < task.participantLimit
  }
  return false
}

/** 发布任务 Tab：映射到任务广场同款筛选（可领取/待审核/已完成/已失效） */
export function mapPublishedTaskToFilter(task: Task): string {
  if (isTaskOverdue(task)) return 'expired'
  if (isTaskExpired(task)) return 'expired'
  if (isTaskRejected(task)) return 'expired'

  if (isTaskNotFullyClaimed(task)) return 'pending'

  const latestStatus = getLatestStatusFromTimeline(task)
  if (latestStatus) {
    if (latestStatus === 'unclaimed' || latestStatus === 'reclaim') return 'pending'
    if (latestStatus === 'claimed' || latestStatus === 'unsubmit' || latestStatus === 'submitted' || latestStatus === 'under_review' || latestStatus === 'resubmit') {
      return 'unsubmit'
    }
    if (latestStatus === 'completed') return 'completed'
    if (latestStatus === 'rejected') return 'expired'
  }

  if (task.status === 'unclaimed' || isTaskNotFullyClaimed(task)) return 'pending'
  if (task.status === 'claimed' || task.status === 'unsubmit' || task.status === 'submitted' || task.status === 'under_review') {
    return 'unsubmit'
  }
  if (task.status === 'completed') return 'completed'
  if (task.status === 'rejected') return 'expired'

  return task.status
}

/** 发布者视角：是否待转账（已完成、未标记、无链上记录） */
export function isPublishedTaskPendingSettlement(
  task: Task,
  hasChainTx?: boolean
): boolean {
  if (task.status !== 'completed') return false
  if (task.transferredAt) return false
  if (hasChainTx) return false
  return true
}

/** 活动待结清状态文案 */
export function getEventPaymentStatusLabel(status: 'pending' | 'partial' | 'pending_transfer'): string {
  if (status === 'partial') return '付款不足'
  if (status === 'pending_transfer') return '待转账'
  return '待付款'
}

/** 领取任务 Tab：待提交/审核中/已完成/已驳回/已过期 */
export function mapClaimedTaskToFilter(task: Task): string {
  if (task.status === 'completed') return 'completed'
  if (isTaskRejected(task)) return 'rejected'
  if (isTaskOverdue(task)) return 'expired'
  if (isTaskExpired(task)) return 'expired'

  const latestStatus = getLatestStatusFromTimeline(task)
  if (latestStatus === 'submitted' || latestStatus === 'under_review') return 'reviewing'
  if (latestStatus === 'claimed' || latestStatus === 'unsubmit' || latestStatus === 'resubmit') return 'to_submit'
  if (latestStatus === 'rejected') return 'rejected'

  if (task.status === 'submitted' || task.status === 'under_review') return 'reviewing'
  if (task.status === 'claimed' || task.status === 'unsubmit') return 'to_submit'
  if (task.status === 'rejected') return 'rejected'

  return 'to_submit'
}

/** 任务状态展示文案（与任务广场一致） */
export function getTaskStatusText(status: string, task?: Task): string {
  if (task) {
    if (isTaskOverdue(task)) return '已截止'
    if (isTaskExpired(task)) return '已过期'
    if (isTaskRejected(task)) return '已终止'

    if (task.participantLimit && task.participantLimit > 1 && task.participantsList) {
      const allCompleted = task.participantsList.every(p => p.status === 'completed' || p.status === 'rejected')
      if (allCompleted && task.participantsList.length > 0) {
        const hasCompleted = task.participantsList.some(p => p.status === 'completed')
        return hasCompleted ? '已完成' : '已终止'
      }
    }

    if (isTaskNotFullyClaimed(task)) return '未领完'
  }

  const statusMap: Record<string, string> = {
    unclaimed: '未领取',
    claimed: '已领取',
    unsubmit: '待提交',
    submitted: '已提交',
    under_review: '审核中',
    completed: '已完成',
    rejected: '已终止',
  }
  return statusMap[status] || '未知'
}

/** 成员页任务卡片状态徽章样式 */
export function getTaskStatusBadgeClass(status: string, task?: Task): string {
  const base = 'font-bold text-[10px] px-2 py-0.5 rounded border'
  const text = task ? getTaskStatusText(status, task) : status

  if (text === '已完成' || text === '已转账') {
    return `${base} border-green-600 text-green-600 bg-green-50`
  }
  if (text === '已终止' || text === '已驳回') {
    return `${base} border-red-600 text-red-600 bg-destructive-50`
  }
  if (text === '已截止' || text === '已过期') {
    return `${base} border-gray-600 text-gray-600 bg-gray-50`
  }
  if (text === '审核中' || text === '已提交') {
    return `${base} border-orange-600 text-orange-600 bg-orange-50`
  }
  if (text === '待提交' || text === '已领取' || text === '进行中') {
    return `${base} border-blue-600 text-blue-600 bg-blue-50`
  }
  if (text === '未领取' || text === '未领完') {
    return `${base} border-yellow-600 text-yellow-600 bg-yellow-50`
  }
  return `${base} border-gray-600 text-gray-600 bg-gray-50`
}
