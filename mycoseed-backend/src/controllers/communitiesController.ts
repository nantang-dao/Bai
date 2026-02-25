import { Response } from 'express'
import { supabase } from '../services/supabase'
import { AuthRequest } from '../middleware/auth'
import { getMemberRole } from '../middleware/communityAdmin'

function toCommunity(row: any) {
    if (!row) return null
    return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        description: row.description || '',
        markdownIntro: row.markdown_intro || '',
        isPublic: row.is_public,
        pointName: row.point_name || '积分',
        superAdminId: row.super_admin_id,
        avatarUrl: row.avatar_url || null,
        memberCount: row.member_count ?? 0,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    }
}

/** GET /api/communities — 公开列表或我加入的(mine=1)，支持 q 搜索 */
export const list = async (req: AuthRequest, res: Response) => {
    try {
        const mine = req.query.mine === '1' || req.query.mine === 'true'
        const q = (req.query.q as string)?.trim() || ''

        if (mine) {
            if (!req.user?.id) return res.status(401).json({ result: 'error', message: 'Unauthorized' })
            const { data: members, error: meError } = await supabase
                .from('community_members')
                .select('community_id')
                .eq('user_id', req.user.id)
            if (meError) throw meError
            const ids = (members || []).map((m: any) => m.community_id)
            if (ids.length === 0) return res.json([])
            let query = supabase.from('communities').select('*').in('id', ids)
            if (q) query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%`)
            const { data: rows, error } = await query.order('name')
            if (error) throw error
            const { data: counts } = await supabase.from('community_members').select('community_id')
            const countMap: Record<string, number> = {}
            ;(counts || []).forEach((c: any) => { countMap[c.community_id] = (countMap[c.community_id] || 0) + 1 })
            const list = (rows || []).map((r: any) => ({ ...toCommunity(r), memberCount: countMap[r.id] ?? 0 }))
            return res.json(list)
        }

        let query = supabase.from('communities').select('*').eq('is_public', true)
        if (q) query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%`)
        const { data: rows, error } = await query.order('name')
        if (error) throw error
        const { data: counts } = await supabase.from('community_members').select('community_id')
        const countMap: Record<string, number> = {}
        ;(counts || []).forEach((c: any) => { countMap[c.community_id] = (countMap[c.community_id] || 0) + 1 })
        const list = (rows || []).map((r: any) => ({ ...toCommunity(r), memberCount: countMap[r.id] ?? 0 }))
        res.json(list)
    } catch (e: any) {
        console.error(e)
        res.status(500).json({ result: 'error', message: e.message || 'Internal server error' })
    }
}

/** GET /api/communities/:id — 详情，非公开需为成员或带正确 slug */
export const getById = async (req: AuthRequest, res: Response) => {
    try {
        const id = req.params.id
        const slug = req.query.slug as string
        const { data: row, error } = await supabase.from('communities').select('*').eq('id', id).single()
        if (error || !row) return res.status(404).json({ result: 'error', message: 'Community not found' })
        const isPublic = row.is_public
        const isMember = req.user
            ? (await getMemberRole(id, req.user.id)) !== null
            : false
        const slugMatch = slug && slug === row.slug
        if (!isPublic && !isMember && !slugMatch) return res.status(403).json({ result: 'error', message: '无权查看' })
        const { count } = await supabase.from('community_members').select('*', { count: 'exact', head: true }).eq('community_id', id)
        const out = { ...toCommunity(row), memberCount: count ?? 0 }
        if (isMember && req.user) (out as any).myRole = await getMemberRole(id, req.user.id)
        res.json(out)
    } catch (e: any) {
        console.error(e)
        res.status(500).json({ result: 'error', message: e.message || 'Internal server error' })
    }
}

/** POST /api/communities — 创建社区（仅系统管理员），body: name, slug, description?, markdown_intro?, is_public?, point_name?, super_admin_id?, avatar_url? */
export const create = async (req: AuthRequest, res: Response) => {
    try {
        const { name, slug, description, markdown_intro, is_public, point_name, super_admin_id, avatar_url } = req.body || {}
        if (!name || !slug) return res.status(400).json({ result: 'error', message: 'name and slug required' })
        const slugNorm = String(slug).trim().toLowerCase().replace(/\s+/g, '-')
        const { data: existing } = await supabase.from('communities').select('id').eq('slug', slugNorm).maybeSingle()
        if (existing) return res.status(400).json({ result: 'error', message: 'slug 已被使用' })
        const { data: comm, error: insertError } = await supabase
            .from('communities')
            .insert({
                name: String(name).trim(),
                slug: slugNorm,
                description: description != null ? String(description) : null,
                markdown_intro: markdown_intro != null ? String(markdown_intro) : null,
                is_public: is_public !== false,
                point_name: point_name != null ? String(point_name) : '积分',
                super_admin_id: super_admin_id || null,
                avatar_url: avatar_url != null && String(avatar_url).trim() ? String(avatar_url).trim() : null,
            })
            .select()
            .single()
        if (insertError) throw insertError
        const uid = super_admin_id || req.user?.id
        if (uid) {
            await supabase.from('community_members').upsert({
                community_id: comm.id,
                user_id: uid,
                role: 'super_admin',
            }, { onConflict: 'community_id,user_id' })
            if (comm.super_admin_id !== uid) {
                await supabase.from('communities').update({ super_admin_id: uid }).eq('id', comm.id)
            }
        }
        const { count } = await supabase.from('community_members').select('*', { count: 'exact', head: true }).eq('community_id', comm.id)
        res.status(201).json({ ...toCommunity(comm), memberCount: count ?? 0 })
    } catch (e: any) {
        console.error(e)
        res.status(500).json({ result: 'error', message: e.message || 'Internal server error' })
    }
}

/** PATCH /api/communities/:id — 更新社区（系统管理员或总管理员可改名称/简介/公开性等） */
export const update = async (req: AuthRequest, res: Response) => {
    try {
        const id = req.params.id
        const role = await getMemberRole(id, req.user!.id)
        const isSystemAdmin = await (async () => {
            const { data } = await supabase.from('system_admins').select('id').eq('user_id', req.user!.id).maybeSingle()
            return !!data
        })()
        if (role !== 'super_admin' && !isSystemAdmin) return res.status(403).json({ result: 'error', message: '需要总管理员或系统管理员权限' })
        const updatePayload: any = {}
        if (req.body.name !== undefined) updatePayload.name = req.body.name
        if (req.body.description !== undefined) updatePayload.description = req.body.description
        if (req.body.markdownIntro !== undefined) updatePayload.markdown_intro = req.body.markdownIntro
        if (req.body.markdown_intro !== undefined) updatePayload.markdown_intro = req.body.markdown_intro
        if (req.body.isPublic !== undefined) updatePayload.is_public = req.body.isPublic
        if (req.body.pointName !== undefined) updatePayload.point_name = req.body.pointName
        if (req.body.avatarUrl !== undefined) updatePayload.avatar_url = req.body.avatarUrl
        if (req.body.avatar_url !== undefined) updatePayload.avatar_url = req.body.avatar_url
        if (Object.keys(updatePayload).length === 0) return res.json(toCommunity((await supabase.from('communities').select('*').eq('id', id).single()).data))
        const { data, error } = await supabase.from('communities').update(updatePayload).eq('id', id).select().single()
        if (error) throw error
        const { count } = await supabase.from('community_members').select('*', { count: 'exact', head: true }).eq('community_id', id)
        res.json({ ...toCommunity(data), memberCount: count ?? 0 })
    } catch (e: any) {
        console.error(e)
        res.status(500).json({ result: 'error', message: e.message || 'Internal server error' })
    }
}

/** POST /api/communities/join-by-invite — 仅传 body.slug，后端查社区并加入或提交申请（用于邀请码入口） */
export const joinByInvite = async (req: AuthRequest, res: Response) => {
    try {
        const slug = (req.body?.slug as string)?.trim()?.toLowerCase()?.replace(/\s+/g, '-')
        if (!slug) return res.status(400).json({ result: 'error', message: 'slug required' })
        if (!req.user?.id) return res.status(401).json({ result: 'error', message: 'Unauthorized' })
        const { data: comm, error: commError } = await supabase.from('communities').select('id, is_public, slug').eq('slug', slug).maybeSingle()
        if (commError || !comm) return res.status(404).json({ result: 'error', message: '邀请码无效' })
        const { data: existing } = await supabase.from('community_members').select('role').eq('community_id', comm.id).eq('user_id', req.user.id).maybeSingle()
        if (existing) return res.status(400).json({ result: 'error', message: '已是成员' })
        if (comm.is_public) {
            await supabase.from('community_members').insert({ community_id: comm.id, user_id: req.user.id, role: 'member' })
            return res.json({ result: 'ok', message: '已加入', communityId: comm.id })
        }
        await supabase.from('community_join_requests').upsert(
            { community_id: comm.id, user_id: req.user.id, status: 'pending' },
            { onConflict: 'community_id,user_id' }
        )
        res.json({ result: 'ok', message: '已提交申请，等待审批', communityId: comm.id })
    } catch (e: any) {
        console.error(e)
        res.status(500).json({ result: 'error', message: e.message || 'Internal server error' })
    }
}

/** POST /api/communities/:id/join — 公开直接加入；私有传 body.slug 校验后写入申请 */
export const join = async (req: AuthRequest, res: Response) => {
    try {
        const id = req.params.id
        if (!req.user?.id) return res.status(401).json({ result: 'error', message: 'Unauthorized' })
        const { data: comm, error: commError } = await supabase.from('communities').select('id, is_public, slug').eq('id', id).single()
        if (commError || !comm) return res.status(404).json({ result: 'error', message: 'Community not found' })
        const { data: existing } = await supabase.from('community_members').select('role').eq('community_id', id).eq('user_id', req.user.id).maybeSingle()
        if (existing) return res.status(400).json({ result: 'error', message: '已是成员' })
        if (comm.is_public) {
            await supabase.from('community_members').insert({ community_id: id, user_id: req.user.id, role: 'member' })
            return res.json({ result: 'ok', message: '已加入' })
        }
        const slug = (req.body?.slug as string)?.trim()
        if (slug !== comm.slug) return res.status(400).json({ result: 'error', message: '邀请码错误' })
        const { error: reqError } = await supabase.from('community_join_requests').upsert(
            { community_id: id, user_id: req.user.id, status: 'pending' },
            { onConflict: 'community_id,user_id' }
        )
        if (reqError) throw reqError
        res.json({ result: 'ok', message: '已提交申请，等待审批' })
    } catch (e: any) {
        console.error(e)
        res.status(500).json({ result: 'error', message: e.message || 'Internal server error' })
    }
}

/** POST /api/communities/:id/leave */
export const leave = async (req: AuthRequest, res: Response) => {
    try {
        const id = req.params.id
        if (!req.user?.id) return res.status(401).json({ result: 'error', message: 'Unauthorized' })
        const { data: mem } = await supabase.from('community_members').select('role').eq('community_id', id).eq('user_id', req.user.id).maybeSingle()
        if (!mem) return res.status(400).json({ result: 'error', message: '不是成员' })
        if (mem.role === 'super_admin') {
            const { data: comm } = await supabase.from('communities').select('super_admin_id').eq('id', id).single()
            if (comm?.super_admin_id === req.user.id) return res.status(400).json({ result: 'error', message: '请先转让总管理员再退出' })
        }
        await supabase.from('community_members').delete().eq('community_id', id).eq('user_id', req.user.id)
        res.json({ result: 'ok', message: '已退出' })
    } catch (e: any) {
        console.error(e)
        res.status(500).json({ result: 'error', message: e.message || 'Internal server error' })
    }
}

/** GET /api/communities/:id/members */
export const getMembers = async (req: AuthRequest, res: Response) => {
    try {
        const id = req.params.id
        const role = req.user ? await getMemberRole(id, req.user.id) : null
        if (!role) return res.status(403).json({ result: 'error', message: '仅成员可见' })
        const { data: rows, error } = await supabase
            .from('community_members')
            .select(`
                role,
                joined_at,
                user:users!community_members_user_id_fkey(id, name, avatar, image_url)
            `)
            .eq('community_id', id)
            .order('joined_at', { ascending: true })
        if (error) throw error
        const list = (rows || []).map((r: any) => ({
            userId: r.user?.id,
            name: r.user?.name,
            avatar: r.user?.avatar || r.user?.image_url,
            role: r.role,
            joinedAt: r.joined_at,
        }))
        res.json(list)
    } catch (e: any) {
        console.error(e)
        res.status(500).json({ result: 'error', message: e.message || 'Internal server error' })
    }
}

/** POST /api/communities/:id/members — 管理员直接添加成员（无需审批） */
export const addMember = async (req: AuthRequest, res: Response) => {
    try {
        const id = req.params.id
        const { userId, role } = req.body || {}
        if (!userId) return res.status(400).json({ result: 'error', message: 'userId required' })
        const myRole = await getMemberRole(id, req.user!.id)
        if (myRole !== 'super_admin' && myRole !== 'sub_admin') return res.status(403).json({ result: 'error', message: '需要管理员权限' })
        const { data: existing } = await supabase.from('community_members').select('role').eq('community_id', id).eq('user_id', userId).maybeSingle()
        if (existing) return res.status(400).json({ result: 'error', message: '该用户已是成员' })
        const targetRole = role === 'sub_admin' && myRole === 'super_admin' ? 'sub_admin' : 'member'
        await supabase.from('community_members').insert({ community_id: id, user_id: userId, role: targetRole })
        res.json({ result: 'ok', message: '已添加' })
    } catch (e: any) {
        console.error(e)
        res.status(500).json({ result: 'error', message: e.message || 'Internal server error' })
    }
}

/** PATCH /api/communities/:id/members/:userId — 踢人或改 role（总管理员可设 sub_admin） */
export const patchMember = async (req: AuthRequest, res: Response) => {
    try {
        const id = req.params.id
        const targetUserId = req.params.userId
        const myRole = await getMemberRole(id, req.user!.id)
        if (myRole !== 'super_admin' && myRole !== 'sub_admin') return res.status(403).json({ result: 'error', message: '需要管理员权限' })
        const { role: newRole, action } = req.body || {} // action: 'remove' | 'set_role'
        if (action === 'remove') {
            if (targetUserId === req.user!.id) return res.status(400).json({ result: 'error', message: '不能移除自己，请使用退出' })
            const { data: target } = await supabase.from('community_members').select('role').eq('community_id', id).eq('user_id', targetUserId).maybeSingle()
            if (!target) return res.status(404).json({ result: 'error', message: '成员不存在' })
            if (target.role === 'super_admin') return res.status(400).json({ result: 'error', message: '不能移除总管理员，请先转让' })
            if (target.role === 'sub_admin' && myRole !== 'super_admin') return res.status(403).json({ result: 'error', message: '仅总管理员可移除分管理员' })
            await supabase.from('community_members').delete().eq('community_id', id).eq('user_id', targetUserId)
            return res.json({ result: 'ok' })
        }
        if (newRole === 'sub_admin' && myRole === 'super_admin') {
            await supabase.from('community_members').update({ role: 'sub_admin' }).eq('community_id', id).eq('user_id', targetUserId)
            return res.json({ result: 'ok' })
        }
        if (newRole === 'member' && myRole === 'super_admin') {
            const { data: target } = await supabase.from('community_members').select('role').eq('community_id', id).eq('user_id', targetUserId).maybeSingle()
            if (target?.role === 'super_admin') return res.status(400).json({ result: 'error', message: '不能将总管理员降为成员，请先转让' })
            await supabase.from('community_members').update({ role: 'member' }).eq('community_id', id).eq('user_id', targetUserId)
            return res.json({ result: 'ok' })
        }
        return res.status(400).json({ result: 'error', message: '无效操作' })
    } catch (e: any) {
        console.error(e)
        res.status(500).json({ result: 'error', message: e.message || 'Internal server error' })
    }
}

/** POST /api/communities/:id/transfer-super-admin body: { targetUserId, demoteTo: 'member'|'sub_admin' } */
export const transferSuperAdmin = async (req: AuthRequest, res: Response) => {
    try {
        const id = req.params.id
        const { targetUserId, demoteTo } = req.body || {}
        if (!targetUserId) return res.status(400).json({ result: 'error', message: 'targetUserId required' })
        const myRole = await getMemberRole(id, req.user!.id)
        if (myRole !== 'super_admin') return res.status(403).json({ result: 'error', message: '需要总管理员权限' })
        if (targetUserId === req.user!.id) return res.status(400).json({ result: 'error', message: '不能转让给自己' })
        const { data: target } = await supabase.from('community_members').select('role').eq('community_id', id).eq('user_id', targetUserId).maybeSingle()
        if (!target) return res.status(400).json({ result: 'error', message: '目标不是成员' })
        const toRole = demoteTo === 'sub_admin' ? 'sub_admin' : 'member'
        await supabase.from('communities').update({ super_admin_id: targetUserId }).eq('id', id)
        await supabase.from('community_members').update({ role: 'super_admin' }).eq('community_id', id).eq('user_id', targetUserId)
        await supabase.from('community_members').update({ role: toRole }).eq('community_id', id).eq('user_id', req.user!.id)
        res.json({ result: 'ok', message: '转让成功' })
    } catch (e: any) {
        console.error(e)
        res.status(500).json({ result: 'error', message: e.message || 'Internal server error' })
    }
}

/** GET /api/communities/:id/join-requests */
export const getJoinRequests = async (req: AuthRequest, res: Response) => {
    try {
        const id = req.params.id
        const role = await getMemberRole(id, req.user!.id)
        if (role !== 'super_admin' && role !== 'sub_admin') return res.status(403).json({ result: 'error', message: '需要管理员权限' })
        const { data: rows, error } = await supabase
            .from('community_join_requests')
            .select(`
                id,
                user_id,
                status,
                created_at,
                user:users!community_join_requests_user_id_fkey(id, name, avatar, image_url)
            `)
            .eq('community_id', id)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
        if (error) throw error
        res.json((rows || []).map((r: any) => ({
            id: r.id,
            userId: r.user_id,
            name: r.user?.name,
            avatar: r.user?.avatar || r.user?.image_url,
            status: r.status,
            createdAt: r.created_at,
        })))
    } catch (e: any) {
        console.error(e)
        res.status(500).json({ result: 'error', message: e.message || 'Internal server error' })
    }
}

/** POST /api/communities/:id/join-requests/:requestId/approve */
export const approveJoinRequest = async (req: AuthRequest, res: Response) => {
    try {
        const id = req.params.id
        const requestId = req.params.requestId
        const role = await getMemberRole(id, req.user!.id)
        if (role !== 'super_admin' && role !== 'sub_admin') return res.status(403).json({ result: 'error', message: '需要管理员权限' })
        const { data: reqRow } = await supabase.from('community_join_requests').select('user_id').eq('id', requestId).eq('community_id', id).eq('status', 'pending').single()
        if (!reqRow) return res.status(404).json({ result: 'error', message: '申请不存在或已处理' })
        await supabase.from('community_join_requests').update({ status: 'approved', reviewed_at: new Date().toISOString(), reviewer_id: req.user!.id }).eq('id', requestId)
        await supabase.from('community_members').insert({ community_id: id, user_id: reqRow.user_id, role: 'member' })
        res.json({ result: 'ok', message: '已通过' })
    } catch (e: any) {
        console.error(e)
        res.status(500).json({ result: 'error', message: e.message || 'Internal server error' })
    }
}

/** POST /api/communities/:id/join-requests/:requestId/reject */
export const rejectJoinRequest = async (req: AuthRequest, res: Response) => {
    try {
        const id = req.params.id
        const requestId = req.params.requestId
        const role = await getMemberRole(id, req.user!.id)
        if (role !== 'super_admin' && role !== 'sub_admin') return res.status(403).json({ result: 'error', message: '需要管理员权限' })
        const { data: reqRow } = await supabase.from('community_join_requests').select('id').eq('id', requestId).eq('community_id', id).eq('status', 'pending').single()
        if (!reqRow) return res.status(404).json({ result: 'error', message: '申请不存在或已处理' })
        await supabase.from('community_join_requests').update({ status: 'rejected', reviewed_at: new Date().toISOString(), reviewer_id: req.user!.id }).eq('id', requestId)
        res.json({ result: 'ok', message: '已拒绝' })
    } catch (e: any) {
        console.error(e)
        res.status(500).json({ result: 'error', message: e.message || 'Internal server error' })
    }
}

// ---------- Announcements ----------
export const listAnnouncements = async (req: AuthRequest, res: Response) => {
    try {
        const id = req.params.id
        const role = req.user ? await getMemberRole(id, req.user.id) : null
        if (!role) return res.status(403).json({ result: 'error', message: '仅成员可见' })
        const { data: rows, error } = await supabase
            .from('announcements')
            .select('id, community_id, author_id, title, content, is_pinned, created_at, updated_at')
            .eq('community_id', id)
            .order('is_pinned', { ascending: false })
            .order('created_at', { ascending: false })
        if (error) throw error
        res.json((rows || []).map((r: any) => ({
            id: r.id,
            communityId: r.community_id,
            authorId: r.author_id,
            title: r.title,
            content: r.content,
            isPinned: r.is_pinned,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
        })))
    } catch (e: any) {
        console.error(e)
        res.status(500).json({ result: 'error', message: e.message || 'Internal server error' })
    }
}

export const createAnnouncement = async (req: AuthRequest, res: Response) => {
    try {
        const id = req.params.id
        const role = await getMemberRole(id, req.user!.id)
        if (role !== 'super_admin' && role !== 'sub_admin') return res.status(403).json({ result: 'error', message: '仅管理员可发公告' })
        const { title, content, is_pinned } = req.body || {}
        if (!title) return res.status(400).json({ result: 'error', message: 'title required' })
        const { data, error } = await supabase
            .from('announcements')
            .insert({ community_id: id, author_id: req.user!.id, title: String(title), content: content != null ? String(content) : null, is_pinned: !!is_pinned })
            .select()
            .single()
        if (error) throw error
        res.status(201).json({
            id: data.id,
            communityId: data.community_id,
            authorId: data.author_id,
            title: data.title,
            content: data.content,
            isPinned: data.is_pinned,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
        })
    } catch (e: any) {
        console.error(e)
        res.status(500).json({ result: 'error', message: e.message || 'Internal server error' })
    }
}

export const updateAnnouncement = async (req: AuthRequest, res: Response) => {
    try {
        const id = req.params.id
        const aid = req.params.announcementId
        const role = await getMemberRole(id, req.user!.id)
        if (role !== 'super_admin' && role !== 'sub_admin') return res.status(403).json({ result: 'error', message: '仅管理员可编辑' })
        const { title, content, is_pinned } = req.body || {}
        const payload: any = {}
        if (title !== undefined) payload.title = title
        if (content !== undefined) payload.content = content
        if (is_pinned !== undefined) payload.is_pinned = !!is_pinned
        if (Object.keys(payload).length === 0) return res.status(400).json({ result: 'error', message: '无有效字段' })
        const { data, error } = await supabase.from('announcements').update(payload).eq('id', aid).eq('community_id', id).select().single()
        if (error) throw error
        if (!data) return res.status(404).json({ result: 'error', message: '公告不存在' })
        res.json({ id: data.id, communityId: data.community_id, authorId: data.author_id, title: data.title, content: data.content, isPinned: data.is_pinned, createdAt: data.created_at, updatedAt: data.updated_at })
    } catch (e: any) {
        console.error(e)
        res.status(500).json({ result: 'error', message: e.message || 'Internal server error' })
    }
}

export const deleteAnnouncement = async (req: AuthRequest, res: Response) => {
    try {
        const id = req.params.id
        const aid = req.params.announcementId
        const role = await getMemberRole(id, req.user!.id)
        if (role !== 'super_admin' && role !== 'sub_admin') return res.status(403).json({ result: 'error', message: '仅管理员可删除' })
        const { error } = await supabase.from('announcements').delete().eq('id', aid).eq('community_id', id)
        if (error) throw error
        res.json({ result: 'ok' })
    } catch (e: any) {
        console.error(e)
        res.status(500).json({ result: 'error', message: e.message || 'Internal server error' })
    }
}
