import { Router, Request, Response } from 'express'
import { supabase } from '../services/supabase'

const router = Router()

/**
 * 路由列表（用于确认线上实际部署的路由是否包含某个 endpoint）
 * GET /api/diagnostics/routes
 */
router.get('/routes', (req: Request, res: Response) => {
  const app: any = req.app as any

  function collectRoutesFromStack(stack: any[], prefix = ''): Array<{ method: string; path: string }> {
    const out: Array<{ method: string; path: string }> = []
    for (const layer of stack || []) {
      // Direct route
      if (layer.route?.path && layer.route?.methods) {
        const methods = Object.keys(layer.route.methods).filter((m) => layer.route.methods[m])
        for (const m of methods) {
          out.push({ method: m.toUpperCase(), path: `${prefix}${layer.route.path}` })
        }
        continue
      }

      // Nested router mounted at some path
      if (layer.name === 'router' && layer.handle?.stack) {
        // layer.regexp is not easily convertible to a nice path; we keep the prefix and recurse
        out.push(...collectRoutesFromStack(layer.handle.stack, prefix))
      }
    }
    return out
  }

  const routes = collectRoutesFromStack(app?._router?.stack || [])
  routes.sort((a, b) => (a.path + a.method).localeCompare(b.path + b.method))

  res.json({
    ok: true,
    count: routes.length,
    hint: 'Search for /api/auth/sync-from-semi; if missing, backend is not deployed with latest routes.',
    routes
  })
})

/**
 * 数据库连接测试端点
 * GET /api/diagnostics/db-test
 */
router.get('/db-test', async (req: Request, res: Response) => {
  try {
    // 测试 1: 检查环境变量
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
    
    const envCheck = {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseKey,
      urlPrefix: supabaseUrl ? supabaseUrl.substring(0, 20) + '...' : 'missing'
    }

    // 测试 2: 尝试查询数据库（检查连接）
    let connectionTest = { success: false, error: null as any }
    try {
      const { data, error } = await supabase
        .from('users')
        .select('count')
        .limit(1)
      
      if (error) {
        connectionTest.error = error.message
      } else {
        connectionTest.success = true
      }
    } catch (err: any) {
      connectionTest.error = err.message
    }

    // 测试 3: 检查关键表是否存在
    const tablesToCheck = ['users', 'tasks', 'auth_tokens', 'verification_tokens', 'task_claims']
    const tableStatus: Record<string, { exists: boolean; error?: string }> = {}

    for (const table of tablesToCheck) {
      try {
        const { error } = await supabase
          .from(table)
          .select('*')
          .limit(0)
        
        tableStatus[table] = {
          exists: !error,
          error: error ? error.message : undefined
        }
      } catch (err: any) {
        tableStatus[table] = {
          exists: false,
          error: err.message
        }
      }
    }

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      environment: {
        nodeEnv: process.env.NODE_ENV || 'not set',
        port: process.env.PORT || '3001 (default)',
        frontendUrl: process.env.FRONTEND_URL || 'not set'
      },
      supabase: {
        envCheck,
        connectionTest,
        tables: tableStatus
      },
      summary: {
        envConfigured: envCheck.hasUrl && envCheck.hasKey,
        dbConnected: connectionTest.success,
        allTablesExist: Object.values(tableStatus).every(t => t.exists)
      }
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
      message: '诊断测试失败'
    })
  }
})

export default router
