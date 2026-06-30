import { Response } from 'express'
import { supabase } from '../services/supabase'
import { AuthRequest } from '../middleware/auth'
import { buildParticipatedEvents } from '../services/eventProfileLogic'

export const getMyParticipatedEvents = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user
    if (!user) return res.status(401).json({ error: '未授权' })

    const { data: userRow } = await supabase
      .from('users')
      .select('evm_chain_address')
      .eq('id', user.id)
      .maybeSingle()

    const walletLower = userRow?.evm_chain_address?.toLowerCase() || ''
    const events = await buildParticipatedEvents(supabase, user.id, walletLower)

    res.json({ events, total: events.length })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '获取报名活动失败'
    console.error('[my-participations] getMyParticipatedEvents error:', error)
    res.status(500).json({ error: message })
  }
}
