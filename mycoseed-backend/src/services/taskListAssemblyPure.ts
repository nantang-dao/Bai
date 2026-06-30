import { Task } from '../types/task'
import { deriveGroupedPlazaStatus } from './taskPlazaListPure'

export const TASK_ROW_SELECT =
  'id, task_info_id, creator_id, claimer_id, reward, currency, weight_coefficient, participant_index, status, completed_at, transferred_at, created_at, updated_at'

export type TaskRow = {
  id: string
  task_info_id: string
  creator_id: string | null
  claimer_id: string | null
  reward: number | string
  currency: string
  weight_coefficient: number | string
  participant_index: number
  status: string
  completed_at: string | null
  transferred_at: string | null
  created_at: string
  updated_at: string
}

export type TaskWithRelations = TaskRow & {
  task_info?: any
  creator?: { id: string; name: string; avatar?: string } | null
  claimer?: { id: string; name: string; avatar?: string } | null
  task_timeline?: { timeline: unknown[] }
  task_proof?: any
}

type MapDbTaskFn = (
  dbTask: any,
  taskInfo?: any,
  taskTimeline?: any,
  taskProof?: any,
  tags?: { id: string; name: string; colorHex: string }[]
) => Task

/** 任务广场：按 task_info 分组（多人任务合并为一张卡片） */
export function buildGroupedPlazaTasks(
  tasksWithInfo: TaskWithRelations[],
  taskTagsMap: Record<string, { id: string; name: string; colorHex: string }[]>,
  mapDbTaskToTask: MapDbTaskFn
): Task[] {
  const taskGroups: Record<string, TaskWithRelations[]> = {}
  tasksWithInfo.forEach(task => {
    const key = task.task_info_id
    if (!taskGroups[key]) taskGroups[key] = []
    taskGroups[key].push(task)
  })

  return Object.values(taskGroups).map(taskGroup => {
    const firstTask = taskGroup[0]
    const taskInfo = firstTask.task_info
    const taskTags = taskInfo ? taskTagsMap[taskInfo.id] || [] : []

    if (taskInfo?.participant_limit && taskInfo.participant_limit > 1) {
      const participants = taskGroup.map(t =>
        mapDbTaskToTask(t, taskInfo, t.task_timeline, t.task_proof, taskTags)
      ).map(participantTask => ({
        id: participantTask.id,
        name: (participantTask as any).claimerName || '未领取',
        claimerId: participantTask.claimerId || undefined,
        claimedAt: participantTask.claimedAt || '',
        submittedAt: participantTask.submittedAt,
        proof: participantTask.proof,
        status: participantTask.status,
        reward: participantTask.reward,
        currency: participantTask.currency,
      }))

      const representativeTask = mapDbTaskToTask(
        firstTask,
        taskInfo,
        firstTask.task_timeline,
        firstTask.task_proof,
        taskTags
      )
      ;(representativeTask as any).participantsList = participants
      representativeTask.status = deriveGroupedPlazaStatus(taskInfo.participant_limit, taskGroup) as any
      return representativeTask
    }

    return mapDbTaskToTask(firstTask, taskInfo, firstTask.task_timeline, firstTask.task_proof, taskTags)
  })
}

/** 我的主页：每个 task 行单独一条（不按 task_info 合并） */
export function buildFlatProfileTasks(
  tasksWithInfo: TaskWithRelations[],
  taskTagsMap: Record<string, { id: string; name: string; colorHex: string }[]>,
  mapDbTaskToTask: MapDbTaskFn
): Task[] {
  return tasksWithInfo.map(task => {
    const taskInfo = task.task_info
    const taskTags = taskInfo ? taskTagsMap[taskInfo.id] || [] : []
    return mapDbTaskToTask(task, taskInfo, task.task_timeline, task.task_proof, taskTags)
  })
}
