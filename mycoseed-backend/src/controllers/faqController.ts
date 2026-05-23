import { Request, Response } from 'express'
import { supabase } from '../services/supabase'

const sanitizeSearch = (input: string): string => {
  // 防止 PostgREST filter 注入：仅保留中文/字母/数字/空格，并限制长度
  const s = String(input || '').slice(0, 80)
  return s.replace(/[^\p{Script=Han}a-zA-Z0-9\s]/gu, ' ').replace(/\s+/g, ' ').trim()
}

const parseNumber = (v: unknown, fallback: number) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

export const listFaqs = async (req: Request, res: Response) => {
  try {
    const qRaw = typeof req.query.q === 'string' ? req.query.q : ''
    const q = sanitizeSearch(qRaw)
    const limit = Math.min(Math.max(parseNumber(req.query.limit, 50), 1), 200)
    const offset = Math.max(parseNumber(req.query.offset, 0), 0)

    let query = supabase
      .from('faqs')
      .select('id, question, answer, created_at, updated_at')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (q) query = query.or(`question.ilike.%${q}%,answer.ilike.%${q}%`)

    const { data, error } = await query
    if (error) throw error

    res.json({ faqs: data || [] })
  } catch (error: any) {
    console.error('[FAQ] listFaqs error:', error)
    res.status(500).json({ error: error?.message || '获取 FAQ 失败' })
  }
}

export const getFaqById = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id || '').trim()
    if (!id) return res.status(400).json({ error: '缺少 FAQ id' })

    const { data, error } = await supabase
      .from('faqs')
      .select('id, question, answer, created_at, updated_at')
      .eq('id', id)
      .single()

    if (error) {
      // PGRST116 = not found
      if ((error as any).code === 'PGRST116') return res.status(404).json({ error: 'FAQ 不存在' })
      throw error
    }

    res.json({ faq: data })
  } catch (error: any) {
    console.error('[FAQ] getFaqById error:', error)
    res.status(500).json({ error: error?.message || '获取 FAQ 失败' })
  }
}

