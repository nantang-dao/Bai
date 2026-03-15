import { Router } from 'express'
import {
    getCommunityPosts,
    createPost
} from '../controllers/postsController'
import { authenticate } from '../middleware/auth'

const router = Router()

// ==================== 社区动态相关路由 ====================
// 注册为 /api/communities/:communityId/posts

// 获取社区动态列表（分页）
router.get('/:communityId/posts', authenticate, getCommunityPosts)

// 发布动态
router.post('/:communityId/posts', authenticate, createPost)

export default router
