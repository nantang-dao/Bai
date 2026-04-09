import { Request, Response } from 'express'
import { supabase } from '../services/supabase'

const parseNumber = (v: unknown, fallback: number) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

/**
 * 防止 PostgREST 过滤表达式注入：
 * `.or("col.ilike.%${q}%")` 这类语法会把 q 当作表达式片段。
 * 这里用白名单把 q 限制为常见文本字符，避免 `,():"` 等语法字符进入过滤表达式。
 */
const sanitizeSearchTerm = (raw: string): string => {
  const s = String(raw || '').trim()
  if (!s) return ''
  // 允许：中英文、数字、空格、下划线、连字符
  const cleaned = s.replace(/[^a-zA-Z0-9\u4e00-\u9fa5\s_-]/g, ' ').replace(/\s+/g, ' ').trim()
  return cleaned.slice(0, 50)
}

export const listFaqs = async (req: Request, res: Response) => {
  try {
    const q = sanitizeSearchTerm(typeof req.query.q === 'string' ? req.query.q : '')
    const limit = Math.min(Math.max(parseNumber(req.query.limit, 50), 1), 200)
    const offset = Math.max(parseNumber(req.query.offset, 0), 0)

    let query = supabase
      .from('faqs')
      .select('id, question, answer, created_at, updated_at')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (q) {
      // 注意：这里仍是 PostgREST 表达式字符串，必须确保 q 不含语法字符
      query = query.or(`question.ilike.%${q}%,answer.ilike.%${q}%`)
    }

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

