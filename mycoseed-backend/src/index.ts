// 环境配置：必须在所有其他导入之前执行
// 这会立即加载环境变量，确保后续导入的模块可以访问到环境变量
import './config/env'

import express from 'express'
import cors from 'cors'
import tasksRouter from './routes/tasks'
import authRouter from './routes/auth'
import uploadRouter from './routes/upload'
import diagnosticsRouter from './routes/diagnostics'
import communitiesRouter from './routes/communities'
import postRouter from './routes/post'
import commentsRouter from './routes/comments'

const nodeEnv = process.env.NODE_ENV || 'development'

const app = express()
// 端口：生产环境强制 8080（与 fly.toml internal_port 一致），开发用 env 或 3001
const PORT = nodeEnv === 'production' ? 8080 : (Number(process.env.PORT) || 3001)

// CORS 配置 - 允许 Vercel 前端域名
const corsOptions = {
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    // 允许的域名列表
    const allowedOrigins = [
      process.env.FRONTEND_URL, // Vercel 部署的前端 URL
      'http://localhost:3000',   // 本地开发
      'http://localhost:5173', // VITE默认端口
      'http://localhost:3003'  
    ].filter(Boolean) // 过滤掉 undefined
    
    // 开发环境允许所有来源，生产环境只允许配置的域名
    if (nodeEnv === 'development' || !origin || allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
}

// 中间件
app.use(cors(corsOptions))
app.use('/api/upload', uploadRouter)

// JSON/urlencoded 解析器：跳过 /api/upload，避免 multipart 被当 JSON 解析
app.use((req, res, next) => {
  if (req.path.startsWith('/api/upload')) return next()
  return express.json({ limit: '50mb' })(req, res, next)
})
app.use((req, res, next) => {
  if (req.path.startsWith('/api/upload')) return next()
  return express.urlencoded({ extended: true, limit: '50mb' })(req, res, next)
})

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'MycoSeed Backend API is running',
    environment: nodeEnv
  })
})

// 测试上传路由是否可用
app.get('/api/upload/test', (req, res) => {
  res.json({ status: 'ok', message: 'Upload routes are available' })
})

// 路由（上传已在上面挂载）
app.use('/api/tasks', tasksRouter)
app.use('/api/auth', authRouter)
app.use('/api/diagnostics', diagnosticsRouter)  // 诊断路由（开发用）
app.use('/api/communities', communitiesRouter)  // 社区 CRUD、成员、公告、动态
app.use('/api/posts', postRouter)         // 单个动态相关路由
app.use('/api/comments', commentsRouter)  // 评论删除路由


// 启动服务器（监听 0.0.0.0 以支持 Fly.io 等云环境）
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server is running on http://0.0.0.0:${PORT}`)
  console.log(`📝 API endpoints available at http://localhost:${PORT}/api`)
  console.log(`🌍 Environment: ${nodeEnv}`)
})