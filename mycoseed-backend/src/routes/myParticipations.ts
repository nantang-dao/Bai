import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { getMyParticipatedEvents } from '../controllers/myParticipationsController'

const router = Router()

router.get('/events', authenticate, getMyParticipatedEvents)

export default router
