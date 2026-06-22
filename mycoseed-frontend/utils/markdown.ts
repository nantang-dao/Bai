import { marked } from 'marked'
import DOMPurify from 'isomorphic-dompurify'

marked.setOptions({ breaks: true, gfm: true })

const SANITIZE_OPTIONS = {
  ALLOWED_TAGS: ['p', 'strong', 'b', 'ul', 'ol', 'li', 'br'],
  ALLOWED_ATTR: [] as string[],
}

const BOLD_PLACEHOLDER = '加粗文字'

export type BoldEditResult = {
  value: string
  selectionStart: number
  selectionEnd: number
}

export function renderTaskMarkdown(text: string): string {
  if (!text?.trim()) return ''
  const raw = marked.parse(text, { async: false }) as string
  return DOMPurify.sanitize(raw, SANITIZE_OPTIONS)
}

export function stripTaskMarkdown(text: string): string {
  if (!text) return ''
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/<[^>]+>/g, '')
    .trim()
}

/** 在选区插入加粗标记，返回新文本与光标/选区位置（供 nextTick 后写回 textarea） */
export function applyBoldWrap(value: string, start: number, end: number): BoldEditResult {
  const selected = value.slice(start, end)
  if (selected) {
    const insert = `**${selected}**`
    const next = value.slice(0, start) + insert + value.slice(end)
    const cursor = start + insert.length
    return { value: next, selectionStart: cursor, selectionEnd: cursor }
  }
  const insert = `**${BOLD_PLACEHOLDER}**`
  const next = value.slice(0, start) + insert + value.slice(end)
  return {
    value: next,
    selectionStart: start + 2,
    selectionEnd: start + 2 + BOLD_PLACEHOLDER.length,
  }
}
