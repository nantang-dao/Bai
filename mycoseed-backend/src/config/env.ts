// 环境变量配置
// 必须在所有其他模块导入之前执行
import dotenv from 'dotenv'
import path from 'path'

const nodeEnv = process.env.NODE_ENV || 'development'

if (nodeEnv === 'development') {
  // 开发环境：加载 .env.development 文件
  const envPath = path.resolve(process.cwd(), '.env.development')
  dotenv.config({ path: envPath })
  console.log(`📝 开发环境：已加载 .env.development`)
} else {
  // 生产环境：不加载文件，直接使用 Fly.io 的环境变量
  // Fly.io 会自动注入环境变量，无需手动加载
  console.log(`🚀 生产环境：使用 Fly.io 环境变量`)
}

export const NODE_ENV = nodeEnv
