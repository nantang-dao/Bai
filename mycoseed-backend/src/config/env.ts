// 环境变量配置
// 必须在所有其他模块导入之前执行
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'

const nodeEnv = process.env.NODE_ENV || 'development'
const root = process.cwd()

// 先加载通用 `.env`（本地常见做法），再让 `.env.development` 覆盖同名键
const envFile = path.join(root, '.env')
if (fs.existsSync(envFile)) {
  dotenv.config({ path: envFile })
}

if (nodeEnv === 'development') {
  const envDevPath = path.resolve(process.cwd(), '.env.development')
  const envPath = path.resolve(process.cwd(), '.env')

  dotenv.config({ path: envPath })
  dotenv.config({ path: envDevPath, override: false })

  console.log(`📝 开发环境：已尝试加载 .env 与 .env.development`)
} else {
  console.log(`🚀 生产环境：优先使用平台环境变量`)
}

export const NODE_ENV = nodeEnv

export const DEV_BYPASS_AUTH = process.env.DEV_BYPASS_AUTH === 'true' && nodeEnv !== 'production'
