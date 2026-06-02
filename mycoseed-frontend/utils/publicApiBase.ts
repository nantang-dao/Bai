/**
 * Browser-facing API origin for auth and REST calls.
 * Empty configured URL => same-origin relative /api/* (via Nuxt proxy in production).
 */
export function resolvePublicApiBase(configuredApiUrl?: string): string {
  const configured = (configuredApiUrl || '').trim().replace(/\/+$/, '')
  if (configured) return configured
  if (typeof window !== 'undefined') return window.location.origin
  return ''
}

/**
 * Prefix for API paths: "" or "https://host" (no trailing slash).
 */
export function apiUrl(path: string, base?: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const b = (base ?? '').replace(/\/+$/, '')
  return b ? `${b}${normalizedPath}` : normalizedPath
}
