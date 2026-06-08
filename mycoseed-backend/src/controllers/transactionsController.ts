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

  // 2. 无论是否有缓存，都尝试从链上查询新交易并更新本地缓存
  let remarks: Awaited<ReturnType<typeof getRemarkByPoolId>> = []
  try {
    remarks = await getRemarkByPoolId(eventId)
  } catch (chainError) {
    console.error('[handleEventTransactions] chain query error:', chainError)
    // 链上查询失败时，如果有本地缓存则返回缓存
    if (localRecords && localRecords.length > 0) {
      return res.json(localRecords)
    }
    return res.json([])
  }

  if (remarks.length === 0) {
    // 链上无记录，返回本地缓存（可能为空）
    return res.json(localRecords || [])
  }

  // 3. 检查本地缓存中已有的 tx_hash，避免重复插入
  const existingTxHashes = new Set((localRecords || []).map((r: any) => r.tx_hash))

  // 4. 查询活动的所有选项价格（用于计算 expected_amount）
  const { data: eventOptions } = await supabase
    .from('community_event_options')
    .select('id, price')
    .eq('event_id', eventId)

  // 构建选项价格映射
  const optionPriceMap: Record<string, number> = {}
  if (eventOptions) {
    for (const opt of eventOptions) {
      optionPriceMap[opt.id] = Number(opt.price) || 0
    }
  }

  // 5. 查询活动的参与记录，获取每个用户选择的选项
  const { data: participations } = await supabase
    .from('community_event_participations')
    .select('user_id, option_id')
    .eq('event_id', eventId)

  // 构建用户 -> 选项价格映射
  const userExpectedPrice: Record<string, number> = {}
  if (participations) {
    for (const p of participations) {
      if (p.option_id && optionPriceMap[p.option_id] !== undefined) {
        userExpectedPrice[p.user_id] = optionPriceMap[p.option_id]
      }
    }
  }

  // 6. 查询用户的钱包地址，用于匹配 sender_address 到 user_id
  const { data: usersWithWallet } = await supabase
    .from('users')
    .select('id, evm_chain_address')
    .not('evm_chain_address', 'is', null)

  const walletToUserId: Record<string, string> = {}
  if (usersWithWallet) {
    for (const u of usersWithWallet) {
      if (u.evm_chain_address) {
        walletToUserId[u.evm_chain_address.toLowerCase()] = u.id
      }
    }
  }

  // 7. 处理每条 remark
  const results: any[] = [...(localRecords || [])]

  for (const remark of remarks) {
    // 跳过已存在的交易
    if (existingTxHashes.has(remark.txHash)) continue

    try {
      const transfer = await getTransferByTxHash(remark.txHash)
      if (!transfer) continue

      // 根据 sender_address 查找用户，获取其对应的预期金额
      const senderLower = transfer.from?.toLowerCase()
      const userId = senderLower ? walletToUserId[senderLower] : undefined
      const userPrice = userId ? userExpectedPrice[userId] : undefined

      // 使用用户实际选项的价格作为 expected_amount，而非最高价
      const expectedAmount = userPrice !== undefined
        ? String(userPrice * 1e18)
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
