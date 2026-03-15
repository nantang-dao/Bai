import { Router } from 'express'
import {
    getPostById,
    deletePost,
    getPostComments,
    createComment,
    toggleLike,
    getPostLikes,
    pinPost,
    unpinPost
} from '../controllers/postsController'
import { authenticate } from '../middleware/auth'

const router = Router()

// ==================== 单个动态相关路由 ====================
// 注册为 /api/posts/:postId

// 获取动态详情
router.get('/:postId', authenticate, getPostById)

// 删除动态
router.delete('/:postId', authenticate, deletePost)

// 获取动态评论列表
router.get('/:postId/comments', authenticate, getPostComments)

// 发表评论
router.post('/:postId/comments', authenticate, createComment)

// 点赞/取消点赞
router.post('/:postId/like', authenticate, toggleLike)

// 获取点赞列表
router.get('/:postId/likes', authenticate, getPostLikes)

// 置顶动态
router.post('/:postId/pin', authenticate, pinPost)

// 取消置顶
router.post('/:postId/unpin', authenticate, unpinPost)

export default router
