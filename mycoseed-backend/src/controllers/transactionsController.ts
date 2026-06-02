import { Response } from 'express'
import { supabase } from '../services/supabase'
import { AuthRequest } from '../middleware/auth'
import { getRemarkByTaskId, getRemarkByPoolId, getTransferByTxHash } from '../services/alchemy'

// GET /api/transactions?task_id=xxx  OR  ?event_id=xxx
export const getTransactions = async (req: AuthRequest, res: Response) => {
  try {
    const { task_id, event_id } = req.query

    if (!task_id && !event_id) {
      return res.status(400).json({ error: 'task_id or event_id is required' })
    }

    if (task_id) {
      return await handleTaskTransaction(req, res, task_id as string)
    }

    if (event_id) {
      return await handleEventTransactions(req, res, event_id as string)
    }
  } catch (error) {
    console.error('[getTransactions] unexpected error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

// 任务付款查询：按 taskId 精确匹配
async function handleTaskTransaction(req: AuthRequest, res: Response, taskId: string) {
  // 1. 先查本地缓存
  let { data: localRecords, error: localError } = await supabase
    .from('transactions')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false })

  if (localError) {
    console.error('[handleTaskTransaction] local query error:', localError)
    localRecords = []
  }

  if (localRecords && localRecords.length > 0) {
    return res.json(localRecords)
  }

  // 2. 本地无记录，按 taskId 查链上 RemarkSaved 事件
  let remarks: Awaited<ReturnType<typeof getRemarkByTaskId>> = []
  try {
    remarks = await getRemarkByTaskId(taskId)
  } catch (chainError) {
    console.error('[handleTaskTransaction] chain query error:', chainError)
    return res.json([])
  }

  if (remarks.length === 0) {
    return res.json([])
  }

  // 3. 用 tx_hash 查 ERC20 Transfer 详情
  const results: any[] = []
  for (const remark of remarks) {
    try {
      const transfer = await getTransferByTxHash(remark.txHash)
      if (!transfer) continue

      const record = {
        tx_hash: remark.txHash,
        chain: 'optimism',
        sender_address: transfer.from,
        receiver_address: transfer.to,
        amount: transfer.value,
        actual_amount: transfer.value,
        expected_amount: null,
        currency: 'NT',
        status: 'success',
        memo: remark.senderRemark,
        task_id: taskId,
        event_id: null,
      }

      // 存入本地表
      const { data: inserted, error: insertError } = await supabase
        .from('transactions')
        .insert(record)
        .select()
        .single()

      if (insertError) {
        console.error('[handleTaskTransaction] insert error:', insertError)
        results.push({ id: `chain-${results.length}`, ...record })
      } else {
        results.push(inserted)
      }
    } catch (e) {
      console.error('[handleTaskTransaction] transfer lookup error:', e)
    }
  }

  return res.json(results)
}

// 活动付款查询：按 eventId 查所有参与者转账
async function handleEventTransactions(req: AuthRequest, res: Response, eventId: string) {
  // 1. 先查本地缓存
  let { data: localRecords, error: localError } = await supabase
    .from('transactions')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })

  if (localError) {
    console.error('[handleEventTransactions] local query error:', localError)
    localRecords = []
  }

  if (localRecords && localRecords.length > 0) {
    return res.json(localRecords)
  }

  // 2. 本地无记录，按 poolId (= eventId) 查链上 RemarkSaved 事件
  let remarks: Awaited<ReturnType<typeof getRemarkByPoolId>> = []
  try {
    remarks = await getRemarkByPoolId(eventId)
  } catch (chainError) {
    console.error('[handleEventTransactions] chain query error:', chainError)
    return res.json([])
  }

  if (remarks.length === 0) {
    return res.json([])
  }

  // 3. 每条 remark 用 tx_hash 查 ERC20 Transfer 详情
  const results: any[] = []
  for (const remark of remarks) {
    try {
      const transfer = await getTransferByTxHash(remark.txHash)
      if (!transfer) continue

      // 查活动的预期金额
      const { data: eventOptions } = await supabase
        .from('community_event_options')
        .select('price')
        .eq('event_id', eventId)
        .order('price', { ascending: false })
        .limit(1)

      const expectedAmount = eventOptions?.[0]?.price
        ? String(Number(eventOptions[0].price) * 1e18)
        : null

      const record = {
        tx_hash: remark.txHash,
        chain: 'optimism',
        sender_address: transfer.from,
        receiver_address: transfer.to,
        amount: transfer.value,
        actual_amount: transfer.value,
        expected_amount: expectedAmount,
        currency: 'NT',
        status: 'success',
        memo: remark.senderRemark,
        task_id: null,
        event_id: eventId,
      }

      // 存入本地表
      const { data: inserted, error: insertError } = await supabase
        .from('transactions')
        .insert(record)
        .select()
        .single()

      if (insertError) {
        console.error('[handleEventTransactions] insert error:', insertError)
        results.push({ id: `chain-${results.length}`, ...record })
      } else {
        results.push(inserted)
      }
    } catch (e) {
      console.error('[handleEventTransactions] transfer lookup error:', e)
    }
  }

  return res.json(results)
}
