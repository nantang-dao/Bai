import { Router } from 'express'
import { getFaqById, listFaqs } from '../controllers/faqController'

const router = Router()

router.get('/', listFaqs)
router.get('/:id', getFaqById)

export default router

