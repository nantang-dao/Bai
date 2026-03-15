import { Response, NextFunction } from 'express'
import { supabase } from '../services/supabase'
import { AuthRequest } from './auth'

const MAX_SYSTEM_ADMINS = 5

/** 检查当前用户是否为系统管理员 */
export const requireSystemAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user?.id) return res.status(401).json({ result: 'error', message: 'Unauthorized' })
        const { data, error } = await supabase
            .from('system_admins')
            .select('id')
            .eq('user_id', req.user.id)
            .maybeSingle()
        if (error || !data) return res.status(403).json({ result: 'error', message: '需要系统管理员权限' })
        next()
    } catch (e) {
        console.error(e)
        res.status(500).json({ result: 'error', message: 'Internal server error' })
    }
}

/** 获取当前用户在指定社区的角色 member | sub_admin | super_admin */
export async function getMemberRole(communityId: string, userId: string): Promise<'member' | 'sub_admin' | 'super_admin' | null> {
    const { data } = await supabase
        .from('community_members')
        .select('role')
        .eq('community_id', communityId)
        .eq('user_id', userId)
        .maybeSingle()
    return (data?.role as 'member' | 'sub_admin' | 'super_admin') || null
}

/** 检查当前用户是否为该社区的总管理员或分管理员 */
export const requireCommunityAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const communityId = req.params.id || req.params.communityId
        if (!communityId || !req.user?.id) return res.status(401).json({ result: 'error', message: 'Unauthorized' })
        const role = await getMemberRole(communityId, req.user.id)
        if (role !== 'super_admin' && role !== 'sub_admin')
            return res.status(403).json({ result: 'error', message: '需要社区管理员权限' })
        ;(req as any).communityRole = role
        next()
    } catch (e) {
        console.error(e)
        res.status(500).json({ result: 'error', message: 'Internal server error' })
    }
}

/** 仅总管理员 */
export const requireSuperAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const communityId = req.params.id || req.params.communityId
        if (!communityId || !req.user?.id) return res.status(401).json({ result: 'error', message: 'Unauthorized' })
        const role = await getMemberRole(communityId, req.user.id)
        if (role !== 'super_admin') return res.status(403).json({ result: 'error', message: '需要总管理员权限' })
        next()
    } catch (e) {
        console.error(e)
        res.status(500).json({ result: 'error', message: 'Internal server error' })
    }
}

export { MAX_SYSTEM_ADMINS }
