import { supabase } from './supabase'
import {
  type TaskRow,
  type TaskWithRelations,
  buildGroupedPlazaTasks,
  buildFlatProfileTasks,
  TASK_ROW_SELECT,
} from './taskListAssemblyPure'

export {
  TASK_ROW_SELECT,
  type TaskRow,
  type TaskWithRelations,
  buildGroupedPlazaTasks,
  buildFlatProfileTasks,
} from './taskListAssemblyPure'

/** 批量加载 task_info / tags / timeline / proof / users，组装带关联数据的任务行 */
export async function enrichTaskRows(tasksData: TaskRow[]): Promise<{
  tasksWithInfo: TaskWithRelations[]
  taskTagsMap: Record<string, { id: string; name: string; colorHex: string }[]>
}> {
  if (!tasksData.length) {
    return { tasksWithInfo: [], taskTagsMap: {} }
  }

  const taskInfoIds = [...new Set(tasksData.filter(t => t.task_info_id).map(t => t.task_info_id))]

  let taskInfoMap: Record<string, any> = {}
  if (taskInfoIds.length > 0) {
    const { data: taskInfosData } = await supabase.from('task_info').select('*').in('id', taskInfoIds)
    if (taskInfosData) {
      taskInfoMap = taskInfosData.reduce((acc, info) => {
        acc[info.id] = info
        return acc
      }, {} as Record<string, any>)
    }
  }

  let taskTagsMap: Record<string, { id: string; name: string; colorHex: string }[]> = {}
  if (taskInfoIds.length > 0) {
    const { data: tagLinks } = await supabase
      .from('task_info_tags')
      .select('task_info_id, tag_id, community_task_tags ( id, name, color_hex )')
      .in('task_info_id', taskInfoIds)
    if (tagLinks && tagLinks.length > 0) {
      for (const link of tagLinks as any[]) {
        const t = link.community_task_tags
        if (!t) continue
        if (!taskTagsMap[link.task_info_id]) taskTagsMap[link.task_info_id] = []
        taskTagsMap[link.task_info_id].push({ id: t.id, name: t.name, colorHex: t.color_hex })
      }
    }
  }

  const taskIds = tasksData.map(t => t.id)
  let timelinesMap: Record<string, any> = {}
  if (taskIds.length > 0) {
    const { data: timelinesData } = await supabase
      .from('task_timelines')
      .select('task_id, timeline')
      .in('task_id', taskIds)
    if (timelinesData) {
      timelinesMap = timelinesData.reduce((acc, t) => {
        acc[t.task_id] = t
        return acc
      }, {} as Record<string, any>)
    }
  }

  let proofsMap: Record<string, any> = {}
  if (taskIds.length > 0) {
    const { data: proofsData } = await supabase
      .from('task_proofs')
      .select('task_id, proof, reject_reason, reject_option, discount, discount_reason')
      .in('task_id', taskIds)
    if (proofsData) {
      proofsMap = proofsData.reduce((acc, p) => {
        acc[p.task_id] = p
        return acc
      }, {} as Record<string, any>)
    }
  }

  const creatorIdsFromTasks = [...new Set(tasksData.filter(t => t.creator_id).map(t => t.creator_id!))]
  const creatorIdsFromInfo = [
    ...new Set(Object.values(taskInfoMap).filter((info: any) => info.creator_id).map((info: any) => info.creator_id)),
  ]
  const creatorIds = [...new Set([...creatorIdsFromTasks, ...creatorIdsFromInfo])]
  const claimerIds = [...new Set(tasksData.filter(t => t.claimer_id).map(t => t.claimer_id!))]
  const allUserIds = [...new Set([...creatorIds, ...claimerIds])]

  let usersMap: Record<string, { id: string; name: string; avatar?: string }> = {}
  if (allUserIds.length > 0) {
    const { data: usersData } = await supabase.from('users').select('id, name, avatar').in('id', allUserIds)
    if (usersData) {
      usersMap = usersData.reduce((acc, user) => {
        acc[user.id] = user
        return acc
      }, {} as Record<string, { id: string; name: string; avatar?: string }>)
    }
  }

  const tasksWithInfo: TaskWithRelations[] = tasksData
    .filter(task => {
      if (!task.task_info_id) return false
      return !!taskInfoMap[task.task_info_id]
    })
    .map(task => {
      const taskInfo = taskInfoMap[task.task_info_id]
      const creatorUser =
        (task.creator_id ? usersMap[task.creator_id] : null) ||
        (taskInfo?.creator_id ? usersMap[taskInfo.creator_id] : null)
      return {
        ...task,
        task_info: taskInfo,
        creator: creatorUser,
        claimer: task.claimer_id ? usersMap[task.claimer_id] : null,
        task_timeline: timelinesMap[task.id] || { timeline: [] },
        task_proof: proofsMap[task.id] || null,
      }
    })

  return { tasksWithInfo, taskTagsMap }
}
