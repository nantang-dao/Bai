import { Router } from 'express'
import { authenticate, optionalAuthenticate } from '../middleware/auth'
import { requireSystemAdmin } from '../middleware/communityAdmin'
import * as communitiesController from '../controllers/communitiesController'
import { getCommunityPosts, createPost } from '../controllers/postsController'

const router = Router()

// 列表与创建必须在带 :id 的路由之前（mine=1 需登录，用可选认证）
router.get('/', optionalAuthenticate, communitiesController.list)
router.post('/', authenticate, requireSystemAdmin, communitiesController.create)
router.post('/join-by-invite', authenticate, communitiesController.joinByInvite)

// 单社区资源（:id 与现有 :communityId 一致，供 posts 复用）
router.get('/:id', optionalAuthenticate, communitiesController.getById)
router.patch('/:id', authenticate, communitiesController.update)
router.post('/:id/join', authenticate, communitiesController.join)
router.post('/:id/leave', authenticate, communitiesController.leave)
router.get('/:id/members', authenticate, communitiesController.getMembers)
router.post('/:id/members', authenticate, communitiesController.addMember)
router.patch('/:id/members/:userId', authenticate, communitiesController.patchMember)
router.post('/:id/transfer-super-admin', authenticate, communitiesController.transferSuperAdmin)
router.get('/:id/join-requests', authenticate, communitiesController.getJoinRequests)
router.post('/:id/join-requests/:requestId/approve', authenticate, communitiesController.approveJoinRequest)
router.post('/:id/join-requests/:requestId/reject', authenticate, communitiesController.rejectJoinRequest)
router.get('/:id/announcements', optionalAuthenticate, communitiesController.listAnnouncements)
router.post('/:id/announcements', authenticate, communitiesController.createAnnouncement)
router.patch('/:id/announcements/:announcementId', authenticate, communitiesController.updateAnnouncement)
router.delete('/:id/announcements/:announcementId', authenticate, communitiesController.deleteAnnouncement)

// 社区动态（保留原接口，param 用 id 与上面一致）
router.get('/:communityId/posts', authenticate, getCommunityPosts)
router.post('/:communityId/posts', authenticate, createPost)

export default router
