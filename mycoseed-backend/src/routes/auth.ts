import {Router} from 'express'
import
{
    sendSMSController,
    signInController,
    getMeController,
    updateProfileController,
    getUserByIdController,
    registerController,
    passwordLoginController,
    getAllUsersController,
    setPasswordController,
    syncFromSemiController,
} from '../controllers/authController'
import {authenticate} from '../middleware/auth'

const router = Router()

// 认证相关路由
router.post('/send-sms',sendSMSController)
router.post('/signin',signInController)  // 短信验证码登录
router.post('/register', registerController)  // 用户注册（密码）
router.post('/login', passwordLoginController)  // 密码登录
router.post('/set-password', setPasswordController)  // 设置密码（验证码验证后）
router.post('/sync-from-semi', syncFromSemiController)  // 从 Semi 同步用户信息
router.get('/me',authenticate,getMeController)  // 获取当前用户信息
router.patch('/me', authenticate, updateProfileController)  // 更新用户资料
router.get('/users', authenticate, getAllUsersController)  // 获取所有用户列表（需要认证）- 必须在 /users/:id 之前
router.get('/users/:id', getUserByIdController)  // 获取用户信息（不需要认证，用于公开信息）

export default router
