import { marked } from 'marked'
import DOMPurify from 'isomorphic-dompurify'

marked.setOptions({ breaks: true, gfm: true })

const SANITIZE_OPTIONS = {
  ALLOWED_TAGS: ['p', 'strong', 'b', 'ul', 'ol', 'li', 'br'],
  ALLOWED_ATTR: [] as string[],
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

export function wrapBold(textarea: HTMLTextAreaElement): string {
  const { selectionStart: start, selectionEnd: end, value } = textarea
  const selected = value.slice(start, end)
  const insert = selected ? `**${selected}**` : '****'
  const next = value.slice(0, start) + insert + value.slice(end)
  const cursor = selected ? start + insert.length : start + 2
  textarea.setSelectionRange(cursor, cursor)
  textarea.focus()
  return next
}

export function insertList(textarea: HTMLTextAreaElement): string {
  const { selectionStart: start, selectionEnd: end, value } = textarea
  const selected = value.slice(start, end)
  const insert = selected
    ? selected.split('\n').map((line) => (line.startsWith('- ') ? line : `- ${line}`)).join('\n')
    : '- '
  const next = value.slice(0, start) + insert + value.slice(end)
  const cursor = start + insert.length
  textarea.setSelectionRange(cursor, cursor)
  textarea.focus()
  return next
}
