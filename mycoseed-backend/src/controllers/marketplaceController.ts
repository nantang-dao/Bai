import { randomUUID } from 'crypto'
import { Response } from 'express'
import { supabase } from '../services/supabase'
import { AuthRequest } from '../middleware/auth'
import { ensureDefaultMarketplaceTags } from '../services/marketplaceSeed'
import { getMemberRole } from '../middleware/communityAdmin'

function isUuid(s: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)
}

const listSelect = `
  id, community_id, seller_id, title, description, price, status, buyer_id, locked_at, sold_at, created_at,
  seller:users!community_marketplace_listings_seller_id_fkey ( id, name, avatar, image_url, semi_id, handle )
`

function mapSeller(u: any) {
    if (!u) return null
    return {
        id: u.id,
        name: u.name,
        avatar: u.avatar || u.image_url || null,
        semiId: u.semi_id || null,
        handle: u.handle || null,
    }
}

function mapTagsFromJoin(rows: { community_marketplace_tags: { id: string; name: string; color_hex: string } | null }[]) {
    if (!rows?.length) return []
    return rows
        .map((r) => {
            const t = r.community_marketplace_tags
            if (!t) return null
            return { id: t.id, name: t.name, colorHex: t.color_hex }
        })
        .filter(Boolean) as { id: string; name: string; colorHex: string }[]
}

async function loadImages(listingId: string) {
    const { data } = await supabase
        .from('community_marketplace_listing_images')
        .select('sort_order, image_url')
        .eq('listing_id', listingId)
        .order('sort_order', { ascending: true })
    return (data || []).map((r) => r.image_url)
}

async function loadTagLinks(listingId: string) {
    const { data } = await supabase
        .from('community_marketplace_listing_tags')
        .select('tag_id, community_marketplace_tags ( id, name, color_hex )')
        .eq('listing_id', listingId)
    return mapTagsFromJoin((data as any) || [])
}

function toListing(
    row: any,
    imageUrls: string[],
    tags: { id: string; name: string; colorHex: string }[]
) {
    return {
        id: row.id,
        communityId: row.community_id,
        sellerId: row.seller_id,
        title: row.title,
        description: row.description,
        price: Number(row.price),
        status: row.status,
        buyerId: row.buyer_id,
        lockedAt: row.locked_at,
        soldAt: row.sold_at,
        createdAt: row.created_at,
        imageUrls,
        tags,
        seller: mapSeller(row.seller),
    }
}

/** GET .../tags */
export const listTags = async (req: AuthRequest, res: Response) => {
    try {
        const communityId = req.params.communityId
        if (!communityId) return res.status(400).json({ result: 'error', message: '缺少 communityId' })
        const role = await getMemberRole(communityId, req.user!.id)
        if (!role) return res.status(403).json({ result: 'error', message: '请先加入该社区' })
        await ensureDefaultMarketplaceTags(communityId)
        const { data, error } = await supabase
            .from('community_marketplace_tags')
            .select('id, name, color_hex, sort_order, created_at, archived')
            .eq('community_id', communityId)
            .or('archived.is.null,archived.eq.false')
            .order('sort_order', { ascending: true })
        if (error) throw error
        res.json({
            tags: (data || []).map((t) => ({
                id: t.id,
                name: t.name,
                colorHex: t.color_hex,
                sortOrder: t.sort_order,
                createdAt: t.created_at,
                archived: t.archived || false,
            })),
        })
    } catch (e: any) {
        console.error(e)
        res.status(500).json({ result: 'error', message: e.message || 'Internal error' })
    }
}

/** POST .../tags */
export const createTag = async (req: AuthRequest, res: Response) => {
    try {
        const communityId = req.params.communityId
        const { name, colorHex } = req.body || {}
        if (!name || !String(name).trim()) return res.status(400).json({ result: 'error', message: 'name 必填' })
        const color = colorHex && String(colorHex).trim() ? String(colorHex).trim() : '#64748b'
        const { data, error } = await supabase
            .from('community_marketplace_tags')
            .insert({
                community_id: communityId,
                name: String(name).trim().slice(0, 100),
                color_hex: color.slice(0, 20),
            })
            .select('id, name, color_hex, sort_order, created_at')
            .single()
        if (error) throw error
        res.status(201).json({
            tag: {
                id: data.id,
                name: data.name,
                colorHex: data.color_hex,
                sortOrder: data.sort_order,
                createdAt: data.created_at,
            },
        })
    } catch (e: any) {
        console.error(e)
        res.status(500).json({ result: 'error', message: e.message || 'Internal error' })
    }
}

/** PATCH .../tags/:tagId */
export const updateTag = async (req: AuthRequest, res: Response) => {
    try {
        const communityId = req.params.communityId
        const tagId = req.params.tagId
        const { name, colorHex } = req.body || {}
        const patch: Record<string, string> = {}
        if (name != null) patch.name = String(name).trim().slice(0, 100)
        if (colorHex != null) patch.color_hex = String(colorHex).trim().slice(0, 20)
        if (!Object.keys(patch).length) return res.status(400).json({ result: 'error', message: '无可更新字段' })
        const { data, error } = await supabase
            .from('community_marketplace_tags')
            .update(patch)
            .eq('id', tagId)
            .eq('community_id', communityId)
            .select('id, name, color_hex, sort_order, created_at')
            .maybeSingle()
        if (error) throw error
        if (!data) return res.status(404).json({ result: 'error', message: '标签不存在' })
        res.json({
            tag: {
                id: data.id,
                name: data.name,
                colorHex: data.color_hex,
                sortOrder: data.sort_order,
                createdAt: data.created_at,
            },
        })
    } catch (e: any) {
        console.error(e)
        res.status(500).json({ result: 'error', message: e.message || 'Internal error' })
    }
}

/** DELETE .../tags/:tagId — archive instead of hard delete */
export const deleteTag = async (req: AuthRequest, res: Response) => {
    try {
        const communityId = req.params.communityId
        const tagId = req.params.tagId
        const { error } = await supabase
            .from('community_marketplace_tags')
            .update({ archived: true })
            .eq('id', tagId)
            .eq('community_id', communityId)
        if (error) throw error
        res.json({ ok: true })
    } catch (e: any) {
        console.error(e)
        res.status(500).json({ result: 'error', message: e.message || 'Internal error' })
    }
}

/** GET .../listings */
export const listListings = async (req: AuthRequest, res: Response) => {
    try {
        const communityId = req.params.communityId
        const q = (req.query.q as string)?.trim() || ''
        const tagId = (req.query.tagId as string)?.trim() || ''
        const limit = Math.min(parseInt(req.query.limit as string, 10) || 24, 60)
        const offset = parseInt(req.query.offset as string, 10) || 0

        const role = await getMemberRole(communityId, req.user!.id)
        if (!role) return res.status(403).json({ result: 'error', message: '请先加入该社区' })
        await ensureDefaultMarketplaceTags(communityId)

        let idFilter: string[] | null = null
        if (tagId) {
            const { data: tagLinks } = await supabase
                .from('community_marketplace_listing_tags')
                .select('listing_id')
                .eq('tag_id', tagId)
            idFilter = (tagLinks || []).map((r) => r.listing_id)
            if (idFilter.length === 0) {
                return res.json({ listings: [], total: 0 })
            }
        }

        let qb = supabase
            .from('community_marketplace_listings')
            .select(listSelect, { count: 'exact' })
            .eq('community_id', communityId)
            .neq('status', 'withdrawn')

        if (idFilter) qb = qb.in('id', idFilter)

        if (q) {
            const esc = `%${q.replace(/%/g, '\\%').replace(/,/g, '\\,')}%`
            const { data: sellers } = await supabase
                .from('users')
                .select('id')
                .or(`name.ilike.${esc},handle.ilike.${esc},semi_id.ilike.${esc}`)
            const sellerIds = ((sellers || []).map((s) => s.id) as string[]).slice(0, 40)
            const orParts = [`title.ilike.${esc}`, `description.ilike.${esc}`]
            for (const sid of sellerIds) orParts.push(`seller_id.eq.${sid}`)
            const { data: tagHits } = await supabase
                .from('community_marketplace_tags')
                .select('id')
                .eq('community_id', communityId)
                .ilike('name', esc)
            const tagIds = (tagHits || []).map((t) => t.id)
            let tagListingIds: string[] = []
            if (tagIds.length) {
                const { data: links } = await supabase
                    .from('community_marketplace_listing_tags')
                    .select('listing_id')
                    .in('tag_id', tagIds)
                tagListingIds = [...new Set((links || []).map((l) => l.listing_id))].slice(0, 200)
            }
            if (tagListingIds.length) orParts.push(`id.in.(${tagListingIds.join(',')})`)
            qb = qb.or(orParts.join(','))
        }

        qb = qb
            .order('status', { ascending: true })
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1)

        const { data: rows, error, count } = await qb
        if (error) throw error

        const listings = []
        for (const row of rows || []) {
            const imgs = await loadImages(row.id)
            const tags = await loadTagLinks(row.id)
            listings.push(toListing(row, imgs, tags))
        }

        res.json({ listings, total: count ?? listings.length })
    } catch (e: any) {
        console.error(e)
        res.status(500).json({ result: 'error', message: e.message || 'Internal error' })
    }
}

/** GET .../listings/:listingId */
export const getListing = async (req: AuthRequest, res: Response) => {
    try {
        const communityId = req.params.communityId
        const listingId = req.params.listingId
        const userId = req.user!.id

        const role = await getMemberRole(communityId, userId)
        if (!role) return res.status(403).json({ result: 'error', message: '请先加入该社区' })

        const { data: row, error } = await supabase
            .from('community_marketplace_listings')
            .select(listSelect)
            .eq('id', listingId)
            .eq('community_id', communityId)
            .maybeSingle()
        if (error) throw error
        if (!row) return res.status(404).json({ result: 'error', message: '商品不存在' })
        if (row.status === 'withdrawn' && row.seller_id !== userId) {
            return res.status(404).json({ result: 'error', message: '商品不存在' })
        }

        const imgs = await loadImages(listingId)
        const tags = await loadTagLinks(listingId)
        let buyer = null as ReturnType<typeof mapSeller>
        if (row.buyer_id) {
            const { data: bu } = await supabase
                .from('users')
                .select('id, name, avatar, image_url, semi_id, handle')
                .eq('id', row.buyer_id)
                .maybeSingle()
            buyer = mapSeller(bu)
        }
        let review = null as any
        const { data: rev } = await supabase
            .from('community_marketplace_reviews')
            .select('id, rating, content, created_at, buyer_id')
            .eq('listing_id', listingId)
            .maybeSingle()
        if (rev) {
            const { data: buyer } = await supabase
                .from('users')
                .select('id, name, avatar, image_url')
                .eq('id', rev.buyer_id)
                .maybeSingle()
            review = {
                id: rev.id,
                rating: rev.rating,
                content: rev.content,
                createdAt: rev.created_at,
                buyer: buyer
                    ? { id: buyer.id, name: buyer.name, avatar: buyer.avatar || buyer.image_url }
                    : null,
            }
        }

        const listingPayload = { ...toListing(row, imgs, tags), buyer }
        res.json({
            listing: listingPayload,
            review,
        })
    } catch (e: any) {
        console.error(e)
        res.status(500).json({ result: 'error', message: e.message || 'Internal error' })
    }
}

/** POST .../listings */
export const createListing = async (req: AuthRequest, res: Response) => {
    try {
        const communityId = req.params.communityId
        const userId = req.user!.id
        const { title, description, price, imageUrls, tagIds, id: clientId } = req.body || {}
        const listingId = clientId && isUuid(String(clientId)) ? String(clientId) : randomUUID()
        if (!title || !String(title).trim()) return res.status(400).json({ result: 'error', message: '标题必填' })
        const urls: string[] = Array.isArray(imageUrls) ? imageUrls.filter((u: any) => typeof u === 'string') : []
        if (urls.length > 3) return res.status(400).json({ result: 'error', message: '最多上传 3 张图' })
        const p = Number(price)
        if (Number.isNaN(p) || p < 0) return res.status(400).json({ result: 'error', message: '价格无效' })

        const role = await getMemberRole(communityId, userId)
        if (!role) return res.status(403).json({ result: 'error', message: '请先加入该社区' })

        const tagList: string[] = Array.isArray(tagIds) ? tagIds.filter((x: any) => typeof x === 'string') : []
        if (tagList.length) {
            const { data: validTags } = await supabase
                .from('community_marketplace_tags')
                .select('id')
                .eq('community_id', communityId)
                .in('id', tagList)
            if (!validTags || validTags.length !== tagList.length)
                return res.status(400).json({ result: 'error', message: '标签无效' })
        }

        const { data: inserted, error: insErr } = await supabase
            .from('community_marketplace_listings')
            .insert({
                id: listingId,
                community_id: communityId,
                seller_id: userId,
                title: String(title).trim().slice(0, 200),
                description: description != null ? String(description) : '',
                price: p,
                status: 'active',
            })
            .select('id')
            .single()
        if (insErr) throw insErr

        const lid = inserted.id
        const imgRows = urls.slice(0, 3).map((url, i) => ({
            listing_id: lid,
            sort_order: i,
            image_url: url,
        }))
        await supabase.from('community_marketplace_listing_images').insert(imgRows)

        if (tagList.length) {
            await supabase
                .from('community_marketplace_listing_tags')
                .insert(tagList.map((tid) => ({ listing_id: lid, tag_id: tid })))
        }

        const { data: row } = await supabase
            .from('community_marketplace_listings')
            .select(listSelect)
            .eq('id', lid)
            .single()

        const imgs = await loadImages(lid)
        const tags = await loadTagLinks(lid)
        res.status(201).json({ listing: toListing(row, imgs, tags) })
    } catch (e: any) {
        console.error(e)
        res.status(500).json({ result: 'error', message: e.message || 'Internal error' })
    }
}

/** PATCH .../listings/:listingId */
export const updateListing = async (req: AuthRequest, res: Response) => {
    try {
        const communityId = req.params.communityId
        const listingId = req.params.listingId
        const userId = req.user!.id
        const { title, description, price, imageUrls, tagIds } = req.body || {}

        const { data: cur, error: cErr } = await supabase
            .from('community_marketplace_listings')
            .select('seller_id, status')
            .eq('id', listingId)
            .eq('community_id', communityId)
            .maybeSingle()
        if (cErr) throw cErr
        if (!cur) return res.status(404).json({ result: 'error', message: '商品不存在' })
        if (cur.seller_id !== userId) return res.status(403).json({ result: 'error', message: '无权修改' })
        if (cur.status !== 'active') return res.status(400).json({ result: 'error', message: '仅上架中可编辑' })

        const patch: Record<string, any> = {}
        if (title != null) patch.title = String(title).trim().slice(0, 200)
        if (description != null) patch.description = String(description)
        if (price != null) {
            const p = Number(price)
            if (Number.isNaN(p) || p < 0) return res.status(400).json({ result: 'error', message: '价格无效' })
            patch.price = p
        }
        if (Object.keys(patch).length) {
            const { error } = await supabase.from('community_marketplace_listings').update(patch).eq('id', listingId)
            if (error) throw error
        }

        if (Array.isArray(imageUrls)) {
            const urls = imageUrls.filter((u: any) => typeof u === 'string').slice(0, 3)
            if (urls.length < 1 || urls.length > 3) return res.status(400).json({ result: 'error', message: '需 1–3 张图' })
            await supabase.from('community_marketplace_listing_images').delete().eq('listing_id', listingId)
            await supabase
                .from('community_marketplace_listing_images')
                .insert(urls.map((url: string, i: number) => ({ listing_id: listingId, sort_order: i, image_url: url })))
        }

        if (Array.isArray(tagIds)) {
            const tagList = tagIds.filter((x: any) => typeof x === 'string')
            const { data: validTags } = await supabase
                .from('community_marketplace_tags')
                .select('id')
                .eq('community_id', communityId)
                .in('id', tagList)
            if (!validTags || validTags.length !== tagList.length)
                return res.status(400).json({ result: 'error', message: '标签无效' })
            await supabase.from('community_marketplace_listing_tags').delete().eq('listing_id', listingId)
            if (tagList.length) {
                await supabase
                    .from('community_marketplace_listing_tags')
                    .insert(tagList.map((tid: string) => ({ listing_id: listingId, tag_id: tid })))
            }
        }

        const { data: row } = await supabase.from('community_marketplace_listings').select(listSelect).eq('id', listingId).single()
        const imgs = await loadImages(listingId)
        const tags = await loadTagLinks(listingId)
        res.json({ listing: toListing(row, imgs, tags) })
    } catch (e: any) {
        console.error(e)
        res.status(500).json({ result: 'error', message: e.message || 'Internal error' })
    }
}

/** POST .../listings/:listingId/withdraw */
export const withdrawListing = async (req: AuthRequest, res: Response) => {
    try {
        const communityId = req.params.communityId
        const listingId = req.params.listingId
        const userId = req.user!.id

        const { data: cur } = await supabase
            .from('community_marketplace_listings')
            .select('seller_id, status')
            .eq('id', listingId)
            .eq('community_id', communityId)
            .maybeSingle()
        if (!cur) return res.status(404).json({ result: 'error', message: '商品不存在' })
        if (cur.seller_id !== userId) return res.status(403).json({ result: 'error', message: '无权操作' })
        if (cur.status !== 'active') return res.status(400).json({ result: 'error', message: '仅未锁单可撤回' })

        await supabase.from('community_marketplace_listings').update({ status: 'withdrawn' }).eq('id', listingId)
        res.json({ ok: true })
    } catch (e: any) {
        console.error(e)
        res.status(500).json({ result: 'error', message: e.message || 'Internal error' })
    }
}

/** POST .../listings/:listingId/lock */
export const lockListing = async (req: AuthRequest, res: Response) => {
    try {
        const communityId = req.params.communityId
        const listingId = req.params.listingId
        const buyerId = req.user!.id

        const { data: cur } = await supabase
            .from('community_marketplace_listings')
            .select('seller_id, status, community_id')
            .eq('id', listingId)
            .eq('community_id', communityId)
            .maybeSingle()
        if (!cur) return res.status(404).json({ result: 'error', message: '商品不存在' })
        if (cur.seller_id === buyerId) return res.status(400).json({ result: 'error', message: '不能购买自己的商品' })
        if (cur.status !== 'active') return res.status(400).json({ result: 'error', message: '商品不可预订' })

        const { data: updated, error } = await supabase
            .from('community_marketplace_listings')
            .update({
                status: 'locked',
                buyer_id: buyerId,
                locked_at: new Date().toISOString(),
            })
            .eq('id', listingId)
            .eq('status', 'active')
            .select('id')
            .maybeSingle()
        if (error) throw error
        if (!updated) return res.status(409).json({ result: 'error', message: '商品已被预订' })

        res.json({ ok: true })
    } catch (e: any) {
        console.error(e)
        res.status(500).json({ result: 'error', message: e.message || 'Internal error' })
    }
}

/** POST .../listings/:listingId/confirm-sold */
export const confirmSold = async (req: AuthRequest, res: Response) => {
    try {
        const communityId = req.params.communityId
        const listingId = req.params.listingId
        const userId = req.user!.id

        const { data: cur } = await supabase
            .from('community_marketplace_listings')
            .select('seller_id, status')
            .eq('id', listingId)
            .eq('community_id', communityId)
            .maybeSingle()
        if (!cur) return res.status(404).json({ result: 'error', message: '商品不存在' })
        if (cur.seller_id !== userId) return res.status(403).json({ result: 'error', message: '仅卖家可操作' })
        if (cur.status !== 'locked') return res.status(400).json({ result: 'error', message: '当前状态不可确认收款' })

        await supabase
            .from('community_marketplace_listings')
            .update({ status: 'sold', sold_at: new Date().toISOString() })
            .eq('id', listingId)

        res.json({ ok: true })
    } catch (e: any) {
        console.error(e)
        res.status(500).json({ result: 'error', message: e.message || 'Internal error' })
    }
}

/** POST .../listings/:listingId/cancel-lock */
export const cancelLock = async (req: AuthRequest, res: Response) => {
    try {
        const communityId = req.params.communityId
        const listingId = req.params.listingId
        const userId = req.user!.id

        const { data: cur } = await supabase
            .from('community_marketplace_listings')
            .select('seller_id, status')
            .eq('id', listingId)
            .eq('community_id', communityId)
            .maybeSingle()
        if (!cur) return res.status(404).json({ result: 'error', message: '商品不存在' })
        if (cur.seller_id !== userId) return res.status(403).json({ result: 'error', message: '仅卖家可操作' })
        if (cur.status !== 'locked') return res.status(400).json({ result: 'error', message: '当前无锁单' })

        await supabase
            .from('community_marketplace_listings')
            .update({ status: 'active', buyer_id: null, locked_at: null })
            .eq('id', listingId)

        res.json({ ok: true })
    } catch (e: any) {
        console.error(e)
        res.status(500).json({ result: 'error', message: e.message || 'Internal error' })
    }
}

/** POST .../listings/:listingId/review */
export const submitReview = async (req: AuthRequest, res: Response) => {
    try {
        const communityId = req.params.communityId
        const listingId = req.params.listingId
        const buyerId = req.user!.id
        const { rating, content } = req.body || {}
        const r = Number(rating)
        if (!Number.isInteger(r) || r < 0 || r > 5) return res.status(400).json({ result: 'error', message: '评分 0–5 整数' })

        const { data: cur } = await supabase
            .from('community_marketplace_listings')
            .select('seller_id, status, buyer_id, community_id')
            .eq('id', listingId)
            .eq('community_id', communityId)
            .maybeSingle()
        if (!cur) return res.status(404).json({ result: 'error', message: '商品不存在' })
        if (cur.status !== 'sold') return res.status(400).json({ result: 'error', message: '仅已成交可评价' })
        if (cur.buyer_id !== buyerId) return res.status(403).json({ result: 'error', message: '仅买家可评价' })

        const { error } = await supabase.from('community_marketplace_reviews').insert({
            community_id: communityId,
            listing_id: listingId,
            buyer_id: buyerId,
            seller_id: cur.seller_id,
            rating: r,
            content: content != null ? String(content).slice(0, 2000) : '',
        })
        if (error) {
            if (error.code === '23505') return res.status(400).json({ result: 'error', message: '已评价过' })
            throw error
        }

        res.status(201).json({ ok: true })
    } catch (e: any) {
        console.error(e)
        res.status(500).json({ result: 'error', message: e.message || 'Internal error' })
    }
}

/** GET .../reviews — 本社区全部评价（分页） */
export const listCommunityReviews = async (req: AuthRequest, res: Response) => {
    try {
        const communityId = req.params.communityId
        const limit = Math.min(parseInt(req.query.limit as string, 10) || 30, 100)
        const offset = parseInt(req.query.offset as string, 10) || 0

        const role = await getMemberRole(communityId, req.user!.id)
        if (!role) return res.status(403).json({ result: 'error', message: '请先加入该社区' })

        const { data: rows, error, count } = await supabase
            .from('community_marketplace_reviews')
            .select('id, listing_id, buyer_id, seller_id, rating, content, created_at', { count: 'exact' })
            .eq('community_id', communityId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1)
        if (error) throw error

        const userIds = new Set<string>()
        const listingIds = new Set<string>()
        for (const r of rows || []) {
            userIds.add(r.buyer_id)
            userIds.add(r.seller_id)
            listingIds.add(r.listing_id)
        }
        const [usersRes, listingsRes] = await Promise.all([
            userIds.size
                ? supabase.from('users').select('id, name, avatar, image_url').in('id', [...userIds])
                : Promise.resolve({ data: [] as any[] }),
            listingIds.size
                ? supabase.from('community_marketplace_listings').select('id, title').in('id', [...listingIds])
                : Promise.resolve({ data: [] as any[] }),
        ])
        const userMap = Object.fromEntries((usersRes.data || []).map((u: any) => [u.id, u]))
        const titleMap = Object.fromEntries((listingsRes.data || []).map((l: any) => [l.id, l.title]))

        const reviews = (rows || []).map((row: any) => {
            const bu = userMap[row.buyer_id]
            const su = userMap[row.seller_id]
            return {
                id: row.id,
                listingId: row.listing_id,
                rating: row.rating,
                content: row.content,
                createdAt: row.created_at,
                productTitle: titleMap[row.listing_id] || '',
                buyer: bu
                    ? { id: bu.id, name: bu.name, avatar: bu.avatar || bu.image_url }
                    : null,
                seller: su
                    ? { id: su.id, name: su.name, avatar: su.avatar || su.image_url }
                    : null,
            }
        })

        res.json({ reviews, total: count ?? reviews.length })
    } catch (e: any) {
        console.error(e)
        res.status(500).json({ result: 'error', message: e.message || 'Internal error' })
    }
}
