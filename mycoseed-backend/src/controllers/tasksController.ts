import { Request, Response } from 'express'
import { supabase } from '../services/supabase'
import { Task, CreateTaskParams, TaskStatus, TimelineStatus } from '../types/task'
import { AuthRequest } from '../middleware/auth'

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
  taskProof?: any
): Task & { creatorName?: string; creatorAvatar?: string; claimerId?: string; claimerName?: string } => {
  // 从 task_info 或 dbTask 中获取基本信息
  const info = taskInfo || dbTask.task_info || {}
  
  // 从 task_timelines 获取时间线
  const timeline = taskTimeline?.timeline || dbTask.timeline || []
  
  // 从 task_proofs 获取凭证和审核信息
  const proof = taskProof?.proof || dbTask.proof
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
  claimerName: dbTask.claimer?.name || null
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
      .select('proof, reject_reason, reject_option, discount, discount_reason')
      .eq('task_id', taskId)
      .single()
    
    if (!proofError && proofData) {
      taskProof = proofData
      taskDataWithRelations.proof = proofData.proof
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
      .select('id, task_info_id, creator_id, claimer_id, reward, currency, weight_coefficient, participant_index, status, completed_at, created_at, updated_at')
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


// 获取所有任务（适配新数据库结构）；支持 ?communityId= 按社区过滤
export const getAllTasks = async (req: Request, res: Response) => {
    try {
      const communityId = (req.query.communityId as string)?.trim() || null

      // 只选择 tasks 表中存在的字段（排除已删除的字段）
      let tasksData: any[] = []
      if (communityId) {
        const { data: infoIds } = await supabase.from('task_info').select('id').eq('community_id', communityId)
        const ids = (infoIds || []).map((i: any) => i.id)
        if (ids.length === 0) {
          return res.json([])
        }
        const { data, error } = await supabase
          .from('tasks')
          .select('id, task_info_id, creator_id, claimer_id, reward, currency, weight_coefficient, participant_index, status, completed_at, created_at, updated_at')
          .in('task_info_id', ids)
          .order('created_at', { ascending: false })
        if (error) throw error
        tasksData = data || []
      } else {
        const { data, error } = await supabase
          .from('tasks')
          .select('id, task_info_id, creator_id, claimer_id, reward, currency, weight_coefficient, participant_index, status, completed_at, created_at, updated_at')
          .order('created_at', { ascending: false })
        if (error) throw error
        tasksData = data || []
      }

      // 获取所有 task_info_id
      const taskInfoIds = [...new Set(tasksData.filter(t => t.task_info_id).map(t => t.task_info_id))]
      
      // 批量获取 task_info
      let taskInfoMap: Record<string, any> = {}
      if (taskInfoIds.length > 0) {
        const { data: taskInfosData } = await supabase
          .from('task_info')
          .select('*')
          .in('id', taskInfoIds)
        
        if (taskInfosData) {
          taskInfoMap = taskInfosData.reduce((acc, info) => {
            acc[info.id] = info
            return acc
          }, {} as Record<string, any>)
        }
      }
  
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
  
      // 获取所有创建者ID和领取者ID（含 task_info 的 creator_id，确保任务卡片能拿到发布者头像）
      const creatorIdsFromTasks = [...new Set(tasksData.filter(t => t.creator_id).map(t => t.creator_id))]
      const creatorIdsFromInfo = [...new Set(Object.values(taskInfoMap).filter((info: any) => info.creator_id).map((info: any) => info.creator_id))]
      const creatorIds = [...new Set([...creatorIdsFromTasks, ...creatorIdsFromInfo])]
      const claimerIds = [...new Set(tasksData.filter(t => t.claimer_id).map(t => t.claimer_id))]
      const allUserIds = [...new Set([...creatorIds, ...claimerIds])]
      
      // 批量获取用户信息（含头像，用于任务卡片展示）
      let usersMap: Record<string, { id: string; name: string; avatar?: string }> = {}
      if (allUserIds.length > 0) {
        const { data: usersData } = await supabase
          .from('users')
          .select('id, name, avatar')
          .in('id', allUserIds)
        
        if (usersData) {
          usersMap = usersData.reduce((acc, user) => {
            acc[user.id] = user
            return acc
          }, {} as Record<string, { id: string; name: string; avatar?: string }>)
        }
      }
      
      // 为每个任务添加 task_info、用户信息、timeline 和 proof
      const tasksWithInfo = tasksData
        .filter(task => {
          // 只保留有 task_info_id 且能找到对应 task_info 的任务
          if (!task.task_info_id) return false
          const taskInfo = taskInfoMap[task.task_info_id]
          if (!taskInfo) return false
          return true
        })
        .map(task => {
          const taskInfo = taskInfoMap[task.task_info_id]
          const creatorUser = (task.creator_id ? usersMap[task.creator_id] : null) || (taskInfo?.creator_id ? usersMap[taskInfo.creator_id] : null)
          return {
        ...task,
            task_info: taskInfo,
            creator: creatorUser,
            claimer: task.claimer_id ? usersMap[task.claimer_id] : null,
            task_timeline: timelinesMap[task.id] || { timeline: [] },
            task_proof: proofsMap[task.id] || null
          }
        })
  
      // 按 task_info_id 分组（多人任务应该只显示一个卡片）
      const taskGroups: Record<string, any[]> = {}
      tasksWithInfo.forEach(task => {
        const key = task.task_info_id
        if (!taskGroups[key]) {
          taskGroups[key] = []
        }
        taskGroups[key].push(task)
      })
  
      // 为每个任务组创建一个代表任务
      const groupedTasks = Object.values(taskGroups).map(taskGroup => {
        const firstTask = taskGroup[0]
        const firstTaskWithRelations = firstTask as TaskDataWithRelations
        const taskInfo = firstTaskWithRelations.task_info
        
        // 如果是多人任务（participant_limit > 1），返回一个代表任务组
        if (taskInfo.participant_limit && taskInfo.participant_limit > 1) {
          // 计算已领取数量
          const claimedCount = taskGroup.filter(t => t.claimer_id).length
          
          // 获取所有参与者的信息
          const participants = taskGroup.map(t => {
            const participantTask = mapDbTaskToTask(
              t,
              taskInfo,
              t.task_timeline,
              t.task_proof
            )
            return {
              id: participantTask.id,
              name: participantTask.claimerName || '未领取',
              claimerId: participantTask.claimerId || undefined, // 添加 claimerId 用于前端匹配
              claimedAt: participantTask.claimedAt || '',
              submittedAt: participantTask.submittedAt,
              proof: participantTask.proof,
              status: participantTask.status,
              reward: participantTask.reward,
              currency: participantTask.currency
            }
          })
          
          // 使用第一个任务行的ID作为代表ID（用于路由）
          const firstTaskWithRelations = firstTask as TaskDataWithRelations
          const representativeTask = mapDbTaskToTask(
            firstTask,
            taskInfo,
            firstTaskWithRelations.task_timeline,
            firstTaskWithRelations.task_proof
          )
          
          // 添加参与者列表
          representativeTask.participantsList = participants
          
          // 计算整体状态：如果未领完，状态应该是 'unclaimed'（显示为"未领完"）
          // 如果已领完但还有未提交的，状态应该是第一个未提交的状态
          // 如果所有参与者都已完成，状态应该是 'completed'
          if (claimedCount < taskInfo.participant_limit) {
            // 未领完：使用 'unclaimed' 状态，但前端会通过 participantsList 判断显示"未领完"
            representativeTask.status = 'unclaimed' as any
          } else {
            // 已领完：检查所有参与者的状态
            const allCompleted = participants.every(p => 
              p.status === 'completed' || p.status === 'rejected'
            )
            
            if (allCompleted && participants.length > 0) {
              // 所有参与者都已完成或被驳回
              const hasCompleted = participants.some(p => p.status === 'completed')
              representativeTask.status = hasCompleted ? 'completed' : 'rejected' as any
            } else {
              // 还有未完成的参与者：使用第一个未完成参与者的状态
              const uncompletedParticipant = participants.find(p => 
                p.status !== 'completed' && p.status !== 'rejected'
              )
              if (uncompletedParticipant) {
                representativeTask.status = uncompletedParticipant.status as any
              } else {
                // 默认情况（不应该发生）
                representativeTask.status = 'unclaimed' as any
              }
            }
          }
          
          return representativeTask
        } else {
          // 单人任务：直接返回
          return mapDbTaskToTask(
            firstTask,
            taskInfo,
            firstTask.task_timeline,
            firstTask.task_proof
          )
        }
      })
      
      res.json(groupedTasks)
    } catch (error: any) {
      console.error('[GET ALL TASKS] Error:', error)
      handleError(res, error, '获取任务列表失败')
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
        .select('id, task_info_id, creator_id, claimer_id, reward, currency, weight_coefficient, participant_index, status, completed_at, created_at, updated_at')
  
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
        null
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
        completedAt: task.completedAt
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
        const { proof } = req.body
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
            // 更新 tasks 表：设置状态和完成时间
            const { error: statusError } = await supabase
            .from('tasks')
                .update({
                    status: 'completed',
                    completed_at: now,
                    updated_at: now
                })
                .eq('id', taskRow.id)

            if (statusError) throw statusError

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