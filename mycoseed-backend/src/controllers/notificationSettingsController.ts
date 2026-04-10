import { Response } from 'express'
import { supabase } from '../services/supabase'
import { AuthRequest } from '../middleware/auth'

export const getSettings = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user
    if (!user) return res.status(401).json({ error: '未授权' })

    let { data } = await supabase
      .from('user_notification_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!data) {
      const { data: created, error } = await supabase
        .from('user_notification_settings')
        .insert({ user_id: user.id })
        .select('*')
        .single()
      if (error) throw error
      data = created
    }

    res.json({ settings: data })
  } catch (error: any) {
    console.error('[notificationSettings] getSettings error:', error)
    res.status(500).json({ error: error?.message || '获取通知设置失败' })
  }
}

export const updateSettings = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user
    if (!user) return res.status(401).json({ error: '未授权' })

    const body = req.body || {}
    const patch: any = {}

    if (typeof body.push_sms_enabled === 'boolean') patch.push_sms_enabled = body.push_sms_enabled
    if (typeof body.push_email_enabled === 'boolean') patch.push_email_enabled = body.push_email_enabled
    if (typeof body.community_enabled === 'boolean') patch.community_enabled = body.community_enabled
    if (typeof body.task_enabled === 'boolean') patch.task_enabled = body.task_enabled
    if (typeof body.due_enabled === 'boolean') patch.due_enabled = body.due_enabled

    const { data, error } = await supabase
      .from('user_notification_settings')
      .upsert({ user_id: user.id, ...patch }, { onConflict: 'user_id' })
      .select('*')
      .single()

    if (error) throw error
    res.json({ success: true, settings: data })
  } catch (error: any) {
    console.error('[notificationSettings] updateSettings error:', error)
    res.status(500).json({ error: error?.message || '更新通知设置失败' })
  }
}

