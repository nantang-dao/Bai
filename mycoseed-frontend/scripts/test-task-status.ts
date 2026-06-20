import type { Task } from '../utils/api'
import {
  mapPublishedTaskToFilter,
  mapClaimedTaskToFilter,
  getTaskStatusText,
} from '../utils/taskStatus'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

function makeTask(partial: Partial<Task> & Pick<Task, 'id' | 'status'>): Task {
  return {
    activityId: 1,
    title: '测试任务',
    description: '',
    reward: 1,
    ...partial,
  } as Task
}

// 发布任务：待审核
assert(
  mapPublishedTaskToFilter(makeTask({ id: '1', status: 'submitted' })) === 'unsubmit',
  'submitted → unsubmit'
)

// 领取任务：审核中
assert(
  mapClaimedTaskToFilter(makeTask({ id: '2', status: 'under_review', claimerId: 'u1' })) === 'reviewing',
  'under_review → reviewing'
)

// 领取任务：待提交
assert(
  mapClaimedTaskToFilter(makeTask({ id: '3', status: 'unsubmit', claimerId: 'u1' })) === 'to_submit',
  'unsubmit → to_submit'
)

// 领取任务：已驳回
assert(
  mapClaimedTaskToFilter(makeTask({
    id: '4',
    status: 'rejected',
    claimerId: 'u1',
    rejectOption: 'rejected',
  })) === 'rejected',
  'rejected → rejected'
)

// 领取任务：已过期（过了提交截止）
const past = new Date()
past.setDate(past.getDate() - 1)
const deadlineStr = past.toISOString().slice(0, 16)
assert(
  mapClaimedTaskToFilter(makeTask({
    id: '5',
    status: 'unsubmit',
    claimerId: 'u1',
    submitDeadline: deadlineStr,
  })) === 'expired',
  'overdue unsubmit → expired'
)

// 状态文案
assert(
  getTaskStatusText('under_review', makeTask({ id: '6', status: 'under_review' })) === '审核中',
  'status text 审核中'
)

console.log('taskStatus tests passed')
