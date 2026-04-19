import { supabase } from './supabase'

export type EnsurePoolListingResult = {
  ok: true
  poolPrimaryTaskId: string
  action: 'unchanged' | 'promoted' | 'demoted_duplicates' | 'inserted_missing_row'
}

/**
 * 保证「任务池」在商城侧有且仅有一条 `listing_kind = taskpool_pool` 的池主行（幂等）。
 * - 子任务行 `taskpool_subtask` 不参与池主竞争。
 * - 若已有唯一池主行，直接返回。
 * - 若 0 条池主标记：在**非子任务**行中选排序第一行升为池主。
 * - 若 >1 条池主：保留排序第一条，其余降为 standard。
 * - 若没有任何 tasks 行（异常数据）：插入一条池主行 + 时间线。
 */
export async function ensureTaskpoolPoolPrimaryListing(taskInfoId: string): Promise<EnsurePoolListingResult> {
  const { data: info, error: infoErr } = await supabase
    .from('task_info')
    .select('id, creator_id, use_taskpool, planned_lock_nt')
    .eq('id', taskInfoId)
    .single()

  if (infoErr || !info) {
    throw new Error('任务信息不存在')
  }
  if (!(info as { use_taskpool?: boolean }).use_taskpool) {
    throw new Error('非任务池任务，无需池主商城行同步')
  }

  const creatorId = (info as { creator_id: string }).creator_id
  const planned = (info as { planned_lock_nt?: string | number | null }).planned_lock_nt
  const rewardFallback =
    planned != null && !Number.isNaN(Number(planned)) ? String(Number(planned)) : '1'

  const { data: rows, error: rowsErr } = await supabase
    .from('tasks')
    .select('id, participant_index, listing_kind, pool_subtask_id, created_at')
    .eq('task_info_id', taskInfoId)
    .order('participant_index', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })

  if (rowsErr) throw rowsErr

  const list = rows || []

  const isSubtaskRow = (r: { listing_kind?: string | null; pool_subtask_id?: string | null }) =>
    r.listing_kind === 'taskpool_subtask' || (r.pool_subtask_id != null && r.pool_subtask_id !== '')

  const isPoolPrimary = (r: { listing_kind?: string | null }) => r.listing_kind === 'taskpool_pool'

  if (list.length === 0) {
    const { data: inserted, error: insErr } = await supabase
      .from('tasks')
      .insert({
        task_info_id: taskInfoId,
        creator_id: creatorId,
        claimer_id: null,
        reward: rewardFallback,
        currency: 'NT',
        weight_coefficient: 1,
        participant_index: 1,
        status: 'unclaimed',
        listing_kind: 'taskpool_pool',
        pool_subtask_id: null,
      })
      .select('id')
      .single()

    if (insErr || !inserted) throw insErr || new Error('插入池主任务行失败')

    const tid = (inserted as { id: string }).id
    const initialTimeline = [
      {
        status: 'unclaimed' as const,
        actorId: creatorId,
        actorName: '系统',
        action: '任务池商城同步补行',
        timestamp: new Date().toISOString(),
      },
    ]
    await supabase.from('task_timelines').insert({ task_id: tid, timeline: initialTimeline })

    return { ok: true, poolPrimaryTaskId: tid, action: 'inserted_missing_row' }
  }

  const primaryCandidates = list.filter((r) => !isSubtaskRow(r))
  if (primaryCandidates.length === 0) {
    throw new Error('任务池仅有子任务商城行，缺少可担任池主的任务行')
  }

  const poolMarked = list.filter(isPoolPrimary)

  if (poolMarked.length === 1) {
    const only = poolMarked[0]
    if (only.pool_subtask_id) {
      await supabase.from('tasks').update({ pool_subtask_id: null }).eq('id', only.id)
    }
    return { ok: true, poolPrimaryTaskId: only.id, action: 'unchanged' }
  }

  if (poolMarked.length === 0) {
    const pick = primaryCandidates[0]
    const { error: upErr } = await supabase
      .from('tasks')
      .update({ listing_kind: 'taskpool_pool', pool_subtask_id: null })
      .eq('id', pick.id)
    if (upErr) throw upErr
    return { ok: true, poolPrimaryTaskId: pick.id, action: 'promoted' }
  }

  const orderedPool = [...poolMarked].sort((a, b) => {
    const pa = a.participant_index ?? 999
    const pb = b.participant_index ?? 999
    if (pa !== pb) return pa - pb
    return String(a.created_at).localeCompare(String(b.created_at))
  })
  const keep = orderedPool[0]
  const drop = orderedPool.slice(1)
  for (const r of drop) {
    const { error: dErr } = await supabase
      .from('tasks')
      .update({ listing_kind: 'standard' })
      .eq('id', r.id)
    if (dErr) throw dErr
  }
  return { ok: true, poolPrimaryTaskId: keep.id, action: 'demoted_duplicates' }
}

export type EnsureSubtaskMallResult = {
  ok: true
  created: number
  skipped: number
  taskIds: string[]
}

/**
 * 子任务定稿后：为每条 task_subtasks 生成一条可领的 `tasks` 行（listing_kind=taskpool_subtask，pool_subtask_id 指向草稿 id）。
 * 幂等：已存在同 pool_subtask_id 则跳过。
 */
export async function ensureSubtaskMallListings(taskInfoId: string): Promise<EnsureSubtaskMallResult> {
  const { data: info, error: infoErr } = await supabase
    .from('task_info')
    .select('id, creator_id, use_taskpool, planned_lock_nt, subtasks_finalized')
    .eq('id', taskInfoId)
    .single()

  if (infoErr || !info) {
    throw new Error('任务信息不存在')
  }
  const row = info as {
    creator_id: string
    use_taskpool?: boolean
    planned_lock_nt?: string | number | null
    subtasks_finalized?: boolean
  }
  if (!row.use_taskpool) {
    throw new Error('非任务池任务，无需子任务商城行')
  }
  if (!row.subtasks_finalized) {
    throw new Error('子任务未定稿，无法发布子任务到商城')
  }

  const { data: drafts, error: dErr } = await supabase
    .from('task_subtasks')
    .select('id, title, sort_order, max_amount_nt, participant_limit')
    .eq('task_info_id', taskInfoId)
    .order('sort_order', { ascending: true })

  if (dErr) throw dErr
  const subList = drafts || []
  if (subList.length === 0) {
    return { ok: true, created: 0, skipped: 0, taskIds: [] }
  }

  const { data: withSubId, error: exErr } = await supabase
    .from('tasks')
    .select('id, pool_subtask_id')
    .eq('task_info_id', taskInfoId)
    .not('pool_subtask_id', 'is', null)

  if (exErr) throw exErr
  const existingCountBySubId = (withSubId || []).reduce((acc: Record<string, number>, t: any) => {
    const sid = t?.pool_subtask_id
    if (!sid) return acc
    acc[sid] = (acc[sid] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const { data: piRows, error: piErr } = await supabase
    .from('tasks')
    .select('participant_index')
    .eq('task_info_id', taskInfoId)

  if (piErr) throw piErr
  let maxPI = 0
  for (const r of piRows || []) {
    const pi = (r as { participant_index?: number }).participant_index ?? 0
    if (pi > maxPI) maxPI = pi
  }

  const n = subList.length
  const plannedNum = row.planned_lock_nt != null ? Number(row.planned_lock_nt) : NaN
  const defaultReward =
    !Number.isNaN(plannedNum) && plannedNum > 0 && n > 0 ? (plannedNum / n).toFixed(2) : '1'

  const creatorId = row.creator_id
  const taskIds: string[] = []
  let created = 0
  let skipped = 0
  let offset = 0

  for (const sub of subList) {
    const neededRaw = (sub as any).participant_limit
    const needed =
      neededRaw != null && !Number.isNaN(Number(neededRaw)) && Number(neededRaw) > 1 ? Number(neededRaw) : 1
    const existingCount = existingCountBySubId[sub.id] || 0
    if (existingCount >= needed) {
      skipped++
      continue
    }

    const reward =
      sub.max_amount_nt != null && Number(sub.max_amount_nt) > 0
        ? String(Number(sub.max_amount_nt))
        : defaultReward

    const toCreate = needed - existingCount
    for (let i = 0; i < toCreate; i++) {
      const participant_index = maxPI + 1 + offset
      offset++

      const { data: ins, error: insErr } = await supabase
        .from('tasks')
        .insert({
          task_info_id: taskInfoId,
          creator_id: creatorId,
          claimer_id: null,
          reward,
          currency: 'NT',
          weight_coefficient: 1,
          participant_index,
          status: 'unclaimed',
          listing_kind: 'taskpool_subtask',
          pool_subtask_id: sub.id,
        })
        .select('id')
        .single()

      if (insErr) throw insErr
      const tid = (ins as { id: string }).id

      await supabase.from('task_timelines').insert({
        task_id: tid,
        timeline: [
          {
            status: 'unclaimed',
            actorId: creatorId,
            actorName: '系统',
            action: '子任务发布到商城',
            timestamp: new Date().toISOString(),
          },
        ],
      })

      existingCountBySubId[sub.id] = (existingCountBySubId[sub.id] || 0) + 1
      taskIds.push(tid)
      created++
    }
  }

  return { ok: true, created, skipped, taskIds }
}
