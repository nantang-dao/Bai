import { Router } from 'express'
import {
    getAllTasks,
    getTaskById,
    createTask,
    claimTask,
    getTaskpoolClaimIntent,
    getTaskpoolFinalRemarkPayloadIntent,
    completeTaskpoolClaim,
    reconcileTaskpoolClaim,
    completeTaskpoolApprove,
    completeTaskpoolApproveAndFinalize,
    submitProof,
    approveTask,
    rejectTask,
    markTransferCompleted,
    unmarkTransferCompleted,
    withdrawTask,
    deleteTask
} from '../controllers/tasksController'
import { authenticate } from '../middleware/auth'

const router = Router()

router.get('/', getAllTasks)
router.get('/:id', getTaskById)
router.post('/', authenticate, createTask)
router.post('/:id/taskpool-claim-intent', authenticate, getTaskpoolClaimIntent)
router.post('/:id/taskpool-final-remark-payload-intent', authenticate, getTaskpoolFinalRemarkPayloadIntent)
router.post('/:id/taskpool-claim-complete', authenticate, completeTaskpoolClaim)
router.post('/:id/taskpool-claim-reconcile', authenticate, reconcileTaskpoolClaim)
router.post('/:id/taskpool-approve-complete', authenticate, completeTaskpoolApprove)
router.post('/:id/taskpool-approve-finalize-complete', authenticate, completeTaskpoolApproveAndFinalize)
router.patch('/:id/claim', authenticate, claimTask)
router.patch('/:id/submit', authenticate, submitProof)
router.patch('/:id/approve', authenticate, approveTask)
router.patch('/:id/reject', authenticate, rejectTask)
router.patch('/:id/mark-transfer-completed', authenticate, markTransferCompleted)
router.patch('/:id/unmark-transfer-completed', authenticate, unmarkTransferCompleted)
router.post('/:id/withdraw', authenticate, withdrawTask)
router.delete('/:id', authenticate, deleteTask)

export default router