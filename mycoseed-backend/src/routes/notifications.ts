import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { getSummary, listNotifications, markRead } from '../controllers/notificationsController'
import { getSettings, updateSettings } from '../controllers/notificationSettingsController'

const router = Router()

router.get('/summary', authenticate, getSummary)
router.get('/', authenticate, listNotifications)
router.post('/mark-read', authenticate, markRead)

// 设置
router.get('/settings', authenticate, getSettings)
router.patch('/settings', authenticate, updateSettings)

export default router

