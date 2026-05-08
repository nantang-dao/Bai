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

async function ensureDueReminders(userId: string, communityId: string) {
  const settings = await getOrCreateSettings(userId)
  if (!settings.due_enabled) return

  const now = Date.now()
  const ONE_HOUR = 60 * 60 * 1000
  const inserts: any[] = []

  // --- 任务到期提醒（1小时前） ---
  const { data: myTasks } = await supabase
    .from('tasks')
    .select('id, task_info_id, status')
    .eq('claimer_id', userId)
    .not('status', 'in', '("completed","rejected")')

  if (myTasks && myTasks.length > 0) {
    const taskInfoIds = [...new Set(myTasks.map((t: any) => t.task_info_id).filter(Boolean))]
    if (taskInfoIds.length > 0) {
      const { data: infos } = await supabase
        .from('task_info')
        .select('id, title, submit_deadline, deadline, community_id')
        .in('id', taskInfoIds)
        .eq('community_id', communityId)

      if (infos && infos.length > 0) {
        const infoMap = new Map<string, any>(infos.map((i: any) => [i.id, i]))
        for (const t of myTasks) {
          const info = infoMap.get(t.task_info_id)
          if (!info) continue
          const deadlineStr = info.submit_deadline || info.deadline
          if (!deadlineStr) continue
          const endTs = new Date(deadlineStr).getTime()
          if (!Number.isFinite(endTs)) continue
          const remaining = endTs - now
          if (remaining <= 0 || remaining > ONE_HOUR) continue
          inserts.push({
            user_id: userId,
            community_id: communityId,
            category: 'due',
            type: 'task_due_1h',
            title: `任务到期提醒：${info.title}`,
            body: '距离截止还有 1 小时',
            data: { taskId: t.id, taskInfoId: info.id, title: info.title, deadline: deadlineStr, window: '1h' },
            dedupe_key: `due:${t.id}:1h`
          })
        }
      }
    }
  }

  // --- 活动到期提醒（1小时前） ---
  const { data: myParticipations } = await supabase
    .from('community_event_participations')
    .select('occurrence_id')
    .eq('user_id', userId)
    .eq('status', 'registered')

  if (myParticipations && myParticipations.length > 0) {
    const occIds = myParticipations.map((p: any) => p.occurrence_id)
    const { data: occs } = await supabase
      .from('community_event_occurrences')
      .select('id, event_id, activity_start')
      .in('id', occIds)

    if (occs && occs.length > 0) {
      const eventIds = [...new Set(occs.map((o: any) => o.event_id))]
      const { data: events } = await supabase
        .from('community_events')
        .select('id, title, community_id')
        .in('id', eventIds)
        .eq('community_id', communityId)

      if (events && events.length > 0) {
        const eventMap = new Map<string, any>(events.map((e: any) => [e.id, e]))
        for (const occ of occs) {
          const ev = eventMap.get(occ.event_id)
          if (!ev) continue
          const startTs = new Date(occ.activity_start).getTime()
          if (!Number.isFinite(startTs)) continue
          const remaining = startTs - now
          if (remaining <= 0 || remaining > ONE_HOUR) continue
          inserts.push({
            user_id: userId,
            community_id: communityId,
            category: 'due',
            type: 'event_due_1h',
            title: `活动即将开始：${ev.title}`,
            body: '活动将在 1 小时后开始',
            data: { eventId: ev.id, occurrenceId: occ.id, title: ev.title, activityStart: occ.activity_start, window: '1h' },
            dedupe_key: `event_due:${occ.id}:1h`
          })
        }
      }
    }
  }

  if (inserts.length === 0) return
  await supabase.from('notifications').upsert(inserts, { onConflict: 'user_id,dedupe_key' })
}

export const getSummary = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user
    if (!user) return res.status(401).json({ error: '未授权' })

    const communityId = typeof req.query.communityId === 'string' ? req.query.communityId.trim() : ''
    if (communityId) {
      await ensureDueReminders(user.id, communityId)
    }

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
