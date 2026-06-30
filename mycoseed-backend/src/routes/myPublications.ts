import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { getMyPublishedEvents } from '../controllers/myPublicationsController'

const router = Router()

router.get('/events', authenticate, getMyPublishedEvents)

export default router
