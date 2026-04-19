import { createClient } from '@supabase/supabase-js'

// 注意：不再在这里调用 dotenv.config()
// 环境变量已在 index.ts 中加载（开发环境）或由 Fly.io 提供（生产环境）

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseKey)

if (!process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_ANON_KEY) {
  console.warn(
    '[supabase] 未设置 SUPABASE_SERVICE_ROLE_KEY，当前使用 ANON_KEY。服务端部分查询若受 RLS 限制，可能出现「无匹配 tasks 行」；本地/脚本建议配置 SERVICE ROLE。'
  )
}