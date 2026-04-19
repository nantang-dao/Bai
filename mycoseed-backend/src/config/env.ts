// 环境变量配置
// 必须在所有其他模块导入之前执行
import dotenv from 'dotenv'
import path from 'path'

const nodeEnv = process.env.NODE_ENV || 'development'

if (nodeEnv === 'development') {
  // 开发环境：按优先级加载（后加载的不会覆盖已存在 env，除非显式 override）
  // 目标：允许你只维护一个 `.env`，同时也兼容 `.env.development`。
  const envDevPath = path.resolve(process.cwd(), '.env.development')
  const envPath = path.resolve(process.cwd(), '.env')

  // 1) 先加载 .env（基础配置）
  dotenv.config({ path: envPath })

  // 2) 再加载 .env.development（仅补充缺失项；不覆盖 .env 里已存在的变量）
  dotenv.config({ path: envDevPath, override: false })

  console.log(`📝 开发环境：已尝试加载 .env 与 .env.development`)
} else {
  // 生产环境：不加载文件，直接使用 Fly.io 的环境变量
  // Fly.io 会自动注入环境变量，无需手动加载
  console.log(`🚀 生产环境：使用 Fly.io 环境变量`)
}

export const NODE_ENV = nodeEnv
