export type EventPaymentStatus = 'paid' | 'partial' | 'pending'

/** 根据预期与实际付款（wei 字符串）计算活动付款状态 */
export function computeEventPaymentStatus(
  expectedWei: bigint,
  actualWei: bigint
): EventPaymentStatus {
  if (expectedWei <= 0n) return 'paid'
  if (actualWei <= 0n) return 'pending'
  if (actualWei < expectedWei) return 'partial'
  return 'paid'
}

/** 累加同一用户在同一活动下的多笔付款 */
export function sumActualPayments(
  transactions: { sender_address?: string | null; actual_amount?: string | number | null; amount?: string | number | null }[],
  userWalletLower: string
): bigint {
  let total = 0n
  for (const tx of transactions) {
    const sender = tx.sender_address?.toLowerCase()
    if (sender !== userWalletLower) continue
    const raw = tx.actual_amount ?? tx.amount ?? '0'
    try {
      total += BigInt(String(raw))
    } catch {
      // ignore invalid
    }
  }
  return total
}

/** 价格（积分/元）转 wei 展示单位（与链上 expected_amount 一致：price * 1e18） */
export function priceToExpectedWei(price: number): bigint {
  if (!Number.isFinite(price) || price <= 0) return 0n
  return BigInt(Math.round(price * 1e18))
}

/** 任务是否处于待转账（发布者视角） */
export function isTaskPendingTransfer(
  task: { status: string; transferred_at?: string | null },
  hasTransaction: boolean
): boolean {
  if (task.status !== 'completed') return false
  if (task.transferred_at) return false
  if (hasTransaction) return false
  return true
}

export type PendingPaymentItem = {
  type: 'task_payout' | 'event_registration'
  id: string
  title: string
  amount: string
  status: 'pending_transfer' | 'pending' | 'partial'
  sourceUrl: string
  communityId?: string
}

export type MyPaymentsPendingResponse = {
  counts: { asPublisher: number; asParticipant: number }
  asPublisher: PendingPaymentItem[]
  asParticipant: PendingPaymentItem[]
}
