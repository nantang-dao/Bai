import { supabase } from './supabase'
import { formatLocalDateTime } from '../utils/formatLocalDateTime'
import {
  type PlazaCursor,
  type PlazaFilterTab,
  type PlazaListItem,
  type PlazaSlotRow,
  type PlazaSortField,
  buildPlazaListItem,
  decodePlazaCursor,
  encodePlazaCursor,
  matchesPlazaFilterTab,
  matchesPlazaSearch,
  matchesPlazaTag,
  sortPlazaItems,
} from './taskPlazaListPure'

const SLOT_SELECT =
  'id, task_info_id, creator_id, claimer_id, reward, currency, participant_index, status, transferred_at, created_at, updated_at'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100
/** 有筛选时单次多拉 task_info 行数，避免过滤后不足一页 */
const FILTER_BATCH = 60

export interface FetchPlazaTasksParams {
  communityId?: string | null
  limit?: number
  cursor?: string | null
  sort?: PlazaSortField
  status?: PlazaFilterTab
  tagId?: string | null
  search?: string | null
}

export interface FetchPlazaTasksResult {
  items: PlazaListItem[]
  nextCursor: string | null
  hasMore: boolean
}

function clampLimit(limit?: number): number {
  const n = limit ?? DEFAULT_LIMIT
  return Math.min(Math.max(1, n), MAX_LIMIT)
}

function plazaItemToTaskResponse(item: PlazaListItem): Record<string, unknown> {
  return {
    id: item.id,
    taskInfoId: item.taskInfoId,
    title: item.title,
    description: item.description,
    reward: item.reward,
    currency: item.currency,
    status: item.status,
    participantLimit: item.participantLimit,
    claimedCount: item.claimedCount,
    creatorId: item.creatorId,
    creatorName: item.creatorName,
    creatorAvatar: item.creatorAvatar,
    claimerId: item.claimerId,
    activityId: item.activityId,
    startDate: item.startDate,
    deadline: item.deadline,
    submitDeadline: item.submitDeadline,
    rewardDistributionMode: item.rewardDistributionMode,
    transferredAt: item.transferredAt,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    tags: item.tags,
  }
}

async function loadTagsForTaskInfos(
  taskInfoIds: string[]
): Promise<Record<string, { id: string; name: string; colorHex: string }[]>> {
  const map: Record<string, { id: string; name: string; colorHex: string }[]> = {}
  if (!taskInfoIds.length) return map

  const { data: tagLinks } = await supabase
    .from('task_info_tags')
    .select('task_info_id, tag_id, community_task_tags ( id, name, color_hex )')
    .in('task_info_id', taskInfoIds)

  if (tagLinks) {
    for (const link of tagLinks as any[]) {
      const t = link.community_task_tags
      if (!t) continue
      if (!map[link.task_info_id]) map[link.task_info_id] = []
      map[link.task_info_id].push({ id: t.id, name: t.name, colorHex: t.color_hex })
    }
  }
  return map
}

async function loadCreators(
  creatorIds: string[]
): Promise<Record<string, { id: string; name: string; avatar?: string | null }>> {
  const map: Record<string, { id: string; name: string; avatar?: string | null }> = {}
  const ids = [...new Set(creatorIds.filter(Boolean))]
  if (!ids.length) return map

  const { data: users } = await supabase.from('users').select('id, name, avatar').in('id', ids)
  if (users) {
    for (const u of users) map[u.id] = u
  }
  return map
}

async function loadSlotRowsByTaskInfoIds(taskInfoIds: string[]): Promise<Record<string, PlazaSlotRow[]>> {
  const grouped: Record<string, PlazaSlotRow[]> = {}
  if (!taskInfoIds.length) return grouped

  const { data, error } = await supabase
    .from('tasks')
    .select(SLOT_SELECT)
    .in('task_info_id', taskInfoIds)

  if (error) throw error
  for (const row of (data || []) as PlazaSlotRow[]) {
    if (!grouped[row.task_info_id]) grouped[row.task_info_id] = []
    grouped[row.task_info_id].push(row)
  }
  return grouped
}

function applyCursorToQuery(query: any, sort: PlazaSortField, cursor: PlazaCursor | null) {
  if (!cursor) return query
  const v = cursor.value
  const id = cursor.id

  if (sort === 'deadline') {
    return query.or(`and(deadline.eq."${v}",id.lt."${id}"),deadline.gt."${v}"`)
  }
  return query.or(`and(created_at.eq."${v}",id.lt."${id}"),created_at.lt."${v}"`)
}

async function fetchTaskInfoBatch(params: {
  communityId: string | null
  sort: PlazaSortField
  cursor: PlazaCursor | null
  batchSize: number
}): Promise<{ rows: any[]; rawCount: number }> {
  const { communityId, sort, cursor, batchSize } = params
  let query = supabase.from('task_info').select('*')

  if (communityId) {
    query = query.eq('community_id', communityId)
  }

  if (sort === 'deadline') {
    query = query.order('deadline', { ascending: true }).order('id', { ascending: false })
  } else {
    query = query.order('created_at', { ascending: false }).order('id', { ascending: false })
  }

  query = applyCursorToQuery(query, sort, cursor)
  query = query.limit(batchSize)

  const { data, error } = await query
  if (error) throw error
  return { rows: data || [], rawCount: (data || []).length }
}

function hasActiveFilters(params: FetchPlazaTasksParams): boolean {
  return (
    (params.status && params.status !== 'all') ||
    !!params.tagId?.trim() ||
    !!params.search?.trim()
  )
}

function itemPassesFilters(item: PlazaListItem, params: FetchPlazaTasksParams, nowMs: number): boolean {
  if (!matchesPlazaFilterTab(item, params.status || 'all', nowMs)) return false
  if (!matchesPlazaTag(item, params.tagId)) return false
  if (!matchesPlazaSearch(item, params.search || '')) return false
  return true
}

async function assembleItemsFromTaskInfos(taskInfoRows: any[]): Promise<PlazaListItem[]> {
  if (!taskInfoRows.length) return []

  const taskInfoIds = taskInfoRows.map(r => r.id)
  const [slotsByInfo, tagsMap, creators] = await Promise.all([
    loadSlotRowsByTaskInfoIds(taskInfoIds),
    loadTagsForTaskInfos(taskInfoIds),
    loadCreators(taskInfoRows.map(r => r.creator_id)),
  ])

  const items: PlazaListItem[] = []
  for (const info of taskInfoRows) {
    const slotRows = slotsByInfo[info.id]
    if (!slotRows?.length) continue
    items.push(
      buildPlazaListItem(
        {
          taskInfo: info,
          slotRows,
          tags: tagsMap[info.id] || [],
          creator: creators[info.creator_id] || null,
        },
        formatLocalDateTime
      )
    )
  }
  return items
}

export async function fetchPlazaTasksPage(params: FetchPlazaTasksParams): Promise<FetchPlazaTasksResult> {
  const limit = clampLimit(params.limit)
  const sort: PlazaSortField = params.sort || 'createdAt'
  const cursor = decodePlazaCursor(params.cursor)
  const communityId = params.communityId?.trim() || null
  const filtersActive = hasActiveFilters(params)
  const nowMs = Date.now()

  if (sort === 'reward') {
    return fetchPlazaTasksPageByReward({ ...params, limit, communityId, filtersActive, nowMs })
  }

  const collected: PlazaListItem[] = []
  let pageCursor = cursor
  let hasMore = false
  let lastRawCount = 0
  let lastFetchedRows: any[] = []
  const batchSize = filtersActive ? FILTER_BATCH : limit + 1

  while (collected.length < limit) {
    const { rows, rawCount } = await fetchTaskInfoBatch({
      communityId,
      sort,
      cursor: pageCursor,
      batchSize,
    })
    lastRawCount = rawCount
    lastFetchedRows = rows
    if (!rows.length) break

    let items = await assembleItemsFromTaskInfos(rows)
    if (filtersActive) {
      items = items.filter(i => itemPassesFilters(i, params, nowMs))
    }
    collected.push(...items)

    const lastInfo = rows[rows.length - 1]
    pageCursor = buildCursorFromTaskInfo(lastInfo, sort)

    if (rawCount < batchSize) break
    if (collected.length >= limit) break
  }

  let pageItems = collected.slice(0, limit)
  if (filtersActive) {
    pageItems = sortPlazaItems(pageItems, sort)
  }

  if (!filtersActive) {
    hasMore = lastRawCount > limit
  } else {
    hasMore = lastRawCount >= batchSize
  }

  const nextCursor =
    hasMore && pageItems.length > 0
      ? encodePlazaCursor(buildCursorFromTaskInfo(lastInfoForCursor(lastFetchedRows, pageItems), sort))
      : null

  return { items: pageItems, nextCursor, hasMore }
}

function lastInfoForCursor(fetchedRows: any[], pageItems: PlazaListItem[]): any {
  if (!pageItems.length) return fetchedRows[fetchedRows.length - 1]
  const lastTaskInfoId = pageItems[pageItems.length - 1].taskInfoId
  return fetchedRows.find(r => r.id === lastTaskInfoId) || fetchedRows[fetchedRows.length - 1]
}

function buildCursorFromTaskInfo(info: any, sort: PlazaSortField): PlazaCursor {
  if (sort === 'deadline') {
    return { sort, value: String(info.deadline), id: info.id }
  }
  if (sort === 'reward') {
    return { sort, value: '0', id: info.id }
  }
  return { sort, value: String(info.created_at), id: info.id }
}

async function fetchPlazaTasksPageByReward(params: {
  limit: number
  communityId: string | null
  cursor?: string | null
  status?: PlazaFilterTab
  tagId?: string | null
  search?: string | null
  filtersActive: boolean
  nowMs: number
}): Promise<FetchPlazaTasksResult> {
  const batchSize = params.filtersActive ? FILTER_BATCH : params.limit + 1
  const cursor = decodePlazaCursor(params.cursor)

  const { rows, rawCount } = await fetchTaskInfoBatch({
    communityId: params.communityId,
    sort: 'createdAt',
    cursor,
    batchSize: Math.max(batchSize, 80),
  })

  if (!rows.length) {
    return { items: [], nextCursor: null, hasMore: false }
  }

  let items = await assembleItemsFromTaskInfos(rows)
  if (params.filtersActive) {
    items = items.filter(i =>
      itemPassesFilters(
        i,
        { status: params.status, tagId: params.tagId, search: params.search },
        params.nowMs
      )
    )
  }
  items = sortPlazaItems(items, 'reward').slice(0, params.limit)

  const hasMore = rawCount >= batchSize
  const lastInfo = rows[rows.length - 1]
  const nextCursor =
    hasMore && items.length > 0
      ? encodePlazaCursor(buildCursorFromTaskInfo(lastInfo, 'reward'))
      : null

  return { items, nextCursor, hasMore }
}

async function collectTaskInfoIdsWithSlots(communityId: string | null): Promise<string[]> {
  const seen = new Set<string>()
  let offset = 0

  while (true) {
    let query = supabase.from('tasks').select('task_info_id').order('task_info_id', { ascending: true })
    const { data, error } = await query.range(offset, offset + 999)
    if (error) throw error
    if (!data?.length) break
    for (const row of data) seen.add(row.task_info_id)
    if (data.length < 1000) break
    offset += 1000
  }

  let ids = [...seen]
  if (communityId) {
    const { data: infos, error } = await supabase
      .from('task_info')
      .select('id')
      .eq('community_id', communityId)
      .in('id', ids)
    if (error) throw error
    ids = (infos || []).map(i => i.id)
  }
  return ids
}

export async function fetchAllPlazaTasks(
  params: Omit<FetchPlazaTasksParams, 'limit' | 'cursor'>
): Promise<PlazaListItem[]> {
  const communityId = params.communityId?.trim() || null
  const infoIds = await collectTaskInfoIdsWithSlots(communityId)
  if (!infoIds.length) return []

  const all: PlazaListItem[] = []
  const batchSize = 50

  for (let i = 0; i < infoIds.length; i += batchSize) {
    const batchIds = infoIds.slice(i, i + batchSize)
    const { data: infos, error } = await supabase.from('task_info').select('*').in('id', batchIds)
    if (error) throw error
    const items = await assembleItemsFromTaskInfos(infos || [])
    all.push(...items)
  }

  return sortPlazaItems(all, params.sort || 'createdAt')
}

export function plazaItemsToApiTasks(items: PlazaListItem[]): Record<string, unknown>[] {
  return items.map(plazaItemToTaskResponse)
}

export async function fetchReviewTasksList(params: {
  communityId?: string | null
  limit?: number
  offset?: number
}): Promise<Record<string, unknown>[]> {
  const limit = Math.min(params.limit ?? 100, MAX_LIMIT)
  const offset = params.offset ?? 0
  const communityId = params.communityId?.trim() || null

  let query = supabase
    .from('tasks')
    .select(SLOT_SELECT)
    .eq('status', 'under_review')
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (communityId) {
    const { data: infoIds } = await supabase.from('task_info').select('id').eq('community_id', communityId)
    const ids = (infoIds || []).map((i: { id: string }) => i.id)
    if (!ids.length) return []
    query = query.in('task_info_id', ids)
  }

  const { data: taskRows, error } = await query
  if (error) throw error
  if (!taskRows?.length) return []

  const taskInfoIds = [...new Set(taskRows.map((t: PlazaSlotRow) => t.task_info_id))]
  const { data: taskInfos } = await supabase.from('task_info').select('*').in('id', taskInfoIds)
  const infoMap = Object.fromEntries((taskInfos || []).map((i: any) => [i.id, i]))
  const tagsMap = await loadTagsForTaskInfos(taskInfoIds)
  const creators = await loadCreators((taskInfos || []).map((i: any) => i.creator_id))

  return taskRows
    .map((row: PlazaSlotRow) => {
      const info = infoMap[row.task_info_id]
      if (!info) return null
      const item = buildPlazaListItem(
        {
          taskInfo: info,
          slotRows: [row],
          tags: tagsMap[info.id] || [],
          creator: creators[info.creator_id] || null,
        },
        formatLocalDateTime
      )
      return plazaItemToTaskResponse(item)
    })
    .filter(Boolean) as Record<string, unknown>[]
}
