/**
 * 活动个人页逻辑单元测试
 * npm run test:event-profile
 */
import { buildParticipatedEvents, buildPublishedEvents } from '../src/services/eventProfileLogic'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

function createMockSupabase(handlers: Record<string, () => Promise<{ data: unknown; error: null }>>) {
  const calls: string[] = []
  return {
    calls,
    from(table: string) {
      calls.push(table)
      const chain: Record<string, unknown> = {}
      const self = {
        select: () => self,
        eq: () => self,
        in: () => self,
        order: () => self,
        is: () => self,
        maybeSingle: async () => handlers[`${table}:maybeSingle`]?.() ?? { data: null, error: null },
        then(resolve: (v: unknown) => void) {
          const key = `${table}:${calls.filter((c) => c === table).length}`
          const handler = handlers[key] ?? handlers[table]
          return Promise.resolve(handler?.() ?? { data: [], error: null }).then(resolve)
        },
      }
      return self
    },
  }
}

async function testBuildPublishedEvents() {
  const mock = createMockSupabase({
    community_events: async () => ({
      data: [
        {
          id: 'ev1',
          title: '端午派对',
          community_id: 'c1',
          created_at: '2026-06-01T10:00:00Z',
        },
      ],
      error: null,
    }),
  })

  const items = await buildPublishedEvents(mock as never, 'user1')
  assert(items.length === 1, '应返回 1 条发布活动')
  assert(items[0].eventId === 'ev1', 'eventId 正确')
  assert(items[0].sortAt === '2026-06-01T10:00:00Z', 'sortAt 应为 created_at')
  assert(items[0].sourceUrl === '/community/c1/events/ev1', 'sourceUrl 正确')
  console.log('[OK] buildPublishedEvents')
}

async function testBuildParticipatedEventsFree() {
  let step = 0
  const mock = {
    from(table: string) {
      const api = {
        select: () => api,
        eq: () => api,
        in: () => api,
        order: () => api,
        async then(resolve: (v: unknown) => void) {
          step++
          if (table === 'community_event_participations' && step === 1) {
            return resolve({
              data: [
                {
                  id: 'p1',
                  occurrence_id: 'occ1',
                  option_id: 'opt1',
                  created_at: '2026-06-02T08:00:00Z',
                },
              ],
              error: null,
            })
          }
          if (table === 'community_event_occurrences') {
            return resolve({ data: [{ id: 'occ1', event_id: 'ev1' }], error: null })
          }
          if (table === 'community_events') {
            return resolve({
              data: [{ id: 'ev1', title: '免费活动', community_id: 'c1' }],
              error: null,
            })
          }
          if (table === 'community_event_options') {
            return resolve({ data: [{ id: 'opt1', event_id: 'ev1', price: 0 }], error: null })
          }
          if (table === 'transactions') {
            return resolve({ data: [], error: null })
          }
          return resolve({ data: [], error: null })
        },
      }
      return api
    },
  }

  const items = await buildParticipatedEvents(mock as never, 'user1', '0xabc')
  assert(items.length === 1, '应返回 1 条报名活动')
  assert(items[0].paymentStatus === 'free', '免费活动应为 free')
  assert(items[0].amount === null, '免费活动 amount 为 null')
  console.log('[OK] buildParticipatedEventsFree')
}

async function main() {
  await testBuildPublishedEvents()
  await testBuildParticipatedEventsFree()
  console.log('\nAll event-profile tests passed.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
