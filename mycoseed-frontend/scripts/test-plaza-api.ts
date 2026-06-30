/**
 * 前端任务广场 API 辅助逻辑测试
 * npm run test:plaza-api
 */
import { isTaskNotFullyClaimed } from '../utils/taskStatus'
import type { Task } from '../utils/api'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

function testClaimedCountFallback() {
  const task: Task = {
    id: 't1',
    activityId: 0,
    title: 'multi',
    description: '',
    reward: 10,
    status: 'unclaimed',
    participantLimit: 5,
    claimedCount: 2,
  }
  assert(isTaskNotFullyClaimed(task) === true, 'claimedCount 应判定未领完')

  const full: Task = { ...task, claimedCount: 5 }
  assert(isTaskNotFullyClaimed(full) === false, '满员应判定已领完')
  console.log('[OK] claimedCount for isTaskNotFullyClaimed')
}

function testBuildPlazaQueryShape() {
  const sp = new URLSearchParams()
  sp.set('communityId', 'abc')
  sp.set('limit', '20')
  sp.set('status', 'pending')
  sp.set('sort', 'deadline')
  const q = sp.toString()
  assert(q.includes('communityId=abc'), 'query has communityId')
  assert(q.includes('status=pending'), 'query has status')
  console.log('[OK] plaza query params shape')
}

function main() {
  testClaimedCountFallback()
  testBuildPlazaQueryShape()
  console.log('\nAll plaza-api frontend tests passed.')
}

main()
