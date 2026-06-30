import type { TaskStatus } from '../types/task'

/** 广场列表名额行（轻量，不含 timeline/proof） */
export type PlazaSlotRow = {
  id: string
  task_info_id: string
  creator_id: string | null
  claimer_id: string | null
  reward: number | string
  currency: string
  participant_index: number
  status: string
  transferred_at: string | null
  created_at: string
  updated_at: string
}

export type PlazaSortField = 'createdAt' | 'deadline' | 'reward'
export type PlazaFilterTab = 'all' | 'pending' | 'unsubmit' | 'completed' | 'expired'

export interface PlazaCursor {
  sort: PlazaSortField
  /** ISO 时间或数字字符串（reward） */
  value: string
  id: string
}

export interface PlazaListItemInput {
  taskInfo: Record<string, unknown>
  slotRows: PlazaSlotRow[]
  tags: { id: string; name: string; colorHex: string }[]
  creator?: { id: string; name: string; avatar?: string | null } | null
}

export interface PlazaListItem {
  id: string
  taskInfoId: string
  title: string
  description: string
  reward: number
  currency: string
  status: TaskStatus
  participantLimit: number | null
  claimedCount: number
  creatorId: string
  creatorName?: string | null
  creatorAvatar?: string | null
  claimerId?: string
  activityId: number
  startDate?: string
  deadline?: string
  submitDeadline?: string
  rewardDistributionMode?: string
  participantLimitRaw?: number | null
  transferredAt?: string
  createdAt?: string
  updatedAt?: string
  tags: { id: string; name: string; colorHex: string }[]
}

export function encodePlazaCursor(cursor: PlazaCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url')
}

export function decodePlazaCursor(raw: string | null | undefined): PlazaCursor | null {
  if (!raw?.trim()) return null
  try {
    const parsed = JSON.parse(Buffer.from(raw.trim(), 'base64url').toString('utf8')) as PlazaCursor
    if (!parsed?.id || !parsed?.sort || parsed.value == null) return null
    return parsed
  } catch {
    return null
  }
}

/** 多人任务聚合状态（与 buildGroupedPlazaTasks 一致） */
export function deriveGroupedPlazaStatus(
  participantLimit: number | null | undefined,
  slotRows: Pick<PlazaSlotRow, 'status' | 'claimer_id'>[]
): TaskStatus {
  const limit = participantLimit ?? 1
  const claimedCount = slotRows.filter(r => r.claimer_id).length

  if (limit > 1) {
    if (claimedCount < limit) return 'unclaimed'
    const allCompleted = slotRows.every(r => r.status === 'completed' || r.status === 'rejected')
    if (allCompleted && slotRows.length > 0) {
      return slotRows.some(r => r.status === 'completed') ? 'completed' : 'rejected'
    }
    const uncompleted = slotRows.find(r => r.status !== 'completed' && r.status !== 'rejected')
    return (uncompleted?.status || 'unclaimed') as TaskStatus
  }

  return (slotRows[0]?.status || 'unclaimed') as TaskStatus
}

export function pickRepresentativeSlotRow(rows: PlazaSlotRow[]): PlazaSlotRow {
  if (!rows.length) throw new Error('pickRepresentativeSlotRow: empty rows')
  return [...rows].sort(
    (a, b) => (a.participant_index ?? 0) - (b.participant_index ?? 0) || a.created_at.localeCompare(b.created_at)
  )[0]
}

function parseBeijingDeadlineMs(deadline: string | undefined | null): number | null {
  if (!deadline) return null
  const clean = deadline.replace(/Z$|[+-]\d{2}:?\d{2}$/, '')
  const match = clean.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  if (!match) return null
  const [, y, mo, d, h, mi] = match.map(Number)
  const utc = Date.UTC(y, mo - 1, d, h, mi)
  return utc - 8 * 60 * 60 * 1000
}

function isPlazaItemExpired(item: PlazaListItem, nowMs: number): boolean {
  const deadlineMs = parseBeijingDeadlineMs(item.deadline)
  if (deadlineMs == null || nowMs <= deadlineMs) return false
  if (item.participantLimit != null && item.participantLimit > 1) return true
  return item.claimedCount === 0
}

function isPlazaItemOverdue(item: PlazaListItem, nowMs: number): boolean {
  const submitMs = parseBeijingDeadlineMs(item.submitDeadline || item.deadline)
  if (submitMs == null || nowMs <= submitMs) return false
  if (item.claimedCount === 0) return false
  const active = ['claimed', 'unsubmit', 'submitted'].includes(item.status)
  return active
}

function isPlazaItemNotFullyClaimed(item: PlazaListItem): boolean {
  if (item.participantLimit != null && item.participantLimit > 1) {
    return item.claimedCount < item.participantLimit
  }
  return false
}

/** 映射到广场 Tab 筛选（与前端 mapPublishedTaskToFilter 对齐） */
export function mapPlazaItemToFilterTab(item: PlazaListItem, nowMs = Date.now()): PlazaFilterTab {
  if (isPlazaItemOverdue(item, nowMs)) return 'expired'
  if (isPlazaItemExpired(item, nowMs)) return 'expired'
  if (item.status === 'rejected') return 'expired'
  if (isPlazaItemNotFullyClaimed(item)) return 'pending'
  if (item.status === 'unclaimed') return 'pending'
  if (item.status === 'claimed' || item.status === 'unsubmit' || item.status === 'submitted' || item.status === 'under_review') {
    return 'unsubmit'
  }
  if (item.status === 'completed') return 'completed'
  return 'all'
}

export function matchesPlazaSearch(item: PlazaListItem, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return (
    item.title.toLowerCase().includes(q) ||
    item.description.toLowerCase().includes(q) ||
    (item.creatorName || '').toLowerCase().includes(q)
  )
}

export function matchesPlazaFilterTab(item: PlazaListItem, tab: PlazaFilterTab, nowMs = Date.now()): boolean {
  if (tab === 'all') return true
  return mapPlazaItemToFilterTab(item, nowMs) === tab
}

export function matchesPlazaTag(
  item: PlazaListItem,
  tagId: string | null | undefined
): boolean {
  if (!tagId?.trim()) return true
  return item.tags.some(t => t.id === tagId)
}

export function sortPlazaItems(items: PlazaListItem[], sort: PlazaSortField): PlazaListItem[] {
  const copy = [...items]
  if (sort === 'deadline') {
    return copy.sort((a, b) => {
      const da = a.submitDeadline || a.deadline || ''
      const db = b.submitDeadline || b.deadline || ''
      if (!da) return 1
      if (!db) return -1
      return da.localeCompare(db)
    })
  }
  if (sort === 'reward') {
    return copy.sort((a, b) => (b.reward || 0) - (a.reward || 0))
  }
  return copy.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
}

export function buildPlazaListItem(
  input: PlazaListItemInput,
  formatDate: (v: string | null | undefined) => string | undefined
): PlazaListItem {
  const info = input.taskInfo
  const slotRows = input.slotRows
  const rep = pickRepresentativeSlotRow(slotRows)
  const participantLimit = (info.participant_limit as number | null) ?? null
  const claimedCount = slotRows.filter(r => r.claimer_id).length
  const status = deriveGroupedPlazaStatus(participantLimit, slotRows)

  return {
    id: rep.id,
    taskInfoId: info.id as string,
    title: (info.title as string) || '',
    description: (info.description as string) || '',
    reward: parseFloat(String(rep.reward || '0')),
    currency: rep.currency || 'NT',
    status,
    participantLimit,
    claimedCount,
    creatorId: (info.creator_id as string) || rep.creator_id || '',
    creatorName: input.creator?.name ?? null,
    creatorAvatar: input.creator?.avatar ?? null,
    claimerId: rep.claimer_id || undefined,
    activityId: (info.activity_id as number) || 0,
    startDate: formatDate(info.start_date as string),
    deadline: formatDate(info.deadline as string),
    submitDeadline: formatDate(info.submit_deadline as string),
    rewardDistributionMode: (info.reward_distribution_mode as string) || 'per_person',
    transferredAt: formatDate(rep.transferred_at),
    createdAt: formatDate(info.created_at as string),
    updatedAt: formatDate(info.updated_at as string),
    tags: input.tags,
  }
}

export function buildPlazaCursorForItem(item: PlazaListItem, sort: PlazaSortField): PlazaCursor {
  if (sort === 'deadline') {
    return { sort, value: item.submitDeadline || item.deadline || '', id: item.taskInfoId }
  }
  if (sort === 'reward') {
    return { sort, value: String(item.reward ?? 0), id: item.taskInfoId }
  }
  return { sort, value: item.createdAt || '', id: item.taskInfoId }
}
