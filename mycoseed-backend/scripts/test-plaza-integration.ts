/**
 * 任务广场分页集成测试（需配置 .env 连接 Supabase）
 * npm run test:plaza-integration
 */
import 'dotenv/config'
import { fetchPlazaTasksPage, fetchAllPlazaTasks } from '../src/services/taskPlazaList'
import { supabase } from '../src/services/supabase'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

async function countDistinctTaskInfoWithSlots(): Promise<number> {
  const seen = new Set<string>()
  let offset = 0
  while (true) {
    const { data, error } = await supabase
      .from('tasks')
      .select('task_info_id')
      .range(offset, offset + 999)
    if (error) throw error
    if (!data?.length) break
    for (const r of data) seen.add(r.task_info_id)
    if (data.length < 1000) break
    offset += 1000
  }
  return seen.size
}

async function countTaskRows(communityId?: string | null): Promise<number> {
  if (communityId) {
    const { data: infos } = await supabase.from('task_info').select('id').eq('community_id', communityId)
    const ids = (infos || []).map(i => i.id)
    if (!ids.length) return 0
    const { count, error } = await supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .in('task_info_id', ids)
    if (error) throw error
    return count ?? 0
  }
  const { count, error } = await supabase.from('tasks').select('id', { count: 'exact', head: true })
  if (error) throw error
  return count ?? 0
}

async function main() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log('[SKIP] 未配置 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY，跳过集成测试')
    return
  }

  const page1 = await fetchPlazaTasksPage({ limit: 20 })
  assert(Array.isArray(page1.items), 'page1.items 应为数组')
  assert(page1.items.length <= 20, '单页不超过 20 条')
  console.log(`[OK] 第一页 ${page1.items.length} 条, hasMore=${page1.hasMore}`)

  if (page1.hasMore && page1.nextCursor) {
    const page2 = await fetchPlazaTasksPage({ limit: 20, cursor: page1.nextCursor })
    assert(Array.isArray(page2.items), 'page2.items 应为数组')
    const ids1 = new Set(page1.items.map(i => i.taskInfoId))
    const overlap = page2.items.filter(i => ids1.has(i.taskInfoId))
    assert(overlap.length === 0, '第二页不应与第一页 task_info 重复')
    console.log(`[OK] 第二页 ${page2.items.length} 条，无重复 task_info`)
  } else {
    console.log('[OK] 数据不足一页，跳过分页去重检查')
  }

  const all = await fetchAllPlazaTasks({})
  assert(all.length >= page1.items.length, '全量应 >= 第一页')
  console.log(`[OK] fetchAllPlazaTasks 共 ${all.length} 条（分页管道）`)

  const noTimeline = page1.items.every(i => !(i as any).timeline)
  assert(noTimeline, '列表项不应含 timeline')
  console.log('[OK] 列表 DTO 无 timeline')

  const infoCount = await countDistinctTaskInfoWithSlots()
  const rowCount = await countTaskRows(null)
  const allCards = await fetchAllPlazaTasks({})
  const uniqueCardIds = new Set(allCards.map(i => i.taskInfoId))
  assert(uniqueCardIds.size === allCards.length, '全量结果不应有重复 task_info')
  assert(allCards.length === infoCount, `全量卡片数 ${allCards.length} 应等于有名额的 task_info 数 ${infoCount}`)
  console.log(`[OK] 全量卡片 ${allCards.length} = 有名额 task_info ${infoCount}（tasks 子行 ${rowCount}）`)

  if (rowCount > 1000) {
    console.log(`[OK] tasks 子行 ${rowCount} > 1000，新管道仍返回完整 ${infoCount} 张卡片`)
  }

  console.log('\nAll plaza integration tests passed.')
}

main().catch(err => {
  console.error('[FAIL]', err.message || err)
  process.exit(1)
})
