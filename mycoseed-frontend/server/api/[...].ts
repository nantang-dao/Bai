import { defineEventHandler, getRequestHeaders, readRawBody, sendStream, getHeader, setResponseStatus, sendRedirect } from 'h3'

export default defineEventHandler(async (event) => {
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
        ? await readRawBody(event)
        : undefined

    const res = await fetch(targetUrl, {
        method: event.method,
        headers,
        body,
        redirect: 'manual',
    })

    if (res.status >= 300 && res.status < 400) {
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
        if (lower === 'transfer-encoding' || lower === 'location') return
        resHeaders[key] = value
    })

    setResponseHeaders(event, resHeaders)
    setResponseStatus(event, res.status)

    if (res.body) {
        return sendStream(event, res.body as any)
    }
    return res.text()
})
