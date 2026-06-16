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
    unmarkTransferCompleted,
    withdrawTask,
    deleteTask,
    getCalendarCards,
    listTaskTags,
    createTaskTag,
    updateTaskTag,
    deleteTaskTag
} from '../controllers/tasksController'
import { authenticate, optionalAuthenticate } from '../middleware/auth'
import { requireCommunityMember, requireSuperAdmin } from '../middleware/communityAdmin'

const router = Router()

// 任务标签管理
router.get('/tags/:communityId', authenticate, requireCommunityMember, listTaskTags)
router.post('/tags/:communityId', authenticate, requireCommunityMember, requireSuperAdmin, createTaskTag)
router.patch('/tags/:communityId/:tagId', authenticate, requireCommunityMember, requireSuperAdmin, updateTaskTag)
router.delete('/tags/:communityId/:tagId', authenticate, requireCommunityMember, requireSuperAdmin, deleteTaskTag)

router.get('/', getAllTasks)
router.get('/calendar-cards', optionalAuthenticate, getCalendarCards)
router.get('/:id', getTaskById)
router.post('/', authenticate, createTask)
router.patch('/:id/claim', authenticate, claimTask)
router.patch('/:id/submit', authenticate, submitProof)
router.patch('/:id/approve', authenticate, approveTask)
router.patch('/:id/reject', authenticate, rejectTask)
router.patch('/:id/mark-transfer-completed', authenticate, markTransferCompleted)
router.patch('/:id/unmark-transfer-completed', authenticate, unmarkTransferCompleted)
router.post('/:id/withdraw', authenticate, withdrawTask)
router.delete('/:id', authenticate, deleteTask)

export default router