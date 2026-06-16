import { supabase } from './supabase'

const DEFAULT_TAGS: { name: string; color_hex: string; sort_order: number }[] = [
    { name: '日常', color_hex: '#f87171', sort_order: 0 },
    { name: '创作', color_hex: '#3b82f6', sort_order: 1 },
    { name: '运营', color_hex: '#eab308', sort_order: 2 },
    { name: '技术', color_hex: '#a855f7', sort_order: 3 },
]

export async function ensureDefaultTaskTags(communityId: string): Promise<void> {
    const { count, error: cErr } = await supabase
        .from('community_task_tags')
        .select('*', { count: 'exact', head: true })
        .eq('community_id', communityId)
    if (cErr) throw cErr
    if ((count ?? 0) > 0) return
    const { error } = await supabase.from('community_task_tags').insert(
        DEFAULT_TAGS.map((t) => ({
            community_id: communityId,
            name: t.name,
            color_hex: t.color_hex,
            sort_order: t.sort_order,
        }))
    )
    if (error) throw error
}
