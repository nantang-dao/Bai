import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { getMyPaymentsPending } from '../controllers/myPaymentsController'

const router = Router()

router.get('/pending', authenticate, getMyPaymentsPending)

export default router
