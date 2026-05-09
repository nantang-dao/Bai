export default defineNuxtRouteMiddleware(async (to, _from) => {
    // 允许访问的公开页面（不需要登录）
    // 注意：旧的 /verify 和 /verifyphone 路径已废弃，现在使用 OAuth2
    const publicPages = ['/auth/login']

    // 如果访问的是公开页面，直接放行
    if (publicPages.some(path => to.path.startsWith(path))) {
        return
    }

    // HttpOnly session cookie 无法在前端读取：用 /api/auth/me 探测是否已登录
    if (typeof window === 'undefined') return
    const config = useRuntimeConfig()
    const baseUrl = config.public.apiUrl
    try {
        const res = await fetch(`${baseUrl}/api/auth/me`, { credentials: 'include' })
        if (!res.ok) return navigateTo('/auth/login')
    } catch {
        return navigateTo('/auth/login')
    }
})

