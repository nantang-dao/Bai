import { Request, Response } from 'express'
import { supabase } from '../services/supabase'
import { Task, CreateTaskParams, TaskStatus, TimelineStatus } from '../types/task'
import { AuthRequest } from '../middleware/auth'
import { ensureDefaultTaskTags } from '../services/taskTagsSeed'
import { getMemberRole } from '../middleware/communityAdmin'
import { validateWithdrawSubmission } from '../services/withdrawSubmission'
import {
  TASK_ROW_SELECT,
  enrichTaskRows,
  buildGroupedPlazaTasks,
  buildFlatProfileTasks,
} from '../services/taskListAssembly'
import {
  fetchPlazaTasksPage,
  fetchAllPlazaTasks,
  fetchReviewTasksList,
  plazaItemsToApiTasks,
} from '../services/taskPlazaList'
import type { PlazaFilterTab, PlazaSortField } from '../services/taskPlazaListPure'

// ==================== 类型定义 ====================

/**
 * 扩展的数据库任务类型（包含动态添加的关联数据）
 * 用于处理从 Supabase 查询返回的任务数据，以及后续动态添加的关联表数据
 */
interface TaskDataWithRelations {
  id: any
  task_info_id: any
  creator_id: any
  claimer_id: any
  reward: any
  currency: any
  weight_coefficient: any
  participant_index: any
  status: any
  completed_at: any
  created_at: any
  updated_at: any
  // 动态添加的属性（从关联表获取）
  task_info?: any
  timeline?: any
  proof?: any
  reject_reason?: any
  reject_option?: any
  discount?: any
  discount_reason?: any
  creator?: any
  claimer?: any
  task_timeline?: any
  task_proof?: any
}

// ==================== 辅助函数 ====================

/**
 * 追加状态到时间线数组（仅追加写入）
 * 从 task_timelines 表读取和写入
 * @param taskId 任务ID
 * @param status 状态值
 * @param actorId 操作者ID（可选）
 * @param actorName 操作者名称（可选）
 * @param action 操作选项（可选，如 '审核驳回'、'重新提交' 等）
 * @param reason 操作理由（可选，如驳回原因、审核意见等）
 */
const appendStatusToTimeline = async (
  taskId: string, 
  status: TaskStatus | 'resubmit' | 'reclaim',
  actorId?: string,
  actorName?: string,
  action?: string,
  reason?: string
): Promise<void> => {
  try {
    console.log(`\n[TIMELINE] ========== 开始追加状态到时间线 ==========`)
    console.log(`[TIMELINE] 任务ID: ${taskId}`)
    console.log(`[TIMELINE] 新状态: ${status}`)
    console.log(`[TIMELINE] 操作者ID: ${actorId || '未知'}`)
    console.log(`[TIMELINE] 操作者: ${actorName || '未知'}`)
    console.log(`[TIMELINE] 操作选项: ${action || '无'}`)
    console.log(`[TIMELINE] 操作理由: ${reason || '无'}`)
    
    // 验证 taskId 是否有效
    if (!taskId || typeof taskId !== 'string') {
      console.error(`[TIMELINE] ❌ 无效的任务ID: ${taskId}`)
      throw new Error(`无效的任务ID: ${taskId}`)
    }
    
    // 验证该任务行是否存在（确保 taskId 是正确的任务行ID）
    const { data: taskRow, error: taskRowError } = await supabase
      .from('tasks')
      .select('id, claimer_id')
      .eq('id', taskId)
      .single()
    
    if (taskRowError || !taskRow) {
      console.error(`[TIMELINE] ❌ 任务行不存在: ${taskId}`, taskRowError)
      throw new Error(`任务行不存在: ${taskId}`)
    }
    
    console.log(`[TIMELINE] 验证: 任务行存在，claimer_id: ${taskRow.claimer_id || 'null'}`)
    
    // 获取或创建 task_timelines 记录（严格使用 task_id 匹配）
    let timelineData = null
    const { data: existingTimeline, error: fetchError } = await supabase
      .from('task_timelines')
      .select('task_id, timeline')
      .eq('task_id', taskId)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = not found
      console.error(`[TIMELINE] ❌ 获取时间线失败:`, fetchError)
      throw fetchError
    }

    // 验证获取到的时间线确实属于该任务行
    if (existingTimeline && existingTimeline.task_id !== taskId) {
      console.error(`[TIMELINE] ❌ 时间线任务ID不匹配! 期望: ${taskId}, 实际: ${existingTimeline.task_id}`)
      throw new Error(`时间线任务ID不匹配: 期望 ${taskId}, 实际 ${existingTimeline.task_id}`)
    }

    // 如果不存在，创建新记录
    if (!existingTimeline) {
      const { data: newTimeline, error: createError } = await supabase
        .from('task_timelines')
        .insert({ task_id: taskId, timeline: [] })
        .select('task_id, timeline')
        .single()
      
      if (createError) {
        console.error(`[TIMELINE] ❌ 创建时间线记录失败:`, createError)
        throw createError
      }
      
      // 再次验证创建的时间线
      if (newTimeline && newTimeline.task_id !== taskId) {
        console.error(`[TIMELINE] ❌ 创建的时间线任务ID不匹配! 期望: ${taskId}, 实际: ${newTimeline.task_id}`)
        throw new Error(`创建的时间线任务ID不匹配: 期望 ${taskId}, 实际 ${newTimeline.task_id}`)
      }
      
      timelineData = newTimeline
    } else {
      timelineData = existingTimeline
    }

    // 打印当前时间线状态
    const currentTimeline = (timelineData.timeline as TimelineStatus[]) || []
    const currentStatuses = currentTimeline.map(item => item.status)
    console.log(`[TIMELINE] 当前时间线长度: ${currentTimeline.length}`)
    console.log(`[TIMELINE] 当前时间线状态数组: [${currentStatuses.map(s => `"${s}"`).join(', ')}]`)
    
    if (currentTimeline.length > 0) {
      console.log(`[TIMELINE] 当前时间线详情:`)
      currentTimeline.forEach((item, index) => {
        console.log(`[TIMELINE]   [${index}] ${item.status} | ${item.action || '无操作'} | ${item.actorName || '未知'} | ${item.actorId || '无ID'} | ${item.timestamp}`)
      })
    }

    // 构建新状态项
    const newStatus: TimelineStatus = {
      status,
      timestamp: new Date().toISOString(),
      ...(actorId ? { actorId } : {}),
      ...(actorName ? { actorName } : {}),
      ...(action ? { action } : {}),
      ...(reason ? { reason } : {})
    }

    console.log(`[TIMELINE] 新状态项:`, JSON.stringify(newStatus, null, 2))

    // 追加到时间线数组
    const updatedTimeline = [...currentTimeline, newStatus]
    const updatedStatuses = updatedTimeline.map(item => item.status)
    console.log(`[TIMELINE] 更新后时间线长度: ${updatedTimeline.length}`)
    console.log(`[TIMELINE] 更新后时间线状态数组: [${updatedStatuses.map(s => `"${s}"`).join(', ')}]`)

    // 更新 task_timelines 表（严格使用 task_id 匹配，确保只更新一条记录）
    const { data: updateResult, error: updateError } = await supabase
      .from('task_timelines')
      .update({ timeline: updatedTimeline })
      .eq('task_id', taskId)
      .select('task_id, timeline')

    if (updateError) {
      console.error(`[TIMELINE] ❌ 更新时间线失败:`, updateError)
      console.error(`[TIMELINE] 错误详情:`, JSON.stringify(updateError, null, 2))
      throw updateError
    }
    
    // 验证更新结果
    if (updateResult && updateResult.length > 0) {
      const updatedRecord = updateResult[0]
      if (updatedRecord.task_id !== taskId) {
        console.error(`[TIMELINE] ❌ 更新后的时间线任务ID不匹配! 期望: ${taskId}, 实际: ${updatedRecord.task_id}`)
        throw new Error(`更新后的时间线任务ID不匹配: 期望 ${taskId}, 实际 ${updatedRecord.task_id}`)
      }
      
      const verifyTimeline = (updatedRecord.timeline as TimelineStatus[]) || []
      if (verifyTimeline.length !== updatedTimeline.length) {
        console.error(`[TIMELINE] ⚠️ 警告: 时间线长度不匹配! 期望: ${updatedTimeline.length}, 实际: ${verifyTimeline.length}`)
      }
      
      console.log(`[TIMELINE] ✅ 成功追加状态 ${status} 到任务行 ${taskId} 的时间线`)
      console.log(`[TIMELINE] 验证: 更新后的时间线长度: ${verifyTimeline.length}`)
    } else {
      console.error(`[TIMELINE] ⚠️ 警告: 更新操作没有返回任何记录`)
    }
    
    console.log(`[TIMELINE] ========== 追加状态完成 ==========\n`)
  } catch (error) {
    console.error(`[TIMELINE] ❌ 追加状态到时间线时出错:`, error)
    console.error(`[TIMELINE] 错误堆栈:`, error instanceof Error ? error.stack : '无堆栈信息')
    throw error // 重新抛出错误，让调用者知道操作失败
  }
}

/**
 * 更新任务状态（同时更新 tasks.status 和 task_timelines.timeline）
 * @param taskId 任务ID
 * @param newStatus 新状态
 * @param actorId 操作者ID（可选）
 * @param actorName 操作者名称（可选）
 * @param action 操作选项（可选）
 * @param reason 操作理由（可选）
 */
const updateTaskStatus = async (
  taskId: string,
  newStatus: TaskStatus | 'resubmit' | 'reclaim',
  actorId?: string,
  actorName?: string,
  action?: string,
  reason?: string
): Promise<void> => {
  try {
    console.log(`\n[STATUS UPDATE] ========== 更新任务状态 ==========`)
    console.log(`[STATUS UPDATE] 任务ID: ${taskId}`)
    console.log(`[STATUS UPDATE] 新状态: ${newStatus}`)
    
    // 1. 更新 tasks 表的 status
    const { error: statusError } = await supabase
      .from('tasks')
      .update({ status: newStatus })
      .eq('id', taskId)
    
    if (statusError) {
      console.error(`[STATUS UPDATE] ❌ 更新任务状态失败:`, statusError)
      throw statusError
    }
    
    console.log(`[STATUS UPDATE] ✅ 任务状态已更新为: ${newStatus}`)
    
    // 2. 追加状态到时间线
    await appendStatusToTimeline(taskId, newStatus, actorId, actorName, action, reason)
    
    console.log(`[STATUS UPDATE] ========== 状态更新完成 ==========\n`)
  } catch (error) {
    console.error(`[STATUS UPDATE] ❌ 更新任务状态时出错:`, error)
    throw error
  }
}

/**
 * 将数据库时间戳转换为北京时间字符串格式 YYYY-MM-DDTHH:mm
 * 统一使用 UTC 时间作为基准，然后 +8 小时转换为北京时间（UTC+8）
 * 不受机器时区影响
 */
const formatLocalDateTime = (timestamp: string | null | undefined): string | undefined => {
  if (!timestamp) return undefined

  // 1. 如果已经是 YYYY-MM-DDTHH:mm 格式，直接返回
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(timestamp)) {
    return timestamp
  }

  // 2. 解析时间（获取 UTC 时间戳）
  const date = new Date(timestamp)
  if (isNaN(date.getTime())) {
    console.warn(`[formatLocalDateTime] 无效的时间戳: ${timestamp}`)
    return undefined
  }

  // 3. 核心技巧：利用 getTime() 直接加 8 小时的毫秒数
  // 这样生成的新的 Date 对象会自动处理所有的跨日、跨月、跨年逻辑
  const beijingTime = new Date(date.getTime() + 8 * 60 * 60 * 1000)

  // 4. 格式化输出 (使用 UTC 方法读取，因为我们已经手动偏移了 8 小时)
  const year = beijingTime.getUTCFullYear()
  const month = String(beijingTime.getUTCMonth() + 1).padStart(2, '0')
  const day = String(beijingTime.getUTCDate()).padStart(2, '0')
  const hour = String(beijingTime.getUTCHours()).padStart(2, '0')
  const minute = String(beijingTime.getUTCMinutes()).padStart(2, '0')

  return `${year}-${month}-${day}T${hour}:${minute}`
}

/**
 * 统一解析时间字符串为 Date 对象（用于时间比较）
 * 将 YYYY-MM-DDTHH:mm 当作北京时间（UTC+8）处理，转换为 UTC 时间戳
 * 不受机器时区影响，统一使用 UTC 时间作为基准
 */
const parseLocalDateTime = (dateString: string | null | undefined): Date | null => {
  if (!dateString) return null
  
  // 去除时区后缀（Z, +08:00 等）
  const cleanDateString = dateString.replace(/Z$|[+-]\d{2}:?\d{2}$/, '')
  
  // 匹配 YYYY-MM-DDTHH:mm 格式
  const match = cleanDateString.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/)
  
  if (match) {
    const [_, year, month, day, hour, minute] = match.map(Number)
    // 将 YYYY-MM-DDTHH:mm 当作北京时间（UTC+8）
    // 使用 UTC 方法创建 Date 对象，然后减去 8 小时得到正确的 UTC 时间戳
    const utcDate = new Date(Date.UTC(year, month - 1, day, hour, minute))
    // 减去 8 小时（因为输入是 UTC+8 时间，需要转换为 UTC）
    return new Date(utcDate.getTime() - 8 * 60 * 60 * 1000)
  }
  
  // 兜底：尝试直接解析（向后兼容）
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return null
  return date
}

/**
 * 将数据库格式的任务转换为前端格式（适配新数据库结构）
 * 从 tasks, task_timelines, task_proofs 表获取数据
 */
const mapDbTaskToTask = (
  dbTask: any, 
  taskInfo?: any,
  taskTimeline?: any,
  taskProof?: any,
  tags?: { id: string; name: string; colorHex: string }[]
): Task & { creatorName?: string; creatorAvatar?: string; claimerId?: string; claimerName?: string } => {
  // 从 task_info 或 dbTask 中获取基本信息
  const info = taskInfo || dbTask.task_info || {}
  
  // 从 task_timelines 获取时间线
  const timeline = taskTimeline?.timeline || dbTask.timeline || []
  
  // 从 task_proofs 获取凭证和审核信息
  const proof = taskProof?.proof || dbTask.proof
  const receiverRemark = taskProof?.receiver_remark || (dbTask as any).receiver_remark
  const rejectReason = taskProof?.reject_reason || dbTask.reject_reason
  const rejectOption = taskProof?.reject_option || dbTask.reject_option
  const discount = taskProof?.discount ? parseFloat(taskProof.discount) : (dbTask.discount ? parseFloat(dbTask.discount) : undefined)
  const discountReason = taskProof?.discount_reason || dbTask.discount_reason
  
  // 从 timeline 中提取 claimed_at 和 submitted_at（最后一次操作的时间）
  let claimedAt: string | undefined = undefined
  let submittedAt: string | undefined = undefined
  if (Array.isArray(timeline)) {
    const claimedEvent = timeline.find((item: any) => item.status === 'claimed' || item.action === '领取任务')
    const submittedEvent = timeline.find((item: any) => item.status === 'submitted' || item.action === '提交凭证')
    if (claimedEvent?.timestamp) claimedAt = formatLocalDateTime(claimedEvent.timestamp)
    if (submittedEvent?.timestamp) submittedAt = formatLocalDateTime(submittedEvent.timestamp)
  }
  
  return {
  id: dbTask.id, // UUID 保持为字符串
    taskInfoId: dbTask.task_info_id,
    taskInfo: taskInfo ? {
      id: taskInfo.id,
      title: taskInfo.title,
      description: taskInfo.description,
      activityId: taskInfo.activity_id || 0,
      startDate: formatLocalDateTime(taskInfo.start_date),
      deadline: formatLocalDateTime(taskInfo.deadline),
      submitDeadline: formatLocalDateTime(taskInfo.submit_deadline),
      participantLimit: taskInfo.participant_limit ?? null,
      rewardDistributionMode: taskInfo.reward_distribution_mode || 'per_person',
      proofConfig: taskInfo.proof_config,
      submissionInstructions: taskInfo.submission_instructions,
      creatorId: taskInfo.creator_id,
      assignedUserId: taskInfo.assigned_user_id || null,  // 指定参与人员ID（向后兼容）
      assignedUserIds: (taskInfo.proof_config as any)?._assignedUserIds || (taskInfo.assigned_user_id ? [taskInfo.assigned_user_id] : []),  // 指定参与人员ID列表
      createdAt: formatLocalDateTime(taskInfo.created_at),
      updatedAt: formatLocalDateTime(taskInfo.updated_at)
    } : undefined,
    // 创建者和领取者
  creatorId: dbTask.creator_id,
    claimerId: dbTask.claimer_id || undefined,
    // 奖励相关（每个参与者独立）
    reward: parseFloat(dbTask.reward || '0'),
    currency: dbTask.currency || 'NT',
    weightCoefficient: dbTask.weight_coefficient || 1.0,
    participantIndex: dbTask.participant_index || undefined,
    // 状态相关（每个参与者独立）
    status: dbTask.status as TaskStatus,
    proof: proof,
    receiverRemark: receiverRemark || undefined,
    rejectReason: rejectReason,
    rejectOption: rejectOption || undefined,
    discount: discount,
    discountReason: discountReason,
    timeline: timeline,
    // 时间戳字段（从 timeline 中提取）
    claimedAt: claimedAt,
    submittedAt: submittedAt,
    completedAt: formatLocalDateTime(dbTask.completed_at),
    transferredAt: formatLocalDateTime(dbTask.transferred_at),
    createdAt: formatLocalDateTime(dbTask.created_at),
    updatedAt: formatLocalDateTime(dbTask.updated_at),
    // 向后兼容字段（从 taskInfo 中获取）
    activityId: info.activity_id || 0,
    title: info.title,
    description: info.description,
    startDate: formatLocalDateTime(info.start_date),
    deadline: formatLocalDateTime(info.deadline),
    submitDeadline: formatLocalDateTime(info.submit_deadline),
    participantLimit: info.participant_limit ?? null,
    rewardDistributionMode: info.reward_distribution_mode || 'per_person',
    proofConfig: info.proof_config,
    submissionInstructions: info.submission_instructions,
    assignedUserId: info.assigned_user_id || null,  // 指定参与人员ID（向后兼容）
    // 用户信息
    creatorName: dbTask.creator?.name || null,
    creatorAvatar: dbTask.creator?.avatar || null,
  claimerName: dbTask.claimer?.name || null,
  tags: tags || []
  }
}

/**
 * 从数据库获取任务（适配新数据库结构）
 * 返回单个任务行及其关联的 task_info, task_timelines, task_proofs
 */
const getTaskFromDb = async (taskId: string): Promise<TaskDataWithRelations> => {
    // 获取任务行数据（只选择存在的字段，排除已删除的字段）
    const { data: taskData, error: taskError } = await supabase
      .from('tasks')
      .select('id, task_info_id, creator_id, claimer_id, reward, currency, weight_coefficient, participant_index, status, completed_at, transferred_at, created_at, updated_at')
      .eq('id', taskId)
      .single()
  
    if (taskError) throw taskError
    if (!taskData) throw new Error('任务不存在')
  
    // 使用类型断言，允许动态添加属性
    const taskDataWithRelations = taskData as TaskDataWithRelations
  
    // 获取关联的 task_info
    let taskInfo = null
    if (taskDataWithRelations.task_info_id) {
      const { data: infoData, error: infoError } = await supabase
        .from('task_info')
        .select('*')
        .eq('id', taskDataWithRelations.task_info_id)
        .single()
      
      if (!infoError && infoData) {
        taskInfo = infoData
        taskDataWithRelations.task_info = infoData
      }
    }
  
    // 获取 task_timelines
    let taskTimeline = null
    const { data: timelineData, error: timelineError } = await supabase
      .from('task_timelines')
      .select('timeline')
      .eq('task_id', taskId)
      .single()
    
    if (!timelineError && timelineData) {
      taskTimeline = timelineData
      taskDataWithRelations.timeline = timelineData.timeline
    } else {
      // 如果不存在，创建默认记录
      const { data: newTimeline } = await supabase
        .from('task_timelines')
        .insert({ task_id: taskId, timeline: [] })
        .select('timeline')
        .single()
      
      if (newTimeline) {
        taskTimeline = newTimeline
        taskDataWithRelations.timeline = newTimeline.timeline
      }
    }
  
    // 获取 task_proofs
    let taskProof = null
    const { data: proofData, error: proofError } = await supabase
      .from('task_proofs')
      .select('proof, receiver_remark, reject_reason, reject_option, discount, discount_reason')
      .eq('task_id', taskId)
      .single()
    
    if (!proofError && proofData) {
      taskProof = proofData
      taskDataWithRelations.proof = proofData.proof
      ;(taskDataWithRelations as any).receiver_remark = (proofData as any).receiver_remark
      taskDataWithRelations.reject_reason = proofData.reject_reason
      taskDataWithRelations.reject_option = proofData.reject_option
      taskDataWithRelations.discount = proofData.discount
      taskDataWithRelations.discount_reason = proofData.discount_reason
    }
  
    // 获取创建者信息
    if (taskDataWithRelations.creator_id) {
      const { data: creatorData, error: creatorError } = await supabase
        .from('users')
        .select('id, name')
        .eq('id', taskDataWithRelations.creator_id)
        .single()
      
      if (!creatorError && creatorData) {
        taskDataWithRelations.creator = creatorData
      }
    }
  
    // 获取领取者信息
    if (taskDataWithRelations.claimer_id) {
      const { data: claimerData, error: claimerError } = await supabase
        .from('users')
        .select('id, name')
        .eq('id', taskDataWithRelations.claimer_id)
        .single()
      
      if (!claimerError && claimerData) {
        taskDataWithRelations.claimer = claimerData
      }
    }
  
    // 添加 task_timeline 和 task_proof 到返回对象
    taskDataWithRelations.task_timeline = taskTimeline
    taskDataWithRelations.task_proof = taskProof
  
    return taskDataWithRelations
}

/**
 * 获取任务组的所有任务行（用于多人任务）
 */
const getTaskGroupFromDb = async (taskInfoId: string) => {
    // 获取所有关联的任务行（只选择存在的字段，排除已删除的字段）
    const { data: tasksData, error: tasksError } = await supabase
      .from('tasks')
      .select('id, task_info_id, creator_id, claimer_id, reward, currency, weight_coefficient, participant_index, status, completed_at, transferred_at, created_at, updated_at')
      .eq('task_info_id', taskInfoId)
      .order('participant_index', { ascending: true })
  
    if (tasksError) throw tasksError
  
    // 获取 task_info
    const { data: taskInfo, error: infoError } = await supabase
      .from('task_info')
      .select('*')
      .eq('id', taskInfoId)
      .single()
  
    if (infoError) throw infoError
  
    // 批量获取所有任务的 timeline
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
  
    // 批量获取所有任务的 proof
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
  
    // 获取所有创建者和领取者信息
    const creatorIds = [...new Set(tasksData.map(t => t.creator_id).filter(Boolean))]
    const claimerIds = [...new Set(tasksData.map(t => t.claimer_id).filter(Boolean))]
    const allUserIds = [...new Set([...creatorIds, ...claimerIds])]
  
    let usersMap: Record<string, { id: string; name: string }> = {}
    if (allUserIds.length > 0) {
      const { data: usersData } = await supabase
        .from('users')
        .select('id, name')
        .in('id', allUserIds)
      
      if (usersData) {
        usersMap = usersData.reduce((acc, u) => {
          acc[u.id] = u
          return acc
        }, {} as Record<string, { id: string; name: string }>)
      }
    }
  
    // 为每个任务行添加用户信息、timeline 和 proof
    tasksData.forEach(task => {
      const taskWithRelations = task as TaskDataWithRelations
      if (taskWithRelations.creator_id && usersMap[taskWithRelations.creator_id]) {
        taskWithRelations.creator = usersMap[taskWithRelations.creator_id]
      }
      if (taskWithRelations.claimer_id && usersMap[taskWithRelations.claimer_id]) {
        taskWithRelations.claimer = usersMap[taskWithRelations.claimer_id]
      }
      taskWithRelations.task_info = taskInfo
      taskWithRelations.task_timeline = timelinesMap[taskWithRelations.id] || { timeline: [] }
      taskWithRelations.task_proof = proofsMap[taskWithRelations.id] || null
    })
  
    return { taskInfo, tasks: tasksData }
}


/**
 * 统一错误处理
 */
const handleError = (res: Response, error: any, defaultMessage: string) => {
    const message = error?.message || defaultMessage
    const status = error?.message === '任务不存在' ? 404 : 500
    res.status(status).json({ error: message })
}


// 获取任务广场列表（task_info 游标分页）；支持 ?communityId= & limit & cursor & sort & status & tagId & search
// ?all=1 时拉取全部页（供 dao 等管理页使用，仍走分页管道，不会触发 1000 行截断）
export const getAllTasks = async (req: Request, res: Response) => {
    try {
      const communityId = (req.query.communityId as string)?.trim() || null
      const fetchAll = req.query.all === '1' || req.query.all === 'true'
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined
      const cursor = (req.query.cursor as string) || null
      const sort = (req.query.sort as PlazaSortField) || 'createdAt'
      const status = (req.query.status as PlazaFilterTab) || 'all'
      const tagId = (req.query.tagId as string) || null
      const search = (req.query.search as string) || null

      const baseParams = { communityId, sort, status, tagId, search }

      if (fetchAll) {
        const items = await fetchAllPlazaTasks(baseParams)
        return res.json(plazaItemsToApiTasks(items))
      }

      const page = await fetchPlazaTasksPage({ ...baseParams, limit, cursor })
      res.json({
        items: plazaItemsToApiTasks(page.items),
        nextCursor: page.nextCursor,
        hasMore: page.hasMore,
      })
    } catch (error: any) {
      console.error('[GET ALL TASKS] Error:', error)
      handleError(res, error, '获取任务列表失败')
    }
}

/** 审核中任务列表（不再依赖全量 GET /api/tasks） */
export const getReviewTasks = async (req: Request, res: Response) => {
  try {
    const communityId = (req.query.communityId as string)?.trim() || null
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0
    const items = await fetchReviewTasksList({ communityId, limit, offset })
    res.json(items)
  } catch (error: any) {
    console.error('[GET REVIEW TASKS] Error:', error)
    handleError(res, error, '获取审核任务失败')
  }
}

/** 当前用户相关的任务（发布或领取），扁平列表，供「我的」页使用 */
export const getMineTasks = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user
    if (!user) {
      return res.status(401).json({ error: '未授权' })
    }

    const userId = user.id
    const communityId = (req.query.communityId as string)?.trim() || null

    let query = supabase
      .from('tasks')
      .select(TASK_ROW_SELECT)
      .or(`creator_id.eq.${userId},claimer_id.eq.${userId}`)
      .order('created_at', { ascending: false })

    if (communityId) {
      const { data: infoIds } = await supabase.from('task_info').select('id').eq('community_id', communityId)
      const ids = (infoIds || []).map((i: { id: string }) => i.id)
      if (ids.length === 0) {
        return res.json([])
      }
      query = query.in('task_info_id', ids)
    }

    const { data, error } = await query
    if (error) throw error

    const tasksData = data || []
    const { tasksWithInfo, taskTagsMap } = await enrichTaskRows(tasksData)
    const flatTasks = buildFlatProfileTasks(tasksWithInfo, taskTagsMap, mapDbTaskToTask)
    res.json(flatTasks)
  } catch (error: any) {
    console.error('[GET MINE TASKS] Error:', error)
    handleError(res, error, '获取我的任务失败')
  }
}
 
// 获取单个任务
export const getTaskById = async (req: Request, res: Response) => {
    try {
      // 获取单个任务行
      const dbTask = await getTaskFromDb(req.params.id)
      
      // 获取 task_info（如果存在）
      let taskInfo = null
      if (dbTask.task_info_id) {
        const { data: infoData } = await supabase
          .from('task_info')
          .select('*')
          .eq('id', dbTask.task_info_id)
          .single()
        
        if (infoData) {
          taskInfo = infoData
        }
      }
      
      // 如果是多人任务（participant_limit > 1），获取所有任务行构建 participantsList
      let participantsList: any[] = []
      if (taskInfo && taskInfo.participant_limit && taskInfo.participant_limit > 1) {
        // 获取该 task_info_id 下的所有任务行
        const { data: allTasks } = await supabase
          .from('tasks')
          .select('id, claimer_id, status, participant_index, transferred_at, created_at, updated_at')
          .eq('task_info_id', dbTask.task_info_id)
          .order('participant_index', { ascending: true })
        
        if (allTasks && allTasks.length > 0) {
          // 获取所有领取者信息
          const claimerIds = [...new Set(allTasks.map(t => t.claimer_id).filter(Boolean))]
          let claimersMap: Record<string, { id: string; name: string }> = {}
          
          if (claimerIds.length > 0) {
            const { data: claimersData } = await supabase
              .from('users')
              .select('id, name')
              .in('id', claimerIds)
            
            if (claimersData) {
              claimersMap = claimersData.reduce((acc, u) => {
                acc[u.id] = u
                return acc
              }, {} as Record<string, { id: string; name: string }>)
            }
          }
          
          // 获取所有任务行的时间线（用于提取 claimedAt 和 submittedAt）
          const taskIds = allTasks.map(t => t.id)
          let timelinesMap: Record<string, any> = {}
          if (taskIds.length > 0) {
            const { data: timelinesData } = await supabase
              .from('task_timelines')
              .select('task_id, timeline')
              .in('task_id', taskIds)
            
            if (timelinesData) {
              timelinesMap = timelinesData.reduce((acc, t) => {
                acc[t.task_id] = t.timeline || []
                return acc
              }, {} as Record<string, any>)
            }
          }

          // 获取所有任务行的接包者备注（receiver_remark）
          // 该字段在提交凭证时写入 task_proofs.receiver_remark，用于审核通过后跳转 semi 时带入上链
          let receiverRemarksMap: Record<string, string> = {}
          if (taskIds.length > 0) {
            const { data: proofsData } = await supabase
              .from('task_proofs')
              .select('task_id, receiver_remark')
              .in('task_id', taskIds)

            if (proofsData) {
              receiverRemarksMap = proofsData.reduce((acc, p: any) => {
                if (p?.task_id) acc[p.task_id] = p.receiver_remark || ''
                return acc
              }, {} as Record<string, string>)
            }
          }
          
          // 获取指定用户信息（用于显示未领取的指定用户名称）
          let assignedUsersMap: Record<string, { id: string; name: string }> = {}
          const assignedUserIds = (taskInfo.proof_config as any)?._assignedUserIds || (taskInfo.assigned_user_id ? [taskInfo.assigned_user_id] : [])
          if (assignedUserIds.length > 0) {
            const { data: assignedUsersData } = await supabase
              .from('users')
              .select('id, name')
              .in('id', assignedUserIds)
            
            if (assignedUsersData) {
              assignedUsersMap = assignedUsersData.reduce((acc, u) => {
                acc[u.id] = u
                return acc
              }, {} as Record<string, { id: string; name: string }>)
            }
          }
          
          // 构建 participantsList
          participantsList = allTasks.map((t, index) => {
            const timeline = timelinesMap[t.id] || []
            // 从时间线中提取 claimedAt 和 submittedAt
            let claimedAt: string | undefined = undefined
            let submittedAt: string | undefined = undefined
            if (Array.isArray(timeline)) {
              const claimedEvent = timeline.find((item: any) => item.status === 'claimed' || item.action === '领取任务')
              const submittedEvent = timeline.find((item: any) => item.status === 'submitted' || item.action === '提交凭证')
              if (claimedEvent?.timestamp) claimedAt = formatLocalDateTime(claimedEvent.timestamp)
              if (submittedEvent?.timestamp) submittedAt = formatLocalDateTime(submittedEvent.timestamp)
            }
            
            const claimer = t.claimer_id ? claimersMap[t.claimer_id] : null
            // 如果未领取，检查是否是指定用户
            let displayName = '未领取'
            if (claimer) {
              displayName = claimer.name
            } else if (assignedUserIds[index] && assignedUsersMap[assignedUserIds[index]]) {
              // 是指定用户但未领取，显示用户名（前端会显示为灰色）
              displayName = assignedUsersMap[assignedUserIds[index]].name
            }
            
            return {
              id: t.id,
              name: displayName,
              claimerId: t.claimer_id || undefined,
              claimedAt: claimedAt || '',
              submittedAt: submittedAt || undefined,
              receiver_remark: receiverRemarksMap[t.id] || undefined,
              status: t.status,
              participantIndex: t.participant_index || 1,
              transferredAt: formatLocalDateTime(t.transferred_at) || undefined
            }
          })
        }
      }
      
      // 构建 assignedUserNames 映射（用于前端显示）
      let assignedUserNames: Record<string, string> = {}
      if (taskInfo) {
        const assignedUserIds = (taskInfo.proof_config as any)?._assignedUserIds || (taskInfo.assigned_user_id ? [taskInfo.assigned_user_id] : [])
        if (assignedUserIds.length > 0) {
          const { data: assignedUsersData } = await supabase
            .from('users')
            .select('id, name')
            .in('id', assignedUserIds)
          
          if (assignedUsersData) {
            assignedUserNames = assignedUsersData.reduce((acc, u) => {
              acc[u.id] = u.name
              return acc
            }, {} as Record<string, string>)
          }
        }
      }
      
      // 返回单个任务（包含 participantsList 如果是多人任务）
      const task = mapDbTaskToTask(
        dbTask, 
        taskInfo, 
        dbTask.task_timeline, 
        dbTask.task_proof
      )
      
      // 如果是多人任务，添加 participantsList
      if (participantsList.length > 0) {
        (task as any).participantsList = participantsList
      }
      
      // 添加 assignedUserNames（用于前端显示指定用户名称）
      if (Object.keys(assignedUserNames).length > 0) {
        (task as any).assignedUserNames = assignedUserNames
      }
      
      res.json(task)
    } catch (error: any) {
      handleError(res, error, '获取任务失败')
    }
}

// 创建新任务（适配新数据库结构）
export const createTask = async (req: AuthRequest, res: Response) => {
    try {
      const params: CreateTaskParams = req.body
      const userId = req.user?.id
  
      if (!userId) {
        return res.status(401).json({ error: '未授权' })
      }
  
      // 验证必填字段
      if (!params.title || !params.description || !params.reward || !params.startDate || !params.deadline) {
        return res.status(400).json({ error: '缺少必填字段' })
      }
  
      // 验证时间顺序：报名开始时间 < 报名截止时间 < 提交截止时间
      // 使用统一的时间解析函数，避免时区问题
      const startDate = parseLocalDateTime(params.startDate)
      const deadline = parseLocalDateTime(params.deadline)
      const submitDeadline = params.submitDeadline ? parseLocalDateTime(params.submitDeadline) : null
      
      // 检查时间是否有效
      if (!startDate) {
        return res.status(400).json({ error: '报名开始时间格式无效' })
      }
      if (!deadline) {
        return res.status(400).json({ error: '报名截止时间格式无效' })
      }
      if (submitDeadline === null && params.submitDeadline) {
        return res.status(400).json({ error: '提交截止时间格式无效' })
      }
      
      // 验证时间顺序
      if (startDate >= deadline) {
        return res.status(400).json({ error: '报名开始时间必须早于报名截止时间' })
      }
      if (submitDeadline && deadline >= submitDeadline) {
        return res.status(400).json({ error: '报名截止时间必须早于提交截止时间' })
      }
      if (submitDeadline && startDate >= submitDeadline) {
        return res.status(400).json({ error: '报名开始时间必须早于提交截止时间' })
      }
  
      const participantLimit = params.participantLimit ?? 1
      const rewardDistributionMode = params.rewardDistributionMode || 'per_person'
      const currency = params.currency || 'NT'
  
      // 步骤1: 创建 task_info 记录
      // 处理时间格式：如果前端发送的是 YYYY-MM-DDTHH:mm 格式（无时区），
      // 需要确保 PostgreSQL 将其解释为本地时区的时间
      const normalizeDateTime = (dateTimeStr: string | undefined): string | null => {
        if (!dateTimeStr) return null

        // 1. 物理切除：去除所有已有的时区标识（Z, +08:00, -0500 等）
        const cleanStr = dateTimeStr.replace(/Z$|[+-]\d{2}:?\d{2}$/, '')

        // 2. 格式验证：匹配 YYYY-MM-DDTHH:mm 格式
        const isoPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/
        
        if (isoPattern.test(cleanStr)) {
          // 3. 注入显式偏移量：强制 PostgreSQL 识别为 UTC+8（新加坡时区）
          return `${cleanStr}+08:00`
        }

        // 如果完全不匹配，原样返回（由数据库报错或进一步处理）
        return dateTimeStr
      }
      
      // 处理assignedUserIds：如果提供了assignedUserIds数组，使用第一个作为assigned_user_id（向后兼容）
      // 同时将完整的assignedUserIds数组存储在proof_config中（临时方案，后续可以创建新表）
      const assignedUserIds = params.assignedUserIds || (params.assignedUserId ? [params.assignedUserId] : [])
      const assignedUserId = assignedUserIds.length > 0 ? assignedUserIds[0] : null
      
      // 如果指定了社区和用户，验证这些用户是否属于该社区
      if (params.communityId && assignedUserIds.length > 0) {
        const { data: communityMembers } = await supabase
          .from('community_members')
          .select('user_id')
          .eq('community_id', params.communityId)
          .in('user_id', assignedUserIds)
        
        const memberIds = new Set((communityMembers || []).map((m: any) => m.user_id))
        const invalidUserIds = assignedUserIds.filter(id => !memberIds.has(id))
        
        if (invalidUserIds.length > 0) {
          return res.status(400).json({ 
            error: `指定的用户不属于当前社区: ${invalidUserIds.join(', ')}` 
          })
        }
      }
      
      console.log('[CREATE TASK] 接收到的参数:', {
        assignedUserId: params.assignedUserId,
        assignedUserIds: params.assignedUserIds,
        hasAssignedUserId: !!assignedUserId
      })
      
      // 将assignedUserIds存储到proof_config中（临时方案）
      const proofConfigWithAssignedUsers = params.proofConfig ? {
        ...params.proofConfig,
        _assignedUserIds: assignedUserIds  // 临时存储assignedUserIds
      } : {
        _assignedUserIds: assignedUserIds
      }
      
      const { data: taskInfo, error: infoError } = await supabase
        .from('task_info')
        .insert({
          title: params.title,
          description: params.description,
          activity_id: params.activityId || 0,
          start_date: normalizeDateTime(params.startDate),
          deadline: normalizeDateTime(params.deadline),
          submit_deadline: normalizeDateTime(params.submitDeadline),
          participant_limit: participantLimit > 1 ? participantLimit : null,
          reward_distribution_mode: rewardDistributionMode,
          proof_config: proofConfigWithAssignedUsers || null,
          submission_instructions: params.submissionInstructions || null,
          creator_id: userId,
          assigned_user_id: assignedUserId,  // 指定参与人员ID（使用第一个，向后兼容）
          community_id: params.communityId || null  // 所属社区
        })
        .select()
        .single()
  
      if (infoError) {
        console.error('[CREATE TASK] 创建 task_info 失败:', infoError)
        throw infoError
      }
      
      console.log('[CREATE TASK] 创建的 task_info:', {
        id: taskInfo.id,
        assigned_user_id: taskInfo.assigned_user_id
      })
  
      // 步骤2: 计算每个参与者的奖励
      let taskRows: any[] = []
      
      if (rewardDistributionMode === 'custom' && params.weights && params.weights.length > 0) {
        // 自定义权重分配
        const totalWeight = params.weights.reduce((sum, w) => sum + w.weight, 0)
        taskRows = params.weights.map((weightItem, index) => ({
          task_info_id: taskInfo.id,
          creator_id: userId,
          claimer_id: null,
          reward: (params.reward * weightItem.weight / totalWeight).toFixed(2),
          currency: currency,
          weight_coefficient: weightItem.weight,
          participant_index: weightItem.participantIndex || index + 1,
          status: 'unclaimed'
        }))
      } else {
        // 平均分配（per_person）
        // params.reward 已经是每人积分，不需要除以参与人数
        const perPersonReward = params.reward.toFixed(2)
        for (let i = 0; i < participantLimit; i++) {
          taskRows.push({
            task_info_id: taskInfo.id,
            creator_id: userId,
            claimer_id: null,
            reward: perPersonReward,
            currency: currency,
            weight_coefficient: 1.0,
            participant_index: i + 1,
            status: 'unclaimed'
          })
        }
      }
  
      // 步骤3: 创建所有任务行（明确指定要返回的字段，排除已删除的字段）
      const { data: createdTasks, error: tasksError } = await supabase
        .from('tasks')
        .insert(taskRows)
        .select('id, task_info_id, creator_id, claimer_id, reward, currency, weight_coefficient, participant_index, status, completed_at, transferred_at, created_at, updated_at')
  
      if (tasksError) {
        console.error('[CREATE TASK] Insert tasks error:', tasksError)
        throw tasksError
      }
  
      // 返回第一个任务（作为主要任务）
      const firstTask = createdTasks?.[0]
      if (!firstTask) {
        throw new Error('创建任务失败：未创建任何任务行')
      }
  
      // 获取创建者信息
      const { data: creatorData } = await supabase
        .from('users')
        .select('id, name')
        .eq('id', userId)
        .single()
  
      const firstTaskWithRelations = firstTask as TaskDataWithRelations
      if (creatorData) {
        firstTaskWithRelations.creator = creatorData
      }
      firstTaskWithRelations.task_info = taskInfo
      
      // 步骤4: 为每个创建的任务创建 task_timelines 记录
      const userName = req.user?.name || '系统'
      const initialTimeline = [{
        status: 'unclaimed',
        actorId: userId,
        actorName: userName,
        action: '创建任务',
        timestamp: new Date().toISOString()
      }]
      
      const timelineInserts = createdTasks.map(task => ({
        task_id: task.id,
        timeline: initialTimeline
      }))
      
      const { error: timelineError } = await supabase
        .from('task_timelines')
        .insert(timelineInserts)
      
      if (timelineError) {
        console.error('[CREATE TASK] Create timelines error:', timelineError)
        // 不抛出错误，继续执行
      }

      // 保存任务标签关联
      const tagIds: string[] = params.tagIds || []
      let taskTags: { id: string; name: string; colorHex: string }[] = []
      if (tagIds.length > 0) {
        const tagInserts = tagIds.map(tagId => ({
          task_info_id: taskInfo.id,
          tag_id: tagId
        }))
        await supabase.from('task_info_tags').insert(tagInserts)
        // 获取标签详情用于返回
        const { data: tagData } = await supabase
          .from('community_task_tags')
          .select('id, name, color_hex')
          .in('id', tagIds)
        if (tagData) {
          taskTags = tagData.map(t => ({ id: t.id, name: t.name, colorHex: t.color_hex }))
        }
      }

      // 获取第一个任务的 timeline 和 proof
      const { data: firstTimeline } = await supabase
        .from('task_timelines')
        .select('timeline')
        .eq('task_id', firstTask.id)
        .single()
      
      const task = mapDbTaskToTask(
        firstTask, 
        taskInfo, 
        firstTimeline || { timeline: initialTimeline }, 
        null,
        taskTags
      )
      
      console.log('[CREATE TASK] Mapped task:', JSON.stringify(task, null, 2))
      
      // 确保返回格式与前端 Task 接口匹配（向后兼容）
      const responseTask = {
        id: task.id,
        activityId: task.activityId || 0,
        title: task.title || taskInfo?.title || '',
        description: task.description || taskInfo?.description || '',
        reward: task.reward || 0,
        participantLimit: task.participantLimit ?? null,
        rewardDistributionMode: task.rewardDistributionMode || 'per_person',
        proof: task.proof,
        proofConfig: task.proofConfig,
        submissionInstructions: task.submissionInstructions,
        status: task.status || 'unclaimed',
        rejectReason: task.rejectReason,
        rejectOption: task.rejectOption,
        discount: task.discount,
        discountReason: task.discountReason,
        creatorId: task.creatorId || userId,
        creatorName: task.creatorName,
        claimerId: task.claimerId,
        claimerName: task.claimerName,
        timeline: task.timeline || [],
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        startDate: task.startDate,
        deadline: task.deadline,
        submitDeadline: task.submitDeadline,
        claimedAt: task.claimedAt,
        submittedAt: task.submittedAt,
        completedAt: task.completedAt,
        tags: task.tags || []
      }
      
      console.log('[CREATE TASK] Response task:', JSON.stringify(responseTask, null, 2))
      
      res.status(201).json(responseTask)
      } catch (error: any) {
      console.error('Create task error:', error)
        handleError(res, error, '创建任务失败')
      }
}

// 领取任务（适配新数据库结构）
export const claimTask = async (req: AuthRequest, res: Response) =>
{
    try
    {
        const { id } = req.params
        const user = req.user
        if (!user) {
            return res.status(401).json({ success: false, message: '未授权' })
        }
        
        // 获取任务行
        const task = await getTaskFromDb(id)

        // 获取 task_info 以检查时间限制
        let taskInfo = null
        if (task.task_info_id) {
            const { data: infoData } = await supabase
                .from('task_info')
                .select('*')
                .eq('id', task.task_info_id)
                    .single()
            taskInfo = infoData
        }

        // 检查任务是否已过期（从 task_info 获取）
        // 使用统一的时间解析函数，避免时区问题
        if (taskInfo?.deadline) {
            const deadlineLocal = formatLocalDateTime(taskInfo.deadline)
            if (deadlineLocal) {
                const deadlineDate = parseLocalDateTime(deadlineLocal)
                if (deadlineDate) {
                    const now = new Date()
                    if (deadlineDate < now) {
                        return res.status(400).json({ success: false, message: '任务已过期，无法领取' })
                    }
                }
            }
        }

        // 检查任务是否已开始
        // 使用统一的时间解析函数，避免时区问题
        if (taskInfo?.start_date) {
            const startDateLocal = formatLocalDateTime(taskInfo.start_date)
            if (startDateLocal) {
                const startDate = parseLocalDateTime(startDateLocal)
                if (startDate) {
                    const now = new Date()
                    if (startDate > now) {
                        return res.status(400).json({ success: false, message: '任务尚未开始，无法领取' })
                    }
                }
            }
        }

        // 检查是否指定了参与人员（创建者也不能领取指定给其他人的任务）
        if (taskInfo?.assigned_user_id) {
            if (taskInfo.assigned_user_id !== user.id) {
                return res.status(403).json({ success: false, message: '此任务已指定给其他用户，您无法领取' })
            }
        }
        
        // 检查是否指定了多个参与人员（多人任务，从proof_config中读取）
        const assignedUserIds = (taskInfo?.proof_config as any)?._assignedUserIds || (taskInfo?.assigned_user_id ? [taskInfo.assigned_user_id] : [])
        if (assignedUserIds.length > 0) {
            // 如果是多人任务，检查用户是否在指定列表中
            if (!assignedUserIds.includes(user.id)) {
                return res.status(403).json({ success: false, message: '此任务已指定给其他用户，您无法领取' })
            }
        }

        // 验证用户是否属于该任务的社区
        if (taskInfo?.community_id) {
            const { data: member } = await supabase
                .from('community_members')
                .select('user_id')
                .eq('community_id', taskInfo.community_id)
                .eq('user_id', user.id)
                .maybeSingle()
            
            if (!member) {
                return res.status(403).json({ success: false, message: '您不属于该任务的社区，无法领取' })
            }
        }

        // 获取用户信息
        const { data: userData } = await supabase
            .from('users')
            .select('id, name')
            .eq('id', user.id)
            .single()

        const userName = userData?.name || '未知用户'
        const now = new Date().toISOString()

        // 确定要更新的任务行ID
        let taskIdToUpdate = id

        // 如果是多人任务，需要查找一个未领取的任务行
        if (taskInfo?.participant_limit && taskInfo.participant_limit > 1) {
            // 首先检查用户是否已经领取过这个任务组中的任何一行
            const { data: userClaimedTasks } = await supabase
                .from('tasks')
                .select('id')
                .eq('task_info_id', task.task_info_id)
                .eq('claimer_id', user.id)

            if (userClaimedTasks && userClaimedTasks.length > 0) {
                return res.status(400).json({ success: false, message: '您已经领取过这个任务' })
            }

            // 获取该任务组的所有任务行，查找一个未领取的行
            const { data: allTasks } = await supabase
                    .from('tasks')
                .select('id, claimer_id')
                .eq('task_info_id', task.task_info_id)
                .order('participant_index', { ascending: true })
            
            if (!allTasks || allTasks.length === 0) {
                return res.status(400).json({ success: false, message: '任务数据异常' })
            }

            // 统计已领取的数量
            const claimedCount = allTasks.filter(t => t.claimer_id).length
            
            // 检查是否已满员
            if (claimedCount >= taskInfo.participant_limit) {
                return res.status(400).json({ success: false, message: '任务参与人数已满' })
            }

            // 查找第一个未领取的任务行
            const unclaimedTask = allTasks.find(t => !t.claimer_id)

            if (!unclaimedTask) {
                return res.status(400).json({ success: false, message: '没有可用的任务位置' })
            }

            // 使用找到的未领取任务行ID
            taskIdToUpdate = unclaimedTask.id
        } else {
            // 单人任务：检查当前任务行是否已被领取
            if (task.claimer_id) {
                if (task.claimer_id === user.id) {
                    return res.status(400).json({ success: false, message: '您已经领取过这个任务' })
                } else {
                    return res.status(400).json({ success: false, message: '该任务已被其他用户领取' })
                }
            }
        }

        // 更新任务：设置 claimer_id 和状态
        const updateData: any = {
            claimer_id: user.id,
            updated_at: now
        }

        const { error: updateError } = await supabase
            .from('tasks')
            .update(updateData)
            .eq('id', taskIdToUpdate)

        if (updateError) throw updateError

        // 更新状态和时间线（使用新的 updateTaskStatus 函数）
        await updateTaskStatus(
          taskIdToUpdate, 
          'claimed', // 领取后状态为 claimed
          user.id, 
          userName, 
          '领取任务'
        )

        // 写入通知：有人领取了我发布的任务（task 开关）
        try {
            const creatorId = taskInfo?.creator_id
            if (creatorId && creatorId !== user.id) {
                const { data: settings } = await supabase
                    .from('user_notification_settings')
                    .select('task_enabled')
                    .eq('user_id', creatorId)
                    .maybeSingle()
                const enabled = settings?.task_enabled !== false
                if (enabled) {
                    const dedupeKey = `task_claim:${taskIdToUpdate}:${user.id}`
                    await supabase.from('notifications').upsert([{
                        user_id: creatorId,
                        community_id: taskInfo?.community_id || null,
                        category: 'task',
                        type: 'task_claim',
                        title: '你的任务有人领取了',
                        body: `${userName} 领取了任务「${taskInfo?.title || ''}」`,
                        data: { taskId: taskIdToUpdate, taskInfoId: taskInfo?.id || task.task_info_id, fromUserId: user.id },
                        dedupe_key: dedupeKey
                    }], { onConflict: 'user_id,dedupe_key' })
                }
            }
        } catch (_) {}

        res.json({ success: true, message: '任务领取成功！' })
    } catch (error: any)
    {
        console.error('Claim task error:', error)
        res.status(500).json({ success: false, message: error.message || '领取任务失败' })
    }
}

// 提交任务凭证（适配新数据库结构）
export const submitProof = async (req: AuthRequest, res: Response) =>
{
    try
    {
        const { id } = req.params
        const { proof, receiver_remark } = req.body
        const user = req.user

        if (!user) {
            return res.status(401).json({ success: false, message: '未授权' })
        }

        if (!proof)
        {
            return res.status(400).json({ success: false, message: '请提供凭证内容' })
        }

        // 获取任务行
        const task = await getTaskFromDb(id)
        
        // 权限检查：只有领取者可以提交
        if (!task.claimer_id || task.claimer_id !== user.id) {
            return res.status(403).json({ success: false, message: '您不是该任务的领取者，无权提交凭证' })
        }

        // 验证任务状态：只有进行中或未领完的任务才能提交凭证
        if (task.status !== 'claimed' && task.status !== 'unsubmit') {
            return res.status(400).json({ success: false, message: `任务状态不正确，当前状态为：${task.status}，无法提交凭证` })
        }

        // 获取 task_info 以获取 proof_config
        let taskInfo = null
        if (task.task_info_id) {
            const { data: infoData } = await supabase
                .from('task_info')
                .select('*')
                .eq('id', task.task_info_id)
                .single()
            taskInfo = infoData
        }

        // 解析 proof 数据（可能是字符串或者对象）
        let proofData: any
        if(typeof proof === 'string')
        {
            try
            {
                proofData = JSON.parse(proof)
            } catch(e)
            {
                return res.status(400).json({success:false, message:'凭证数据格式错误'})
            }
        } else
        {
            proofData = proof
        }
        
        // 验证 GPS 数据（从 task_info 获取）
        const proofConfig = taskInfo?.proof_config as any
        if(proofConfig?.gps?.enabled)
        {
            if(!proofData.gps)
            {
                return res.status(400).json
                ({
                    success:false,
                    message:'此任务要求提供GPS定位信息'
                })
            }

            // 验证GPS数据格式
            const { latitude,longitude }= proofData.gps
            if(typeof latitude !=='number'||typeof longitude !=='number')
            {
                return res.status(400).json
                ({
                    success:false,
                    message:'GPS数据格式错误'
                })
            }
        }

        // 验证文件
        if(proofConfig?.photo?.enabled)
        {
            if(!proofData.files || proofData.files.length ===0)
            {
                return res.status(400).json
                ({
                    success:false,
                    message:'此任务要求提供照片证明'
                })
            }
        }

        // 验证文字描述
        if (proofConfig?.description?.enabled)
        {
            if(!proofData.description || proofData.description.trim().length ===0)
            {
                return res.status(400).json
                ({
                    success:false,
                    message:'此任务要求提供文字描述'
                })
            }

            // 验证最少字数（使用字符数，支持中文）
            const minWords = parseInt(proofConfig.description.minWords||'20')
            const charCount = proofData.description.trim().length
            if(charCount<minWords)
            {
                return res.status(400).json
                ({
                    success:false,
                    message:`文字描述至少需要${minWords}字，当前${charCount}字`
                })
            }
        }

        // 将 proof 数据序列化为 JSON 字符串存储
        const proofString = JSON.stringify(proofData)

        // 获取用户信息
        const { data: userData } = await supabase
            .from('users')
            .select('id, name')
            .eq('id', user.id)
            .single()

        const userName = userData?.name || '未知用户'
        const now = new Date().toISOString()

        // 更新或创建 task_proofs 记录
        const { error: proofError } = await supabase
            .from('task_proofs')
            .upsert({
                task_id: id,
                proof: proofString,
                receiver_remark: typeof receiver_remark === 'string' ? receiver_remark.trim().slice(0, 32) : null,
                updated_at: now
            }, {
                onConflict: 'task_id'
            })

        if (proofError) {
            console.error('[SUBMIT PROOF] Update proof error:', proofError)
            throw proofError
        }

        // 每个任务行独立提交，不等待其他参与者
        // 提交后立即更新状态为 submitted，进入审核阶段
        await updateTaskStatus(
            id,
            'submitted',
            user.id,
            userName,
            '提交凭证'
        )

        // 写入通知：有人提交了凭证（发起者收到）
        try {
            const creatorId = taskInfo?.creator_id
            if (creatorId && creatorId !== user.id) {
                const { data: settings } = await supabase
                    .from('user_notification_settings')
                    .select('task_enabled')
                    .eq('user_id', creatorId)
                    .maybeSingle()
                const enabled = settings?.task_enabled !== false
                if (enabled) {
                    const dedupeKey = `task_submit:${id}`
                    await supabase.from('notifications').upsert([{
                        user_id: creatorId,
                        community_id: taskInfo?.community_id || null,
                        category: 'task',
                        type: 'task_submit',
                        title: '任务凭证已提交',
                        body: `${userName} 提交了任务「${taskInfo?.title || ''}」的凭证，等待你审核`,
                        data: { taskId: id, taskInfoId: taskInfo?.id || task.task_info_id, fromUserId: user.id },
                        dedupe_key: dedupeKey
                    }], { onConflict: 'user_id,dedupe_key' })
                }
            }
        } catch (_) {}

        // 清理该任务的到期提醒通知（已提交，不再需要截止提醒）
        try {
          await supabase.from('notifications').delete()
            .eq('category', 'due')
            .eq('data->>taskId', String(id))
        } catch (_) {}

        res.json({ 
            success: true, 
            message: '凭证提交成功！等待审核' 
        })
        
    } catch (error: any)
    {
        console.error('Submit proof error:', error)
        res.status(500).json({ success: false, message: error.message || '提交凭证失败' })
    }
}

// 审核通过任务
export const approveTask = async (req: AuthRequest, res: Response) =>
{
    try
    {
        console.log('=== [APPROVE TASK] 开始审核 ===')
        const { id } = req.params
        const { comments } = req.body // 可选的评语
        const user = req.user 
        console.log('[APPROVE TASK] taskId:', id, 'userId:', user?.id, 'comments:', comments)
        if (!user)
        {
            return res.status(401).json({ success: false, message: '未授权' })
        }

        // 获取任务行
        const task = await getTaskFromDb(id)

        // 获取 task_info 以检查权限和任务组信息
        let taskInfo = null
        if (task.task_info_id) {
            const { data: infoData } = await supabase
                .from('task_info')
                .select('*')
                .eq('id', task.task_info_id)
                .single()
            taskInfo = infoData
        }

        // 权限检查：只有创建者可以审核（从 task_info 检查）
        if (!taskInfo || !taskInfo.creator_id)
        {
            return res.status(403).json
            ({
                success: false,
                message: '该任务没有创建者，无法审核'
            })
        }
        if (taskInfo.creator_id !== user.id)
        {
            return res.status(403).json
            ({
                success: false,
                message: '您不是任务创建者，无权审核此任务'
            })
        }

        // 已审核通过的任务：幂等返回，不再重复写入时间线，避免多次点击出现多条「审核通过」进度
        if (task.status === 'completed')
        {
            return res.json({
                success: true,
                message: '任务已审核通过',
                data: {
                    claimerId: task.claimer_id,
                    reward: parseFloat(String(task.reward || '0')),
                    creatorId: taskInfo.creator_id
                }
            })
        }

        if (task.status !== 'submitted' && task.status !== 'under_review') {
            return res.status(400).json({
                success: false,
                message: `任务状态不正确，当前状态为：${task.status}，无法审核通过`
            })
        }

        // 验证该任务是否有提交的凭证（通过 task_proofs 表）
        // 对于多人任务，每个参与者独立审核，只审核传入的 task_id
        const { data: proofData } = await supabase
            .from('task_proofs')
            .select('proof')
            .eq('task_id', id)
            .single()
        
        if (!proofData || !proofData.proof) {
            return res.status(400).json({
                success: false,
                message: '该任务尚未提交凭证，无法审核'
            })
        }
        
        // 确保任务已被领取
        if (!task.claimer_id) {
            return res.status(400).json({
                success: false,
                message: '该任务尚未被领取，无法审核'
            })
        }
        
        // 只审核传入的特定任务ID（每个参与者独立审核）
        let tasksToApprove: any[] = []
        // 检查该任务是否有 proof
        if (proofData && proofData.proof) {
            tasksToApprove = [task]
        } else {
            // 单个任务：检查是否有 proof
            const { data: proofData } = await supabase
                .from('task_proofs')
                .select('task_id')
                .eq('task_id', id)
                .not('proof', 'is', null)
                .single()
            
            if (proofData) {
                tasksToApprove = [task]
            }
        }

        if (tasksToApprove.length === 0) {
            return res.status(400).json({
                success: false,
                message: '没有找到已提交的任务，无法审核'
            })
        }

        // 获取用户信息
        const { data: userData } = await supabase
            .from('users')
            .select('id, name')
            .eq('id', user.id)
            .single()

        const userName = userData?.name || '未知用户'
        const now = new Date().toISOString()

        // 每个任务行独立审核，不等待其他参与者
        // 更新当前任务行状态和时间线
        for (const taskRow of tasksToApprove) {
            // 乐观锁：仅 submitted / under_review 可审核通过
            const { data: lockedRow, error: lockError } = await supabase
                .from('tasks')
                .update({
                    status: 'completed',
                    completed_at: now,
                    updated_at: now
                })
                .eq('id', taskRow.id)
                .in('status', ['submitted', 'under_review'])
                .select('id')
                .maybeSingle()

            if (lockError) throw lockError
            if (!lockedRow) {
                return res.status(409).json({
                    success: false,
                    message: '任务状态已变更，无法审核通过（可能已被撤回）'
                })
            }

            // 如果有审核意见，保存到 task_proofs 表
            if (comments && comments.trim().length > 0) {
                const { error: proofError } = await supabase
                    .from('task_proofs')
                    .upsert({
                        task_id: taskRow.id,
                        reject_reason: comments.trim(), // 审核意见保存在 reject_reason 字段
                        reject_option: null, // 清除驳回选项
                        updated_at: now
                    }, {
                        onConflict: 'task_id'
                    })

                if (proofError) {
                    console.error('[APPROVE TASK] Update proof error:', proofError)
                    // 不抛出错误，继续执行
                }
            }

            // 追加状态到时间线（只追加到当前任务行的时间线）
            await appendStatusToTimeline(
              taskRow.id, 
              'completed', 
              user.id, 
              userName, 
              '审核通过',
              comments?.trim()
            )
        }

        // 写入通知：我领取的任务被审核通过（领取者收到）
        try {
            const claimerId = tasksToApprove?.[0]?.claimer_id
            if (claimerId) {
                const { data: settings } = await supabase
                    .from('user_notification_settings')
                    .select('task_enabled')
                    .eq('user_id', claimerId)
                    .maybeSingle()
                const enabled = settings?.task_enabled !== false
                if (enabled) {
                    const dedupeKey = `task_approved:${id}`
                    await supabase.from('notifications').upsert([{
                        user_id: claimerId,
                        community_id: taskInfo?.community_id || null,
                        category: 'task',
                        type: 'task_approved',
                        title: '任务已审核通过',
                        body: `你领取的任务「${taskInfo?.title || ''}」已审核通过`,
                        data: { taskId: id, taskInfoId: taskInfo?.id || task.task_info_id, reviewerId: user.id },
                        dedupe_key: dedupeKey
                    }], { onConflict: 'user_id,dedupe_key' })
                }
            }
        } catch (_) {}

        // 清理该任务的到期提醒通知（已审核通过，不再需要截止提醒）
        try {
          await supabase.from('notifications').delete()
            .eq('category', 'due')
            .eq('data->>taskId', String(id))
        } catch (_) {}

        // 获取被审核通过的参与者信息和创建者信息
        const approvedTask = tasksToApprove[0] // 当前审核的任务行

        // 添加调试日志
        console.log('=== [APPROVE TASK] 准备返回转账数据 ===')
        console.log('[APPROVE TASK] tasksToApprove.length:', tasksToApprove.length)
        console.log('[APPROVE TASK] approvedTask:', JSON.stringify(approvedTask, null, 2))
        console.log('[APPROVE TASK] approvedTask.claimer_id:', approvedTask?.claimer_id)
        console.log('[APPROVE TASK] approvedTask.reward:', approvedTask?.reward)
        console.log('[APPROVE TASK] taskInfo:', taskInfo ? { id: taskInfo.id, creator_id: taskInfo.creator_id } : 'null')
        console.log('[APPROVE TASK] taskInfo.creator_id:', taskInfo?.creator_id)

        const responseData = {
          success: true,
          message: '任务审核通过！',
          data: {
            claimerId: approvedTask.claimer_id, // 被审核通过的参与者ID
            reward: parseFloat(approvedTask.reward || '0'), // 该参与者的奖励金额
            creatorId: taskInfo.creator_id // 创建者ID
          }
        }

        console.log('[APPROVE TASK] 准备返回的响应数据:', JSON.stringify(responseData, null, 2))
        
        res.json(responseData)
    } catch (error: any)
    {
        console.error('Approve task error:', error)
        res.status(500).json
        ({
            success: false,
            message: error.message || '审核失败'
        })
    }
}

// 审核驳回任务
export const rejectTask = async (req: AuthRequest, res: Response) =>
{
    try
    {
        const { id } = req.params
        const { reason, rejectOption } = req.body
        const user = req.user
        
        console.log(`\n[REJECT API] ========== 收到审核驳回请求 ==========`)
        console.log(`[REJECT API] 任务ID: ${id}`)
        console.log(`[REJECT API] 用户ID: ${user?.id || '未授权'}`)
        console.log(`[REJECT API] 请求体 reason:`, reason)
        console.log(`[REJECT API] 请求体 rejectOption:`, rejectOption)
        console.log(`[REJECT API] rejectOption 类型:`, typeof rejectOption)
        console.log(`[REJECT API] rejectOption 值:`, JSON.stringify(rejectOption))
        
        if (!user) 
        {
            console.log(`[REJECT API] ❌ 未授权`)
            return res.status(401).json({ success: false, message:'未授权' })
        }

        if (!reason || reason.trim().length === 0)
        {
            console.log(`[REJECT API] ❌ 缺少驳回理由`)
            return res.status(400).json
            ({
                success: false,
                message: '请提供驳回理由'
            })
        }

        // 验证驳回选项：支持 resubmit、reclaim 和 rejected
        const rejectOptionStr = rejectOption ? String(rejectOption).trim() : ''
        const validOptions = ['resubmit', 'reclaim', 'rejected']
        const isValidOption = validOptions.includes(rejectOptionStr)
        
        console.log(`[REJECT API] rejectOption 字符串值: "${rejectOptionStr}"`)
        console.log(`[REJECT API] 有效选项列表:`, validOptions)
        console.log(`[REJECT API] 是否有效: ${isValidOption}`)
        
        if (!rejectOption || !isValidOption)
        {
            console.log(`[REJECT API] ❌ 无效的驳回选项`)
            console.log(`[REJECT API] 收到的选项: "${rejectOptionStr}"`)
            console.log(`[REJECT API] 有效选项: ${validOptions.join(', ')}`)
            return res.status(400).json
            ({
                success: false,
                message: `无效的驳回选项，必须是 "resubmit"、"reclaim" 或 "rejected"，收到: "${rejectOptionStr}"`
            })
        }
        
        // 确保 rejectOption 是标准化的字符串值
        const normalizedOption = String(rejectOption).trim()

        // 获取任务行
        const task = await getTaskFromDb(id)

        // 获取 task_info 以检查权限
        let taskInfo = null
        if (task.task_info_id) {
            const { data: infoData } = await supabase
                .from('task_info')
                .select('*')
                .eq('id', task.task_info_id)
                .single()
            taskInfo = infoData
        }

        // 验证任务状态（支持已提交任务的审核）
        if (task.status !== 'submitted')
        {
            return res.status(400).json
            ({
                success: false,
                message: '任务状态不正确，只能审核已提交状态的任务'
            })
        }

        // 权限检查：只有创建者可以审核（从 task_info 检查）
        if (!taskInfo || !taskInfo.creator_id)
        {
            return res.status(403).json
            ({
                success: false,
                message: '该任务没有创建者，无法审核'
            })
        }
        if (taskInfo.creator_id !== user.id)
        {
            return res.status(403).json
            ({
                success: false,
                message: '您不是任务创建者，无权审核此任务'
            })
        }

        // 仅驳回传入的单个任务行 id（多人任务中只驳回当前选中的参与者，不牵连同任务其他参与者）
        // resubmit / reclaim / rejected 均只作用于本条 task 行，不使用 task_info_id 批量操作
        // 检查该任务行是否有 proof
        const { data: proofData } = await supabase
            .from('task_proofs')
            .select('task_id')
            .eq('task_id', id)
            .not('proof', 'is', null)
            .single()
        
        if (!proofData) {
            return res.status(400).json({
                success: false,
                message: '该任务尚未提交凭证，无法审核'
            })
        }

        // 获取用户信息
        const { data: userData } = await supabase
            .from('users')
            .select('id, name')
            .eq('id', user.id)
            .single()

        const userName = userData?.name || '未知用户'

        // 根据驳回选项更新任务状态并写入时间线
        console.log(`\n[REJECT] ========== 审核驳回 ==========`)
        console.log(`[REJECT] 任务ID: ${id}`)
        console.log(`[REJECT] 审核者: ${userName} (${user.id})`)
        console.log(`[REJECT] 驳回选项: ${normalizedOption}`)
        console.log(`[REJECT] 驳回理由: ${reason.trim()}`)
        
        const now = new Date().toISOString()

        if (normalizedOption === 'resubmit') {
            // 重新提交证明：仅更新本条任务行（req.params.id），不按 task_info_id 批量、不联动其他参与者
            // 只改 tasks / task_timelines / task_proofs 中 task_id = id 的这一条
            const taskIdToUpdate = String(id).trim()
            console.log(`[REJECT] resubmit 仅作用于任务行 id=${taskIdToUpdate}，不联动同 task_info 下其他行`)

            await updateTaskStatus(
                taskIdToUpdate,
                'unsubmit',
                user.id,
                userName,
                '审核驳回',
                reason.trim()
            )

            const { error: proofError } = await supabase
                .from('task_proofs')
                .update({
                    proof: null,
                    reject_reason: reason.trim(),
                    reject_option: 'resubmit',
                    updated_at: now
                })
                .eq('task_id', taskIdToUpdate)

            if (proofError) {
                console.error(`[REJECT] ❌ 更新 task_proofs 失败:`, proofError)
            }

            console.log(`[REJECT] ========== 审核驳回完成 (resubmit)，仅任务行 ${taskIdToUpdate} ==========\n`)
            res.json({
                success: true,
                message: '任务已驳回，请重新提交证明'
            })

            // 通知领取者：被驳回需重新提交
            try {
                const claimerId = task.claimer_id
                if (claimerId) {
                    const { data: settings } = await supabase
                        .from('user_notification_settings')
                        .select('task_enabled')
                        .eq('user_id', claimerId)
                        .maybeSingle()
                    const enabled = settings?.task_enabled !== false
                    if (enabled) {
                        const dedupeKey = `task_rejected_resubmit:${taskIdToUpdate}:${now}`
                        await supabase.from('notifications').upsert([{
                            user_id: claimerId,
                            community_id: taskInfo?.community_id || null,
                            category: 'task',
                            type: 'task_rejected',
                            title: '任务被驳回',
                            body: `你领取的任务「${taskInfo?.title || ''}」被驳回：${reason.trim().slice(0, 80)}`,
                            data: { taskId: taskIdToUpdate, taskInfoId: taskInfo?.id || task.task_info_id, rejectOption: 'resubmit' },
                            dedupe_key: `task_rejected:resubmit:${taskIdToUpdate}:${reason.trim().slice(0, 20)}`
                        }], { onConflict: 'user_id,dedupe_key' })
                    }
                }
            } catch (_) {}

            return
        } else if (normalizedOption === 'reclaim') {
            // 重新发布任务：仅更新本条任务行（req.params.id），不按 task_info_id 批量、不联动其他参与者
            // 只改 tasks / task_timelines / task_proofs 中 id = id 的这一条，同一多人任务下其他人状态不变
            const taskIdToUpdate = String(id).trim()
            console.log(`[REJECT] reclaim 仅作用于任务行 id=${taskIdToUpdate}，不联动同 task_info 下其他行`)

            // 更新 tasks 表：仅本条任务行
            const { error: updateError } = await supabase
                .from('tasks')
                .update({
                    claimer_id: null,
                    status: 'unclaimed',
                    updated_at: now
                })
                .eq('id', taskIdToUpdate)

            if (updateError) {
                console.error(`[REJECT] ❌ 更新任务状态失败:`, updateError)
                throw updateError
            }

            // 更新 task_proofs 表：仅本条（用 update+eq，确保只改一行）
            const { error: proofError } = await supabase
                .from('task_proofs')
                .update({
                    proof: null,
                    reject_reason: reason.trim(),
                    reject_option: 'reclaim',
                    updated_at: now
                })
                .eq('task_id', taskIdToUpdate)

            if (proofError) {
                console.error(`[REJECT] ❌ 更新 task_proofs 失败:`, proofError)
            }

            // 只给本条任务行追加时间线
            await appendStatusToTimeline(taskIdToUpdate, 'reclaim', user.id, userName, '审核驳回', reason.trim())
            await appendStatusToTimeline(taskIdToUpdate, 'unclaimed', user.id, userName, '重新发布')

            console.log(`[REJECT] ========== 审核驳回完成 (reclaim)，仅任务行 ${taskIdToUpdate} ==========\n`)
            res.json({
            success: true,
                message: '任务已驳回，已重新发布'
            })

            // 通知领取者：被驳回需重新领取
            try {
                const claimerId = task.claimer_id
                if (claimerId) {
                    const { data: settings } = await supabase
                        .from('user_notification_settings')
                        .select('task_enabled')
                        .eq('user_id', claimerId)
                        .maybeSingle()
                    const enabled = settings?.task_enabled !== false
                    if (enabled) {
                        await supabase.from('notifications').upsert([{
                            user_id: claimerId,
                            community_id: taskInfo?.community_id || null,
                            category: 'task',
                            type: 'task_rejected',
                            title: '任务被驳回',
                            body: `你领取的任务「${taskInfo?.title || ''}」被驳回，需要重新领取`,
                            data: { taskId: taskIdToUpdate, taskInfoId: taskInfo?.id || task.task_info_id, rejectOption: 'reclaim' },
                            dedupe_key: `task_rejected:reclaim:${taskIdToUpdate}`
                        }], { onConflict: 'user_id,dedupe_key' })
                    }
                }
            } catch (_) {}

            return
        } else if (normalizedOption === 'rejected') {
            // 终止任务：仅将当前选中的这一条任务行改为 rejected（多人任务中只终止当前参与者，不关闭整个任务）
            const taskIdToUpdate = id

            await updateTaskStatus(
                taskIdToUpdate,
                'rejected',
                user.id,
                userName,
                '审核驳回',
                reason.trim()
            )

            const { error: proofError } = await supabase
                .from('task_proofs')
                .upsert({
                    task_id: taskIdToUpdate,
                    reject_reason: reason.trim(),
                    reject_option: 'rejected',
                    updated_at: now
                }, {
                    onConflict: 'task_id'
                })

            if (proofError) {
                console.error(`[REJECT] ❌ 更新 task_proofs 失败:`, proofError)
            }

            console.log(`[REJECT] ========== 审核驳回完成 (rejected)，仅任务行 ${taskIdToUpdate} ==========\n`)
            res.json({
                success: true,
                message: '任务已驳回，已终止'
            })

            // 通知领取者：被终止
            try {
                const claimerId = task.claimer_id
                if (claimerId) {
                    const { data: settings } = await supabase
                        .from('user_notification_settings')
                        .select('task_enabled')
                        .eq('user_id', claimerId)
                        .maybeSingle()
                    const enabled = settings?.task_enabled !== false
                    if (enabled) {
                        await supabase.from('notifications').upsert([{
                            user_id: claimerId,
                            community_id: taskInfo?.community_id || null,
                            category: 'task',
                            type: 'task_rejected',
                            title: '任务被终止',
                            body: `你领取的任务「${taskInfo?.title || ''}」已被终止：${reason.trim().slice(0, 80)}`,
                            data: { taskId: taskIdToUpdate, taskInfoId: taskInfo?.id || task.task_info_id, rejectOption: 'rejected' },
                            dedupe_key: `task_rejected:rejected:${taskIdToUpdate}`
                        }], { onConflict: 'user_id,dedupe_key' })
                    }
                }
            } catch (_) {}

            return
        }

        // 如果执行到这里，说明有未处理的选项（不应该发生）
        res.status(400).json({
            success: false,
            message: '未知的驳回选项'
        })
    } catch (error: any)
    {
        console.error('Reject task error:', error)
        res.status(500).json
        ({
            success: false,
            message: error.message || '审核失败'
        })
    }
}

// 标记转账完成
export const markTransferCompleted = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params
        const user = req.user
        
        console.log(`\n[MARK TRANSFER] ========== 标记转账完成 ==========`)
        console.log(`[MARK TRANSFER] 任务ID: ${id}`)
        console.log(`[MARK TRANSFER] 用户ID: ${user?.id || '未授权'}`)
        
        if (!user) {
            console.log(`[MARK TRANSFER] ❌ 未授权`)
            return res.status(401).json({ success: false, message: '未授权' })
        }
        
        // 获取任务信息，验证用户是否有权限（必须是创建者）
        const dbTask = await getTaskFromDb(id)
        const taskInfo = dbTask.task_info
        
        if (!taskInfo) {
            console.log(`[MARK TRANSFER] ❌ 任务不存在`)
            return res.status(404).json({ success: false, message: '任务不存在' })
        }
        
        // 验证是否是任务创建者
        if (taskInfo.creator_id !== user.id) {
            console.log(`[MARK TRANSFER] ❌ 只有任务创建者可以标记转账`)
            return res.status(403).json({ success: false, message: '只有任务创建者可以标记转账' })
        }
        
        // 验证任务状态必须是已完成
        if (dbTask.status !== 'completed') {
            console.log(`[MARK TRANSFER] ❌ 只有已完成的任务才能标记转账，当前状态: ${dbTask.status}`)
            return res.status(400).json({ success: false, message: '只有已完成的任务才能标记转账' })
        }
        
        // 更新 transferred_at 字段
        const now = new Date().toISOString()
        const { error } = await supabase
            .from('tasks')
            .update({ transferred_at: now })
            .eq('id', id)
        
        if (error) {
            console.error('[MARK TRANSFER] ❌ 更新数据库失败:', error)
            return res.status(500).json({ success: false, message: '标记转账失败' })
        }
        
        console.log(`[MARK TRANSFER] ✅ 转账已标记为完成`)
        console.log(`[MARK TRANSFER] ========== 标记完成 ==========\n`)
        
        res.json({
            success: true,
            message: '转账已标记为完成',
            data: {
                transferredAt: formatLocalDateTime(now)
            }
        })
    } catch (error: any) {
        console.error('[MARK TRANSFER] ❌ 标记转账完成错误:', error)
        res.status(500).json({
            success: false,
            message: error.message || '标记转账失败'
        })
    }
}

// 取消转账标记（清除 transferred_at）
export const unmarkTransferCompleted = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params
        const user = req.user
        
        console.log(`\n[UNMARK TRANSFER] ========== 取消转账标记 ==========`)
        console.log(`[UNMARK TRANSFER] 任务ID: ${id}`)
        console.log(`[UNMARK TRANSFER] 用户ID: ${user?.id || '未授权'}`)
        
        if (!user) {
            console.log(`[UNMARK TRANSFER] ❌ 未授权`)
            return res.status(401).json({ success: false, message: '未授权' })
        }
        
        // 获取任务信息，验证用户是否有权限（必须是创建者）
        const dbTask = await getTaskFromDb(id)
        const taskInfo = dbTask.task_info
        
        if (!taskInfo) {
            console.log(`[UNMARK TRANSFER] ❌ 任务不存在`)
            return res.status(404).json({ success: false, message: '任务不存在' })
        }
        
        // 验证是否是任务创建者
        if (taskInfo.creator_id !== user.id) {
            console.log(`[UNMARK TRANSFER] ❌ 只有任务创建者可以取消转账标记`)
            return res.status(403).json({ success: false, message: '只有任务创建者可以取消转账标记' })
        }
        
        // 验证任务状态必须是已完成
        if (dbTask.status !== 'completed') {
            console.log(`[UNMARK TRANSFER] ❌ 只有已完成的任务才能取消转账标记，当前状态: ${dbTask.status}`)
            return res.status(400).json({ success: false, message: '只有已完成的任务才能取消转账标记' })
        }
        
        // 清除 transferred_at 字段（设为 null）
        const { error } = await supabase
            .from('tasks')
            .update({ transferred_at: null })
            .eq('id', id)
        
        if (error) {
            console.error('[UNMARK TRANSFER] ❌ 清除转账标记失败:', error)
            return res.status(500).json({ success: false, message: '取消转账标记失败' })
        }
        
        console.log(`[UNMARK TRANSFER] ✅ 转账标记已清除`)
        console.log(`[UNMARK TRANSFER] ========== 取消完成 ==========\n`)
        
        res.json({
            success: true,
            message: '转账标记已取消',
            data: {
                transferredAt: null
            }
        })
    } catch (error: any) {
        console.error('[UNMARK TRANSFER] ❌ 取消转账标记错误:', error)
        res.status(500).json({
            success: false,
            message: error.message || '取消转账标记失败'
        })
    }
}

// ==================== 日历任务卡片 ====================

/**
 * 日历任务卡片项（返回给前端的结构）
 */
interface CalendarTaskCard {
  taskInfoId: string       // task_info UUID，用于跳转详情
  taskId: string           // 第一个任务行 ID，用于路由 task/detail/:taskId
  title: string            // 任务标题
  dateKey: string          // 该卡片对应的日期 YYYY-MM-DD
  dateLabel: string        // 日期标签，如 "开始日 06.05"
  labelType: 'start' | 'deadline' | 'submit_deadline'  // 标签类型
  /** 预留：标签体系引入后可配置边框颜色，默认红框 */
  borderColor: string
  /** 该卡片对应日期的时刻（用于排序），ISO 字符串 */
  sortTime: string
  /** 用户对该任务的状态（已领取/已提交/已完成等），仅 mine 模式下有值 */
  userStatus?: 'claimed' | 'submitted' | 'completed' | null
}

/**
 * 获取日历任务卡片
 * GET /api/tasks/calendar-cards?communityId=xxx&from=ISO&to=ISO&mine=0|1
 *
 * 仅返回 is_multi = true（participant_limit > 1）的多人任务
 * 每个任务最多在 3 个日期展示卡片：
 *   - 开始日（所有用户可见）
 *   - 领取截止日（所有用户可见）
 *   - 提交截止日（仅已报名用户可见）
 *
 * mine=1 时：只显示用户已领取的多人任务，且只展示截止时间卡片（领取截止+提交截止）
 */
export const getCalendarCards = async (req: Request, res: Response) => {
  try {
    const communityId = (req.query.communityId as string)?.trim() || null
    const from = req.query.from as string
    const to = req.query.to as string
    const mine = req.query.mine === '1'

    if (!communityId || !from || !to) {
      return res.status(400).json({ error: '缺少 communityId / from / to 参数' })
    }

    // 获取当前登录用户（可选，用于判断提交截止日可见性）
    const userId = (req as any).user?.id as string | undefined

    // mine 模式必须登录
    if (mine && !userId) {
      return res.json({ cards: [] })
    }

    // 查询该社区下所有多人任务的 task_info
    const { data: taskInfos, error: infoError } = await supabase
      .from('task_info')
      .select('id, title, start_date, deadline, submit_deadline, participant_limit, community_id')
      .eq('community_id', communityId)
      .gt('participant_limit', 1) // 仅多人任务

    if (infoError) throw infoError
    if (!taskInfos || taskInfos.length === 0) {
      return res.json({ cards: [] })
    }

    // 获取每个 task_info 的第一个任务行 ID（用于路由跳转）
    const taskInfoIds = taskInfos.map((ti: any) => ti.id)
    const { data: firstTasks } = await supabase
      .from('tasks')
      .select('id, task_info_id')
      .in('task_info_id', taskInfoIds)
      .order('participant_index', { ascending: true })

    // 构建 taskInfoId -> firstTaskId 映射
    const firstTaskMap: Record<string, string> = {}
    if (firstTasks) {
      for (const t of firstTasks) {
        if (!firstTaskMap[t.task_info_id]) {
          firstTaskMap[t.task_info_id] = t.id
        }
      }
    }

    // 如果用户已登录，查询该用户在哪些 task_info 下有报名（claimer_id = userId）
    let userClaimedInfoIds = new Set<string>()
    // 用户对每个 task_info 的状态（claimed / submitted / completed）
    const userTaskStatus: Record<string, 'claimed' | 'submitted' | 'completed' | null> = {}
    if (userId) {
      const { data: claimedTasks } = await supabase
        .from('tasks')
        .select('task_info_id, status')
        .eq('claimer_id', userId)
        .in('task_info_id', taskInfoIds)
      if (claimedTasks) {
        for (const t of claimedTasks) {
          userClaimedInfoIds.add(t.task_info_id)
          // 记录用户对该任务的状态
          if (t.status === 'completed') {
            userTaskStatus[t.task_info_id] = 'completed'
          } else if (t.status === 'submitted' || t.status === 'under_review') {
            userTaskStatus[t.task_info_id] = 'submitted'
          } else {
            userTaskStatus[t.task_info_id] = 'claimed'
          }
        }
      }
    }

    // mine 模式：只保留用户已领取的任务
    let filteredTaskInfos = taskInfos
    if (mine) {
      filteredTaskInfos = taskInfos.filter((ti: any) => userClaimedInfoIds.has(ti.id))
    }

    // 解析日期范围
    const fromDate = new Date(from)
    const toDate = new Date(to)

    // 辅助：将 ISO/日期字符串转为本地日期 key YYYY-MM-DD
    const toDayKey = (iso: string | null | undefined): string | null => {
      if (!iso) return null
      const d = new Date(iso)
      if (isNaN(d.getTime())) return null
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${day}`
    }

    // 辅助：格式化日期标签中的月日部分 MM.DD
    const fmtMD = (iso: string | null | undefined): string => {
      if (!iso) return ''
      const d = new Date(iso)
      if (isNaN(d.getTime())) return ''
      return `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
    }

    // 默认边框颜色（预留可配置）
    const DEFAULT_TASK_BORDER_COLOR = '#E53935'

    const cards: CalendarTaskCard[] = []

    for (const ti of filteredTaskInfos) {
      const taskInfoId = ti.id
      const firstTaskId = firstTaskMap[taskInfoId]
      if (!firstTaskId) continue

      const startDateKey = toDayKey(ti.start_date)
      const deadlineKey = toDayKey(ti.deadline)
      const submitDeadlineKey = toDayKey(ti.submit_deadline)
      const isClaimed = userClaimedInfoIds.has(taskInfoId)
      const taskStatus = userTaskStatus[taskInfoId] || null

      if (mine) {
        // mine 模式：只显示提交截止日卡片
        if (submitDeadlineKey && isClaimed) {
          const cardDate = new Date(submitDeadlineKey)
          if (cardDate >= fromDate && cardDate <= toDate) {
            cards.push({
              taskInfoId,
              taskId: firstTaskId,
              title: ti.title || '',
              dateKey: submitDeadlineKey,
              dateLabel: `截止提交 ${fmtMD(ti.submit_deadline)}`,
              labelType: 'submit_deadline',
              borderColor: DEFAULT_TASK_BORDER_COLOR,
              sortTime: ti.submit_deadline,
              userStatus: taskStatus,
            })
          }
        }
      } else {
        // 非mine模式：显示所有卡片
        // 开始日卡片 - 所有用户可见
        if (startDateKey) {
          const cardDate = new Date(startDateKey)
          if (cardDate >= fromDate && cardDate <= toDate) {
            cards.push({
              taskInfoId,
              taskId: firstTaskId,
              title: ti.title || '',
              dateKey: startDateKey,
              dateLabel: `开始日 ${fmtMD(ti.start_date)}`,
              labelType: 'start',
              borderColor: DEFAULT_TASK_BORDER_COLOR,
              sortTime: ti.start_date,
              userStatus: isClaimed ? taskStatus : null,
            })
          }
        }

        // 领取截止日卡片 - 所有用户可见
        if (deadlineKey) {
          const cardDate = new Date(deadlineKey)
          if (cardDate >= fromDate && cardDate <= toDate) {
            cards.push({
              taskInfoId,
              taskId: firstTaskId,
              title: ti.title || '',
              dateKey: deadlineKey,
              dateLabel: `截止领取 ${fmtMD(ti.deadline)}`,
              labelType: 'deadline',
              borderColor: DEFAULT_TASK_BORDER_COLOR,
              sortTime: ti.deadline,
              userStatus: isClaimed ? taskStatus : null,
            })
          }
        }

        // 提交截止日卡片 - 仅已报名用户可见
        if (submitDeadlineKey && isClaimed) {
          const cardDate = new Date(submitDeadlineKey)
          if (cardDate >= fromDate && cardDate <= toDate) {
            cards.push({
              taskInfoId,
              taskId: firstTaskId,
              title: ti.title || '',
              dateKey: submitDeadlineKey,
              dateLabel: `截止提交 ${fmtMD(ti.submit_deadline)}`,
              labelType: 'submit_deadline',
              borderColor: DEFAULT_TASK_BORDER_COLOR,
              sortTime: ti.submit_deadline,
              userStatus: taskStatus,
            })
          }
        }
      }
    }

    res.json({ cards })
  } catch (error: any) {
    console.error('[GET CALENDAR CARDS] Error:', error)
    handleError(res, error, '获取日历任务卡片失败')
  }
}

// ==================== 领取者撤回提交 ====================

/**
 * 撤回提交（仅领取者；状态 submitted → unsubmit，保留 task_proofs）
 * PATCH /api/tasks/:id/withdraw-submission
 */
export const withdrawSubmission = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user
    const taskId = String(req.params.id || '').trim()
    if (!taskId) {
      return res.status(400).json({ success: false, message: '缺少任务ID' })
    }

    const task = await getTaskFromDb(taskId)

    let taskInfo: any = task.task_info || null
    if (!taskInfo && task.task_info_id) {
      const { data: infoData } = await supabase
        .from('task_info')
        .select('id, title, creator_id, community_id, submit_deadline')
        .eq('id', task.task_info_id)
        .single()
      taskInfo = infoData
    }

    const validation = validateWithdrawSubmission({
      userId: user?.id,
      claimerId: task.claimer_id,
      status: task.status,
      proof: task.proof,
      submitDeadline: taskInfo?.submit_deadline,
    })

    if (!validation.ok) {
      const statusCode =
        validation.code === 'UNAUTHORIZED' ? 401
        : validation.code === 'NOT_CLAIMER' ? 403
        : 400
      return res.status(statusCode).json({ success: false, message: validation.message })
    }

    const { data: userData } = await supabase
      .from('users')
      .select('id, name')
      .eq('id', user!.id)
      .single()
    const userName = userData?.name || '未知用户'

    // 乐观锁：仅当仍为 submitted 时更新
    const { data: updatedRow, error: updateError } = await supabase
      .from('tasks')
      .update({ status: 'unsubmit', updated_at: new Date().toISOString() })
      .eq('id', taskId)
      .eq('status', 'submitted')
      .select('id')
      .maybeSingle()

    if (updateError) throw updateError
    if (!updatedRow) {
      return res.status(409).json({
        success: false,
        message: '任务状态已变更，无法撤回（可能已被审核）',
      })
    }

    await appendStatusToTimeline(taskId, 'unsubmit', user!.id, userName, '撤回提交')

    // 清理发布者的「待审核」通知
    try {
      await supabase
        .from('notifications')
        .delete()
        .eq('dedupe_key', `task_submit:${taskId}`)
    } catch (_) {}

    // 可选：通知创建者
    try {
      const creatorId = taskInfo?.creator_id
      if (creatorId && creatorId !== user!.id) {
        const { data: settings } = await supabase
          .from('user_notification_settings')
          .select('task_enabled')
          .eq('user_id', creatorId)
          .maybeSingle()
        const enabled = settings?.task_enabled !== false
        if (enabled) {
          await supabase.from('notifications').insert([{
            user_id: creatorId,
            community_id: taskInfo?.community_id || null,
            category: 'task',
            type: 'task_withdraw_submission',
            title: '任务提交已撤回',
            body: `${userName} 撤回了任务「${taskInfo?.title || ''}」的提交`,
            data: { taskId, taskInfoId: taskInfo?.id || task.task_info_id, fromUserId: user!.id },
          }])
        }
      }
    } catch (_) {}

    res.json({ success: true, message: '已撤回提交，可继续编辑后重新提交' })
  } catch (error: any) {
    console.error('[withdrawSubmission] error:', error)
    res.status(500).json({ success: false, message: error?.message || '撤回提交失败' })
  }
}

// ==================== 发布者撤回/删除（未被领取前） ====================

/**
 * 撤回任务（仅发布者；且同 task_info 下无人领取）
 * 撤回会删除该任务（task_info + tasks 等级联），并返回用于“重新编辑”的草稿数据
 * POST /api/tasks/:id/withdraw
 */
export const withdrawTask = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user
    if (!user) return res.status(401).json({ error: '未授权' })

    const taskId = String(req.params.id || '').trim()
    if (!taskId) return res.status(400).json({ error: '缺少任务ID' })

    const { data: taskRow, error: taskError } = await supabase
      .from('tasks')
      .select('id, task_info_id')
      .eq('id', taskId)
      .single()

    if (taskError) {
      if ((taskError as any).code === 'PGRST116') return res.status(404).json({ error: '任务不存在' })
      throw taskError
    }

    const taskInfoId = (taskRow as any).task_info_id as string
    const { data: taskInfo, error: infoError } = await supabase
      .from('task_info')
      .select('id, title, description, start_date, deadline, submit_deadline, participant_limit, reward_distribution_mode, proof_config, submission_instructions, creator_id, assigned_user_id, community_id')
      .eq('id', taskInfoId)
      .single()

    if (infoError) throw infoError
    if (!taskInfo) return res.status(404).json({ error: '任务不存在' })

    if ((taskInfo as any).creator_id !== user.id) {
      return res.status(403).json({ error: '无权撤回此任务' })
    }

    // 检查是否有人领取过（同 task_info 下任意行 claimer_id 非空）
    const { count: claimedCount, error: claimedError } = await supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('task_info_id', taskInfoId)
      .not('claimer_id', 'is', null)

    if (claimedError) throw claimedError
    if ((claimedCount || 0) > 0) {
      return res.status(400).json({ error: '已有用户领取过该任务，无法撤回' })
    }

    // 取一条任务行的 reward/currency 作为“每人积分”的草稿值
    const { data: anyTaskRow, error: anyTaskError } = await supabase
      .from('tasks')
      .select('reward, currency')
      .eq('task_info_id', taskInfoId)
      .order('participant_index', { ascending: true })
      .limit(1)
      .single()
    if (anyTaskError) throw anyTaskError

    // assignedUserIds 兼容：从 proof_config._assignedUserIds 或 assigned_user_id 推导
    const proofConfig = (taskInfo as any).proof_config || null
    const assignedFromConfig = Array.isArray(proofConfig?._assignedUserIds) ? proofConfig._assignedUserIds : []
    const assignedFromSingle = (taskInfo as any).assigned_user_id ? [(taskInfo as any).assigned_user_id] : []
    const assignedUserIds = assignedFromConfig.length > 0 ? assignedFromConfig : assignedFromSingle

    const draft = {
      title: (taskInfo as any).title,
      description: (taskInfo as any).description,
      reward: Number((anyTaskRow as any)?.reward || 0),
      currency: (anyTaskRow as any)?.currency || 'NT',
      startDate: formatLocalDateTime((taskInfo as any).start_date),
      deadline: formatLocalDateTime((taskInfo as any).deadline),
      submitDeadline: formatLocalDateTime((taskInfo as any).submit_deadline),
      participantLimit: (taskInfo as any).participant_limit ?? 1,
      rewardDistributionMode: (taskInfo as any).reward_distribution_mode || 'per_person',
      submissionInstructions: (taskInfo as any).submission_instructions || '',
      proofConfig,
      assignedUserIds,
      communityId: (taskInfo as any).community_id || null
    }

    // 删除 task_info（级联删除 tasks/task_timelines/task_proofs）
    const { error: deleteError } = await supabase
      .from('task_info')
      .delete()
      .eq('id', taskInfoId)

    if (deleteError) throw deleteError

    res.json({ success: true, draft })
  } catch (error: any) {
    console.error('[withdrawTask] error:', error)
    res.status(500).json({ error: error?.message || '撤回失败' })
  }
}

/**
 * 删除任务（仅发布者；且同 task_info 下无人领取）
 * DELETE /api/tasks/:id
 */
export const deleteTask = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user
    if (!user) return res.status(401).json({ error: '未授权' })

    const taskId = String(req.params.id || '').trim()
    if (!taskId) return res.status(400).json({ error: '缺少任务ID' })

    const { data: taskRow, error: taskError } = await supabase
      .from('tasks')
      .select('id, task_info_id')
      .eq('id', taskId)
      .single()

    if (taskError) {
      if ((taskError as any).code === 'PGRST116') return res.status(404).json({ error: '任务不存在' })
      throw taskError
    }

    const taskInfoId = (taskRow as any).task_info_id as string
    const { data: taskInfo, error: infoError } = await supabase
      .from('task_info')
      .select('id, creator_id')
      .eq('id', taskInfoId)
      .single()

    if (infoError) throw infoError
    if (!taskInfo) return res.status(404).json({ error: '任务不存在' })

    if ((taskInfo as any).creator_id !== user.id) {
      return res.status(403).json({ error: '无权删除此任务' })
    }

    const { count: claimedCount, error: claimedError } = await supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('task_info_id', taskInfoId)
      .not('claimer_id', 'is', null)

    if (claimedError) throw claimedError
    if ((claimedCount || 0) > 0) {
      return res.status(400).json({ error: '已有用户领取过该任务，无法删除' })
    }

    const { error: deleteError } = await supabase
      .from('task_info')
      .delete()
      .eq('id', taskInfoId)

    if (deleteError) throw deleteError

    res.json({ success: true, message: '任务已删除' })
  } catch (error: any) {
    console.error('[deleteTask] error:', error)
    res.status(500).json({ error: error?.message || '删除失败' })
  }
}

// ==================== 任务标签管理 ====================

/** GET /api/tasks/tags/:communityId */
export const listTaskTags = async (req: AuthRequest, res: Response) => {
  try {
    const communityId = req.params.communityId
    if (!communityId) return res.status(400).json({ result: 'error', message: '缺少 communityId' })
    const role = await getMemberRole(communityId, req.user!.id)
    if (!role) return res.status(403).json({ result: 'error', message: '请先加入该社区' })
    await ensureDefaultTaskTags(communityId)
    const { data, error } = await supabase
      .from('community_task_tags')
      .select('id, name, color_hex, sort_order, created_at, archived')
      .eq('community_id', communityId)
      .or('archived.is.null,archived.eq.false')
      .order('sort_order', { ascending: true })
    if (error) throw error
    res.json({
      tags: (data || []).map((t) => ({
        id: t.id,
        name: t.name,
        colorHex: t.color_hex,
        sortOrder: t.sort_order,
        createdAt: t.created_at,
        archived: t.archived || false,
      })),
    })
  } catch (e: any) {
    console.error(e)
    res.status(500).json({ result: 'error', message: e.message || 'Internal error' })
  }
}

/** POST /api/tasks/tags/:communityId */
export const createTaskTag = async (req: AuthRequest, res: Response) => {
  try {
    const communityId = req.params.communityId
    const { name, colorHex } = req.body || {}
    if (!name || !String(name).trim()) return res.status(400).json({ result: 'error', message: 'name 必填' })
    const color = colorHex && String(colorHex).trim() ? String(colorHex).trim() : '#64748b'
    const { data, error } = await supabase
      .from('community_task_tags')
      .insert({
        community_id: communityId,
        name: String(name).trim().slice(0, 100),
        color_hex: color.slice(0, 20),
      })
      .select('id, name, color_hex, sort_order, created_at')
      .single()
    if (error) throw error
    res.status(201).json({
      tag: {
        id: data.id,
        name: data.name,
        colorHex: data.color_hex,
        sortOrder: data.sort_order,
        createdAt: data.created_at,
      },
    })
  } catch (e: any) {
    console.error(e)
    res.status(500).json({ result: 'error', message: e.message || 'Internal error' })
  }
}

/** PATCH /api/tasks/tags/:communityId/:tagId */
export const updateTaskTag = async (req: AuthRequest, res: Response) => {
  try {
    const communityId = req.params.communityId
    const tagId = req.params.tagId
    const { name, colorHex } = req.body || {}
    const patch: Record<string, string> = {}
    if (name != null) patch.name = String(name).trim().slice(0, 100)
    if (colorHex != null) patch.color_hex = String(colorHex).trim().slice(0, 20)
    if (!Object.keys(patch).length) return res.status(400).json({ result: 'error', message: '无可更新字段' })
    const { data, error } = await supabase
      .from('community_task_tags')
      .update(patch)
      .eq('id', tagId)
      .eq('community_id', communityId)
      .select('id, name, color_hex, sort_order, created_at')
      .maybeSingle()
    if (error) throw error
    if (!data) return res.status(404).json({ result: 'error', message: '标签不存在' })
    res.json({
      tag: {
        id: data.id,
        name: data.name,
        colorHex: data.color_hex,
        sortOrder: data.sort_order,
        createdAt: data.created_at,
      },
    })
  } catch (e: any) {
    console.error(e)
    res.status(500).json({ result: 'error', message: e.message || 'Internal error' })
  }
}

/** DELETE /api/tasks/tags/:communityId/:tagId — archive instead of hard delete */
export const deleteTaskTag = async (req: AuthRequest, res: Response) => {
  try {
    const communityId = req.params.communityId
    const tagId = req.params.tagId
    const { error } = await supabase
      .from('community_task_tags')
      .update({ archived: true })
      .eq('id', tagId)
      .eq('community_id', communityId)
    if (error) throw error
    res.json({ ok: true })
  } catch (e: any) {
    console.error(e)
    res.status(500).json({ result: 'error', message: e.message || 'Internal error' })
  }
}