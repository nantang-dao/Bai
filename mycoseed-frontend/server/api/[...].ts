import { defineEventHandler, getRequestHeaders, readRawBody, sendStream, getHeader, setResponseStatus, sendRedirect } from 'h3'

const BACKEND_URL = process.env.NUXT_PUBLIC_API_URL || 'http://localhost:3001'
const FRONTEND_URL = process.env.NUXT_PUBLIC_APP_URL || ''

export default defineEventHandler(async (event) => {
    const path = event.path
    const targetUrl = `${BACKEND_URL}${path}`

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
                const backendOrigin = new URL(BACKEND_URL).origin
                const frontendOrigin = FRONTEND_URL ? new URL(FRONTEND_URL).origin : ''

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
