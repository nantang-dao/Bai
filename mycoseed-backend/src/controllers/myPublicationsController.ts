import { Response } from 'express'
import { supabase } from '../services/supabase'
import { AuthRequest } from '../middleware/auth'
import { buildPublishedEvents } from '../services/eventProfileLogic'

export const getMyPublishedEvents = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user
    if (!user) return res.status(401).json({ error: '未授权' })

    const events = await buildPublishedEvents(supabase, user.id)

    res.json({ events, total: events.length })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '获取发布活动失败'
    console.error('[my-publications] getMyPublishedEvents error:', error)
    res.status(500).json({ error: message })
  }
}
