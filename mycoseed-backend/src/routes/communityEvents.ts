import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { requireCommunityMember, requireSuperAdmin, requireCommunityAdmin } from '../middleware/communityAdmin'
import * as c from '../controllers/communityEventsController'

const router = Router()

router.get('/:communityId/calendar-tags', authenticate, requireCommunityMember, c.listCalendarTags)
router.post('/:communityId/calendar-tags', authenticate, requireCommunityMember, requireSuperAdmin, c.createCalendarTag)
router.patch('/:communityId/calendar-tags/:tagId', authenticate, requireCommunityMember, requireSuperAdmin, c.updateCalendarTag)
router.delete('/:communityId/calendar-tags/:tagId', authenticate, requireCommunityMember, requireSuperAdmin, c.deleteCalendarTag)

router.get('/:communityId/events/calendar', authenticate, requireCommunityMember, c.listEventsCalendar)
router.get('/:communityId/events', authenticate, requireCommunityMember, c.listEvents)
router.post('/:communityId/events', authenticate, requireCommunityAdmin, c.createEvent)
router.get('/:communityId/events/:eventId', authenticate, requireCommunityMember, c.getEvent)
router.delete('/:communityId/events/:eventId', authenticate, requireCommunityAdmin, c.deleteEvent)
router.patch('/:communityId/events/:eventId/pin', authenticate, requireCommunityAdmin, c.pinEvent)
router.post('/:communityId/events/:eventId/register', authenticate, requireCommunityMember, c.registerEvent)
router.delete(
    '/:communityId/events/:eventId/occurrences/:occurrenceId/register',
    authenticate,
    requireCommunityMember,
    c.cancelRegistration
)

export default router
