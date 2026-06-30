import {
  computeEventPaymentStatus,
  priceToExpectedWei,
  sumActualPayments,
  type EventPaymentStatus,
} from './pendingPaymentsLogic'

export type EventParticipationItem = {
  participationId: string
  eventId: string
  communityId: string
  title: string
  registeredAt: string
  amount: string | null
  paymentStatus: 'free' | EventPaymentStatus
  sourceUrl: string
  sortAt: string
}

export type EventPublicationItem = {
  eventId: string
  communityId: string
  title: string
  createdAt: string
  sourceUrl: string
  sortAt: string
}

type ParticipationRow = {
  id: string
  occurrence_id: string
  option_id: string | null
  created_at: string
}

/** 批量解析用户报名的活动（含付款状态），按活动去重保留最早报名记录 */
export async function buildParticipatedEvents(
  supabase: { from: (table: string) => any },
  userId: string,
  walletLower: string
): Promise<EventParticipationItem[]> {
  const { data: participations, error: pErr } = await supabase
    .from('community_event_participations')
    .select('id, occurrence_id, option_id, created_at')
    .eq('user_id', userId)
    .eq('status', 'registered')
    .order('created_at', { ascending: false })

  if (pErr) throw pErr
  if (!participations?.length) return []

  const occIds = [...new Set((participations as ParticipationRow[]).map((p) => p.occurrence_id))]
  const { data: occs } = await supabase
    .from('community_event_occurrences')
    .select('id, event_id')
    .in('id', occIds)

  if (!occs?.length) return []

  const occToEvent = new Map<string, string>(
    occs.map((o: { id: string; event_id: string }) => [o.id, o.event_id] as [string, string])
  )
  const eventIds = [...new Set(occs.map((o: { event_id: string }) => o.event_id))]

  const { data: events } = await supabase
    .from('community_events')
    .select('id, title, community_id')
    .in('id', eventIds)

  if (!events?.length) return []

  type EventRow = { id: string; title: string; community_id: string }
  const eventMap = new Map<string, EventRow>(
    (events as EventRow[]).map((e) => [e.id, e] as [string, EventRow])
  )

  const { data: options } = await supabase
    .from('community_event_options')
    .select('id, event_id, price')
    .in('event_id', eventIds)

  const optionPriceMap = new Map<string, number>()
  const maxPriceByEvent = new Map<string, number>()
  for (const opt of options || []) {
    const price = Number((opt as { price: number }).price) || 0
    optionPriceMap.set((opt as { id: string }).id, price)
    const eid = (opt as { event_id: string }).event_id
    const prev = maxPriceByEvent.get(eid) ?? 0
    if (price > prev) maxPriceByEvent.set(eid, price)
  }

  const { data: eventTxs } = await supabase
    .from('transactions')
    .select('event_id, sender_address, actual_amount, amount')
    .in('event_id', eventIds)

  const txsByEvent = new Map<string, { event_id?: string; sender_address?: string | null; actual_amount?: string | number | null; amount?: string | number | null }[]>()
  for (const tx of eventTxs || []) {
    const eid = (tx as { event_id: string }).event_id
    if (!eid) continue
    if (!txsByEvent.has(eid)) txsByEvent.set(eid, [])
    txsByEvent.get(eid)!.push(tx as { event_id?: string; sender_address?: string | null; actual_amount?: string | number | null; amount?: string | number | null })
  }

  const seenEventIds = new Set<string>()
  const items: EventParticipationItem[] = []

  for (const p of participations as ParticipationRow[]) {
    const eventId = occToEvent.get(p.occurrence_id)
    if (!eventId || seenEventIds.has(eventId)) continue

    const ev = eventMap.get(eventId)
    if (!ev) continue

    seenEventIds.add(eventId)

    const optionPrice = p.option_id ? optionPriceMap.get(p.option_id) : undefined
    let expectedPrice = optionPrice
    if (expectedPrice === undefined) {
      const eventOpts = (options || []).filter(
        (o: { event_id: string; price: number }) => o.event_id === eventId && Number(o.price) > 0
      )
      if (eventOpts.length) {
        expectedPrice = Math.min(...eventOpts.map((o: { price: number }) => Number(o.price)))
      } else {
        expectedPrice = 0
      }
    }

    let paymentStatus: EventParticipationItem['paymentStatus'] = 'free'
    let amount: string | null = null

    if (expectedPrice && expectedPrice > 0) {
      amount = String(expectedPrice)
      const expectedWei = priceToExpectedWei(expectedPrice)
      const eventTxList = txsByEvent.get(eventId) || []
      const actualWei = walletLower ? sumActualPayments(eventTxList, walletLower) : 0n
      paymentStatus = computeEventPaymentStatus(expectedWei, actualWei)
    }

    items.push({
      participationId: p.id,
      eventId,
      communityId: ev.community_id,
      title: ev.title,
      registeredAt: p.created_at,
      amount,
      paymentStatus,
      sourceUrl: `/community/${ev.community_id}/events/${eventId}`,
      sortAt: p.created_at,
    })
  }

  return items
}

/** 用户创建的活动列表 */
export async function buildPublishedEvents(
  supabase: { from: (table: string) => any },
  userId: string
): Promise<EventPublicationItem[]> {
  const { data: events, error } = await supabase
    .from('community_events')
    .select('id, title, community_id, created_at')
    .eq('creator_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  if (!events?.length) return []

  return (events as { id: string; title: string; community_id: string; created_at: string }[]).map(
    (ev) => ({
      eventId: ev.id,
      communityId: ev.community_id,
      title: ev.title,
      createdAt: ev.created_at,
      sourceUrl: `/community/${ev.community_id}/events/${ev.id}`,
      sortAt: ev.created_at,
    })
  )
}
