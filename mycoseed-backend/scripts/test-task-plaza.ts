/**
 * 任务广场分页纯函数单元测试
 * npm run test:task-plaza
 */
import {
  buildPlazaListItem,
  decodePlazaCursor,
  deriveGroupedPlazaStatus,
  encodePlazaCursor,
  mapPlazaItemToFilterTab,
  matchesPlazaFilterTab,
  matchesPlazaSearch,
  pickRepresentativeSlotRow,
  sortPlazaItems,
  type PlazaSlotRow,
} from '../src/services/taskPlazaListPure'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

const fmt = (v: string | null | undefined) => v || undefined

function slot(partial: Partial<PlazaSlotRow> & Pick<PlazaSlotRow, 'id' | 'task_info_id'>): PlazaSlotRow {
  return {
    creator_id: 'u1',
    claimer_id: null,
    reward: 10,
    currency: 'NT',
    participant_index: 1,
    status: 'unclaimed',
    transferred_at: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...partial,
  }
}

function testCursorRoundTrip() {
  const c = { sort: 'createdAt' as const, value: '2026-03-01T12:00:00+00:00', id: 'abc-123' }
  const encoded = encodePlazaCursor(c)
  const decoded = decodePlazaCursor(encoded)
  assert(decoded?.id === c.id && decoded.sort === c.sort, 'cursor round-trip')
  assert(decodePlazaCursor('bad') === null, 'invalid cursor returns null')
  console.log('[OK] cursor encode/decode')
}

function testDeriveGroupedPlazaStatus() {
  const multiPartial = [
    slot({ id: 't1', task_info_id: 'i1', participant_index: 1, claimer_id: 'u2', status: 'claimed' }),
    slot({ id: 't2', task_info_id: 'i1', participant_index: 2, claimer_id: null, status: 'unclaimed' }),
  ]
  assert(deriveGroupedPlazaStatus(2, multiPartial) === 'unclaimed', '未领完应为 unclaimed')

  const multiFull = [
    slot({ id: 't1', task_info_id: 'i1', participant_index: 1, claimer_id: 'u2', status: 'completed' }),
    slot({ id: 't2', task_info_id: 'i1', participant_index: 2, claimer_id: 'u3', status: 'under_review' }),
  ]
  assert(deriveGroupedPlazaStatus(2, multiFull) === 'under_review', '进行中应取未完结状态')

  const multiDone = [
    slot({ id: 't1', task_info_id: 'i1', participant_index: 1, claimer_id: 'u2', status: 'completed' }),
    slot({ id: 't2', task_info_id: 'i1', participant_index: 2, claimer_id: 'u3', status: 'completed' }),
  ]
  assert(deriveGroupedPlazaStatus(2, multiDone) === 'completed', '全部完成')

  const multiReject = [
    slot({ id: 't1', task_info_id: 'i1', participant_index: 1, claimer_id: 'u2', status: 'rejected' }),
    slot({ id: 't2', task_info_id: 'i1', participant_index: 2, claimer_id: 'u3', status: 'rejected' }),
  ]
  assert(deriveGroupedPlazaStatus(2, multiReject) === 'rejected', '全部驳回')

  const single = [slot({ id: 't1', task_info_id: 'i1', status: 'claimed', claimer_id: 'u2' })]
  assert(deriveGroupedPlazaStatus(1, single) === 'claimed', '单人任务取行状态')
  console.log('[OK] deriveGroupedPlazaStatus')
}

function testPickRepresentative() {
  const rows = [
    slot({ id: 'b', task_info_id: 'i1', participant_index: 2 }),
    slot({ id: 'a', task_info_id: 'i1', participant_index: 1 }),
  ]
  assert(pickRepresentativeSlotRow(rows).id === 'a', '代表行取最小 participant_index')
  console.log('[OK] pickRepresentativeSlotRow')
}

function testBuildPlazaListItem() {
  const info = {
    id: 'info1',
    title: '测试任务',
    description: 'desc',
    activity_id: 0,
    start_date: '2026-01-01T00:00:00Z',
    deadline: '2026-12-31T23:59:00Z',
    submit_deadline: null,
    participant_limit: 2,
    reward_distribution_mode: 'per_person',
    creator_id: 'u1',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }
  const rows = [
    slot({ id: 't1', task_info_id: 'info1', participant_index: 1, claimer_id: 'u2', status: 'claimed' }),
    slot({ id: 't2', task_info_id: 'info1', participant_index: 2, status: 'unclaimed' }),
  ]
  const item = buildPlazaListItem(
    { taskInfo: info, slotRows: rows, tags: [{ id: 'tag1', name: 'A', colorHex: '#fff' }], creator: { id: 'u1', name: 'Alice' } },
    fmt
  )
  assert(item.id === 't1', '卡片 id 为代表行')
  assert(item.claimedCount === 1, 'claimedCount=1')
  assert(item.status === 'unclaimed', '未领完状态')
  assert(item.tags.length === 1, 'tags 保留')
  console.log('[OK] buildPlazaListItem')
}

function testFilterAndSearch() {
  const item = buildPlazaListItem(
    {
      taskInfo: {
        id: 'info1',
        title: 'FC 社区任务',
        description: 'hello',
        activity_id: 0,
        deadline: '2099-12-31T23:59:00Z',
        participant_limit: 1,
        creator_id: 'u1',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      slotRows: [slot({ id: 't1', task_info_id: 'info1', status: 'unclaimed' })],
      tags: [],
      creator: { id: 'u1', name: 'Bob' },
    },
    fmt
  )
  assert(mapPlazaItemToFilterTab(item) === 'pending', '未领取 -> pending tab')
  assert(matchesPlazaSearch(item, 'fc'), 'search case insensitive')
  assert(matchesPlazaFilterTab(item, 'pending'), 'filter pending')
  assert(!matchesPlazaFilterTab(item, 'completed'), 'not completed')
  console.log('[OK] filter and search')
}

function testSortPlazaItems() {
  const a = buildPlazaListItem(
    {
      taskInfo: { id: '1', title: 'A', description: '', activity_id: 0, deadline: '2026-06-01T00:00:00Z', creator_id: 'u', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
      slotRows: [slot({ id: 't1', task_info_id: '1', reward: 5 })],
      tags: [],
    },
    fmt
  )
  const b = buildPlazaListItem(
    {
      taskInfo: { id: '2', title: 'B', description: '', activity_id: 0, deadline: '2026-03-01T00:00:00Z', creator_id: 'u', created_at: '2026-02-01T00:00:00Z', updated_at: '2026-02-01T00:00:00Z' },
      slotRows: [slot({ id: 't2', task_info_id: '2', reward: 20 })],
      tags: [],
    },
    fmt
  )
  const byReward = sortPlazaItems([a, b], 'reward')
  assert(byReward[0].reward === 20, 'reward desc')
  const byDeadline = sortPlazaItems([a, b], 'deadline')
  assert(byDeadline[0].taskInfoId === '2', 'deadline asc')
  console.log('[OK] sortPlazaItems')
}

function main() {
  testCursorRoundTrip()
  testDeriveGroupedPlazaStatus()
  testPickRepresentative()
  testBuildPlazaListItem()
  testFilterAndSearch()
  testSortPlazaItems()
  console.log('\nAll task-plaza unit tests passed.')
}

main()
