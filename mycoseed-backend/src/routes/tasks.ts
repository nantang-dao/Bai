import { Router } from 'express'
import {
    getAllTasks,
    getTaskById,
    createTask,
    claimTask,
    submitProof,
    approveTask,
    rejectTask,
    markTransferCompleted,
    unmarkTransferCompleted
} from '../controllers/tasksController'
import { authenticate } from '../middleware/auth'

const router = Router()

router.get('/', getAllTasks)
router.get('/:id', getTaskById)
router.post('/', authenticate, createTask)
router.patch('/:id/claim', authenticate, claimTask)
router.patch('/:id/submit', authenticate, submitProof)
router.patch('/:id/approve', authenticate, approveTask)
router.patch('/:id/reject', authenticate, rejectTask)
router.patch('/:id/mark-transfer-completed', authenticate, markTransferCompleted)
router.patch('/:id/unmark-transfer-completed', authenticate, unmarkTransferCompleted)

export default router