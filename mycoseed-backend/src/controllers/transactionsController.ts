import { Response } from 'express'
import { supabase } from '../services/supabase'
import { AuthRequest } from '../middleware/auth'
import { getNtTransfersBetween } from '../services/alchemy'

// GET /api/transactions?task_id=xxx
export const getTransactions = async (req: AuthRequest, res: Response) => {
  try {
    const { task_id } = req.query
    if (!task_id) {
      return res.status(400).json({ error: 'task_id is required' })
    }

    // 1. 先查本地 transactions 表
    const { data: localRecords, error: localError } = await supabase
      .from('transactions')
      .select('*')
      .eq('task_id', task_id)
      .order('created_at', { ascending: false })

    if (localError) {
      console.error('[getTransactions] local query error:', localError)
      return res.status(500).json({ error: 'Failed to query transactions' })
    }

    if (localRecords && localRecords.length > 0) {
      return res.json(localRecords)
    }

    // 2. 本地无记录，查链上数据
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('id, creator_id, claimer_id')
      .eq('id', task_id)
      .single()

    if (taskError || !task) {
      return res.json([])
    }

    if (!task.creator_id || !task.claimer_id) {
      return res.json([])
    }

    // 获取双方钱包地址
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, evm_chain_address')
      .in('id', [task.creator_id, task.claimer_id])

    if (usersError || !users || users.length < 2) {
      return res.json([])
    }

    const creator = users.find((u) => u.id === task.creator_id)
    const claimer = users.find((u) => u.id === task.claimer_id)

    if (!creator?.evm_chain_address || !claimer?.evm_chain_address) {
      return res.json([])
    }

    // 调 Alchemy 查链上转账
    let chainRecords: any[] = []
    try {
      chainRecords = await getNtTransfersBetween(
        creator.evm_chain_address,
        claimer.evm_chain_address
      )
    } catch (alchemyError) {
      console.error('[getTransactions] alchemy query error:', alchemyError)
      return res.json([])
    }

    if (chainRecords.length === 0) {
      return res.json([])
    }

    // 3. 存入本地表
    const toInsert = chainRecords.map((r) => ({
      tx_hash: r.txHash,
      chain: 'optimism',
      sender_address: r.from,
      receiver_address: r.to,
      amount: r.value,
      currency: 'NT',
      status: 'success',
      memo: null,
      task_id: task.id,
    }))

    const { data: inserted, error: insertError } = await supabase
      .from('transactions')
      .insert(toInsert)
      .select()

    if (insertError) {
      console.error('[getTransactions] insert error:', insertError)
      // 插入失败也返回链上数据
      return res.json(chainRecords.map((r, i) => ({ id: `chain-${i}`, ...r })))
    }

    return res.json(inserted || [])
  } catch (error) {
    console.error('[getTransactions] unexpected error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
