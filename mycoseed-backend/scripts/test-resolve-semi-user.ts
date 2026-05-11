/**
 * 验证 resolveUserFromSemiPayload：新建、按 semi_id 命中、按 handle 合并（可选）
 * npm run test:resolve-semi-user
 */
import '../src/config/env'
import { supabase } from '../src/services/supabase'
import { resolveUserFromSemiPayload } from '../src/controllers/authController'

async function main() {
  const suffix = `${Date.now()}`

  // 1) 全新用户：只有 semi_id + handle
  const semiId = `semi_test_${suffix}`
  const handle = `handle_test_${suffix}`
  let u = await resolveUserFromSemiPayload({
    id: semiId,
    handle,
  })
  console.log('[1] create new user:', u.id, 'semi_id=', u.semi_id)

  // 2) 同一 semi_id 再次同步：应命中同一行
  const u2 = await resolveUserFromSemiPayload({
    id: semiId,
    handle,
    evm_chain_address: '0x1234567890123456789012345678901234567890',
  })
  console.log('[2] same semi_id:', u2.id === u.id ? 'OK' : 'FAIL', 'wallet=', u2.evm_chain_address?.slice(0, 12))

  // 3) handle 合并：库里已有 handle、无 semi_id；OAuth 带上同一 handle + 新 semi_id 应更新同一行而非插入
  const orphanHandle = `orphan_${suffix}`
  const { data: orphan, error: orphanErr } = await supabase
    .from('users')
    .insert({
      handle: orphanHandle,
      name: orphanHandle,
      semi_id: null,
      phone_verified: false,
    })
    .select('id')
    .single()
  if (orphanErr) throw orphanErr
  const mergeSemiId = `semi_merge_${suffix}`
  const merged = await resolveUserFromSemiPayload({
    id: mergeSemiId,
    handle: orphanHandle,
  })
  console.log(
    '[3] merge by handle:',
    merged.id === orphan!.id && merged.semi_id === mergeSemiId ? 'OK' : 'FAIL',
    merged.id
  )

  // 清理
  await supabase.from('users').delete().eq('id', u.id)
  await supabase.from('users').delete().eq('id', orphan!.id)
  console.log('[cleanup] deleted probe rows')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
