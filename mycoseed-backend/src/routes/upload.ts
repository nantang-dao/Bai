import { Router } from 'express'
import multer from 'multer'
import { uploadAvatarController, uploadProofController, uploadPostImageController } from '../controllers/uploadController'
import { authenticate } from '../middleware/auth'

const router = Router()

// 调试：所有 /api/upload 请求都会打日志
router.use((req, _res, next) => {
  console.log('[upload] 请求进入 upload 路由', req.method, req.path)
  next()
})

// 配置multer（内存存储）
const storage = multer.memoryStorage()
const upload = multer({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 最大10MB
    }
})

// 上传头像（单文件）
router.post('/avatar', authenticate, upload.single('file'), uploadAvatarController)

// 上传任务凭证照片（多文件）
router.post('/proof', authenticate, upload.array('files', 10), uploadProofController)

// 上传社区动态图片（多文件）
router.post('/post-image', authenticate, upload.array('files', 9), uploadPostImageController)

export default router