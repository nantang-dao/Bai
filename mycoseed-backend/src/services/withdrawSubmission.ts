import { TaskStatus } from '../types/task'

export type WithdrawSubmissionErrorCode =
  | 'UNAUTHORIZED'
  | 'NOT_CLAIMER'
  | 'INVALID_STATUS'
  | 'NO_PROOF'
  | 'DEADLINE_PASSED'

export type WithdrawSubmissionValidationResult =
  | { ok: true }
  | { ok: false; code: WithdrawSubmissionErrorCode; message: string }

const WITHDRAWABLE_STATUSES: TaskStatus[] = ['submitted']

/**
 * 将时间字符串解析为 Date（YYYY-MM-DDTHH:mm 视为北京时间 UTC+8）
 */
export function parseBeijingDateTime(dateString: string | null | undefined): Date | null {
  if (!dateString) return null

  const cleanDateString = dateString.replace(/Z$|[+-]\d{2}:?\d{2}$/, '')
  const match = cleanDateString.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)

  if (match) {
    const [, year, month, day, hour, minute] = match.map(Number)
    const utcDate = new Date(Date.UTC(year, month - 1, day, hour, minute))
    return new Date(utcDate.getTime() - 8 * 60 * 60 * 1000)
  }

  const date = new Date(dateString)
  return isNaN(date.getTime()) ? null : date
}

/**
 * 提交截止是否已过（submit_deadline 按北京时间比较）
 */
export function isSubmitDeadlinePassed(
  submitDeadline: string | null | undefined,
  now: Date = new Date()
): boolean {
  const deadline = parseBeijingDateTime(submitDeadline)
  if (!deadline) return false
  return now.getTime() > deadline.getTime()
}

export function validateWithdrawSubmission(input: {
  userId: string | undefined
  claimerId: string | null | undefined
  status: string
  proof: string | null | undefined
  submitDeadline: string | null | undefined
  now?: Date
}): WithdrawSubmissionValidationResult {
  if (!input.userId) {
    return { ok: false, code: 'UNAUTHORIZED', message: '未授权' }
  }

  if (!input.claimerId || input.claimerId !== input.userId) {
    return { ok: false, code: 'NOT_CLAIMER', message: '您不是该任务的领取者，无权撤回提交' }
  }

  if (!WITHDRAWABLE_STATUSES.includes(input.status as TaskStatus)) {
    return {
      ok: false,
      code: 'INVALID_STATUS',
      message: '任务状态不正确，只有已提交状态才能撤回'
    }
  }

  if (!input.proof) {
    return { ok: false, code: 'NO_PROOF', message: '没有可撤回的提交内容' }
  }

  if (isSubmitDeadlinePassed(input.submitDeadline, input.now)) {
    return {
      ok: false,
      code: 'DEADLINE_PASSED',
      message: '已超过提交截止时间，无法撤回'
    }
  }

  return { ok: true }
}
