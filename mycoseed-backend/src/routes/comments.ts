import { Router } from 'express'
import { deleteComment } from '../controllers/postsController'
import { authenticate } from '../middleware/auth'

const router = Router()

// ==================== 评论删除路由 ====================
// 注册为 /api/comments/:commentId

// 删除评论
router.delete('/:commentId', authenticate, deleteComment)

export default router
