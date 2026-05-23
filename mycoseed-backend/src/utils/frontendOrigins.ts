/** Parse env / config into allowed browser Origins for CORS and OAuth return. */

const LOCAL_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:3003',
]

function toOrigin(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  try {
    return new URL(trimmed).origin
  } catch {
    return null
  }
}

/** Allowed frontend Origins (scheme + host + port). */
export function getAllowedFrontendOrigins(): string[] {
  const fromList = (process.env.FRONTEND_URLS || '')
    .split(',')
    .map((s) => toOrigin(s))
    .filter((o): o is string => Boolean(o))

  const single = process.env.FRONTEND_URL ? toOrigin(process.env.FRONTEND_URL) : null

  return [...new Set([...fromList, ...(single ? [single] : []), ...LOCAL_ORIGINS])]
}

/** Default frontend Origin when return_origin is missing or invalid. */
export function getDefaultFrontendOrigin(): string {
  const fromEnv = process.env.FRONTEND_URL ? toOrigin(process.env.FRONTEND_URL) : null
  if (fromEnv) return fromEnv
  const allowed = getAllowedFrontendOrigins()
  return allowed[0] || 'http://localhost:3003'
}

/**
 * Pick OAuth post-login redirect base (Origin) from query / header, else default.
 * Accepts full URL or Origin string; must be in allowlist (except dev uses list only).
 */
export function resolveReturnOrigin(...candidates: (string | undefined)[]): string {
  const allowed = new Set(getAllowedFrontendOrigins())
  for (const raw of candidates) {
    if (!raw) continue
    const origin = toOrigin(raw) ?? (allowed.has(raw) ? raw : null)
    if (origin && allowed.has(origin)) return origin
  }
  return getDefaultFrontendOrigin()
}
