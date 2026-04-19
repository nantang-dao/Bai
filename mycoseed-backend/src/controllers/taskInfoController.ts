import { Response } from 'express'
import { supabase } from '../services/supabase'
import { ensureSubtaskMallListings, ensureTaskpoolPoolPrimaryListing } from '../services/taskpoolMallSync'
import { AuthRequest } from '../middleware/auth'
import type { TaskSubtaskDraft, TaskpoolPhase } from '../types/task'

type TaskInfoSubtaskRow = {
  id: string
  creator_id: string
  manager_user_id: string | null
  subtasks_finalized: boolean
  taskpool_create_tx_hash: string | null
  use_taskpool: boolean
  submit_deadline?: string | null
  planned_lock_nt?: string | number | null
}

async function loadTaskInfoForSubtasks(taskInfoId: string) {
  const { data, error } = await supabase
    .from('task_info')
    .select(
      'id, creator_id, manager_user_id, subtasks_finalized, taskpool_create_tx_hash, use_taskpool, submit_deadline, planned_lock_nt'
    )
    .eq('id', taskInfoId)
    .single()
  if (error || !data) {
    return { ok: false as const, status: 404 as const, error: '任务信息不存在' }
  }
  return { ok: true as const, taskInfo: data as TaskInfoSubtaskRow }
}

function formatLocalDateTime(timestamp: string | null | undefined): string | undefined {
  if (!timestamp) return undefined
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(timestamp)) return timestamp
  const date = new Date(timestamp)
  if (isNaN(date.getTime())) return undefined
  const beijingTime = new Date(date.getTime() + 8 * 60 * 60 * 1000)
  const year = beijingTime.getUTCFullYear()
  const month = String(beijingTime.getUTCMonth() + 1).padStart(2, '0')
  const day = String(beijingTime.getUTCDate()).padStart(2, '0')
  const hour = String(beijingTime.getUTCHours()).padStart(2, '0')
  const minute = String(beijingTime.getUTCMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hour}:${minute}`
}

/** 与 tasksController.createTask 一致：前端 YYYY-MM-DDTHH:mm 按 UTC+8 解析 */
const parseLocalDateTime = (dateString: string | null | undefined): Date | null => {
  if (!dateString) return null
  const cleanDateString = dateString.replace(/Z$|[+-]\d{2}:?\d{2}$/, '')
  const match = cleanDateString.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/)
  if (match) {
    const [_, year, month, day, hour, minute] = match.map(Number)
    const utcDate = new Date(Date.UTC(year, month - 1, day, hour, minute))
    return new Date(utcDate.getTime() - 8 * 60 * 60 * 1000)
  }
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return null
  return date
}

const normalizeDateTime = (dateTimeStr: string | undefined): string | null => {
  if (!dateTimeStr) return null
  const cleanStr = dateTimeStr.replace(/Z$|[+-]\d{2}:?\d{2}$/, '')
  const isoPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/
  if (isoPattern.test(cleanStr)) return `${cleanStr}+08:00`
  return dateTimeStr
}

type TaskPoolDraftGate =
  | { ok: true; taskInfo: any; taskCount: number; creatorId: string }
  | { ok: false; status: number; error: string }

async function gateTaskPoolDraftEdit(taskInfoId: string, userId: string): Promise<TaskPoolDraftGate> {
  const { data: taskInfo, error: infoError } = await supabase
    .from('task_info')
    .select(
      'id, title, description, start_date, deadline, submit_deadline, participant_limit, reward_distribution_mode, proof_config, submission_instructions, creator_id, community_id, use_taskpool, manager_user_id, taskpool_create_tx_hash, subtasks_finalized, allow_split, planned_lock_nt'
    )
    .eq('id', taskInfoId)
    .single()
  if (infoError || !taskInfo) {
    return { ok: false, status: 404, error: '任务信息不存在' }
  }
  if ((taskInfo as any).use_taskpool !== true) {
    return { ok: false, status: 400, error: '非任务池任务，无法编辑' }
  }
  if ((taskInfo as any).creator_id !== userId) {
    return { ok: false, status: 403, error: '无权编辑此任务池' }
  }
  if ((taskInfo as any).manager_user_id != null) {
    return { ok: false, status: 400, error: '任务池已被认领 Manager，无法编辑主信息' }
  }
  if ((taskInfo as any).taskpool_create_tx_hash) {
    return { ok: false, status: 400, error: '已发起链上建池，无法编辑' }
  }
  if ((taskInfo as any).subtasks_finalized === true) {
    return { ok: false, status: 400, error: '子任务已定稿，无法编辑主信息' }
  }
  const { count: claimedCount, error: claimedError } = await supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('task_info_id', taskInfoId)
    .not('claimer_id', 'is', null)
  if (claimedError) throw claimedError
  if ((claimedCount || 0) > 0) {
    return { ok: false, status: 400, error: '已有用户领取过该任务池，无法编辑' }
  }
  const { count: taskCount, error: tcErr } = await supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('task_info_id', taskInfoId)
  if (tcErr) throw tcErr
  const n = taskCount || 0
  if (n === 0) {
    return { ok: false, status: 400, error: '任务池缺少任务行' }
  }
  return { ok: true, taskInfo, taskCount: n, creatorId: (taskInfo as any).creator_id }
}

/** 查看子任务：Publisher（创建者）或 Manager */
function canReadSubtasks(userId: string, row: TaskInfoSubtaskRow): boolean {
  if (row.creator_id === userId) return true
  if (row.manager_user_id != null && row.manager_user_id === userId) return true
  return false
}

/**
 * 修改子任务 / 定稿 / PATCH taskpool 元数据：
 * - 已指定 Manager：仅 Manager
 * - 尚未认领（manager_user_id 为空）：仅创建者可编辑（认领前由发布者维护草稿）
 */
function canWriteSubtasks(userId: string, row: TaskInfoSubtaskRow): boolean {
  if (row.manager_user_id != null) {
    return row.manager_user_id === userId
  }
  return row.creator_id === userId
}

function mapSubtaskRow(row: any): TaskSubtaskDraft {
  return {
    id: row.id,
    taskInfoId: row.task_info_id,
    subtaskUuid: row.subtask_uuid,
    title: row.title || '',
    sortOrder: row.sort_order ?? 0,
    maxAmountNt: row.max_amount_nt != null ? parseFloat(String(row.max_amount_nt)) : null,
    description: row.description || '',
    submissionInstructions: row.submission_instructions || '',
    proofConfig: row.proof_config ?? null,
    participantLimit: row.participant_limit ?? null,
    rewardNt: row.reward_nt != null ? parseFloat(String(row.reward_nt)) : null,
    submitDeadlineOverride: formatLocalDateTime(row.submit_deadline_override) || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function checkSubtaskSubmitDeadlineGate(
  poolSubmitDeadlineRaw: string | null | undefined,
  subtaskSubmitDeadlineRaw: string | null | undefined
): { ok: true } | { ok: false; message: string } {
  if (!subtaskSubmitDeadlineRaw) return { ok: true }
  const pool = parseLocalDateTime(poolSubmitDeadlineRaw || undefined)
  const sub = parseLocalDateTime(subtaskSubmitDeadlineRaw || undefined)
  if (!pool) return { ok: false, message: '任务池提交截止时间缺失或无效，无法设置子任务截止' }
  if (!sub) return { ok: false, message: '子任务提交截止时间格式无效' }
  if (sub.getTime() > pool.getTime()) {
    return { ok: false, message: '子任务提交截止不得晚于任务池提交截止' }
  }
  return { ok: true }
}

/**
 * 校验子任务总金额不超过任务池总激励
 * 规则：sum(subtask.reward_nt × subtask.participant_limit) <= task_info.planned_lock_nt
 */
function checkSubtaskTotalRewardGate(
  taskInfo: { planned_lock_nt?: string | number | null },
  subtasks: Array<{ reward_nt?: string | number | null; participant_limit?: number | null }>
): { ok: true } | { ok: false; message: string } {
  const poolTotal = taskInfo.planned_lock_nt != null ? Number(taskInfo.planned_lock_nt) : NaN
  if (Number.isNaN(poolTotal) || poolTotal <= 0) {
    return { ok: false, message: '任务池总激励无效' }
  }

  const subtaskTotal = subtasks.reduce((sum, s) => {
    const reward = s.reward_nt != null ? Number(s.reward_nt) : 0
    const participants = s.participant_limit ?? 1
    return sum + reward * participants
  }, 0)

  if (subtaskTotal > poolTotal) {
    return { 
      ok: false, 
      message: `子任务总金额(${subtaskTotal.toFixed(2)}) 不得超过任务池总激励(${poolTotal.toFixed(2)})` 
    }
  }
  return { ok: true }
}

/** GET /api/task-info/:taskInfoId/subtasks */
export const listSubtasks = async (req: AuthRequest, res: Response) => {
  try {
    const { taskInfoId } = req.params
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ error: '未授权' })
    const gate = await loadTaskInfoForSubtasks(taskInfoId)
    if (!gate.ok) return res.status(gate.status).json({ error: gate.error })
    if (!canReadSubtasks(userId, gate.taskInfo)) {
      return res.status(403).json({ error: '无权限查看子任务' })
    }

    const { data, error } = await supabase
      .from('task_subtasks')
      .select('*')
      .eq('task_info_id', taskInfoId)
      .order('sort_order', { ascending: true })

    if (error) throw error
    res.json({ subtasks: (data || []).map(mapSubtaskRow) })
  } catch (e: any) {
    console.error('[listSubtasks]', e)
    res.status(500).json({ error: e?.message || '获取子任务失败' })
  }
}

/** POST /api/task-info/:taskInfoId/subtasks */
export const createSubtask = async (req: AuthRequest, res: Response) => {
  try {
    const { taskInfoId } = req.params
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ error: '未授权' })
    const gate = await loadTaskInfoForSubtasks(taskInfoId)
    if (!gate.ok) return res.status(gate.status).json({ error: gate.error })
    if (!canWriteSubtasks(userId, gate.taskInfo)) {
      return res.status(403).json({ error: '仅 Manager 可编辑子任务' })
    }
    if (gate.taskInfo.subtasks_finalized) {
      return res.status(400).json({ error: '子任务已定稿，不可再添加' })
    }

    const {
      title,
      sortOrder,
      maxAmountNt,
      subtaskUuid,
      description,
      submissionInstructions,
      proofConfig,
      participantLimit,
      rewardNt,
      submitDeadlineOverride,
    } = req.body || {}
    const row: Record<string, unknown> = {
      task_info_id: taskInfoId,
      title: typeof title === 'string' ? title : '子任务',
      sort_order: typeof sortOrder === 'number' ? sortOrder : 0
    }
    if (subtaskUuid) row.subtask_uuid = subtaskUuid
    if (maxAmountNt != null && !Number.isNaN(Number(maxAmountNt))) {
      row.max_amount_nt = Number(maxAmountNt)
    }
    if (typeof description === 'string') row.description = description
    if (typeof submissionInstructions === 'string') row.submission_instructions = submissionInstructions
    if (proofConfig != null) row.proof_config = proofConfig
    if (participantLimit != null && !Number.isNaN(Number(participantLimit))) row.participant_limit = Number(participantLimit)
    if (rewardNt != null && !Number.isNaN(Number(rewardNt))) row.reward_nt = Number(rewardNt)
    if (typeof submitDeadlineOverride === 'string' && submitDeadlineOverride.trim()) {
      const gate2 = checkSubtaskSubmitDeadlineGate(gate.taskInfo.submit_deadline, submitDeadlineOverride.trim())
      if (!gate2.ok) return res.status(400).json({ error: gate2.message })
      row.submit_deadline_override = normalizeDateTime(submitDeadlineOverride.trim())
    }

    // 校验子任务总金额
    const { data: existingSubtasks } = await supabase
      .from('task_subtasks')
      .select('reward_nt, participant_limit')
      .eq('task_info_id', taskInfoId)
    
    const allSubtasksForValidation = [
      ...(existingSubtasks || []),
      {
        reward_nt: rewardNt ?? 0,
        participant_limit: participantLimit ?? 1
      }
    ]
    
    const gate3 = checkSubtaskTotalRewardGate(gate.taskInfo, allSubtasksForValidation)
    if (!gate3.ok) return res.status(400).json({ error: gate3.message })

    const { data, error } = await supabase
      .from('task_subtasks')
      .insert(row)
      .select('*')
      .single()

    if (error) throw error
    res.status(201).json({ subtask: mapSubtaskRow(data) })
  } catch (e: any) {
    console.error('[createSubtask]', e)
    res.status(500).json({ error: e?.message || '创建子任务失败' })
  }
}

/** PATCH /api/task-info/:taskInfoId/subtasks/:subtaskId — 更新子任务草稿（未定稿；可写权限同 create） */
export const patchSubtask = async (req: AuthRequest, res: Response) => {
  try {
    const { taskInfoId, subtaskId } = req.params as any
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ error: '未授权' })
    if (!taskInfoId) return res.status(400).json({ error: '缺少 taskInfoId' })
    if (!subtaskId) return res.status(400).json({ error: '缺少 subtaskId' })

    const gate = await loadTaskInfoForSubtasks(taskInfoId)
    if (!gate.ok) return res.status(gate.status).json({ error: gate.error })
    if (!canWriteSubtasks(userId, gate.taskInfo)) return res.status(403).json({ error: '无权限编辑子任务草稿' })
    if (gate.taskInfo.subtasks_finalized) return res.status(400).json({ error: '子任务已定稿，不可编辑' })

    const body = req.body || {}
    const patch: Record<string, unknown> = {}
    if (typeof body.title === 'string') patch.title = body.title
    if (typeof body.sortOrder === 'number') patch.sort_order = body.sortOrder
    if (body.maxAmountNt != null && !Number.isNaN(Number(body.maxAmountNt))) patch.max_amount_nt = Number(body.maxAmountNt)
    if (typeof body.description === 'string') patch.description = body.description
    if (typeof body.submissionInstructions === 'string') patch.submission_instructions = body.submissionInstructions
    if (body.proofConfig !== undefined) patch.proof_config = body.proofConfig
    if (body.participantLimit != null && !Number.isNaN(Number(body.participantLimit))) patch.participant_limit = Number(body.participantLimit)
    if (body.rewardNt != null && !Number.isNaN(Number(body.rewardNt))) patch.reward_nt = Number(body.rewardNt)
    if (typeof body.submitDeadlineOverride === 'string' && body.submitDeadlineOverride.trim()) {
      const gate2 = checkSubtaskSubmitDeadlineGate(gate.taskInfo.submit_deadline, body.submitDeadlineOverride.trim())
      if (!gate2.ok) return res.status(400).json({ error: gate2.message })
      patch.submit_deadline_override = normalizeDateTime(body.submitDeadlineOverride.trim())
    }
    if (Object.keys(patch).length === 0) return res.json({ ok: true })

    // 校验修改后的子任务总金额
    const { data: thisSubtask } = await supabase
      .from('task_subtasks')
      .select('reward_nt, participant_limit')
      .eq('id', subtaskId)
      .single()
    
    const { data: otherSubtasks } = await supabase
      .from('task_subtasks')
      .select('reward_nt, participant_limit')
      .eq('task_info_id', taskInfoId)
      .neq('id', subtaskId)
    
    const updatedSubtask = {
      reward_nt: patch.reward_nt ?? thisSubtask?.reward_nt,
      participant_limit: patch.participant_limit ?? thisSubtask?.participant_limit
    }
    const allForValidation = [updatedSubtask, ...(otherSubtasks || [])]
    
    const gate3 = checkSubtaskTotalRewardGate(gate.taskInfo, allForValidation)
    if (!gate3.ok) return res.status(400).json({ error: gate3.message })

    const { data, error } = await supabase
      .from('task_subtasks')
      .update(patch)
      .eq('id', subtaskId)
      .eq('task_info_id', taskInfoId)
      .select('*')
      .single()
    if (error) throw error
    res.json({ subtask: mapSubtaskRow(data) })
  } catch (e: any) {
    console.error('[patchSubtask]', e)
    res.status(500).json({ error: e?.message || '更新失败' })
  }
}

/** DELETE /api/task-info/:taskInfoId/subtasks/:subtaskId — 删除单条子任务草稿（认领前创建者；认领后仅 Manager；未上链；未定稿） */
export const deleteSubtask = async (req: AuthRequest, res: Response) => {
  try {
    const { taskInfoId, subtaskId } = req.params as any
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ error: '未授权' })
    if (!taskInfoId) return res.status(400).json({ error: '缺少 taskInfoId' })
    if (!subtaskId) return res.status(400).json({ error: '缺少 subtaskId' })

    const gate = await loadTaskInfoForSubtasks(taskInfoId)
    if (!gate.ok) return res.status(gate.status).json({ error: gate.error })
    if (gate.taskInfo.use_taskpool !== true) {
      return res.status(400).json({ error: '非任务池任务，无法删除子任务草稿' })
    }
    if (!canWriteSubtasks(userId, gate.taskInfo)) {
      return res.status(403).json({ error: '无权限删除子任务草稿' })
    }
    if (gate.taskInfo.taskpool_create_tx_hash) {
      return res.status(400).json({ error: '已发起链上建池，子任务不再是草稿，无法删除' })
    }
    if (gate.taskInfo.subtasks_finalized) {
      return res.status(400).json({ error: '子任务已定稿，不可删除' })
    }

    const { data, error } = await supabase
      .from('task_subtasks')
      .delete()
      .eq('id', subtaskId)
      .eq('task_info_id', taskInfoId)
      .select('id')
      .single()
    if (error) {
      // supabase delete+single 在未命中时常会报错，这里统一按 404 处理
      return res.status(404).json({ error: '子任务草稿不存在' })
    }
    if (!data) return res.status(404).json({ error: '子任务草稿不存在' })

    res.json({ ok: true })
  } catch (e: any) {
    console.error('[deleteSubtask]', e)
    res.status(500).json({ error: e?.message || '删除失败' })
  }
}

/** POST /api/task-info/:taskInfoId/subtasks/finalize */
export const finalizeSubtasks = async (req: AuthRequest, res: Response) => {
  try {
    const { taskInfoId } = req.params
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ error: '未授权' })
    const gate = await loadTaskInfoForSubtasks(taskInfoId)
    if (!gate.ok) return res.status(gate.status).json({ error: gate.error })
    if (!canWriteSubtasks(userId, gate.taskInfo)) {
      return res.status(403).json({ error: '仅 Manager 可定稿子任务' })
    }
    if (gate.taskInfo.subtasks_finalized) {
      return res.status(400).json({ error: '子任务已定稿，不可重复定稿' })
    }

    // 定稿前最终验证子任务总金额
    const { data: allSubtasks } = await supabase
      .from('task_subtasks')
      .select('reward_nt, participant_limit')
      .eq('task_info_id', taskInfoId)
    
    const gate2 = checkSubtaskTotalRewardGate(gate.taskInfo, allSubtasks || [])
    if (!gate2.ok) {
      return res.status(400).json({ 
        error: `无法定稿：${gate2.message}` 
      })
    }

    const { error } = await supabase
      .from('task_info')
      .update({ subtasks_finalized: true })
      .eq('id', taskInfoId)

    if (error) throw error

    let mallSync: Awaited<ReturnType<typeof ensureTaskpoolPoolPrimaryListing>> | undefined
    let subtaskMallSync: Awaited<ReturnType<typeof ensureSubtaskMallListings>> | undefined
    if (gate.taskInfo.use_taskpool) {
      try {
        mallSync = await ensureTaskpoolPoolPrimaryListing(taskInfoId)
        subtaskMallSync = await ensureSubtaskMallListings(taskInfoId)
      } catch (me: any) {
        console.error('[finalizeSubtasks] mall sync', me)
        return res.status(500).json({ error: me?.message || '定稿成功但商城同步失败' })
      }
    }
    res.json({ ok: true, mallSync, subtaskMallSync })
  } catch (e: any) {
    console.error('[finalizeSubtasks]', e)
    res.status(500).json({ error: e?.message || '定稿失败' })
  }
}

/** POST /api/task-info/:taskInfoId/pool-listing/sync — 幂等同步池主商城行（创建者或 Manager） */
export const syncTaskpoolPoolListing = async (req: AuthRequest, res: Response) => {
  try {
    const { taskInfoId } = req.params
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ error: '未授权' })
    const gate = await loadTaskInfoForSubtasks(taskInfoId)
    if (!gate.ok) return res.status(gate.status).json({ error: gate.error })
    if (!canReadSubtasks(userId, gate.taskInfo)) {
      return res.status(403).json({ error: '仅创建者或 Manager 可同步商城池主行' })
    }
    const mallSync = await ensureTaskpoolPoolPrimaryListing(taskInfoId)
    let subtaskMallSync: Awaited<ReturnType<typeof ensureSubtaskMallListings>> | undefined
    if (gate.taskInfo.subtasks_finalized) {
      subtaskMallSync = await ensureSubtaskMallListings(taskInfoId)
    }
    res.json({ mallSync, subtaskMallSync })
  } catch (e: any) {
    console.error('[syncTaskpoolPoolListing]', e)
    res.status(500).json({ error: e?.message || '同步失败' })
  }
}

/** PATCH /api/task-info/:taskInfoId/taskpool — 链上元数据回写（仅 Manager，与创建者规则一致） */
export const patchTaskpoolMeta = async (req: AuthRequest, res: Response) => {
  try {
    const { taskInfoId } = req.params
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ error: '未授权' })
    const gate = await loadTaskInfoForSubtasks(taskInfoId)
    if (!gate.ok) return res.status(gate.status).json({ error: gate.error })
    if (!canWriteSubtasks(userId, gate.taskInfo)) {
      return res.status(403).json({ error: '仅 Manager 可更新 TaskPool 元数据' })
    }

    const {
      taskpoolPhase,
      taskpoolCreateTxHash,
      taskpoolManagerUserId,
      taskpoolCreateStatus,
      taskpoolCreateDigest,
      taskpoolCreateLastError,
    } = req.body || {}

    // 幂等保护：若已记录过 txHash，则不允许用不同 txHash 覆盖
    if (taskpoolCreateTxHash != null && gate.taskInfo.use_taskpool) {
      const existing = (await supabase
        .from('task_info')
        .select('taskpool_create_tx_hash')
        .eq('id', taskInfoId)
        .single()) as any
      const existed = existing?.data?.taskpool_create_tx_hash as string | null | undefined
      if (existed && String(taskpoolCreateTxHash) !== existed) {
        return res.status(409).json({ error: '已存在建池 txHash，不可覆盖为不同值' })
      }
    }
    const patch: Record<string, unknown> = {}
    if (taskpoolPhase && ['none', 'awaiting_pool', 'pool_created', 'closed'].includes(taskpoolPhase)) {
      patch.taskpool_phase = taskpoolPhase as TaskpoolPhase
    }
    if (taskpoolCreateTxHash != null) patch.taskpool_create_tx_hash = String(taskpoolCreateTxHash)
    if (taskpoolManagerUserId != null) patch.taskpool_manager_user_id = String(taskpoolManagerUserId)
    if (taskpoolCreateStatus && ['idle','signing','pending','confirmed','failed'].includes(taskpoolCreateStatus)) {
      patch.taskpool_create_status = String(taskpoolCreateStatus)
    }
    if (taskpoolCreateDigest != null) patch.taskpool_create_digest = String(taskpoolCreateDigest)
    if (taskpoolCreateLastError != null) patch.taskpool_create_last_error = String(taskpoolCreateLastError)
    if (Object.keys(patch).length > 0) patch.taskpool_create_updated_at = new Date().toISOString()

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: '无可更新字段' })
    }

    const { data, error } = await supabase
      .from('task_info')
      .update(patch)
      .eq('id', taskInfoId)
      .select('*')
      .single()

    if (error) throw error
    res.json({ taskInfo: data })
  } catch (e: any) {
    console.error('[patchTaskpoolMeta]', e)
    res.status(500).json({ error: e?.message || '更新失败' })
  }
}

/**
 * POST /api/task-info/:taskInfoId/claim-manager
 * 认领主项目为 Manager（仅 use_taskpool；仅当尚未指定 Manager 时可调用一次）
 */
export const claimTaskPoolManager = async (req: AuthRequest, res: Response) => {
  try {
    const { taskInfoId } = req.params
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ error: '未授权' })

    const gate = await loadTaskInfoForSubtasks(taskInfoId)
    if (!gate.ok) return res.status(gate.status).json({ error: gate.error })

    if (!gate.taskInfo.use_taskpool) {
      return res.status(400).json({ error: '非任务池任务，无需认领 Manager' })
    }
    if (gate.taskInfo.manager_user_id != null) {
      return res.status(403).json({ error: '已有 Manager，不可重复认领' })
    }

    const { data, error } = await supabase
      .from('task_info')
      .update({ manager_user_id: userId })
      .eq('id', taskInfoId)
      .is('manager_user_id', null)
      .select('id, manager_user_id, creator_id, use_taskpool')
      .maybeSingle()

    if (error) throw error
    if (!data) {
      return res.status(409).json({ error: '认领冲突，请重试' })
    }

    res.json({
      result: 'ok',
      taskInfoId: data.id,
      managerUserId: data.manager_user_id
    })
  } catch (e: any) {
    console.error('[claimTaskPoolManager]', e)
    res.status(500).json({ error: e?.message || '认领失败' })
  }
}

/** GET /api/task-info/:taskInfoId/overall-submission — 查看整单提交（Publisher/Manager 可读） */
export const getOverallSubmission = async (req: AuthRequest, res: Response) => {
  try {
    const { taskInfoId } = req.params
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ error: '未授权' })

    const gate = await loadTaskInfoForSubtasks(taskInfoId)
    if (!gate.ok) return res.status(gate.status).json({ error: gate.error })
    if (!canReadSubtasks(userId, gate.taskInfo)) {
      return res.status(403).json({ error: '无权限查看整单提交' })
    }

    const { data, error } = await supabase
      .from('taskpool_overall_submissions')
      .select('task_info_id, submitted_by_user_id, payload, submitted_at, updated_at, status')
      .eq('task_info_id', taskInfoId)
      .maybeSingle()

    if (error) throw error

    const { data: reviews, error: reviewsError } = await supabase
      .from('taskpool_overall_submission_reviews')
      .select('id, task_info_id, reviewer_user_id, decision, reason, reviewed_at')
      .eq('task_info_id', taskInfoId)
      .order('reviewed_at', { ascending: false })

    if (reviewsError) throw reviewsError

    res.json({ submission: data || null, reviews: reviews || [] })
  } catch (e: any) {
    console.error('[getOverallSubmission]', e)
    res.status(500).json({ error: e?.message || '获取整单提交失败' })
  }
}

/**
 * POST /api/task-info/:taskInfoId/overall-submission — 提交整单凭证（仅 Manager；未认领前仅创建者）
 * body: { summary?: string; url?: string }
 */
export const upsertOverallSubmission = async (req: AuthRequest, res: Response) => {
  try {
    const { taskInfoId } = req.params
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ error: '未授权' })

    const gate = await loadTaskInfoForSubtasks(taskInfoId)
    if (!gate.ok) return res.status(gate.status).json({ error: gate.error })
    if (!gate.taskInfo.use_taskpool) {
      return res.status(400).json({ error: '非任务池任务，无法整单提交' })
    }
    if (!canWriteSubtasks(userId, gate.taskInfo)) {
      return res.status(403).json({ error: '仅 Manager 可整单提交' })
    }

    // 阶段 8：仅当全部子任务（商城 tasks 行 listing_kind=taskpool_subtask）均 completed 才允许整单提交
    {
      // 若未定稿，按“还没有子任务可完成”处理
      if (!gate.taskInfo.subtasks_finalized) {
        return res.status(400).json({ error: '子任务未定稿，无法整单提交' })
      }

      // 只统计子任务 tasks 行（含 pool_subtask_id），避免把池主入口行算进去
      const { data: subRows, error: subErr } = await supabase
        .from('tasks')
        .select('id, status')
        .eq('task_info_id', taskInfoId)
        .eq('listing_kind', 'taskpool_subtask')

      if (subErr) throw subErr

      const list = subRows || []
      if (list.length === 0) {
        return res.status(400).json({ error: '尚未发布子任务到商城，无法整单提交' })
      }
      const notDone = list.filter((t: any) => t.status !== 'completed')
      if (notDone.length > 0) {
        return res.status(400).json({
          error: `子任务未全部完成（剩余 ${notDone.length}/${list.length}），无法整单提交`,
        })
      }
    }

    const { summary, url } = req.body || {}
    const payload: Record<string, unknown> = {}
    if (typeof summary === 'string') payload.summary = summary
    if (typeof url === 'string') payload.url = url

    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from('taskpool_overall_submissions')
      .upsert(
        {
          task_info_id: taskInfoId,
          submitted_by_user_id: userId,
          payload,
          status: 'under_review',
          submitted_at: now,
          updated_at: now
        },
        { onConflict: 'task_info_id' }
      )
      .select('task_info_id, submitted_by_user_id, payload, submitted_at, updated_at, status')
      .single()

    if (error) throw error
    res.status(201).json({ submission: data })
  } catch (e: any) {
    console.error('[upsertOverallSubmission]', e)
    res.status(500).json({ error: e?.message || '整单提交失败' })
  }
}

/**
 * POST /api/task-info/:taskInfoId/overall-submission/review — 审核整单（仅创建者）
 * body: { decision: 'approved' | 'rejected'; reason?: string }
 */
export const reviewOverallSubmission = async (req: AuthRequest, res: Response) => {
  try {
    const { taskInfoId } = req.params
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ error: '未授权' })

    const gate = await loadTaskInfoForSubtasks(taskInfoId)
    if (!gate.ok) return res.status(gate.status).json({ error: gate.error })
    if (!gate.taskInfo.use_taskpool) {
      return res.status(400).json({ error: '非任务池任务，无法审核整单提交' })
    }
    // Reviewer：按你现有任务审核规则，使用创建者（Publisher）作为审核者
    if (gate.taskInfo.creator_id !== userId) {
      return res.status(403).json({ error: '仅创建者可审核整单提交' })
    }

    const { decision, reason } = req.body || {}
    if (decision !== 'approved' && decision !== 'rejected') {
      return res.status(400).json({ error: 'decision 必须为 approved 或 rejected' })
    }

    // 必须先有提交记录
    const { data: submission, error: subErr } = await supabase
      .from('taskpool_overall_submissions')
      .select('task_info_id, status')
      .eq('task_info_id', taskInfoId)
      .maybeSingle()
    if (subErr) throw subErr
    if (!submission) {
      return res.status(400).json({ error: '尚未整单提交，无法审核' })
    }

    // 幂等：若状态已一致，则不重复写 review 记录
    const targetStatus = decision === 'approved' ? 'approved' : 'rejected'
    if (submission.status === targetStatus) {
      return res.json({ ok: true, status: submission.status })
    }

    const now = new Date().toISOString()
    const { error: insErr } = await supabase
      .from('taskpool_overall_submission_reviews')
      .insert({
        task_info_id: taskInfoId,
        reviewer_user_id: userId,
        decision,
        reason: typeof reason === 'string' ? reason : null,
        reviewed_at: now,
      })
    if (insErr) throw insErr

    const { data: updated, error: updErr } = await supabase
      .from('taskpool_overall_submissions')
      .update({ status: targetStatus, updated_at: now })
      .eq('task_info_id', taskInfoId)
      .select('task_info_id, submitted_by_user_id, payload, submitted_at, updated_at, status')
      .single()
    if (updErr) throw updErr

    res.json({ submission: updated })
  } catch (e: any) {
    console.error('[reviewOverallSubmission]', e)
    res.status(500).json({ error: e?.message || '审核失败' })
  }
}

/**
 * GET /api/task-info/:taskInfoId/pool-draft — 获取任务池主信息草稿（仅创建者；与 PATCH 相同前置条件）
 */
export const getTaskPoolDraftForEdit = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ error: '未授权' })
    const { taskInfoId } = req.params
    if (!taskInfoId) return res.status(400).json({ error: '缺少 taskInfoId' })

    const gate = await gateTaskPoolDraftEdit(taskInfoId, userId)
    if (!gate.ok) return res.status(gate.status).json({ error: gate.error })

    const { data: anyTaskRow, error: anyTaskError } = await supabase
      .from('tasks')
      .select('reward, currency')
      .eq('task_info_id', taskInfoId)
      .order('participant_index', { ascending: true })
      .limit(1)
      .single()
    if (anyTaskError) throw anyTaskError

    const ti = gate.taskInfo as any
    const draft = {
      title: ti.title,
      description: ti.description,
      reward: Number((anyTaskRow as any)?.reward || 0),
      participantLimit: ti.participant_limit ?? 1,
      startDate: formatLocalDateTime(ti.start_date),
      deadline: formatLocalDateTime(ti.deadline),
      submitDeadline: formatLocalDateTime(ti.submit_deadline),
      submissionInstructions: ti.submission_instructions || '',
      proofConfig: ti.proof_config || null,
      communityId: ti.community_id || null,
      useTaskpool: true,
      allowSplit: ti.allow_split === true,
    }
    res.json({ draft })
  } catch (e: any) {
    console.error('[getTaskPoolDraftForEdit]', e)
    res.status(500).json({ error: e?.message || '获取失败' })
  }
}

/**
 * PATCH /api/task-info/:taskInfoId/pool-draft — 更新任务池主信息（仅创建者；未认领 Manager；未上链；未定稿；无人领取）
 * body: { title, description, reward, participantLimit, startDate, deadline, submitDeadline, submissionInstructions?, proofConfig? }
 */
export const patchTaskPoolDraft = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ error: '未授权' })
    const { taskInfoId } = req.params
    if (!taskInfoId) return res.status(400).json({ error: '缺少 taskInfoId' })

    const gate = await gateTaskPoolDraftEdit(taskInfoId, userId)
    if (!gate.ok) return res.status(gate.status).json({ error: gate.error })

    const body = req.body || {}
    const {
      title,
      description,
      reward,
      participantLimit: plRaw,
      startDate,
      deadline,
      submitDeadline,
      submissionInstructions,
      proofConfig,
    } = body

    if (typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'title 必填' })
    }
    if (typeof description !== 'string' || !description.trim()) {
      return res.status(400).json({ error: 'description 必填' })
    }
    const hasPlannedLockNt =
      body.plannedLockNt != null &&
      !Number.isNaN(Number(body.plannedLockNt)) &&
      Number(body.plannedLockNt) >= 1
    const rewardNum = hasPlannedLockNt ? 1 : Number(reward)
    if (!hasPlannedLockNt && (Number.isNaN(rewardNum) || rewardNum < 1)) {
      return res.status(400).json({ error: 'reward 无效' })
    }
    let participantLimit = typeof plRaw === 'number' ? plRaw : parseInt(String(plRaw || '1'), 10)
    if (Number.isNaN(participantLimit) || participantLimit < 1) {
      if (hasPlannedLockNt) {
        participantLimit = 1
      } else {
        return res.status(400).json({ error: 'participantLimit 无效' })
      }
    }
    if (!startDate || !deadline || !submitDeadline) {
      return res.status(400).json({ error: 'startDate、deadline、submitDeadline 必填' })
    }

    const sd = parseLocalDateTime(startDate)
    const dd = parseLocalDateTime(deadline)
    const subd = parseLocalDateTime(submitDeadline)
    if (!sd) return res.status(400).json({ error: '报名开始时间格式无效' })
    if (!dd) return res.status(400).json({ error: '报名截止时间格式无效' })
    if (!subd) return res.status(400).json({ error: '提交截止时间格式无效' })
    if (sd >= dd) return res.status(400).json({ error: '报名开始时间必须早于报名截止时间' })
    if (dd >= subd) return res.status(400).json({ error: '报名截止时间必须早于提交截止时间' })
    if (sd >= subd) return res.status(400).json({ error: '报名开始时间必须早于提交截止时间' })

    const ti = gate.taskInfo as any
    let mergedProof = ti.proof_config || null
    if (proofConfig != null && typeof proofConfig === 'object') {
      mergedProof = { ...(mergedProof || {}), ...proofConfig }
    }

    // 接收 plannedLockNt 或用旧的 reward×participantLimit（兼容）
    let plannedLockNt: number
    if (body.plannedLockNt != null && !Number.isNaN(Number(body.plannedLockNt))) {
      // 前端新模式：直接传总金额
      plannedLockNt = Number(body.plannedLockNt)
    } else {
      // 兼容旧模式：reward × participantLimit
      console.warn('[patchTaskPoolDraft] 使用了旧的 reward×participantLimit 方式，请改为直接传 plannedLockNt')
      plannedLockNt = rewardNum * participantLimit
    }
    
    const participantLimitCol = participantLimit > 1 ? participantLimit : null

    // 当修改总激励时，验证现有子任务是否会超额
    if (body.plannedLockNt != null && gate.taskInfo.use_taskpool) {
      const { data: existingSubtasks } = await supabase
        .from('task_subtasks')
        .select('reward_nt, participant_limit')
        .eq('task_info_id', taskInfoId)
      
      const gate2 = checkSubtaskTotalRewardGate(
        { planned_lock_nt: plannedLockNt },
        existingSubtasks || []
      )
      if (!gate2.ok) {
        return res.status(400).json({
          error: `无法修改总激励：${gate2.message}`
        })
      }
    }

    const { error: updInfoErr } = await supabase
      .from('task_info')
      .update({
        title: title.trim(),
        description: description.trim(),
        start_date: normalizeDateTime(startDate),
        deadline: normalizeDateTime(deadline),
        submit_deadline: normalizeDateTime(submitDeadline),
        participant_limit: participantLimitCol,
        submission_instructions:
          typeof submissionInstructions === 'string' ? submissionInstructions : ti.submission_instructions,
        proof_config: mergedProof,
        planned_lock_nt: plannedLockNt,
      })
      .eq('id', taskInfoId)
    if (updInfoErr) throw updInfoErr

    const currency = 'NT'
    const perPersonReward = rewardNum.toFixed(2)

    if (participantLimit !== gate.taskCount) {
      const { error: delErr } = await supabase.from('tasks').delete().eq('task_info_id', taskInfoId)
      if (delErr) throw delErr

      const taskRows = []
      for (let i = 0; i < participantLimit; i++) {
        taskRows.push({
          task_info_id: taskInfoId,
          creator_id: gate.creatorId,
          claimer_id: null,
          reward: perPersonReward,
          currency,
          weight_coefficient: 1.0,
          participant_index: i + 1,
          status: 'unclaimed',
        })
      }
      const { data: createdTasks, error: insErr } = await supabase
        .from('tasks')
        .insert(taskRows)
        .select('id')
      if (insErr) throw insErr

      const userName = (req.user as any)?.name || '系统'
      const initialTimeline = [
        {
          status: 'unclaimed',
          actorId: userId,
          actorName: userName,
          action: '创建任务',
          timestamp: new Date().toISOString(),
        },
      ]
      const timelineInserts = (createdTasks || []).map((t: any) => ({
        task_id: t.id,
        timeline: initialTimeline,
      }))
      if (timelineInserts.length > 0) {
        const { error: tlErr } = await supabase.from('task_timelines').insert(timelineInserts)
        if (tlErr) console.error('[patchTaskPoolDraft] timeline insert:', tlErr)
      }
    } else {
      const { error: rwErr } = await supabase
        .from('tasks')
        .update({ reward: perPersonReward, currency })
        .eq('task_info_id', taskInfoId)
      if (rwErr) throw rwErr
    }

    res.json({ success: true, taskInfoId })
  } catch (e: any) {
    console.error('[patchTaskPoolDraft]', e)
    res.status(500).json({ error: e?.message || '更新失败' })
  }
}

/**
 * POST /api/task-info/:taskInfoId/withdraw — 撤回任务池（仅创建者；未认领 Manager；未上链；且无人领取）
 * 撤回会删除 task_info（级联删除 tasks/subtasks/整单/审核记录），并返回用于重新发布的草稿数据
 */
export const withdrawTaskPool = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ error: '未授权' })

    const { taskInfoId } = req.params
    if (!taskInfoId) return res.status(400).json({ error: '缺少 taskInfoId' })

    const { data: taskInfo, error: infoError } = await supabase
      .from('task_info')
      .select(
        'id, title, description, start_date, deadline, submit_deadline, participant_limit, reward_distribution_mode, proof_config, submission_instructions, creator_id, community_id, use_taskpool, manager_user_id, taskpool_create_tx_hash'
      )
      .eq('id', taskInfoId)
      .single()
    if (infoError) throw infoError
    if (!taskInfo) return res.status(404).json({ error: '任务信息不存在' })

    if ((taskInfo as any).use_taskpool !== true) {
      return res.status(400).json({ error: '非任务池任务，无法撤回' })
    }
    if ((taskInfo as any).creator_id !== userId) {
      return res.status(403).json({ error: '无权撤回此任务池' })
    }
    if ((taskInfo as any).manager_user_id != null) {
      return res.status(400).json({ error: '任务池已被认领 Manager，无法撤回' })
    }
    if ((taskInfo as any).taskpool_create_tx_hash) {
      return res.status(400).json({ error: '已发起链上建池，无法撤回' })
    }

    const { count: claimedCount, error: claimedError } = await supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('task_info_id', taskInfoId)
      .not('claimer_id', 'is', null)
    if (claimedError) throw claimedError
    if ((claimedCount || 0) > 0) {
      return res.status(400).json({ error: '已有用户领取过该任务池，无法撤回' })
    }

    const { data: anyTaskRow, error: anyTaskError } = await supabase
      .from('tasks')
      .select('reward, currency')
      .eq('task_info_id', taskInfoId)
      .order('participant_index', { ascending: true })
      .limit(1)
      .single()
    if (anyTaskError) throw anyTaskError

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
      proofConfig: (taskInfo as any).proof_config || null,
      communityId: (taskInfo as any).community_id || null,
      useTaskpool: true,
      allowSplit: true,
    }

    const { error: deleteError } = await supabase.from('task_info').delete().eq('id', taskInfoId)
    if (deleteError) throw deleteError

    res.json({ success: true, draft })
  } catch (e: any) {
    console.error('[withdrawTaskPool]', e)
    res.status(500).json({ error: e?.message || '撤回失败' })
  }
}

function amountsMatchPlanned(amountHuman: string, planned: number | null): boolean {
  if (planned == null || Number.isNaN(Number(planned))) return false
  const a = Number(amountHuman)
  const p = Number(planned)
  if (Number.isNaN(a)) return false
  return Math.abs(a - p) < 1e-9
}

/** POST /api/task-info/:taskInfoId/prepay-intent — 发起 Semi 预付前登记 state（仅创建者；未上链建池） */
export const startTaskpoolPrepayIntent = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ error: '未授权' })
    const { taskInfoId } = req.params
    if (!taskInfoId) return res.status(400).json({ error: '缺少 taskInfoId' })

    const body = req.body || {}
    const state = typeof body.state === 'string' ? body.state.trim() : ''
    const amountHuman = typeof body.amountHuman === 'string' ? body.amountHuman.trim() : ''
    let clientReference: string | null =
      typeof body.clientReference === 'string' ? body.clientReference.trim() : null
    if (clientReference && clientReference.length > 128) {
      return res.status(400).json({ error: 'clientReference 过长（≤128）' })
    }
    if (!clientReference) clientReference = null

    if (state.length < 8) return res.status(400).json({ error: 'state 无效' })
    if (!amountHuman) return res.status(400).json({ error: 'amountHuman 必填' })

    const { data: taskInfo, error: infoError } = await supabase
      .from('task_info')
      .select('id, creator_id, use_taskpool, taskpool_create_tx_hash, planned_lock_nt')
      .eq('id', taskInfoId)
      .single()
    if (infoError || !taskInfo) return res.status(404).json({ error: '任务信息不存在' })
    const ti = taskInfo as any
    if (ti.use_taskpool !== true) return res.status(400).json({ error: '非任务池任务' })
    if (ti.creator_id !== userId) return res.status(403).json({ error: '仅创建者可登记预付' })
    if (ti.taskpool_create_tx_hash) return res.status(400).json({ error: '已发起链上建池，无需再登记 Semi 预付' })
    if (!amountsMatchPlanned(amountHuman, ti.planned_lock_nt != null ? Number(ti.planned_lock_nt) : null)) {
      return res.status(400).json({ error: '金额与计划锁仓不一致，请刷新任务池后重试' })
    }

    const { error: supErr } = await supabase
      .from('taskpool_prepay_intents')
      .update({ status: 'superseded', updated_at: new Date().toISOString() })
      .eq('task_info_id', taskInfoId)
      .eq('status', 'pending')
    if (supErr) throw supErr

    const { data: inserted, error: insErr } = await supabase
      .from('taskpool_prepay_intents')
      .insert({
        task_info_id: taskInfoId,
        creator_id: userId,
        state_token: state,
        amount_human: amountHuman,
        status: 'pending',
        client_reference: clientReference,
      })
      .select('id, task_info_id, state_token, amount_human, status, client_reference, created_at')
      .single()
    if (insErr) throw insErr

    res.json({ intent: inserted })
  } catch (e: any) {
    console.error('[startTaskpoolPrepayIntent]', e)
    res.status(500).json({ error: e?.message || '登记失败' })
  }
}

/** POST /api/task-info/:taskInfoId/prepay-complete — Semi 回跳后落库（仅创建者） */
export const completeTaskpoolPrepayIntent = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ error: '未授权' })
    const { taskInfoId } = req.params
    if (!taskInfoId) return res.status(400).json({ error: '缺少 taskInfoId' })

    const body = req.body || {}
    const state = typeof body.state === 'string' ? body.state.trim() : ''
    const rawStatus = body.status
    if (state.length < 8) return res.status(400).json({ error: 'state 无效' })
    if (rawStatus !== 'success' && rawStatus !== 'failed' && rawStatus !== 'cancelled') {
      return res.status(400).json({ error: 'status 须为 success | failed | cancelled' })
    }

    const { data: row, error: findErr } = await supabase
      .from('taskpool_prepay_intents')
      .select('id, task_info_id, creator_id, status, state_token')
      .eq('task_info_id', taskInfoId)
      .eq('state_token', state)
      .maybeSingle()
    if (findErr) throw findErr
    if (!row) return res.status(404).json({ error: '未找到匹配的预付记录' })
    const r = row as any
    if (r.creator_id !== userId) return res.status(403).json({ error: '无权更新此记录' })

    if (r.status !== 'pending') {
      return res.json({
        ok: true,
        alreadyFinalized: true,
        intent: await loadPrepayIntentRowById(r.id),
      })
    }

    const nextStatus = rawStatus === 'success' ? 'success' : rawStatus === 'failed' ? 'failed' : 'cancelled'
    const userOpHash = typeof body.user_op_hash === 'string' ? body.user_op_hash.trim() || null : null
    const txHash = typeof body.tx_hash === 'string' ? body.tx_hash.trim() || null : null
    const errorCode = typeof body.error_code === 'string' ? body.error_code.trim() || null : null
    const errMsg = typeof body.error === 'string' ? body.error.trim() || null : null

    const { error: updErr } = await supabase
      .from('taskpool_prepay_intents')
      .update({
        status: nextStatus,
        user_op_hash: userOpHash,
        tx_hash: txHash,
        error_code: errorCode,
        error: errMsg,
        updated_at: new Date().toISOString(),
      })
      .eq('id', r.id)
    if (updErr) throw updErr

    const updatedIntent = await loadPrepayIntentRowById(r.id)

    // Step3：若 Semi 回跳为 success 且带 tx_hash：尝试用链上 receipt 确认 PoolCreated，并回写 task_info 的建池元数据（只写一次）
    let onchain: any = null
    try {
      if (nextStatus === 'success' && !txHash) {
        onchain = {
          ok: false,
          error: 'status=success 但未提供 tx_hash，无法链上确权（请检查 Semi 回跳是否附带 tx_hash）',
        }
      } else if (nextStatus === 'success' && txHash) {
        const { data: info, error: infoErr } = await supabase
          .from('task_info')
          .select('id, creator_id, use_taskpool, taskpool_create_tx_hash, planned_lock_nt')
          .eq('id', taskInfoId)
          .single()
        if (infoErr) {
          onchain = { ok: false, error: `读取 task_info 失败：${infoErr.message}` }
        } else if (!info) {
          onchain = { ok: false, error: 'task_info 不存在，无法链上确权' }
        } else if ((info as any).use_taskpool !== true) {
          onchain = { ok: false, error: '非任务池任务，跳过链上写回' }
        } else if ((info as any).creator_id !== userId) {
          onchain = {
            ok: false,
            error: '当前用户与 task_info.creator_id 不一致，跳过写回（请确认登录账号与发布者一致）',
          }
        } else {
          const existed = (info as any).taskpool_create_tx_hash as string | null
          if (existed) {
            onchain = { ok: true, skipped: true, reason: 'task_info 已有 taskpool_create_tx_hash' }
          } else {
            const { verifyTaskpoolPoolCreatedByTx } = await import('../services/taskpoolOnchainVerify')
            const v = await verifyTaskpoolPoolCreatedByTx({
              taskInfoId,
              txHash,
              amountHuman: String((updatedIntent as any).amount_human || ''),
            })
            onchain = v
            if (v.ok) {
              const { error: patchErr } = await supabase
                .from('task_info')
                .update({
                  taskpool_phase: 'pool_created',
                  taskpool_create_status: 'confirmed',
                  taskpool_create_tx_hash: txHash,
                  taskpool_create_updated_at: new Date().toISOString(),
                  taskpool_create_last_error: v.warnings.length ? v.warnings.join('; ') : null,
                })
                .eq('id', taskInfoId)
              if (patchErr) throw patchErr
            } else {
              const errMsg = String(v.error || '链上未找到 PoolCreated').slice(0, 2000)
              const { error: failPatchErr } = await supabase
                .from('task_info')
                .update({
                  taskpool_create_status: 'failed',
                  taskpool_create_last_error: errMsg,
                  taskpool_create_updated_at: new Date().toISOString(),
                })
                .eq('id', taskInfoId)
              if (failPatchErr) {
                console.error('[completeTaskpoolPrepayIntent] 写入建池失败原因失败', failPatchErr)
                throw failPatchErr
              }
            }
          }
        }
      }
    } catch (e: any) {
      // 不阻塞回调：链上校验失败时，仍然返回 intent，前端可提示“稍后重试/刷新”
      onchain = { ok: false, error: e?.message || 'onchain verify failed' }
    }

    res.json({ ok: true, intent: updatedIntent, onchain })
  } catch (e: any) {
    console.error('[completeTaskpoolPrepayIntent]', e)
    res.status(500).json({ error: e?.message || '更新失败' })
  }
}

/** POST /api/task-info/:taskInfoId/taskpool/final-approve-complete */
export const completeTaskpoolFinalApprove = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ error: '未授权' })
    const taskInfoId = String(req.params.taskInfoId || '').trim()
    const body = req.body || {}
    const state = typeof body.state === 'string' ? body.state.trim() : ''
    const status = body.status
    const txHash = typeof body.tx_hash === 'string' ? body.tx_hash.trim() : ''
    if (state.length < 8) return res.status(400).json({ error: 'state 无效' })
    if (status !== 'success' && status !== 'failed' && status !== 'cancelled') return res.status(400).json({ error: 'status 无效' })
    if (status !== 'success') return res.json({ ok: true, skipped: true })
    if (!txHash) return res.status(400).json({ error: '缺少 tx_hash' })

    const { data: info, error: infoErr } = await supabase
      .from('task_info')
      .select('id, creator_id, use_taskpool, taskpool_create_tx_hash, taskpool_phase')
      .eq('id', taskInfoId)
      .single()
    if (infoErr) throw infoErr
    if (!info || (info as any).use_taskpool !== true) return res.status(400).json({ error: '非任务池任务' })
    if ((info as any).creator_id !== userId) return res.status(403).json({ error: '仅创建者可终审' })

    const { verifyTaskpoolPoolFinalApprovedByTx } = await import('../services/taskpoolOnchainVerifyPoolFinal')
    const v = await verifyTaskpoolPoolFinalApprovedByTx({ taskInfoId, txHash })
    if (!v.ok) return res.status(409).json({ error: v.error })

    res.json({ ok: true, onchain: v })
  } catch (e: any) {
    console.error('[completeTaskpoolFinalApprove]', e)
    res.status(500).json({ error: e?.message || 'final approve complete 失败' })
  }
}

/** POST /api/task-info/:taskInfoId/taskpool/distribute-complete */
export const completeTaskpoolDistribute = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ error: '未授权' })
    const taskInfoId = String(req.params.taskInfoId || '').trim()
    const body = req.body || {}
    const state = typeof body.state === 'string' ? body.state.trim() : ''
    const status = body.status
    const txHash = typeof body.tx_hash === 'string' ? body.tx_hash.trim() : ''
    if (state.length < 8) return res.status(400).json({ error: 'state 无效' })
    if (status !== 'success' && status !== 'failed' && status !== 'cancelled') return res.status(400).json({ error: 'status 无效' })
    if (status !== 'success') return res.json({ ok: true, skipped: true })
    if (!txHash) return res.status(400).json({ error: '缺少 tx_hash' })

    const { data: info, error: infoErr } = await supabase
      .from('task_info')
      .select('id, creator_id, use_taskpool, taskpool_phase')
      .eq('id', taskInfoId)
      .single()
    if (infoErr) throw infoErr
    if (!info || (info as any).use_taskpool !== true) return res.status(400).json({ error: '非任务池任务' })
    if ((info as any).creator_id !== userId) return res.status(403).json({ error: '仅创建者可同步结算' })

    const { verifyTaskpoolDistributedByTx } = await import('../services/taskpoolOnchainVerifyDistribute')
    const v = await verifyTaskpoolDistributedByTx({ taskInfoId, txHash })
    if (!v.ok) return res.status(409).json({ error: v.error })

    // 写入 phase=closed（幂等）
    if ((info as any).taskpool_phase !== 'closed') {
      await supabase.from('task_info').update({ taskpool_phase: 'closed' }).eq('id', taskInfoId)
    }

    res.json({ ok: true, onchain: v })
  } catch (e: any) {
    console.error('[completeTaskpoolDistribute]', e)
    res.status(500).json({ error: e?.message || 'distribute complete 失败' })
  }
}

async function loadPrepayIntentRowById(id: string) {
  const { data, error } = await supabase
    .from('taskpool_prepay_intents')
    .select(
      'id, task_info_id, amount_human, status, user_op_hash, tx_hash, error_code, error, client_reference, created_at, updated_at'
    )
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

/** GET /api/task-info/:taskInfoId/prepay-intent/latest — 最近一条 intent（仅创建者） */
export const getTaskpoolPrepayIntentLatest = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ error: '未授权' })
    const { taskInfoId } = req.params
    if (!taskInfoId) return res.status(400).json({ error: '缺少 taskInfoId' })

    const { data: taskInfo, error: infoError } = await supabase
      .from('task_info')
      .select('id, creator_id')
      .eq('id', taskInfoId)
      .single()
    if (infoError || !taskInfo) return res.status(404).json({ error: '任务信息不存在' })
    if ((taskInfo as any).creator_id !== userId) return res.status(403).json({ error: '无权查看' })

    const { data: latest, error } = await supabase
      .from('taskpool_prepay_intents')
      .select(
        'id, task_info_id, amount_human, status, user_op_hash, tx_hash, error_code, error, client_reference, created_at, updated_at'
      )
      .eq('task_info_id', taskInfoId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw error

    res.json({ intent: latest || null })
  } catch (e: any) {
    console.error('[getTaskpoolPrepayIntentLatest]', e)
    res.status(500).json({ error: e?.message || '查询失败' })
  }
}

/** GET /api/task-info/:taskInfoId/prepay-intents?limit= — 支付单列表（阶段 5.2；仅创建者） */
export const listTaskpoolPrepayIntents = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ error: '未授权' })
    const { taskInfoId } = req.params
    if (!taskInfoId) return res.status(400).json({ error: '缺少 taskInfoId' })

    const rawLimit = req.query.limit
    const n = typeof rawLimit === 'string' ? parseInt(rawLimit, 10) : 20
    const limit = Number.isFinite(n) ? Math.min(50, Math.max(1, n)) : 20

    const { data: taskInfo, error: infoError } = await supabase
      .from('task_info')
      .select('id, creator_id')
      .eq('id', taskInfoId)
      .single()
    if (infoError || !taskInfo) return res.status(404).json({ error: '任务信息不存在' })
    if ((taskInfo as any).creator_id !== userId) return res.status(403).json({ error: '无权查看' })

    const { data: rows, error } = await supabase
      .from('taskpool_prepay_intents')
      .select(
        'id, task_info_id, amount_human, status, user_op_hash, tx_hash, error_code, error, client_reference, created_at, updated_at'
      )
      .eq('task_info_id', taskInfoId)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error

    res.json({ intents: rows || [] })
  } catch (e: any) {
    console.error('[listTaskpoolPrepayIntents]', e)
    res.status(500).json({ error: e?.message || '查询失败' })
  }
}
