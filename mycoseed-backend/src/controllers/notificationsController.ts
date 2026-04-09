import { Response } from 'express'
import { supabase } from '../services/supabase'
import { AuthRequest } from '../middleware/auth'

type Category = 'community' | 'task' | 'due'

const parseNumber = (v: unknown, fallback: number) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

async function getOrCreateSettings(userId: string) {
  const { data } = await supabase
    .from('user_notification_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (data) return data

  const { data: created, error } = await supabase
    .from('user_notification_settings')
    .insert({ user_id: userId })
    .select('*')
    .single()
  if (error) throw error
  return created
}

/**
 * 生成到期提醒（1h/3h）并写入 notifications（带去重）
 * 仅在 due_enabled=true 且传入 communityId 时生成
 */
async function ensureDueReminders(userId: string, communityId: string) {
  const settings = await getOrCreateSettings(userId)
  if (!settings.due_enabled) return

  // 找到我领取但未完成/未终止的任务（同社区）
  // 通过 tasks.claimer_id=user 且 status not in (completed,rejected)
  const { data: myTasks, error } = await supabase
    .from('tasks')
    .select('id, task_info_id, status')
    .eq('claimer_id', userId)
    .not('status', 'in', '("completed","rejected")')

  if (error) throw error
  if (!myTasks || myTasks.length === 0) return

  const taskInfoIds = [...new Set(myTasks.map((t: any) => t.task_info_id).filter(Boolean))]
  if (taskInfoIds.length === 0) return

  const { data: infos, error: infoError } = await supabase
    .from('task_info')
    .select('id, title, submit_deadline, deadline, community_id')
    .in('id', taskInfoIds)
    .eq('community_id', communityId)

  if (infoError) throw infoError
  if (!infos || infos.length === 0) return

  const infoMap = new Map<string, any>(infos.map((i: any) => [i.id, i]))

  const now = Date.now()
  const windows = [
    { key: '3h', ms: 3 * 60 * 60 * 1000, type: 'task_due_3h', titleSuffix: '距离截止还有 3 小时' },
    { key: '1h', ms: 1 * 60 * 60 * 1000, type: 'task_due_1h', titleSuffix: '距离截止还有 1 小时' }
  ] as const

  const inserts: any[] = []
  for (const t of myTasks) {
    const info = infoMap.get(t.task_info_id)
    if (!info) continue
    const deadlineStr = info.submit_deadline || info.deadline
    if (!deadlineStr) continue
    const endTs = new Date(deadlineStr).getTime()
    if (!Number.isFinite(endTs)) continue

    const remaining = endTs - now
    if (remaining <= 0) continue

    for (const w of windows) {
      // 进入窗口：<= w.ms 且 > w.ms - 10min（给个容忍区，避免频繁生成）
      // 这里只做“窗口内存在”触发，靠去重保证不会重复插入
      if (remaining <= w.ms) {
        const dedupeKey = `due:${t.id}:${w.key}`
        inserts.push({
          user_id: userId,
          community_id: communityId,
          category: 'due',
          type: w.type,
          title: `任务到期提醒：${info.title}`,
          body: w.titleSuffix,
          data: { taskId: t.id, taskInfoId: info.id, title: info.title, deadline: deadlineStr, window: w.key },
          dedupe_key: dedupeKey
        })
      }
    }
  }

  if (inserts.length === 0) return

  // upsert by unique index (user_id, dedupe_key)
  await supabase.from('notifications').upsert(inserts, { onConflict: 'user_id,dedupe_key' })
}

export const getSummary = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user
    if (!user) return res.status(401).json({ error: '未授权' })

    const communityId = typeof req.query.communityId === 'string' ? req.query.communityId.trim() : ''
    if (communityId) {
      // 仅在请求 summary 时顺便生成 due 通知
      await ensureDueReminders(user.id, communityId)
    }

    // 未读总数 & 各分类未读
    const base = supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('read_at', null)

    const [all, community, task, due] = await Promise.all([
      base,
      supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('category', 'community').is('read_at', null),
      supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('category', 'task').is('read_at', null),
      supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('category', 'due').is('read_at', null),
    ])

    res.json({
      hasUnread: (all.count || 0) > 0,
      unreadTotal: all.count || 0,
      unreadByCategory: {
        community: community.count || 0,
        task: task.count || 0,
        due: due.count || 0,
      }
    })
  } catch (error: any) {
    console.error('[notifications] getSummary error:', error)
    res.status(500).json({ error: error?.message || '获取消息摘要失败' })
  }
}

export const listNotifications = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user
    if (!user) return res.status(401).json({ error: '未授权' })

    const communityId = typeof req.query.communityId === 'string' ? req.query.communityId.trim() : ''
    const category = typeof req.query.category === 'string' ? (req.query.category.trim() as Category) : ''
    const limit = Math.min(Math.max(parseNumber(req.query.limit, 50), 1), 200)
    const offset = Math.max(parseNumber(req.query.offset, 0), 0)

    if (category === 'due' && communityId) {
      await ensureDueReminders(user.id, communityId)
    }

    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (communityId) query = query.eq('community_id', communityId)
    if (category) query = query.eq('category', category)

    const { data, error } = await query
    if (error) throw error

    res.json({ notifications: data || [] })
  } catch (error: any) {
    console.error('[notifications] listNotifications error:', error)
    res.status(500).json({ error: error?.message || '获取消息列表失败' })
  }
}

export const markRead = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user
    if (!user) return res.status(401).json({ error: '未授权' })

    const { ids, category, communityId } = req.body as { ids?: string[]; category?: Category; communityId?: string }
    const now = new Date().toISOString()

    let q = supabase.from('notifications').update({ read_at: now }).eq('user_id', user.id)
    if (Array.isArray(ids) && ids.length > 0) {
      q = q.in('id', ids)
    } else if (category) {
      q = q.eq('category', category)
      if (communityId) q = q.eq('community_id', communityId)
    } else {
      // 未提供 ids/category：默认全部已读
      if (communityId) q = q.eq('community_id', communityId)
    }

    const { error } = await q
    if (error) throw error

    res.json({ success: true })
  } catch (error: any) {
    console.error('[notifications] markRead error:', error)
    res.status(500).json({ error: error?.message || '标记已读失败' })
  }
}

