export default defineNuxtRouteMiddleware(async (to, _from) => {
    const publicPages = ['/auth/login']

    if (publicPages.some(path => to.path.startsWith(path))) {
        return
    }

    if (typeof window === 'undefined') return
    const config = useRuntimeConfig()
    const { resolvePublicApiBase, apiUrl } = await import('~/utils/publicApiBase')
    const meUrl = apiUrl('/api/auth/me', resolvePublicApiBase(config.public.apiUrl as string))
    try {
        const res = await fetch(meUrl, { credentials: 'include' })
        if (!res.ok) return navigateTo('/auth/login')
    } catch {
        return navigateTo('/auth/login')
    }
})

