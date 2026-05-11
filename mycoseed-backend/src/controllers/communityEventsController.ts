import { Response } from 'express'
import { supabase } from '../services/supabase'
import { AuthRequest } from '../middleware/auth'
import { getMemberRole } from '../middleware/communityAdmin'
import { ensureDefaultCalendarTags } from '../services/calendarTagsSeed'

async function participationCountForEvent(eventId: string): Promise<number> {
    const { data: occ } = await supabase.from('community_event_occurrences').select('id').eq('event_id', eventId)
    const ids = (occ || []).map((o) => o.id)
    if (!ids.length) return 0
    const { count } = await supabase
        .from('community_event_participations')
        .select('*', { count: 'exact', head: true })
        .in('occurrence_id', ids)
        .eq('status', 'registered')
    return count ?? 0
}

function mapUser(u: any) {
    if (!u) return null
    return { id: u.id, name: u.name, avatar: u.avatar || u.image_url || null }
}

/** ---------- Tags ---------- */
export const listCalendarTags = async (req: AuthRequest, res: Response) => {
    try {
        const communityId = req.params.communityId
        const role = await getMemberRole(communityId, req.user!.id)
        if (!role) return res.status(403).json({ result: 'error', message: '请先加入该社区' })
        await ensureDefaultCalendarTags(communityId)
        const { data, error } = await supabase
            .from('community_calendar_tags')
            .select('id, name, color_hex, sort_order, archived')
            .eq('community_id', communityId)
            .or('archived.is.null,archived.eq.false')
            .order('sort_order', { ascending: true })
        if (error) throw error
        res.json({ tags: (data || []).map((t) => ({ id: t.id, name: t.name, colorHex: t.color_hex, sortOrder: t.sort_order, archived: t.archived || false })) })
    } catch (e: any) {
        console.error(e)
        res.status(500).json({ result: 'error', message: e.message })
    }
}

export const createCalendarTag = async (req: AuthRequest, res: Response) => {
    try {
        const communityId = req.params.communityId
        const { name, colorHex } = req.body || {}
        if (!name?.trim()) return res.status(400).json({ result: 'error', message: 'name 必填' })
        const { data, error } = await supabase
            .from('community_calendar_tags')
            .insert({
                community_id: communityId,
                name: String(name).trim().slice(0, 100),
                color_hex: (colorHex && String(colorHex).trim()) || '#64748b',
            })
            .select('id, name, color_hex, sort_order')
            .single()
        if (error) throw error
        res.status(201).json({ tag: { id: data.id, name: data.name, colorHex: data.color_hex, sortOrder: data.sort_order } })
    } catch (e: any) {
        console.error(e)
        res.status(500).json({ result: 'error', message: e.message })
    }
}

export const updateCalendarTag = async (req: AuthRequest, res: Response) => {
    try {
        const communityId = req.params.communityId
        const tagId = req.params.tagId
        const { name, colorHex } = req.body || {}
        const patch: Record<string, string> = {}
        if (name != null) patch.name = String(name).trim().slice(0, 100)
        if (colorHex != null) patch.color_hex = String(colorHex).trim().slice(0, 20)
        if (!Object.keys(patch).length) return res.status(400).json({ result: 'error', message: '无可更新字段' })
        const { data, error } = await supabase
            .from('community_calendar_tags')
            .update(patch)
            .eq('id', tagId)
            .eq('community_id', communityId)
            .select('id, name, color_hex, sort_order')
            .maybeSingle()
        if (error) throw error
        if (!data) return res.status(404).json({ result: 'error', message: '标签不存在' })
        res.json({ tag: { id: data.id, name: data.name, colorHex: data.color_hex, sortOrder: data.sort_order } })
    } catch (e: any) {
        console.error(e)
        res.status(500).json({ result: 'error', message: e.message })
    }
}

export const deleteCalendarTag = async (req: AuthRequest, res: Response) => {
    try {
        const communityId = req.params.communityId
        const tagId = req.params.tagId
        const { error } = await supabase.from('community_calendar_tags').update({ archived: true }).eq('id', tagId).eq('community_id', communityId)
        if (error) throw error
        res.json({ ok: true })
    } catch (e: any) {
        console.error(e)
        res.status(500).json({ result: 'error', message: e.message })
    }
}

async function loadEventBundle(eventId: string) {
    const { data: ev, error } = await supabase.from('community_events').select('*').eq('id', eventId).maybeSingle()
    if (error) throw error
    if (!ev) return null
    let tag: { id: string; name: string; color_hex: string } | null = null
    if (ev.tag_id) {
        const { data: t } = await supabase
            .from('community_calendar_tags')
            .select('id, name, color_hex')
            .eq('id', ev.tag_id)
            .maybeSingle()
        tag = t
    }
    ;(ev as any).tag = tag
    const { data: options } = await supabase
        .from('community_event_options')
        .select('id, title, price, sort_order')
        .eq('event_id', eventId)
        .order('sort_order', { ascending: true })
    const { data: occurrences } = await supabase
        .from('community_event_occurrences')
        .select('id, sequence_no, activity_start, activity_end')
        .eq('event_id', eventId)
        .order('sequence_no', { ascending: true })
    return { ev, options: options || [], occurrences: occurrences || [] }
}

function maxEndMs(occurrences: { activityEnd: string }[]) {
    let m = 0
    for (const o of occurrences) {
        const t = new Date(o.activityEnd).getTime()
        if (t > m) m = t
    }
    return m
}

function sortEventsForList(rows: any[]) {
    const now = Date.now()
    const decorated = rows.map((r) => {
        const maxEnd = maxEndMs(r.occurrences || [])
        const ended = maxEnd > 0 && maxEnd < now
        return { ...r, _maxEnd: maxEnd, _ended: ended }
    })
    const pinned = decorated.filter((r) => r.isPinned).sort((a, b) => {
        const ta = a.pinnedAt ? new Date(a.pinnedAt).getTime() : 0
        const tb = b.pinnedAt ? new Date(b.pinnedAt).getTime() : 0
        return tb - ta
    })
    const unpinned = decorated.filter((r) => !r.isPinned)
    const active = unpinned.filter((r) => !r._ended).sort((a, b) => {
        const sa = new Date(a.occurrences?.[0]?.activityStart || 0).getTime()
        const sb = new Date(b.occurrences?.[0]?.activityStart || 0).getTime()
        return sa - sb
    })
    const endedList = unpinned.filter((r) => r._ended).sort((a, b) => {
        const sa = new Date(a.occurrences?.[0]?.activityStart || 0).getTime()
        const sb = new Date(b.occurrences?.[0]?.activityStart || 0).getTime()
        return sb - sa
    })
    return [...pinned, ...active, ...endedList].map(({ _maxEnd, _ended, ...rest }) => rest)
}

export const listEvents = async (req: AuthRequest, res: Response) => {
    try {
        const communityId = req.params.communityId
        const tagId = (req.query.tagId as string) || ''
        const mine = req.query.mine === '1'
        const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 50)
        const offset = parseInt(req.query.offset as string, 10) || 0

        const role = await getMemberRole(communityId, req.user!.id)
        if (!role) return res.status(403).json({ result: 'error', message: '请先加入该社区' })
        await ensureDefaultCalendarTags(communityId)

        let ids: string[] = []

        if (mine) {
            const { data: myOcc } = await supabase
                .from('community_event_participations')
                .select('occurrence_id')
                .eq('user_id', req.user!.id)
                .eq('status', 'registered')
            const occIds = (myOcc || []).map((p) => p.occurrence_id)
            if (!occIds.length) ids = []
            else {
                const { data: evFromOcc } = await supabase
                    .from('community_event_occurrences')
                    .select('event_id')
                    .in('id', occIds)
                ids = [...new Set((evFromOcc || []).map((r) => r.event_id))]
            }
            if (tagId && ids.length) {
                const { data: tagged } = await supabase
                    .from('community_events')
                    .select('id')
                    .in('id', ids)
                    .eq('tag_id', tagId)
                ids = (tagged || []).map((r) => r.id)
            }
        } else {
            let qb = supabase.from('community_events').select('id').eq('community_id', communityId)
            if (tagId) qb = qb.eq('tag_id', tagId)
            const { data: idRows, error } = await qb
            if (error) throw error
            ids = (idRows || []).map((r) => r.id)
        }

        const bundles: any[] = []
        for (const id of ids) {
            const b = await loadEventBundle(id)
            if (b) bundles.push(await formatEventListItem(b))
        }
        const sorted = sortEventsForList(bundles)
        const slice = sorted.slice(offset, offset + limit)
        res.json({ events: slice, total: sorted.length })
    } catch (e: any) {
        console.error(e)
        res.status(500).json({ result: 'error', message: e.message })
    }
}

/** 日历视图：返回在 [from,to] 时间内至少有一场与区间有交集的活动（整段排序与列表一致） */
export const listEventsCalendar = async (req: AuthRequest, res: Response) => {
    try {
        const communityId = req.params.communityId
        const from = req.query.from as string
        const to = req.query.to as string
        const tagId = (req.query.tagId as string) || ''
        const mine = req.query.mine === '1'

        if (!from || !to) return res.status(400).json({ result: 'error', message: '需要 from 与 to（ISO 时间）' })
        const fromMs = new Date(from).getTime()
        const toMs = new Date(to).getTime()
        if (Number.isNaN(fromMs) || Number.isNaN(toMs))
            return res.status(400).json({ result: 'error', message: 'from / to 无效' })

        const role = await getMemberRole(communityId, req.user!.id)
        if (!role) return res.status(403).json({ result: 'error', message: '请先加入该社区' })
        await ensureDefaultCalendarTags(communityId)

        const { data: occRows, error: occErr } = await supabase
            .from('community_event_occurrences')
            .select('event_id')
            .gte('activity_end', from)
            .lte('activity_start', to)

        if (occErr) throw occErr
        const cand = [...new Set((occRows || []).map((r: any) => r.event_id as string))]

        if (!cand.length) return res.json({ events: [], total: 0 })

        const { data: inCommunity, error: cErr } = await supabase
            .from('community_events')
            .select('id')
            .eq('community_id', communityId)
            .in('id', cand)

        if (cErr) throw cErr
        let ids = (inCommunity || []).map((r: any) => r.id as string)

        if (mine) {
            const { data: myOcc } = await supabase
                .from('community_event_participations')
                .select('occurrence_id')
                .eq('user_id', req.user!.id)
                .eq('status', 'registered')
            const occIds = (myOcc || []).map((p) => p.occurrence_id)
            if (!occIds.length) ids = []
            else {
                const { data: evFromOcc } = await supabase
                    .from('community_event_occurrences')
                    .select('event_id')
                    .in('id', occIds)
                const mineSet = new Set((evFromOcc || []).map((r: any) => r.event_id))
                ids = ids.filter((id) => mineSet.has(id))
            }
        }

        if (tagId && ids.length) {
            const { data: tagged } = await supabase.from('community_events').select('id').in('id', ids).eq('tag_id', tagId)
            ids = (tagged || []).map((r: any) => r.id)
        }

        const bundles: any[] = []
        for (const id of ids) {
            const b = await loadEventBundle(id)
            if (b) bundles.push(await formatEventListItem(b))
        }
        const sorted = sortEventsForList(bundles)
        res.json({ events: sorted, total: sorted.length })
    } catch (e: any) {
        console.error(e)
        res.status(500).json({ result: 'error', message: e.message })
    }
}

async function formatEventListItem(bundle: NonNullable<Awaited<ReturnType<typeof loadEventBundle>>>) {
    const { ev, options, occurrences } = bundle
    const pCount = await participationCountForEvent(ev.id)
    const tag = ev.tag ? { id: ev.tag.id, name: ev.tag.name, colorHex: ev.tag.color_hex } : null
    return {
        id: ev.id,
        communityId: ev.community_id,
        creatorId: ev.creator_id,
        kind: ev.kind,
        title: ev.title,
        description: ev.description,
        noteEnabled: ev.note_enabled,
        isPinned: ev.is_pinned,
        pinnedAt: ev.pinned_at,
        registrationStart: ev.registration_start,
        registrationEnd: ev.registration_end,
        paymentAddress: String((ev as any).payment_address ?? '').trim(),
        tag,
        packFrequency: ev.pack_frequency,
        packRangeStart: ev.pack_range_start,
        packRangeEnd: ev.pack_range_end,
        options: (options || []).map((o: any) => ({
            id: o.id,
            title: o.title,
            price: Number(o.price),
        })),
        occurrences: (occurrences || []).map((o: any) => ({
            id: o.id,
            sequenceNo: o.sequence_no,
            activityStart: o.activity_start,
            activityEnd: o.activity_end,
        })),
        participantCount: pCount,
    }
}

export const getEvent = async (req: AuthRequest, res: Response) => {
    try {
        const communityId = req.params.communityId
        const eventId = req.params.eventId
        const role = await getMemberRole(communityId, req.user!.id)
        if (!role) return res.status(403).json({ result: 'error', message: '请先加入该社区' })

        const { data: evRow } = await supabase.from('community_events').select('id').eq('id', eventId).eq('community_id', communityId).maybeSingle()
        if (!evRow) return res.status(404).json({ result: 'error', message: '活动不存在' })

        const bundle = await loadEventBundle(eventId)
        if (!bundle) return res.status(404).json({ result: 'error', message: '活动不存在' })
        const listItem = await formatEventListItem(bundle)
        const occIds = bundle.occurrences.map((o) => o.id)
        let parts: any[] = []
        if (occIds.length) {
            const { data: p } = await supabase
                .from('community_event_participations')
                .select('id, occurrence_id, user_id, option_id, remark, status, created_at')
                .in('occurrence_id', occIds)
                .eq('status', 'registered')
            parts = p || []
        }

        const userIds = [...new Set(parts.map((p) => p.user_id))]
        const { data: usersRows } =
            userIds.length > 0
                ? await supabase.from('users').select('id, name, avatar, image_url').in('id', userIds)
                : { data: [] as any[] }
        const userMap = Object.fromEntries((usersRows || []).map((u: any) => [u.id, u]))
        const optMap = Object.fromEntries((bundle.options || []).map((o: any) => [o.id, o]))

        const byUser: Record<string, any> = {}
        for (const p of parts) {
            const uid = p.user_id
            if (!byUser[uid]) {
                byUser[uid] = {
                    user: mapUser(userMap[uid]),
                    cells: {} as Record<string, { optionTitle: string; remark: string; price: number }>,
                }
            }
            const oid = p.occurrence_id
            const op = p.option_id ? optMap[p.option_id] : null
            byUser[uid].cells[oid] = {
                optionTitle: op?.title || '',
                remark: p.remark || '',
                price: Number(op?.price || 0),
            }
        }

        const now = Date.now()
        const regStart = new Date(bundle.ev.registration_start).getTime()
        const regEnd = new Date(bundle.ev.registration_end).getTime()
        let currentOccurrenceId: string | null = null
        const regOk = now >= regStart && now <= regEnd
        const sortedOcc = [...bundle.occurrences].sort((a, b) => a.sequence_no - b.sequence_no)
        if (regOk) {
            const open = sortedOcc.find((o) => {
                const aend = new Date(o.activity_end).getTime()
                return now <= aend
            })
            currentOccurrenceId = open?.id || sortedOcc[sortedOcc.length - 1]?.id || null
        } else if (sortedOcc.length) {
            const future = sortedOcc.find((o) => new Date(o.activity_start).getTime() > now)
            currentOccurrenceId = future?.id || sortedOcc[sortedOcc.length - 1].id
        }

        const participationsList = parts.map((p) => {
            const op = p.option_id ? optMap[p.option_id] : null
            return {
                id: p.id,
                occurrenceId: p.occurrence_id,
                userId: p.user_id,
                user: mapUser(userMap[p.user_id]),
                optionId: p.option_id,
                optionTitle: op?.title || '',
                remark: p.remark || '',
                createdAt: p.created_at,
            }
        })

        res.json({
            event: listItem,
            participations: participationsList,
            matrixUsers: Object.values(byUser),
            currentOccurrenceId,
            registrationOpen: now >= regStart && now <= regEnd,
        })
    } catch (e: any) {
        console.error(e)
        res.status(500).json({ result: 'error', message: e.message })
    }
}

export const createEvent = async (req: AuthRequest, res: Response) => {
    try {
        const communityId = req.params.communityId
        const userId = req.user!.id
        const body = req.body || {}
        const {
            kind,
            title,
            description,
            tagId,
            noteEnabled,
            registrationStart,
            registrationEnd,
            options,
            occurrences,
            packFrequency,
            packRangeStart,
            packRangeEnd,
            packCustomWeekdays,
            paymentAddress,
        } = body

        if (!title?.trim()) return res.status(400).json({ result: 'error', message: '标题必填' })
        if (!['single', 'composite', 'pack'].includes(kind)) return res.status(400).json({ result: 'error', message: '类型无效' })
        if (!registrationStart || !registrationEnd) return res.status(400).json({ result: 'error', message: '报名时间必填' })
        const occList = Array.isArray(occurrences) ? occurrences : []
        if (!occList.length) return res.status(400).json({ result: 'error', message: '缺少活动时间' })
        const optList = Array.isArray(options) ? options : []
        if (!optList.length) return res.status(400).json({ result: 'error', message: '缺少金额/选项' })

        const payAddr = paymentAddress != null ? String(paymentAddress).trim() : ''
        const maxOptPrice = Math.max(0, ...optList.map((o: any) => Number(o.price) || 0))
        if (maxOptPrice > 0) {
            if (!payAddr) return res.status(400).json({ result: 'error', message: '有付费选项时请填写收款地址' })
            if (payAddr.length > 256) return res.status(400).json({ result: 'error', message: '收款地址过长' })
        } else if (payAddr.length > 256) {
            return res.status(400).json({ result: 'error', message: '收款地址过长' })
        }

        const role = await getMemberRole(communityId, userId)
        if (role !== 'super_admin' && role !== 'sub_admin')
            return res.status(403).json({ result: 'error', message: '需要管理员权限' })

        const { data: inserted, error: e1 } = await supabase
            .from('community_events')
            .insert({
                community_id: communityId,
                creator_id: userId,
                kind,
                title: String(title).trim().slice(0, 300),
                description: description != null ? String(description) : '',
                tag_id: tagId || null,
                note_enabled: !!noteEnabled,
                registration_start: registrationStart,
                registration_end: registrationEnd,
                payment_address: payAddr || '',
                pack_frequency: kind === 'pack' ? packFrequency || null : null,
                pack_range_start: kind === 'pack' ? packRangeStart || null : null,
                pack_range_end: kind === 'pack' ? packRangeEnd || null : null,
                pack_custom_weekdays: kind === 'pack' && Array.isArray(packCustomWeekdays) ? packCustomWeekdays : null,
            })
            .select('id')
            .single()
        if (e1) throw e1
        const eventId = inserted.id

        const optRows = optList.map((o: any, i: number) => ({
            event_id: eventId,
            title: String(o.title || (optList.length === 1 ? '默认' : `选项${i + 1}`)).slice(0, 200),
            price: Math.max(0, Number(o.price) || 0),
            sort_order: i,
        }))
        const { error: e2 } = await supabase.from('community_event_options').insert(optRows)
        if (e2) throw e2

        const occRows = occList.map((o: any, i: number) => ({
            event_id: eventId,
            sequence_no: i + 1,
            activity_start: o.activityStart,
            activity_end: o.activityEnd,
        }))
        const { error: e3 } = await supabase.from('community_event_occurrences').insert(occRows)
        if (e3) throw e3

        const bundle = await loadEventBundle(eventId)
        res.status(201).json({ event: bundle ? await formatEventListItem(bundle) : null })
    } catch (e: any) {
        console.error(e)
        res.status(500).json({ result: 'error', message: e.message })
    }
}

/** 删除前生成与发布页一致的草稿（前端 sessionStorage 回填），时间字段用 ISO，便于浏览器端转为 datetime-local */
function buildEventDeleteDraft(bundle: NonNullable<Awaited<ReturnType<typeof loadEventBundle>>>) {
    const ev = bundle.ev
    const options = bundle.options || []
    const occurrences = [...(bundle.occurrences || [])].sort(
        (a, b) => (a.sequence_no || 0) - (b.sequence_no || 0)
    )
    const first = occurrences[0]
    const communityId = ev.community_id as string

    const base = {
        communityId,
        kind: ev.kind as 'single' | 'composite' | 'pack',
        title: String(ev.title || ''),
        description: String(ev.description || ''),
        tagId: ev.tag_id ? String(ev.tag_id) : '',
        noteEnabled: !!ev.note_enabled,
        registrationStart: ev.registration_start as string,
        registrationEnd: ev.registration_end as string,
        paymentAddress: String((ev as any).payment_address ?? '').trim(),
    }

    if (ev.kind === 'single' && first) {
        const price = options[0] != null ? Number((options[0] as any).price ?? 0) : 0
        return {
            ...base,
            actStart: first.activity_start as string,
            actEnd: first.activity_end as string,
            singlePrice: price,
        }
    }

    if (ev.kind === 'composite' && first) {
        return {
            ...base,
            actStart: first.activity_start as string,
            actEnd: first.activity_end as string,
            subOptions: options.map((o: any) => ({
                title: String(o.title || ''),
                price: Math.max(0, Number(o.price) || 0),
            })),
        }
    }

    if (ev.kind === 'pack' && first) {
        const freq = (ev.pack_frequency as string) || 'daily'
        const packFrequency = freq === 'weekly' || freq === 'daily' || freq === 'custom' ? freq : 'daily'
        const rawDays = Array.isArray(ev.pack_custom_weekdays) ? ev.pack_custom_weekdays : []
        const packCustomWeekdays = rawDays.map((d: any) => Number(d)).filter((d: number) => !Number.isNaN(d) && d >= 0 && d <= 6)

        const rs = ev.pack_range_start
        const re = ev.pack_range_end
        const packRangeStart =
            typeof rs === 'string'
                ? rs.slice(0, 10)
                : rs
                  ? new Date(rs as string).toISOString().slice(0, 10)
                  : ''
        const packRangeEnd =
            typeof re === 'string'
                ? re.slice(0, 10)
                : re
                  ? new Date(re as string).toISOString().slice(0, 10)
                  : ''

        return {
            ...base,
            packFrequency,
            packRangeStart,
            packRangeEnd,
            packCustomWeekdays,
            packOptions: options.map((o: any) => ({
                title: String(o.title || ''),
                price: Math.max(0, Number(o.price) || 0),
            })),
            firstOccurrence: {
                activityStart: first.activity_start as string,
                activityEnd: first.activity_end as string,
            },
        }
    }

    return base
}

export const deleteEvent = async (req: AuthRequest, res: Response) => {
    try {
        const communityId = req.params.communityId
        const eventId = req.params.eventId
        const userId = req.user!.id
        const role = await getMemberRole(communityId, userId)
        if (role !== 'super_admin' && role !== 'sub_admin')
            return res.status(403).json({ result: 'error', message: '需要管理员权限' })

        const n = await participationCountForEvent(eventId)
        if (n > 0) return res.status(400).json({ result: 'error', message: '已有报名，无法删除' })

        const bundle = await loadEventBundle(eventId)
        if (!bundle || bundle.ev.community_id !== communityId) {
            return res.status(404).json({ result: 'error', message: '活动不存在' })
        }

        const draft = buildEventDeleteDraft(bundle)

        const { error } = await supabase.from('community_events').delete().eq('id', eventId).eq('community_id', communityId)
        if (error) throw error
        res.json({ ok: true, draft })
    } catch (e: any) {
        console.error(e)
        res.status(500).json({ result: 'error', message: e.message })
    }
}

export const pinEvent = async (req: AuthRequest, res: Response) => {
    try {
        const communityId = req.params.communityId
        const eventId = req.params.eventId
        const { isPinned } = req.body || {}
        const role = await getMemberRole(communityId, req.user!.id)
        if (role !== 'super_admin' && role !== 'sub_admin')
            return res.status(403).json({ result: 'error', message: '需要管理员权限' })

        const { error } = await supabase
            .from('community_events')
            .update({ is_pinned: !!isPinned, pinned_at: !!isPinned ? new Date().toISOString() : null })
            .eq('id', eventId)
            .eq('community_id', communityId)
        if (error) throw error
        res.json({ ok: true })
    } catch (e: any) {
        console.error(e)
        res.status(500).json({ result: 'error', message: e.message })
    }
}

export const registerEvent = async (req: AuthRequest, res: Response) => {
    try {
        const communityId = req.params.communityId
        const eventId = req.params.eventId
        const userId = req.user!.id
        const { occurrenceId, optionId, remark } = req.body || {}

        const role = await getMemberRole(communityId, userId)
        if (!role) return res.status(403).json({ result: 'error', message: '请先加入该社区' })

        const bundle = await loadEventBundle(eventId)
        if (!bundle || bundle.ev.community_id !== communityId) return res.status(404).json({ result: 'error', message: '活动不存在' })

        const occ = bundle.occurrences.find((o) => o.id === occurrenceId)
        if (!occ) return res.status(400).json({ result: 'error', message: '期次无效' })

        const now = Date.now()
        const rs = new Date(bundle.ev.registration_start).getTime()
        const re = new Date(bundle.ev.registration_end).getTime()
        if (now < rs || now > re) return res.status(400).json({ result: 'error', message: '不在报名时间内' })

        let opt: any = bundle.options[0]
        if (bundle.ev.kind === 'composite' || bundle.ev.kind === 'pack') {
            if (!optionId) return res.status(400).json({ result: 'error', message: '请选择子选项' })
            opt = bundle.options.find((o: any) => o.id === optionId)
            if (!opt) return res.status(400).json({ result: 'error', message: '选项无效' })
        }

        const useOptId = opt?.id || bundle.options[0]?.id

        if (bundle.ev.note_enabled && (!remark || !String(remark).trim()))
            return res.status(400).json({ result: 'error', message: '请填写备注' })

        const { data: existing } = await supabase
            .from('community_event_participations')
            .select('id')
            .eq('occurrence_id', occurrenceId)
            .eq('user_id', userId)
            .eq('status', 'registered')
            .maybeSingle()
        if (existing) return res.status(400).json({ result: 'error', message: '该期次已报名' })

        const { error } = await supabase.from('community_event_participations').insert({
            occurrence_id: occurrenceId,
            user_id: userId,
            option_id: useOptId || null,
            remark: remark != null ? String(remark).slice(0, 500) : '',
            status: 'registered',
        })
        if (error) throw error

        const price = Number(opt?.price ?? 0)
        const paymentAddr = String((bundle.ev as any).payment_address ?? '').trim()

        res.status(201).json({
            ok: true,
            price,
            paymentAddress: paymentAddr,
            optionTitle: opt?.title || '',
        })
    } catch (e: any) {
        console.error(e)
        res.status(500).json({ result: 'error', message: e.message })
    }
}

export const cancelRegistration = async (req: AuthRequest, res: Response) => {
    try {
        const communityId = req.params.communityId
        const eventId = req.params.eventId
        const userId = req.user!.id
        const occurrenceId = req.params.occurrenceId

        const role = await getMemberRole(communityId, userId)
        if (!role) return res.status(403).json({ result: 'error', message: '请先加入该社区' })

        const bundle = await loadEventBundle(eventId)
        if (!bundle || bundle.ev.community_id !== communityId) return res.status(404).json({ result: 'error', message: '活动不存在' })
        if (!bundle.occurrences.some((o) => o.id === occurrenceId))
            return res.status(400).json({ result: 'error', message: '期次无效' })

        const now = Date.now()
        const re = new Date(bundle.ev.registration_end).getTime()
        if (now > re) return res.status(400).json({ result: 'error', message: '报名已截止，无法取消' })

        const { error } = await supabase
            .from('community_event_participations')
            .delete()
            .eq('occurrence_id', occurrenceId)
            .eq('user_id', userId)
        if (error) throw error
        res.json({ ok: true })
    } catch (e: any) {
        console.error(e)
        res.status(500).json({ result: 'error', message: e.message })
    }
}
