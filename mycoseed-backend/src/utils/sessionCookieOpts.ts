import { getDefaultFrontendOrigin } from './frontendOrigins'

export function cookieOptsForFrontend(redirectUri: string, frontendOrigin?: string) {
  const secure = redirectUri.startsWith('https://')
  const backendOrigin = new URL(redirectUri).origin
  const front =
    frontendOrigin && frontendOrigin.includes('://')
      ? new URL(frontendOrigin).origin
      : frontendOrigin || getDefaultFrontendOrigin()
  const crossSite = backendOrigin !== front
  const sameSite =
    crossSite && secure ? ('None' as const) : ((process.env.SESSION_SAMESITE as any) || ('Lax' as const))
  const domain = process.env.SESSION_DOMAIN
  return { secure, sameSite, domain, crossSite, frontendOrigin: front }
}
