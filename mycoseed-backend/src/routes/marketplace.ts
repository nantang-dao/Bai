import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { requireCommunityMember, requireSuperAdmin } from '../middleware/communityAdmin'
import * as m from '../controllers/marketplaceController'

const router = Router()

// 所有路由需登录且为社区成员；部分需总管理员
router.get('/:communityId/tags', authenticate, requireCommunityMember, m.listTags)
router.post('/:communityId/tags', authenticate, requireCommunityMember, requireSuperAdmin, m.createTag)
router.patch('/:communityId/tags/:tagId', authenticate, requireCommunityMember, requireSuperAdmin, m.updateTag)
router.delete('/:communityId/tags/:tagId', authenticate, requireCommunityMember, requireSuperAdmin, m.deleteTag)

router.get('/:communityId/listings', authenticate, requireCommunityMember, m.listListings)
router.post('/:communityId/listings', authenticate, requireCommunityMember, m.createListing)
router.get('/:communityId/listings/:listingId', authenticate, requireCommunityMember, m.getListing)
router.patch('/:communityId/listings/:listingId', authenticate, requireCommunityMember, m.updateListing)
router.post('/:communityId/listings/:listingId/withdraw', authenticate, requireCommunityMember, m.withdrawListing)
router.post('/:communityId/listings/:listingId/lock', authenticate, requireCommunityMember, m.lockListing)
router.post('/:communityId/listings/:listingId/confirm-sold', authenticate, requireCommunityMember, m.confirmSold)
router.post('/:communityId/listings/:listingId/cancel-lock', authenticate, requireCommunityMember, m.cancelLock)
router.post('/:communityId/listings/:listingId/review', authenticate, requireCommunityMember, m.submitReview)

router.get('/:communityId/reviews', authenticate, requireCommunityMember, m.listCommunityReviews)

export default router
