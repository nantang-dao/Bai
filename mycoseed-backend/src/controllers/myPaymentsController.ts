import { Response } from 'express'
import { supabase } from '../services/supabase'
import { AuthRequest } from '../middleware/auth'
import {
  computeEventPaymentStatus,
  sumActualPayments,
  priceToExpectedWei,
  isTaskPendingTransfer,
  type MyPaymentsPendingResponse,
  type PendingPaymentItem,
} from '../services/pendingPaymentsLogic'
import { TASK_ROW_SELECT } from '../services/taskListAssemblyPure'

async function fetchPublisherPendingTasks(userId: string): Promise<PendingPaymentItem[]> {
  const { data: tasks, error } = await supabase
    .from('tasks')
    .select(TASK_ROW_SELECT)
    .eq('creator_id', userId)
    .eq('status', 'completed')
    .is('transferred_at', null)

  if (error) throw error
  if (!tasks?.length) return []

  const taskInfoIds = [...new Set(tasks.map((t: any) => t.task_info_id).filter(Boolean))]
  const { data: infos } = await supabase.from('task_info').select('id, title, community_id').in('id', taskInfoIds)
  const infoMap = new Map((infos || []).map((i: any) => [i.id, i]))

  const taskIds = tasks.map((t: any) => t.id)
  const { data: txRows } = await supabase
    .from('transactions')
    .select('task_id')
    .in('task_id', taskIds)

  const txTaskIds = new Set((txRows || []).map((r: any) => r.task_id))

  const items: PendingPaymentItem[] = []
  for (const t of tasks as any[]) {
    if (!isTaskPendingTransfer(t, txTaskIds.has(t.id))) continue
    const info = infoMap.get(t.task_info_id)
    if (!info?.title) continue
    items.push({
      type: 'task_payout',
      id: t.id,
      title: info.title,
      amount: String(parseFloat(t.reward || '0')),
      status: 'pending_transfer',
      sourceUrl: `/tasks/${t.id}`,
      communityId: info.community_id || undefined,
    })
  }
  return items
}

async function fetchParticipantPendingEvents(userId: string): Promise<PendingPaymentItem[]> {
  const { data: userRow } = await supabase
    .from('users')
    .select('evm_chain_address')
    .eq('id', userId)
    .maybeSingle()

  const walletLower = userRow?.evm_chain_address?.toLowerCase() || ''

  const { data: participations, error: pErr } = await supabase
    .from('community_event_participations')
    .select('id, occurrence_id, option_id')
    .eq('user_id', userId)
    .eq('status', 'registered')

  if (pErr) throw pErr
  if (!participations?.length) return []

  const occIds = [...new Set(participations.map((p: any) => p.occurrence_id))]
  const { data: occs } = await supabase
    .from('community_event_occurrences')
    .select('id, event_id')
    .in('id', occIds)

  if (!occs?.length) return []

  const occToEvent = new Map(occs.map((o: any) => [o.id, o.event_id]))
  const eventIds = [...new Set(occs.map((o: any) => o.event_id))]

  const { data: events } = await supabase
    .from('community_events')
    .select('id, title, community_id')
    .in('id', eventIds)

  if (!events?.length) return []

  const eventMap = new Map(events.map((e: any) => [e.id, e]))

  const { data: options } = await supabase
    .from('community_event_options')
    .select('id, event_id, price')
    .in('event_id', eventIds)

  const optionPriceMap = new Map<string, number>()
  const eventHasPaid = new Set<string>()
  for (const opt of options || []) {
    const price = Number((opt as any).price) || 0
    optionPriceMap.set((opt as any).id, price)
    if (price > 0) eventHasPaid.add((opt as any).event_id)
  }

  const { data: eventTxs } = await supabase
    .from('transactions')
    .select('event_id, sender_address, actual_amount, amount, expected_amount')
    .in('event_id', eventIds)

  const txsByEvent = new Map<string, any[]>()
  for (const tx of eventTxs || []) {
    const eid = (tx as any).event_id
    if (!eid) continue
    if (!txsByEvent.has(eid)) txsByEvent.set(eid, [])
    txsByEvent.get(eid)!.push(tx)
  }

  const seenEventIds = new Set<string>()
  const items: PendingPaymentItem[] = []

  for (const p of participations as any[]) {
    const eventId = occToEvent.get(p.occurrence_id)
    if (!eventId || !eventHasPaid.has(eventId)) continue
    if (seenEventIds.has(eventId)) continue

    const ev = eventMap.get(eventId)
    if (!ev) continue

    const optionPrice = p.option_id ? optionPriceMap.get(p.option_id) : undefined
    let expectedPrice = optionPrice
    if (expectedPrice === undefined) {
      const eventOpts = (options || []).filter((o: any) => o.event_id === eventId && Number(o.price) > 0)
      if (!eventOpts.length) continue
      expectedPrice = Math.min(...eventOpts.map((o: any) => Number(o.price)))
    }
    if (!expectedPrice || expectedPrice <= 0) continue

    const expectedWei = priceToExpectedWei(expectedPrice)
    const eventTxList = txsByEvent.get(eventId) || []
    const actualWei = walletLower ? sumActualPayments(eventTxList, walletLower) : 0n
    const payStatus = computeEventPaymentStatus(expectedWei, actualWei)

    if (payStatus === 'paid') continue

    seenEventIds.add(eventId)
    items.push({
      type: 'event_registration',
      id: p.id,
      title: ev.title,
      amount: String(expectedPrice),
      status: payStatus === 'partial' ? 'partial' : 'pending',
      sourceUrl: `/community/${ev.community_id}/events/${eventId}`,
      communityId: ev.community_id,
    })
  }

  return items
}

export const getMyPaymentsPending = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user
    if (!user) {
      return res.status(401).json({ error: '未授权' })
    }

    const [asPublisher, asParticipant] = await Promise.all([
      fetchPublisherPendingTasks(user.id),
      fetchParticipantPendingEvents(user.id),
    ])

    const body: MyPaymentsPendingResponse = {
      counts: {
        asPublisher: asPublisher.length,
        asParticipant: asParticipant.length,
      },
      asPublisher,
      asParticipant,
    }

    res.json(body)
  } catch (error: any) {
    console.error('[my-payments] getMyPaymentsPending error:', error)
    res.status(500).json({ error: error?.message || '获取待结清款项失败' })
  }
}
