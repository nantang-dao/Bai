export default defineNuxtRouteMiddleware(async (to, _from) => {
    const publicPages = ['/auth/login']

    if (publicPages.some(path => to.path.startsWith(path))) {
        return
    }

    if (typeof window === 'undefined') return
    const config = useRuntimeConfig()
    const baseUrl = config.public.apiUrl as string
    const meUrl = baseUrl ? `${baseUrl}/api/auth/me` : '/api/auth/me'
    try {
        const res = await fetch(meUrl, { credentials: 'include' })
        if (!res.ok) return navigateTo('/auth/login')
    } catch {
        return navigateTo('/auth/login')
    }
})

