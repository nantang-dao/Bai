/**
 * 单元测试：撤回提交校验逻辑
 * npm run test:withdraw-submission
 */
import {
  validateWithdrawSubmission,
  isSubmitDeadlinePassed,
  parseBeijingDateTime,
} from '../src/services/withdrawSubmission'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

function testParseBeijingDateTime() {
  const d = parseBeijingDateTime('2026-06-18T18:00')
  assert(d !== null, '应能解析北京时间')
  // 北京时间 18:00 = UTC 10:00
  assert(d!.getUTCHours() === 10, `期望 UTC 10 点，实际 ${d!.getUTCHours()}`)
  console.log('[OK] parseBeijingDateTime')
}

function testIsSubmitDeadlinePassed() {
  const deadline = '2099-01-01T23:59'
  assert(!isSubmitDeadlinePassed(deadline), '未来截止不应算过期')
  assert(isSubmitDeadlinePassed('2000-01-01T00:00'), '过去截止应算过期')
  assert(!isSubmitDeadlinePassed(null), '无截止不应算过期')
  console.log('[OK] isSubmitDeadlinePassed')
}

function testValidateWithdrawSubmission() {
  const base = {
    userId: 'user-1',
    claimerId: 'user-1',
    status: 'submitted',
    proof: '{"description":"hi"}',
    submitDeadline: '2099-12-31T23:59',
  }

  assert(validateWithdrawSubmission(base).ok === true, '正常应通过')

  const noAuth = validateWithdrawSubmission({ ...base, userId: undefined })
  assert(noAuth.ok === false && noAuth.code === 'UNAUTHORIZED', '未登录应拒绝')

  const notClaimer = validateWithdrawSubmission({ ...base, claimerId: 'other' })
  assert(notClaimer.ok === false && notClaimer.code === 'NOT_CLAIMER', '非领取者应拒绝')

  const badStatus = validateWithdrawSubmission({ ...base, status: 'completed' })
  assert(badStatus.ok === false && badStatus.code === 'INVALID_STATUS', '非 submitted 应拒绝')

  const noProof = validateWithdrawSubmission({ ...base, proof: null })
  assert(noProof.ok === false && noProof.code === 'NO_PROOF', '无 proof 应拒绝')

  const overdue = validateWithdrawSubmission({
    ...base,
    submitDeadline: '2000-01-01T00:00',
  })
  assert(overdue.ok === false && overdue.code === 'DEADLINE_PASSED', '超截止应拒绝')

  console.log('[OK] validateWithdrawSubmission')
}

function main() {
  testParseBeijingDateTime()
  testIsSubmitDeadlinePassed()
  testValidateWithdrawSubmission()
  console.log('\nAll withdraw-submission tests passed.')
}

main()
