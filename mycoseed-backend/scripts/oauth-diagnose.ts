/**
 * OAuth / Supabase 冒烟与诊断（不打印密钥）
 * 用法：cd mycoseed-backend && npm run oauth-diagnose
 */
import '../src/config/env'
import { supabase } from '../src/services/supabase'

function maskEnv(k: string): string {
  const v = process.env[k]
  return v ? `set(len=${v.length})` : 'MISSING'
}

async function httpProbe(base: string) {
  const paths = ['/api/health', '/api/auth/me']
  for (const p of paths) {
    const url = `${base.replace(/\/$/, '')}${p}`
    try {
      const r = await fetch(url, { credentials: 'omit' })
      const text = await r.text()
      const preview = text.length > 200 ? `${text.slice(0, 200)}…` : text
      console.log(`[HTTP] ${r.status} GET ${p}`)
      console.log(`       body: ${preview.replace(/\s+/g, ' ')}`)
    } catch (e) {
      console.log(`[HTTP] FAIL GET ${p}:`, e instanceof Error ? e.message : e)
    }
  }

  const loginUrl = `${base.replace(/\/$/, '')}/api/auth/semi/login`
  try {
    const r = await fetch(loginUrl, { redirect: 'manual' })
    console.log(`[HTTP] ${r.status} GET /api/auth/semi/login (no cookie)`)
    const loc = r.headers.get('location')
    if (loc) console.log(`       Location: ${loc.slice(0, 120)}…`)
    const cook = r.headers.get('set-cookie')
    if (cook) console.log(`       Set-Cookie: ${cook.includes('mycoseed_pkce') ? 'mycoseed_pkce=yes' : cook.slice(0, 80)}`)
    if (r.status === 500) {
      const t = await r.text()
      console.log(`       err body: ${t}`)
    }
  } catch (e) {
    console.log('[HTTP] FAIL semi/login:', e instanceof Error ? e.message : e)
  }
}

async function supabaseProbe() {
  console.log('\n--- Supabase ---')
  const sel = await supabase.from('users').select('id').limit(1)
  if (sel.error) {
    console.log('[DB] select users:', sel.error.code, sel.error.message, sel.error.details || '')
    return
  }
  console.log('[DB] select users: ok')

  const probeId = `oauth_probe_${Date.now()}`
  const ins = await supabase
    .from('users')
    .insert({
      semi_id: probeId,
      handle: null,
      name: null,
      evm_chain_address: null,
      phone_verified: false,
    })
    .select('id')
    .single()

  if (ins.error) {
    console.log('[DB] insert (oauth-shaped row) FAILED:', ins.error.code, ins.error.message)
    console.log('       details:', ins.error.details || '(none)')
    console.log('       hint:', ins.error.hint || '(none)')
    return
  }

  const rowId = ins.data?.id as string
  console.log('[DB] insert probe row: ok id=', rowId)

  const del = await supabase.from('users').delete().eq('id', rowId)
  if (del.error) {
    console.log('[DB] delete probe row FAILED:', del.error.message, '(please delete manually id=', rowId, ')')
  } else {
    console.log('[DB] delete probe row: ok')
  }
}

async function remoteSemiProbe() {
  console.log('\n--- Remote Semi API (TLS + /oauth/token reachable) ---')
  const base = process.env.SEMI_BACKEND_URL || process.env.SEMI_BACKEND_BASE_URL
  if (!base) {
    console.log('[Semi] SEMI_BACKEND_URL / SEMI_BACKEND_BASE_URL: MISSING')
    return
  }
  const tokenUrl = new URL('/oauth/token', base).toString()
  try {
    const r = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
    const snippet = (await r.text()).slice(0, 120)
    console.log('[Semi] POST', tokenUrl, '→', r.status, snippet.replace(/\s+/g, ' '))
  } catch (e) {
    console.log('[Semi] probe error:', e instanceof Error ? e.message : e)
  }
}

async function main() {
  console.log('=== OAuth / DB diagnose ===\n')
  console.log('NODE_ENV:', process.env.NODE_ENV)
  console.log('Env (presence only):')
  ;[
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SEMI_CLIENT_ID',
    'SEMI_CLIENT_SECRET',
    'SEMI_FRONTEND_URL',
    'SEMI_BACKEND_URL',
    'SEMI_BACKEND_BASE_URL',
    'REDIRECT_URI',
    'FRONTEND_URL',
    'SESSION_SECRET',
  ].forEach((k) => console.log(`  ${k}:`, maskEnv(k)))

  const port = Number(process.env.PORT) || 3001
  const base = `http://127.0.0.1:${port}`

  await supabaseProbe()
  await remoteSemiProbe()

  console.log('\n--- Local HTTP (start backend first: npm run dev) ---')
  await httpProbe(base)

  console.log('\nDone.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
