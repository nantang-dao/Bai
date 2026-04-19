/**
 * PATCH /tasks/:id/approve 与 /reject 共用权限规则（阶段 7）：
 * - 子任务行（listing_kind=taskpool_subtask）：仅 task_info.manager_user_id 可审。
 *   发布者若已认领池主成为 Manager，则 manager_user_id=发布者，自然可审。
 * - 其它任务行：仅创建者（task_info.creator_id）可审。
 */
export function checkTaskApproveRejectPermission(
  taskListingKind: string | null | undefined,
  taskInfo: { creator_id: string; manager_user_id?: string | null },
  userId: string
): { ok: true } | { ok: false; message: string } {
  const lk = taskListingKind || 'standard'
  if (lk === 'taskpool_subtask') {
    const mgr = taskInfo.manager_user_id
    if (!mgr) {
      return {
        ok: false,
        message: '子任务须由任务池 Manager 审核，请先认领任务池负责人',
      }
    }
    if (userId !== mgr) {
      return { ok: false, message: '该子任务由任务池 Manager 审核，您无权操作' }
    }
    return { ok: true }
  }

  if (userId !== taskInfo.creator_id) {
    return { ok: false, message: '您不是任务创建者，无权审核此任务' }
  }
  return { ok: true }
}

