import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import {
  listSubtasks,
  createSubtask,
  patchSubtask,
  deleteSubtask,
  finalizeSubtasks,
  patchTaskpoolMeta,
  claimTaskPoolManager,
  getOverallSubmission,
  upsertOverallSubmission,
  reviewOverallSubmission,
  withdrawTaskPool,
  getTaskPoolDraftForEdit,
  patchTaskPoolDraft,
  startTaskpoolPrepayIntent,
  completeTaskpoolPrepayIntent,
  getTaskpoolPrepayIntentLatest,
  listTaskpoolPrepayIntents,
  syncTaskpoolPoolListing,
  completeTaskpoolFinalApprove,
  completeTaskpoolDistribute,
  getTaskpoolFinalRemarkPayloadIntent,
} from '../controllers/taskInfoController'

const router = Router()

router.post('/:taskInfoId/claim-manager', authenticate, claimTaskPoolManager)
router.post('/:taskInfoId/pool-listing/sync', authenticate, syncTaskpoolPoolListing)
router.get('/:taskInfoId/overall-submission', authenticate, getOverallSubmission)
router.post('/:taskInfoId/overall-submission', authenticate, upsertOverallSubmission)
router.post('/:taskInfoId/overall-submission/review', authenticate, reviewOverallSubmission)
router.get('/:taskInfoId/pool-draft', authenticate, getTaskPoolDraftForEdit)
router.patch('/:taskInfoId/pool-draft', authenticate, patchTaskPoolDraft)
router.post('/:taskInfoId/withdraw', authenticate, withdrawTaskPool)
router.post('/:taskInfoId/prepay-intent', authenticate, startTaskpoolPrepayIntent)
router.post('/:taskInfoId/prepay-complete', authenticate, completeTaskpoolPrepayIntent)
router.get('/:taskInfoId/prepay-intent/latest', authenticate, getTaskpoolPrepayIntentLatest)
router.get('/:taskInfoId/prepay-intents', authenticate, listTaskpoolPrepayIntents)
router.get('/:taskInfoId/subtasks', authenticate, listSubtasks)
router.post('/:taskInfoId/subtasks', authenticate, createSubtask)
router.patch('/:taskInfoId/subtasks/:subtaskId', authenticate, patchSubtask)
router.delete('/:taskInfoId/subtasks/:subtaskId', authenticate, deleteSubtask)
router.post('/:taskInfoId/subtasks/finalize', authenticate, finalizeSubtasks)
router.patch('/:taskInfoId/taskpool', authenticate, patchTaskpoolMeta)
router.post('/:taskInfoId/taskpool/final-remark-payload-intent', authenticate, getTaskpoolFinalRemarkPayloadIntent)
router.post('/:taskInfoId/taskpool/final-approve-complete', authenticate, completeTaskpoolFinalApprove)
router.post('/:taskInfoId/taskpool/distribute-complete', authenticate, completeTaskpoolDistribute)

export default router
