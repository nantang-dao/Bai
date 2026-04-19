/**
 * tasks.listing_kind：商城中该行的业务语义（与 DB migration 028 一致）
 */
export type TaskListingKind = 'standard' | 'taskpool_pool' | 'taskpool_subtask'

export const TASK_LISTING_KINDS: readonly TaskListingKind[] = [
  'standard',
  'taskpool_pool',
  'taskpool_subtask',
] as const

export function isTaskListingKind(s: string): s is TaskListingKind {
  return (TASK_LISTING_KINDS as readonly string[]).includes(s)
}

/**
 * 与 DB CHECK tasks_pool_subtask_link_check 一致：子任务行必须带 pool_subtask_id，其它行必须为 NULL。
 */
export function assertValidTaskListingRow(
  listingKind: TaskListingKind,
  poolSubtaskId: string | null | undefined
): void {
  const sid = poolSubtaskId ?? null
  if (listingKind === 'taskpool_subtask') {
    if (!sid || typeof sid !== 'string' || sid.trim() === '') {
      throw new Error('listing_kind=taskpool_subtask 时必须提供 pool_subtask_id（对应 task_subtasks.id）')
    }
  } else if (sid != null) {
    throw new Error('仅 listing_kind=taskpool_subtask 时可设置 pool_subtask_id')
  }
}
