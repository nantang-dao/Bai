import crypto from 'crypto'
type CookieHeaderSource = { headers?: { cookie?: string } }

export interface SessionPayload {
  uid: string
  iat: number
}

const SESSION_COOKIE_NAME = 'mycoseed_sid'

function base64url(input: Buffer | Uint8Array | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : Buffer.from(input)
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function base64urlDecodeToString(input: string): string {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/')
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4))
  return Buffer.from(b64 + pad, 'base64').toString('utf8')
}

function getCookieValue(req: CookieHeaderSource, name: string): string | null {
  const header = req.headers?.cookie || ''
  const parts = header.split(';').map(p => p.trim())
  for (const p of parts) {
    if (!p) continue
    const eq = p.indexOf('=')
    if (eq === -1) continue
    const k = p.slice(0, eq)
    if (k !== name) continue
    return p.slice(eq + 1)
  }
  return null
}

function hmacSign(secret: string, payload: string): string {
  return base64url(crypto.createHmac('sha256', secret).update(payload).digest())
}

export function createSessionCookie(opts: {
  userId: string
  sessionSecret: string
  maxAgeSeconds?: number
  secure?: boolean
  sameSite?: 'Lax' | 'Strict' | 'None'
  domain?: string
}): string {
  const payload: SessionPayload = { uid: opts.userId, iat: Date.now() }
  const raw = base64url(JSON.stringify(payload))
  const sig = hmacSign(opts.sessionSecret, raw)
  const value = `${raw}.${sig}`

  const parts = [
    `${SESSION_COOKIE_NAME}=${value}`,
    'HttpOnly',
    'Path=/',
    `Max-Age=${Math.max(1, opts.maxAgeSeconds ?? 60 * 60 * 24 * 30)}`,
    `SameSite=${opts.sameSite ?? 'Lax'}`,
  ]
  if (opts.secure) parts.push('Secure')
  if (opts.domain) parts.push(`Domain=${opts.domain}`)
  return parts.join('; ')
}

export function clearSessionCookie(opts?: { secure?: boolean; sameSite?: 'Lax' | 'Strict' | 'None'; domain?: string }): string {
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    'HttpOnly',
    'Path=/',
    'Max-Age=0',
    `SameSite=${opts?.sameSite ?? 'Lax'}`,
  ]
  if (opts?.secure) parts.push('Secure')
  if (opts?.domain) parts.push(`Domain=${opts.domain}`)
  return parts.join('; ')
}

export function getSession(req: CookieHeaderSource, sessionSecret: string): SessionPayload | null {
  const raw = getCookieValue(req, SESSION_COOKIE_NAME)
  if (!raw) return null
  const dot = raw.lastIndexOf('.')
  if (dot === -1) return null
  const payload = raw.slice(0, dot)
  const sig = raw.slice(dot + 1)
  const expected = hmacSign(sessionSecret, payload)
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
  try {
    const parsed = JSON.parse(base64urlDecodeToString(payload)) as SessionPayload
    if (!parsed?.uid) return null
    return parsed
  } catch {
    return null
  }
}

export function getPkceCookie(req: CookieHeaderSource): { state: string; verifier: string } | null {
  const raw = getCookieValue(req, 'mycoseed_pkce')
  if (!raw) return null
  const tilde = raw.indexOf('~')
  if (tilde === -1) return null
  const state = raw.slice(0, tilde)
  const verifier = raw.slice(tilde + 1)
  if (!state || !verifier) return null
  return { state, verifier }
}

export function createPkceCookie(opts: {
  state: string
  verifier: string
  maxAgeSeconds?: number
  secure?: boolean
  sameSite?: 'Lax' | 'Strict' | 'None'
  domain?: string
}): string {
  const parts = [
    `mycoseed_pkce=${opts.state}~${opts.verifier}`,
    'HttpOnly',
    'Path=/',
    `Max-Age=${Math.max(1, opts.maxAgeSeconds ?? 600)}`,
    `SameSite=${opts.sameSite ?? 'Lax'}`,
  ]
  if (opts.secure) parts.push('Secure')
  if (opts.domain) parts.push(`Domain=${opts.domain}`)
  return parts.join('; ')
}

export function clearPkceCookie(opts?: { secure?: boolean; sameSite?: 'Lax' | 'Strict' | 'None'; domain?: string }): string {
  const parts = [
    'mycoseed_pkce=',
    'HttpOnly',
    'Path=/',
    'Max-Age=0',
    `SameSite=${opts?.sameSite ?? 'Lax'}`,
  ]
  if (opts?.secure) parts.push('Secure')
  if (opts?.domain) parts.push(`Domain=${opts.domain}`)
  return parts.join('; ')
}

