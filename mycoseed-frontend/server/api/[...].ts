import {
    createError,
    defineEventHandler,
    getRequestHeaders,
    readRawBody,
    sendStream,
    getHeader,
    setResponseStatus,
    sendRedirect,
    appendResponseHeader,
    setResponseHeaders,
    type H3Event,
} from 'h3'

function getUpstreamSetCookies(headers: Headers): string[] {
    if (typeof headers.getSetCookie === 'function') {
        return headers.getSetCookie()
    }
    const combined = headers.get('set-cookie')
    return combined ? [combined] : []
}

function forwardSetCookies(event: H3Event, cookies: string[]) {
    for (const cookie of cookies) {
        appendResponseHeader(event, 'set-cookie', cookie)
    }
}

export default defineEventHandler(async (event) => {
    // Production: /api/* is handled by Cloudflare Worker → Fly.io; disable Nitro proxy.
    if (!import.meta.dev) {
        throw createError({
            statusCode: 404,
            statusMessage: 'Not Found in Production',
        })
    }

    const config = useRuntimeConfig()
    const backendUrl = String(config.backendUrl || 'http://localhost:3001').replace(/\/+$/, '')
    const frontendUrl = String(config.public.appUrl || '').replace(/\/+$/, '')

    const path = event.path
    const targetUrl = `${backendUrl}${path}`

    const headers: Record<string, string> = {}
    const incoming = getRequestHeaders(event)
    for (const [key, value] of Object.entries(incoming)) {
        const lower = key.toLowerCase()
        if (lower === 'host' || lower === 'connection' || lower === 'content-length') continue
        headers[key] = value as string
    }

    const body = event.method !== 'GET' && event.method !== 'HEAD'
        ? await readRawBody(event, false)
        : undefined

    const res = await fetch(targetUrl, {
        method: event.method,
        headers,
        body,
        redirect: 'manual',
    })

    const setCookies = getUpstreamSetCookies(res.headers)

    if (res.status >= 300 && res.status < 400) {
        forwardSetCookies(event, setCookies)
        const location = res.headers.get('location')
        if (location) {
            let rewritten = location
            try {
                const locUrl = new URL(location)
                const reqHost = getHeader(event, 'host') || ''
                const reqProto = (getHeader(event, 'x-forwarded-proto') || 'http')
                const backendOrigin = new URL(backendUrl).origin
                const frontendOrigin = frontendUrl ? new URL(frontendUrl).origin : ''

                if (locUrl.origin === backendOrigin) {
                    locUrl.protocol = reqProto
                    locUrl.host = reqHost
                    rewritten = locUrl.toString()
                } else if (frontendOrigin && locUrl.origin === frontendOrigin) {
                    locUrl.protocol = reqProto
                    locUrl.host = reqHost
                    rewritten = locUrl.toString()
                }
            } catch {}
            return sendRedirect(event, rewritten, res.status)
        }
    }

    const resHeaders: Record<string, string> = {}
    res.headers.forEach((value, key) => {
        const lower = key.toLowerCase()
        if (lower === 'transfer-encoding' || lower === 'location' || lower === 'set-cookie') return
        resHeaders[key] = value
    })

    forwardSetCookies(event, setCookies)
    setResponseHeaders(event, resHeaders)
    setResponseStatus(event, res.status)

    if (res.body) {
        return sendStream(event, res.body as any)
    }
    return res.text()
})
