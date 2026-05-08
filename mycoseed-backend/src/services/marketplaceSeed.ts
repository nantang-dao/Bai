import { supabase } from './supabase'

const DEFAULT_TAGS: { name: string; color_hex: string; sort_order: number }[] = [
    { name: '闲置物品', color_hex: '#22c55e', sort_order: 0 },
    { name: '技能服务', color_hex: '#3b82f6', sort_order: 1 },
    { name: '代购跑腿', color_hex: '#eab308', sort_order: 2 },
    { name: '珍藏好物', color_hex: '#a855f7', sort_order: 3 },
]

/** 新社区或尚未有标签时写入默认四个标签 */
export async function ensureDefaultMarketplaceTags(communityId: string): Promise<void> {
    const { count, error: cErr } = await supabase
        .from('community_marketplace_tags')
        .select('*', { count: 'exact', head: true })
        .eq('community_id', communityId)
    if (cErr) throw cErr
    if ((count ?? 0) > 0) return
    const { error } = await supabase.from('community_marketplace_tags').insert(
        DEFAULT_TAGS.map((t) => ({
            community_id: communityId,
            name: t.name,
            color_hex: t.color_hex,
            sort_order: t.sort_order,
        }))
    )
    if (error) throw error
}
