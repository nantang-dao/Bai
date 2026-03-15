import {Request,Response} from 'express'
import {AuthRequest} from '../middleware/auth'
import {supabase} from '../services/supabase'
import {sendSMS} from '../services/sms'
import {User,SignInRequest} from '../types/auth'
import crypto from 'crypto'
import { promisify } from 'util'

// 使用 Node.js 内置的 crypto 进行密码哈希（使用 pbkdf2）
const pbkdf2Async = promisify(crypto.pbkdf2)

/**
 * 生成密码哈希
 * @param password 明文密码
 * @returns 哈希值和盐值（格式：salt:hash）
 */
const hashPassword = async (password: string): Promise<string> => {
    const salt = crypto.randomBytes(16).toString('hex')
    const hash = await pbkdf2Async(password, salt, 10000, 64, 'sha512')
    return `${salt}:${hash.toString('hex')}`
}

/**
 * 验证密码
 * @param password 明文密码
 * @param hashedPassword 存储的哈希值（格式：salt:hash）
 * @returns 是否匹配
 */
const verifyPassword = async (password: string, hashedPassword: string): Promise<boolean> => {
    const [salt, hash] = hashedPassword.split(':')
    if (!salt || !hash) return false
    
    const hashBuffer = await pbkdf2Async(password, salt, 10000, 64, 'sha512')
    return hashBuffer.toString('hex') === hash
}

// 生成随机 token
const generateToken = ():string=>
{
    return crypto.randomBytes(16).toString('hex')
}

// 生成6位验证码
const generateCode = ():string =>
{
    return Math.floor(100000 + Math.random() * 900000).toString()
}

// 清理手机号：只保留数字字符，防止 URL 参数中包含额外字符（如字母）
const cleanPhoneNumber = (phone: string): string => {
    if (!phone) return ''
    // 只保留数字字符
    return phone.replace(/\D/g, '')
}

// 发送验证码
export const sendSMSController = async (req: Request, res: Response) =>
{
    try
    {
        const {phone: rawPhone} = req.body
        
        // 清理手机号：只保留数字字符，防止 URL 参数中包含额外字符（如字母）
        const phone = cleanPhoneNumber(rawPhone)

        if (!phone || !/^\d{11}$/.test(phone))
        {
            return res.status(400).json({result:'error',message:'Invalid phone number'})
        }

        const code = generateCode()
        const expiresAt = new Date(Date.now()+15*60*1000) // 15分钟后过期

        // 保存验证码到数据库
        const {error:insertError}= await supabase
            .from('verification_tokens')
            .insert
            ({
                context: 'phone-login',
                sent_to: phone,
                code,
                expires_at: expiresAt.toISOString(),
                used: false,
            })
        if (insertError)
        {
            throw insertError
        }

        // 发送短信（如果启用了sms）
        if (process.env.SMS_ENABLED === 'ENABLED')
        {
            try
            {
                await sendSMS(phone, code)
            } catch (smsError)
            {
                console.error('SMS sending failed:', smsError)
                // 计时短信发送失败，也返回成功（开发环境）
            }
        }

        // 开发环境返回验证码（方便测试）
        const response:any = {result:'ok'}
        if (process.env.NODE_ENV === 'development')
        {
            response.code = code
        }

        res.json(response)
    } catch(error:any)
    {
        console.error('Send SMS error:',error)
        res.status(500).json({result:'error',message:error.message || 'Failed to send SMS'})
    }
}

// 登录
export const signInController = async(req:Request, res:Response)=>
{
    try
    {
        const {phone: rawPhone,code}:SignInRequest = req.body

        if(!rawPhone || !code)
        {
            return res.status(400).json({result:'error', message:'Phone and code are required'})
        }
        
        // 清理手机号：只保留数字字符，防止 URL 参数中包含额外字符（如字母）
        const phone = cleanPhoneNumber(rawPhone)
        
        if (!phone || !/^\d{11}$/.test(phone))
        {
            return res.status(400).json({result:'error', message:'Invalid phone number format'})
        }

        // 查找验证码
        const {data:verificationToken,error: findError } = await supabase
            .from('verification_tokens')
            .select('*')
            .eq('context', 'phone-login')
            .eq('sent_to', phone)
            .eq('code',code)
            .eq('used', false)
            .single()
        
        if(findError || !verificationToken)
            {
                return res.status(400).json({result:'error',message: 'Invalid phone or code'})
            }

        // 检查是否过期
        if (new Date() > new Date(verificationToken.expires_at))
            {
                return res.status(400).json({result:'error',message:'Code expired'})
            }

        // 标记验证码为已使用
        await supabase
            .from('verification_tokens')
            .update({used:true})
            .eq('id',verificationToken.id)
        
        // 查找或创建用户
        let {data:user, error:userError} = await supabase 
            .from('users')
            .select('*')
            .eq('phone', phone)
            .single()
        
        if(userError && userError.code === 'PGRST116')
        {
            // 用户不存在，创建新用户
            const {data:newUser,error:createError} = await supabase
                .from('users')
                .insert
                ({
                    phone,
                    phone_verified:true,
                })
                .select()
                .single()
            
            if(createError) throw createError
            user = newUser
        } else if (userError)
        {
            throw userError
        } else
        {
            // 更新用户验证状态
            if(!user.phone_verified)
            {
                await supabase
                    .from('users')
                    .update({phone_verified:true})
                    .eq('id',user.id)
            }
        }

        // 生成认证 token
        const token = generateToken()
        const {error:tokenError} = await supabase
            .from('auth_tokens')
            .insert
            ({
                token,
                user_id: user.id,
                disabled: false,
            })
        
        if(tokenError) throw tokenError

        res.json
        ({
            result: 'ok',
            auth_token: token,
            phone: user.phone,
            id: user.id,
            address_type: 'phone',
        })
    } catch (error:any)
    {
        console.error('Sign in error:',error)
        res.status(500).json({result:'error',message: error.message || 'Failed to sign in'})
    }
}

// 获取当前用户信息
export const getMeController = async (req: Request, res:Response) =>
{
    try
    {
        const user= (req as any).user as User

        if(!user)
        {
            return res.status(401).json({result:'error',message:'Unauthorized'})
        }

        // 检查是否为系统管理员
        const { data: systemAdmin } = await supabase
            .from('system_admins')
            .select('id')
            .eq('user_id', user.id)
            .maybeSingle()

        // 统一字段名：将 image_url 映射为 avatar（前端使用）
        // 同时移除敏感字段（password_hash）
        const userResponse: any = {
            ...user,
            avatar: user.avatar || user.image_url,  // 优先使用 avatar，否则使用 image_url
            isSystemAdmin: !!systemAdmin,  // 是否为系统管理员
        }
        // 删除不需要返回的字段
        delete userResponse.image_url
        delete userResponse.password_hash  // 不返回密码哈希

        res.json(userResponse)
    } catch (error: any)
    {
        console.error('Get me error:' ,error)
        res.status(500).json({result:'error',message:error.message||'Failed to get user info'}) 
    }
}

// 根据 ID 获取用户信息（用于获取成员详情）
export const getUserByIdController = async (req: Request, res: Response) => {
    try {
        const { id } = req.params

        if (!id) {
            return res.status(400).json({ result: 'error', message: 'User ID is required' })
        }

        // 从数据库查询用户
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('id', id)
            .single()

        if (userError || !user) {
            return res.status(404).json({ result: 'error', message: 'User not found' })
        }

        // 统一字段名：将 image_url 映射为 avatar（前端使用）
        // 同时移除敏感字段（password_hash）
        const userResponse: any = {
            ...user,
            avatar: user.avatar || user.image_url,  // 优先使用 avatar，否则使用 image_url
        }
        // 删除不需要返回的字段
        delete userResponse.image_url
        delete userResponse.password_hash  // 不返回密码哈希

        res.json({
            result: 'ok',
            user: userResponse
        })
    } catch (error: any) {
        console.error('Get user by ID error:', error)
        res.status(500).json({ result: 'error', message: error.message || 'Failed to get user info' })
    }
}

// 获取所有用户列表（用于任务指定参与人员）
export const getAllUsersController = async (req: AuthRequest, res: Response) => {
    try {
        // 从数据库查询所有用户（只返回 id 和 name）
        const { data: users, error: usersError } = await supabase
            .from('users')
            .select('id, name, phone, email')
            .order('name', { ascending: true, nullsFirst: false })

        if (usersError) {
            return res.status(500).json({ result: 'error', message: usersError.message })
        }

        // 格式化返回数据
        const usersList = (users || []).map(user => ({
            id: user.id,
            name: user.name || user.phone || user.email || '未命名用户',
            phone: user.phone,
            email: user.email
        }))

        res.json({
            result: 'ok',
            users: usersList
        })
    } catch (error: any) {
        console.error('Get all users error:', error)
        res.status(500).json({ result: 'error', message: error.message || 'Failed to get users list' })
    }
}

// 更新用户资料
export interface UpdateProfileRequest {
  name?: string
  bio?: string
  avatar?: string
}

export const updateProfileController = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user as User

        if (!user) {
            return res.status(401).json({ result: 'error', message: 'Unauthorized' })
        }

        const { name, bio ,avatar }: UpdateProfileRequest = req.body

        // 构建更新对象（只包含提供的字段）
        const updateData: any = {}
        if (name !== undefined) updateData.name = name
        if (bio !== undefined) updateData.bio = bio
        if (avatar !== undefined) updateData.avatar = avatar

        // 如果没有要更新的字段
        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ result: 'error', message: 'No fields to update' })
        }

        // 更新用户信息
        const { data: updatedUser, error } = await supabase
            .from('users')
            .update(updateData)
            .eq('id', user.id)
            .select()
            .single()
        
        if (error) throw error

        res.json({
            result: 'ok',
            user: updatedUser
        })
    } catch (error: any) {
        console.error('Update profile error:', error)
        res.status(500).json({ result: 'error', message: error.message || 'Failed to update profile'})
    }
}

// 用户注册（使用密码）
export interface RegisterRequest {
    phone?: string
    email?: string
    password: string
    name?: string
}

export const registerController = async (req: Request, res: Response) => {
    try {
        const { phone: rawPhone, email, password, name }: RegisterRequest = req.body
        
        // 清理手机号：只保留数字字符，防止 URL 参数中包含额外字符（如字母）
        const phone = rawPhone ? cleanPhoneNumber(rawPhone) : undefined

        // 验证：必须提供手机号或邮箱，以及密码
        if (!password || password.length < 6) {
            return res.status(400).json({ 
                result: 'error', 
                message: '密码长度至少为6位' 
            })
        }

        if (!phone && !email) {
            return res.status(400).json({ 
                result: 'error', 
                message: '必须提供手机号或邮箱' 
            })
        }

        // 验证手机号格式
        if (phone && !/^\d{11}$/.test(phone)) {
            return res.status(400).json({ 
                result: 'error', 
                message: '手机号格式不正确' 
            })
        }

        // 验证邮箱格式
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ 
                result: 'error', 
                message: '邮箱格式不正确' 
            })
        }

        // 检查用户是否已存在
        let existingUser = null
        if (phone) {
            const { data } = await supabase
                .from('users')
                .select('id')
                .eq('phone', phone)
                .single()
            if (data) existingUser = data
        }
        
        if (!existingUser && email) {
            const { data } = await supabase
                .from('users')
                .select('id')
                .eq('email', email)
                .single()
            if (data) existingUser = data
        }

        if (existingUser) {
            return res.status(400).json({ 
                result: 'error', 
                message: phone ? '该手机号已被注册' : '该邮箱已被注册' 
            })
        }

        // 生成密码哈希
        const passwordHash = await hashPassword(password)

        // 创建新用户
        const userData: any = {
            password_hash: passwordHash,
            phone_verified: false,
        }
        
        if (phone) userData.phone = phone
        if (email) userData.email = email
        if (name) userData.name = name

        const { data: newUser, error: createError } = await supabase
            .from('users')
            .insert(userData)
            .select()
            .single()

        if (createError) {
            console.error('Create user error:', createError)
            throw createError
        }

        // 生成认证 token
        const token = generateToken()
        const { error: tokenError } = await supabase
            .from('auth_tokens')
            .insert({
                token,
                user_id: newUser.id,
                disabled: false,
            })

        if (tokenError) throw tokenError

        // 统一字段名：将 image_url 映射为 avatar
        const userResponse: any = {
            ...newUser,
            avatar: newUser.avatar || newUser.image_url,
        }
        delete userResponse.image_url
        delete userResponse.password_hash  // 不返回密码哈希

        res.json({
            result: 'ok',
            auth_token: token,
            user: userResponse,
            address_type: phone ? 'phone' : 'email',
        })
    } catch (error: any) {
        console.error('Register error:', error)
        res.status(500).json({ 
            result: 'error', 
            message: error.message || '注册失败' 
        })
    }
}

// 密码登录
export interface PasswordLoginRequest {
    phone?: string
    email?: string
    password: string
}

export const passwordLoginController = async (req: Request, res: Response) => {
    try {
        const { phone: rawPhone, email, password }: PasswordLoginRequest = req.body
        
        // 清理手机号：只保留数字字符，防止 URL 参数中包含额外字符（如字母）
        const phone = rawPhone ? cleanPhoneNumber(rawPhone) : undefined

        if (!password) {
            return res.status(400).json({ 
                result: 'error', 
                message: '密码不能为空' 
            })
        }

        if (!phone && !email) {
            return res.status(400).json({ 
                result: 'error', 
                message: '必须提供手机号或邮箱' 
            })
        }

        // 查找用户
        let user = null
        if (phone) {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('phone', phone)
                .single()
            if (error && error.code !== 'PGRST116') throw error
            user = data
        } else if (email) {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('email', email)
                .single()
            if (error && error.code !== 'PGRST116') throw error
            user = data
        }

        if (!user || !user.password_hash) {
            return res.status(400).json({ 
                result: 'error', 
                message: '用户不存在或未设置密码' 
            })
        }

        // 验证密码
        const isValid = await verifyPassword(password, user.password_hash)
        if (!isValid) {
            return res.status(400).json({ 
                result: 'error', 
                message: '密码错误' 
            })
        }

        // 生成认证 token
        const token = generateToken()
        const { error: tokenError } = await supabase
            .from('auth_tokens')
            .insert({
                token,
                user_id: user.id,
                disabled: false,
            })

        if (tokenError) throw tokenError

        // 统一字段名：将 image_url 映射为 avatar
        const userResponse: any = {
            ...user,
            avatar: user.avatar || user.image_url,
        }
        delete userResponse.image_url
        delete userResponse.password_hash  // 不返回密码哈希

        res.json({
            result: 'ok',
            auth_token: token,
            user: userResponse,
            address_type: phone ? 'phone' : 'email',
        })
    } catch (error: any) {
        console.error('Password login error:', error)
        res.status(500).json({ 
            result: 'error', 
            message: error.message || '登录失败' 
        })
    }
}

// 设置密码（验证码验证后）
export interface SetPasswordRequest {
    phone: string
    code: string
    password: string
}

export const setPasswordController = async (req: Request, res: Response) => {
    try {
        const { phone: rawPhone, code, password }: SetPasswordRequest = req.body

        if (!rawPhone || !code || !password) {
            return res.status(400).json({ 
                result: 'error', 
                message: '手机号、验证码和密码都是必需的' 
            })
        }
        
        // 清理手机号：只保留数字字符，防止 URL 参数中包含额外字符（如字母）
        const phone = cleanPhoneNumber(rawPhone)

        if (!phone || !/^\d{11}$/.test(phone)) {
            return res.status(400).json({ 
                result: 'error', 
                message: '手机号格式不正确' 
            })
        }

        if (password.length < 6) {
            return res.status(400).json({ 
                result: 'error', 
                message: '密码长度至少为6位' 
            })
        }

        // 查找验证码
        const { data: verificationToken, error: findError } = await supabase
            .from('verification_tokens')
            .select('*')
            .eq('context', 'phone-login')
            .eq('sent_to', phone)
            .eq('code', code)
            .eq('used', false)
            .single()
        
        if (findError || !verificationToken) {
            return res.status(400).json({ 
                result: 'error', 
                message: '验证码无效' 
            })
        }

        // 检查是否过期
        if (new Date() > new Date(verificationToken.expires_at)) {
            return res.status(400).json({ 
                result: 'error', 
                message: '验证码已过期' 
            })
        }

        // 标记验证码为已使用
        await supabase
            .from('verification_tokens')
            .update({ used: true })
            .eq('id', verificationToken.id)

        // 查找用户
        let { data: user, error: userError } = await supabase 
            .from('users')
            .select('*')
            .eq('phone', phone)
            .single()
        
        if (userError && userError.code === 'PGRST116') {
            // 用户不存在，创建新用户
            const passwordHash = await hashPassword(password)
            const { data: newUser, error: createError } = await supabase
                .from('users')
                .insert({
                    phone,
                    phone_verified: true,
                    password_hash: passwordHash,
                })
                .select()
                .single()
            
            if (createError) throw createError
            user = newUser
        } else if (userError) {
            throw userError
        } else {
            // 用户存在，更新密码
            const passwordHash = await hashPassword(password)
            const { data: updatedUser, error: updateError } = await supabase
                .from('users')
                .update({
                    password_hash: passwordHash,
                    phone_verified: true,
                })
                .eq('id', user.id)
                .select()
                .single()
            
            if (updateError) throw updateError
            user = updatedUser
        }

        // 生成认证 token
        const token = generateToken()
        const { error: tokenError } = await supabase
            .from('auth_tokens')
            .insert({
                token,
                user_id: user.id,
                disabled: false,
            })

        if (tokenError) throw tokenError

        // 统一字段名：将 image_url 映射为 avatar
        const userResponse: any = {
            ...user,
            avatar: user.avatar || user.image_url,
        }
        delete userResponse.image_url
        delete userResponse.password_hash  // 不返回密码哈希

        res.json({
            result: 'ok',
            auth_token: token,
            user: userResponse,
            address_type: 'phone',
        })
    } catch (error: any) {
        console.error('Set password error:', error)
        res.status(500).json({ 
            result: 'error', 
            message: error.message || '设置密码失败' 
        })
    }
}

// 同步 semi 用户信息到 mycoseed
export interface SyncFromSemiRequest {
    id: string
    phone?: string
    email?: string
    handle?: string
    image_url?: string
    evm_chain_address?: string
    evm_chain_active_key?: string
    encrypted_keys?: any
    remaining_gas_credits?: number
    total_used_gas_credits?: number
    can_send_badge?: boolean
}

export const syncFromSemiController = async (req: Request, res: Response) => {
    try {
        const semiUserData: SyncFromSemiRequest = req.body 

        // 验证必要字段
        if (!semiUserData.id) {
            return res.status(400).json({ result: 'error', message: 'Semi user ID is required'})
        }

        // 用户查找优先级：semi_id > phone > email
        let user = null
        let userError = null

        // 1. 优先用 semi_id 查找（最可靠）
        if (semiUserData.id) {
            const result = await supabase
                .from('users')
                .select('*')
                .eq('semi_id', semiUserData.id)
                .maybeSingle()  // 使用 maybeSingle 避免空结果报错
            user = result.data
            userError = result.error
            // 如果有真正的错误（不是 maybeSingle 的 null），立即抛出
            if (userError) {
                throw userError
            }
        }

        // 2. 如果没有找到，用 phone 查找
        if (!user && semiUserData.phone && semiUserData.phone.trim() !== '') {
            const result = await supabase
                .from('users')
                .select('*')
                .eq('phone', semiUserData.phone.trim())
                .maybeSingle()
            user = result.data
            userError = result.error
            // 如果有真正的错误，立即抛出
            if (userError) {
                throw userError
            }
        }

        // 3. 如果还没找到，用 email 查找
        if (!user && semiUserData.email && semiUserData.email.trim() !== '') {
            const result = await supabase
                .from('users')
                .select('*')
                .eq('email', semiUserData.email.trim())
                .maybeSingle()
            user = result.data
            userError = result.error
            // 如果有真正的错误，立即抛出
            if (userError) {
                throw userError
            }
        }

        // 如果用户不存在，创建新用户
        if (!user) {
            // 如果有真正的错误（不是 maybeSingle 的 null），抛出错误
            if (userError) {
                throw userError
            }
            
            // 没有找到用户且没有错误，创建新用户
            const { data: newUser, error: createError } = await supabase
                .from('users')
                .insert({
                    semi_id: semiUserData.id,  // 保存 Semi ID
                    phone: semiUserData.phone?.trim() || null,
                    email: semiUserData.email?.trim() || null,
                    handle: semiUserData.handle || null,
                    name: semiUserData.handle || null,  // 将 handle 映射到 name
                    image_url: semiUserData.image_url || null,
                    evm_chain_address: semiUserData.evm_chain_address || null,
                    evm_chain_active_key: semiUserData.evm_chain_active_key || null,
                    encrypted_keys: semiUserData.encrypted_keys || null,
                    phone_verified: !!semiUserData.phone,
                })
                .select()
                .single()

            if (createError) throw createError
            user = newUser
        } else if (user) {
            // 用户已存在，更新 semi 的信息（保留业务数据 name, bio, avatar)
            const updateData: any = {}

            // 始终更新 semi_id（如果之前没有）
            if (semiUserData.id && !user.semi_id) {
                updateData.semi_id = semiUserData.id
            }

            // 更新其他字段
            if (semiUserData.email?.trim()) updateData.email = semiUserData.email.trim()
            if (semiUserData.handle) {
                // 如果用户还没有 name，用 handle 填充
                if (!user.name) {
                    updateData.name = semiUserData.handle
                }
                updateData.handle = semiUserData.handle
            }
            if (semiUserData.image_url) updateData.image_url = semiUserData.image_url
            if (semiUserData.evm_chain_address) updateData.evm_chain_address = semiUserData.evm_chain_address
            if (semiUserData.evm_chain_active_key) updateData.evm_chain_active_key = semiUserData.evm_chain_active_key
            if (semiUserData.encrypted_keys) updateData.encrypted_keys = semiUserData.encrypted_keys
            if (semiUserData.phone?.trim()) {
                updateData.phone = semiUserData.phone.trim()
                updateData.phone_verified = true
            }

            // 只有有更新字段时才执行更新
            if (Object.keys(updateData).length > 0) {
                const { data: updatedUser, error: updateError} = await supabase
                    .from('users')
                    .update(updateData)
                    .eq('id', user.id)
                    .select()
                    .single()

                if (updateError) throw updateError
                user = updatedUser
            }
        }
        
        // 生成 mycoseed 的 auth_token
        const token = generateToken()
        const { error: tokenError } = await supabase
            .from('auth_tokens')
            .insert({
                token,
                user_id: user.id,
                disabled: false,
            })

        if (tokenError) throw tokenError

        // 返回结果
        res.json({
            result: 'ok',
            auth_token: token,
            user: {
                ...user,
                avatar: user.avatar || user.image_url
            }
        })
    } catch (error: any) {
        console.error('Sync from Semi error:', error)
        res.status(500).json({ result: 'error', message: error.message || 'Failed to sync user from Semi'})
    }
}