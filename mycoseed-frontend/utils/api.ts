// ==================== 常量定义 ====================

// 默认社区 UUID（南塘，与后端迁移一致）
export const DEFAULT_COMMUNITY_UUID = '00000000-0000-0000-0000-000000000002'

// ==================== 数据类型定义 ====================

export interface ProofFile
{
  url: string
  hash:string
  name:string
  size:number
  type:string
}

export interface GPSData
{
  latitude:number
  longitude:number
  accuracy?:number  // 精度字段改为可选，不再使用
  timestamp:string
}

export interface ProofData
{
  description:string
  files:ProofFile[]
  gps?:GPSData
  submittedAt:string
}

/**
 * 活动数据结构
 */
export interface Activity {
  id: number
  name: string                    // 活动名称
  location: string                // 活动地点
  startTime: string              // 活动开始时间 (ISO 8601 格式)
  endTime: string                // 活动结束时间 (ISO 8601 格式)
  description: string            // 活动描述
  image: string                  // 活动封面图片 URL
  organizer: string              // 主办方
  participants: number           // 当前参与人数
  maxParticipants: number        // 最大参与人数
  status: 'upcoming' | 'ongoing' | 'ended'  // 活动状态
  tags: string[]                 // 活动标签
}

/**
 * 创建活动参数
 */
export interface CreateActivityParams {
  name: string
  description: string
  startTime: string
  endTime: string
  location?: string
  reward?: number
  maxParticipants?: number
  organizer?: string
  tags?: string[]
}

/**
 * 任务数据结构
 */
/**
 * 任务时间线状态项（记录所有状态变化）
 */
export interface TimelineStatus {
  status: 'unclaimed' | 'claimed' | 'unsubmit' | 'submitted' | 'under_review' | 'completed' | 'rejected' | 'resubmit' | 'reclaim'  // 状态值
  actorId?: string                              // 操作者ID
  actorName?: string                            // 操作者名称
  action?: string                               // 操作选项（如 '审核驳回'、'重新提交'、'重新发布' 等）
  reason?: string                               // 操作理由（如驳回原因、审核意见等）
  timestamp: string                             // 状态变化时间
}

export interface Task {
  id: string                     // 任务ID (UUID)
  activityId: number             // 所属活动ID
  title: string                  // 任务标题
  description: string            // 任务描述
  reward: number                 // 奖金（ETH）
  participantLimit?: number | null // 参与人数上限（null 表示不限）
  rewardDistributionMode?: 'per_person' | 'total' // 奖励分配模式：每人积分或总积分
  proof?: string                 // 完成凭证
  proofConfig?: any              // 证明配置（提交要求）
  submissionInstructions?: string // 提交说明（备注）
  status: 'unclaimed' | 'claimed' | 'unsubmit' | 'submitted' | 'under_review' | 'completed' | 'rejected'  // 任务状态
  rejectReason?: string          // 驳回理由
  rejectOption?: 'resubmit' | 'reclaim' | 'rejected'  // 驳回选项（用于区分驳回类型）
  discount?: number              // 打折百分数
  discountReason?: string        // 打折理由
  creatorId?: string             // 创建者ID (UUID)
  creatorName?: string           // 创建者名称
  claimerId?: string             // 接单者ID (UUID)（单人任务）
  claimerName?: string           // 接单者名称（单人任务）
  assignedUserId?: string        // 指定参与人员ID（可选，如果指定，则只有该用户可以领取）
  participantsList?: Array<{    // 参与者列表（多人任务）
    id: string
    name: string
    claimedAt: string
    submittedAt?: string
    proof?: string
    status?: string
    transferredAt?: string     // 转账完成时间
  }>
  timeline?: TimelineStatus[]     // 任务时间线（状态数组，仅追加写入，通过最后一个元素获取最新状态）
  createdAt?: string             // 创建时间
  updatedAt?: string             // 更新时间
  startDate?: string             // 报名开始日期
  deadline?: string              // 报名截止日期
  submitDeadline?: string        // 提交截止日期
  claimedAt?: string             // 领取时间（单人任务）
  submittedAt?: string           // 提交时间（单人任务）
  completedAt?: string           // 完成时间
  transferredAt?: string        // 转账完成时间
}

// ==================== Mock 数据 ====================

const mockActivities: Activity[] = [
  {
    id: 1,
    name: 'ETH 上海黑客松 2025',
    location: '上海市浦东新区世纪大道 8 号',
    startTime: '2025-10-25T09:00:00+08:00',
    endTime: '2025-10-27T18:00:00+08:00',
    description: '为期三天的以太坊黑客松活动，汇聚全球优秀开发者，共同探索 Web3 的未来。',
    image: '/images/eth_logo.png',
    organizer: 'ETH 上海社区',
    participants: 156,
    maxParticipants: 300,
    status: 'upcoming',
    tags: ['区块链', '黑客松', 'Web3', 'DeFi']
  },
  {
    id: 2,
    name: '区块链技术分享会',
    location: '北京市朝阳区建国门外大街 1 号',
    startTime: '2025-10-20T14:00:00+08:00',
    endTime: '2025-10-20T17:00:00+08:00',
    description: '深入探讨区块链技术的最新发展，包括 Layer2、零知识证明等前沿技术。',
    image: '/images/eth_logo.png',
    organizer: '北京区块链协会',
    participants: 89,
    maxParticipants: 150,
    status: 'ongoing',
    tags: ['技术分享', 'Layer2', '零知识证明']
  },
  {
    id: 3,
    name: 'DeFi 开发者 Workshop',
    location: '深圳市南山区科技园南区',
    startTime: '2025-11-05T10:00:00+08:00',
    endTime: '2025-11-05T16:00:00+08:00',
    description: '手把手教你开发 DeFi 应用，从智能合约到前端开发全流程讲解。',
    image: '/images/eth_logo.png',
    organizer: '深圳 Web3 开发者社区',
    participants: 45,
    maxParticipants: 80,
    status: 'upcoming',
    tags: ['DeFi', 'Workshop', '智能合约', 'Solidity']
  },
  {
    id: 4,
    name: 'NFT 艺术展览',
    location: '杭州市西湖区文三路 138 号',
    startTime: '2025-09-15T10:00:00+08:00',
    endTime: '2025-09-17T20:00:00+08:00',
    description: '展示优秀的 NFT 艺术作品，探讨数字艺术与区块链的结合。',
    image: '/images/eth_logo.png',
    organizer: '杭州数字艺术馆',
    participants: 234,
    maxParticipants: 500,
    status: 'ended',
    tags: ['NFT', '艺术', '展览']
  },
  {
    id: 5,
    name: 'Web3 创业路演',
    location: '成都市高新区天府大道',
    startTime: '2025-11-12T13:00:00+08:00',
    endTime: '2025-11-12T18:00:00+08:00',
    description: '为 Web3 创业项目提供展示机会，与投资人面对面交流。',
    image: '/images/eth_logo.png',
    organizer: '成都创投联盟',
    participants: 67,
    maxParticipants: 120,
    status: 'upcoming',
    tags: ['创业', 'Web3', '投资', '路演']
  }
]

// 任务数据（从 localStorage 加载，不包含 mock 数据）
let tasks: Task[] = []

// 用户已领取的任务ID列表
let claimedTaskIds: number[] = []

// 从 localStorage 加载任务
const loadTasks = (): Task[] => {
  if (typeof window === 'undefined') {
    return []
  }
  
  try {
    const savedTasks = localStorage.getItem('tasks')
    if (savedTasks) {
      return JSON.parse(savedTasks) as Task[]
    }
  } catch (e) {
    console.warn('Failed to load tasks from localStorage:', e)
  }
  
  return []
}

// 初始化任务列表（从 localStorage 加载）
tasks = loadTasks()

// 将任务列表持久化到 localStorage，保持状态同步
const persistTasks = () => {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('tasks', JSON.stringify(tasks))
    } catch (e) {
      console.warn('Failed to save tasks to localStorage:', e)
    }
  }
}

// ==================== 交易记录和积分存储 ====================

// 交易记录存储（按用户ID存储）
const getTransactionsKey = (userId: number | string) => `transactions_${userId}`

/**
 * 获取用户的交易记录
 * @param userId 用户ID (string | number)
 */
export const getTransactions = async (userId: number | string): Promise<Transaction[]> => {
  await new Promise(resolve => setTimeout(resolve, 200))
  
  if (typeof window === 'undefined') {
    return []
  }
  
  try {
    const key = getTransactionsKey(userId)
    const saved = localStorage.getItem(key)
    if (saved) {
      const transactions = JSON.parse(saved) as Transaction[]
      // 按时间倒序排列（最新的在前）
      return transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    }
  } catch (e) {
    console.warn('Failed to load transactions from localStorage:', e)
  }
  
  return []
}

/**
 * 添加交易记录
 * @param userId 用户ID (string | number)
 * @param transaction 交易记录
 */
export const addTransaction = async (userId: number | string, transaction: Transaction): Promise<void> => {
  if (typeof window === 'undefined') {
    return
  }
  
  try {
    const key = getTransactionsKey(userId)
    const existing = await getTransactions(userId)
    
    // 生成新ID（使用当前最大ID + 1）
    const newId = existing.length > 0 
      ? Math.max(...existing.map(t => t.id)) + 1 
      : 1
    
    const newTransaction: Transaction = {
      ...transaction,
      id: newId
    }
    
    existing.unshift(newTransaction) // 添加到最前面
    
    localStorage.setItem(key, JSON.stringify(existing))
  } catch (e) {
    console.warn('Failed to save transaction to localStorage:', e)
  }
}

// 用户积分存储（按用户ID存储）
const getUserPointsKey = (userId: number | string) => `user_points_${userId}`

/**
 * 获取用户的社区积分
 * @param userId 用户ID (string | number)
 * @param communityId 社区ID
 */
export const getUserCommunityPoints = async (userId: string | number, communityId: number): Promise<number> => {
  await new Promise(resolve => setTimeout(resolve, 200))
  
  if (typeof window === 'undefined') {
    return 0
  }
  
  try {
    const key = getUserPointsKey(String(userId))
    const saved = localStorage.getItem(key)
    if (saved) {
      const points = JSON.parse(saved) as Record<number, number>
      return points[communityId] || 0
    }
  } catch (e) {
    console.warn('Failed to load user points from localStorage:', e)
  }
  
  return 0
}

/**
 * 更新用户的社区积分
 * @param userId 用户ID (string | number)
 * @param communityId 社区ID
 * @param points 积分数量（正数表示增加，负数表示减少）
 */
export const updateUserCommunityPoints = async (userId: number | string, communityId: number, points: number): Promise<number> => {
  if (typeof window === 'undefined') {
    return 0
  }
  
  try {
    const key = getUserPointsKey(String(userId))
    let userPoints: Record<number, number> = {}
    
    const saved = localStorage.getItem(key)
    if (saved) {
      userPoints = JSON.parse(saved)
    }
    
    const currentPoints = userPoints[communityId] || 0
    const newPoints = Math.max(0, currentPoints + points) // 确保积分不为负数
    userPoints[communityId] = newPoints
    
    localStorage.setItem(key, JSON.stringify(userPoints))
    return newPoints
  } catch (e) {
    console.warn('Failed to update user points in localStorage:', e)
    return 0
  }
}

/**
 * 获取用户的所有积分（所有社区）
 * @param userId 用户ID (string | number)
 */
export const getUserPoints = async (userId: number | string): Promise<Record<number, number>> => {
  await new Promise(resolve => setTimeout(resolve, 200))
  
  if (typeof window === 'undefined') {
    return {}
  }
  
  try {
    const key = getUserPointsKey(String(userId))
    const saved = localStorage.getItem(key)
    if (saved) {
      return JSON.parse(saved) as Record<number, number>
    }
  } catch (e) {
    console.warn('Failed to load user points from localStorage:', e)
  }
  
  return {}
}

// ==================== 辅助函数 ====================

/**
 * 计算任务的最终奖金
 * @param task 任务
 * @returns 最终奖金
 */
export const getFinalReward = (task: Task): number => {
  if (task.discount && task.discount > 0 && task.discount <= 100) {
    return task.reward * (task.discount / 100)
  }
  return task.reward
}

const getAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }

  if (typeof window !== 'undefined') {
    const token = getCookie(AUTH_TOKEN_KEY)
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
  }

  return headers
}

/**
 * 获取 API 基础 URL
 * 优先从环境变量读取，否则使用默认值
 */
export const getApiBaseUrl = (): string => {
  // 优先使用环境变量（兼容客户端和服务器端）
  if (typeof window !== 'undefined') {
    // 客户端环境：使用 import.meta.env
    const env = (import.meta as any).env
    if (env?.NUXT_PUBLIC_API_URL) {
      return env.NUXT_PUBLIC_API_URL
    }
  } else {
    // 服务器端环境：使用 process.env
    const processEnv = (globalThis as any).process?.env || {}
    if (processEnv.NUXT_PUBLIC_API_URL) {
      return processEnv.NUXT_PUBLIC_API_URL
    }
  }
  
  // 尝试从 Nuxt 运行时配置获取（如果可用）
  if (typeof window !== 'undefined') {
    try {
      const nuxtApp = (window as any).__NUXT__
      if (nuxtApp?.config?.public?.apiUrl) {
        return nuxtApp.config.public.apiUrl
      }
    } catch (e) {
      // 忽略错误
    }
  }
  
  // 默认值（开发环境）
  return 'http://localhost:3001'
}

// ==================== 活动相关 API ====================

/**
 * 获取所有活动列表
 * @param status 可选：按状态筛选活动
 * TODO: 等待后端实现活动 API
 */
export const getActivities = async (status?: Activity['status']): Promise<Activity[]> => {
  console.warn('活动 API 暂未实现，返回空数组')
  return []
}

/**
 * 根据 ID 获取单个活动详情
 * @param id 活动 ID
 * TODO: 等待后端实现活动 API
 */
export const getActivityById = async (id: number): Promise<Activity | null> => {
  console.warn('活动 API 暂未实现，返回 null')
  return null
}

/**
 * 报名参加活动
 * @param id 活动 ID
 * TODO: 等待后端实现活动 API
 */
export const joinActivity = async (id: number): Promise<{ success: boolean; message: string }> => {
  console.warn('活动 API 暂未实现，返回错误消息')
  return { success: false, message: '活动功能暂未实现，等待后端开发' }
}

/**
 * 创建活动
 * @param params 活动参数
 * TODO: 等待后端实现活动 API
 */
export const createActivity = async (params: CreateActivityParams): Promise<Activity> => {
  // 模拟网络延迟
  await new Promise(resolve => setTimeout(resolve, 500))
  
  console.warn('Activities API not implemented yet')
  
  // 返回Mock数据，让页面可以正常渲染
  return {
    id: Date.now(), // 临时ID
    name: params.name,
    description: params.description,
    location: params.location || '',
    startTime: params.startTime,
    endTime: params.endTime,
    image: '',
    organizer: params.organizer || '',
    participants: 0,
    maxParticipants: params.maxParticipants || 0,
    status: 'upcoming',
    tags: params.tags || []
  }
}

// ==================== 任务相关 API ====================

/**
 * 获取活动的任务列表
 * @param activityId 活动 ID
 * @param baseUrl API 基础 URL
 */
export const getTasks = async (activityId: number, baseUrl: string): Promise<Task[]> => {
  try {
    // 获取所有任务，然后在前端过滤
    const allTasks = await getAllTasks(baseUrl)
    return allTasks.filter(task => task.activityId === activityId)
  } catch (error: any) {
    console.error('Get tasks error:', error)
    throw error
  }
}

/**
 * 根据 ID 获取单个任务详情（带缓存）
 * @param id 任务 ID (UUID string)
 * @param baseUrl API 基础 URL
 * @param useCache 是否使用缓存，默认 true
 * @param cacheTTL 缓存时间（毫秒），默认 5000ms
 */
export const getTaskById = async (
  id: string, 
  baseUrl: string, 
  useCache: boolean = true,
  cacheTTL: number = 5000
): Promise<Task | null> => {
  try {
    // 检查缓存
    if (useCache) {
      const { responseCache } = await import('./cache')
      const cached = responseCache.get<Task>(`task:${id}`)
      if (cached) {
        return cached
      }
    }

    const response = await fetch(`${baseUrl}/api/tasks/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      if (response.status === 404) {
        return null
      }
      const error = await response.json()
      throw new Error(error.error || '获取任务失败')
    }

    const data = await response.json()
    
    // 处理单个任务格式
    return data as Task
  } catch (error: any) {
    console.error('Get task by id error:', error)
    throw error
  }
}

/**
 * 获取所有任务列表
 * @param baseUrl API 基础 URL
 */
/** 获取任务列表；传入 communityId 时仅返回该社区任务 */
export const getAllTasks = async (baseUrl: string, communityId?: string | null): Promise<Task[]> => {
  try {
    const params = communityId ? `?communityId=${encodeURIComponent(communityId)}` : ''
    const response = await fetch(`${baseUrl}/api/tasks${params}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || '获取任务列表失败')
    }

    const tasks: Task[] = await response.json()
    return tasks
  } catch (error: any) {
    console.error('Get all tasks error:', error)
    throw error
  }
}

/**
 * 创建新任务
 */
export interface CreateTaskParams {
  title: string
  description: string
  reward: number
  startDate: string
  deadline: string  // 报名截止日期
  submitDeadline?: string  // 提交截止日期
  proofConfig?: any
  participantLimit?: number | null
  rewardDistributionMode?: 'per_person' | 'total'
  submissionInstructions?: string
  assignedUserId?: string  // 指定参与人员ID（可选，向后兼容）
  assignedUserIds?: string[]  // 指定参与人员ID列表（多人任务）
  communityId?: string  // 所属社区 ID，不传则任务不归属任何社区
}

/**
 * 创建新任务
 * @param params 任务参数
 * @param baseUrl API 基础 URL
 */
export const createTask = async (params: CreateTaskParams, baseUrl: string): Promise<Task> => {
  try {
    console.log('[API] createTask - 请求参数:', params)
    console.log('[API] createTask - Base URL:', baseUrl)
    
    const requestBody = {
      title: params.title,
      description: params.description,
      reward: params.reward,
      startDate: params.startDate,
      deadline: params.deadline,
      submitDeadline: params.submitDeadline,
      proofConfig: params.proofConfig || null,
      participantLimit: params.participantLimit ?? null,
      rewardDistributionMode: params.rewardDistributionMode || 'per_person',
      submissionInstructions: params.submissionInstructions,
      assignedUserId: params.assignedUserId || undefined,
      assignedUserIds: params.assignedUserIds || undefined,
      communityId: params.communityId || undefined,
    }
    
    console.log('[API] createTask - 请求体:', requestBody)
    console.log('[API] createTask - Auth headers:', getAuthHeaders())
    
    const response = await fetch(`${baseUrl}/api/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(requestBody),
    })

    console.log('[API] createTask - 响应状态:', response.status, response.statusText)
    console.log('[API] createTask - 响应头:', Object.fromEntries(response.headers.entries()))

    if (!response.ok) {
      let errorMessage = '创建任务失败'
      try {
        const errorData = await response.json()
        console.error('[API] createTask - 错误响应:', errorData)
        errorMessage = errorData.error || errorData.message || errorMessage
      } catch (e) {
        const text = await response.text()
        console.error('[API] createTask - 错误响应文本:', text)
        errorMessage = text || errorMessage
      }
      throw new Error(errorMessage)
    }

    const task: Task = await response.json()
    console.log('[API] createTask - 成功，返回任务:', task)
    return task
  } catch (error: any) {
    console.error('[API] createTask - 捕获错误:', error)
    console.error('[API] createTask - 错误类型:', typeof error)
    console.error('[API] createTask - 错误消息:', error?.message)
    console.error('[API] createTask - 错误堆栈:', error?.stack)
    throw error
  }
}

/**
 * 领取任务
 * @param taskId 任务 ID (UUID string)
 * @param baseUrl API 基础 URL
 * @param userIdentifier 用户标识（可选，如果已登录则从 getMe 获取用户ID）
 */
export const claimTask = async (taskId: string, baseUrl: string, userIdentifier?: string): Promise<{ success: boolean; message: string }> => {
  try {
    // 如果没有提供 userIdentifier，尝试从当前登录用户获取
    let userId = userIdentifier
    if (!userId) {
      try {
        const user = await getMe(baseUrl)
        userId = user.id
      } catch (e) {
        // 如果未登录，使用临时标识符（从 localStorage 获取）
        if (typeof window !== 'undefined') {
          userId = localStorage.getItem('current_identifier') || undefined
        }
      }
    }

    const response = await fetch(`${baseUrl}/api/tasks/${taskId}/claim`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        userIdentifier: userId,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      return { success: false, message: error.message || '领取任务失败' }
    }

    const result = await response.json()
    return result
  } catch (error: any) {
    console.error('Claim task error:', error)
    return { success: false, message: error.message || '领取任务失败' }
  }
}

/**
 * 获取我的任务列表
 * @param baseUrl API 基础 URL
 */
export const getMyTasks = async (baseUrl: string): Promise<Task[]> => {
  try {
    // 获取所有任务，然后在前端过滤（需要根据用户ID过滤）
    // 注意：这个功能需要后端支持，或者前端根据 task_claims 表查询
    // 目前先返回所有任务，后续可以优化
    const allTasks = await getAllTasks(baseUrl)
    
    // 尝试获取当前用户ID
    try {
      const user = await getMe(baseUrl)
      if (!user?.id) {
        return []
      }
      
      // 返回用户发布的任务或用户领取的任务
      // 包括所有状态：未领取、已领取、待提交、审核中、已完成、已驳回等
      return allTasks.filter(task => 
        task.creatorId === user.id ||  // 用户发布的任务
        task.claimerId === user.id      // 用户领取的任务
      )
    } catch (e) {
      // 如果未登录，返回空数组
      return []
    }
  } catch (error: any) {
    console.error('Get my tasks error:', error)
    throw error
  }
}

/**
 * 提交任务完成凭证
 * @param taskId 任务 ID (UUID string)
 * @param proof 凭证数据
 * @param baseUrl API 基础 URL
 */
export const submitProof = async (taskId: string, proof: ProofData, baseUrl: string): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await fetch(`${baseUrl}/api/tasks/${taskId}/submit`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        proof: proof, // 直接传递对象，后端会序列化
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      return { success: false, message: error.message || '提交凭证失败' }
    }

    const result = await response.json()
    return result
  } catch (error: any) {
    console.error('Submit proof error:', error)
    return { success: false, message: error.message || '提交凭证失败' }
  }
}

/**
 * 获取审核中的任务列表
 * @param baseUrl API 基础 URL
 */
export const getReviewTasks = async (baseUrl: string): Promise<Task[]> => {
  try {
    // 从后端获取所有任务，然后过滤出审核中的任务
    const allTasks = await getAllTasks(baseUrl)
    return allTasks.filter(task => task.status === 'under_review')
  } catch (error) {
    console.error('Get review tasks error:', error)
    return []
  }
}

/**
 * 审核通过任务
 * @param taskId 任务 ID (UUID string)
 * @param baseUrl API 基础 URL
 * @param comments 可选的审核评语
 */
export const approveTask = async (taskId: string, baseUrl: string, comments?: string): Promise<{ 
  success: boolean; 
  message: string;
  data?: {
    claimerId: string;
    reward: number;
    creatorId: string;
  }
}> =>
{
  try
  {
    const response = await fetch(`${baseUrl}/api/tasks/${taskId}/approve`,
      {
        method: 'PATCH',
        headers: 
        {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: comments ? JSON.stringify({ comments }) : undefined,
      }
    )

    if (!response.ok)
    {
      const error = await response.json()
      return {
        success: false,
        message: error.message || '审核失败'
      }
    }

    const result = await response.json()
    return result
  } catch (error: any)
  {
    console.error('Approve task error:', error)
    return { success: false, message: error.message || '审核失败'}
  }
}

/**
 * 标记转账完成
 * @param taskId 任务 ID (UUID string)
 * @param baseUrl API 基础 URL
 */
export const markTransferCompleted = async (taskId: string, baseUrl: string): Promise<{ 
  success: boolean; 
  message: string;
  data?: {
    transferredAt: string;
  }
}> => {
  try {
    const response = await fetch(`${baseUrl}/api/tasks/${taskId}/mark-transfer-completed`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
      }
    )

    if (!response.ok) {
      const error = await response.json()
      return {
        success: false,
        message: error.message || '标记转账失败'
      }
    }

    const result = await response.json()
    return result
  } catch (error: any) {
    console.error('Mark transfer completed error:', error)
    return { success: false, message: error.message || '标记转账失败' }
  }
}

export const unmarkTransferCompleted = async (taskId: string, baseUrl: string): Promise<{ 
  success: boolean; 
  message: string;
  data?: {
    transferredAt: null;
  }
}> => {
  try {
    const response = await fetch(`${baseUrl}/api/tasks/${taskId}/unmark-transfer-completed`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
      }
    )

    if (!response.ok) {
      const error = await response.json()
      return {
        success: false,
        message: error.message || '取消转账标记失败'
      }
    }

    const result = await response.json()
    return {
      success: result.success,
      message: result.message,
      data: result.data
    }
  } catch (error: any) {
    console.error('Unmark transfer completed error:', error)
    return { success: false, message: error.message || '取消转账标记失败' }
  }
}

/**
 * 驳回任务
 * @param taskId 任务 ID (UUID string)
 * @param reason 驳回理由
 * @param baseUrl API 基础 URL
 * @param rejectOption 驳回选项：
 *   - 'resubmit': 重新提交证明（状态回到 unsubmit）
 *   - 'reclaim': 重新发布任务（状态回到 unclaimed）
 *   - 'rejected': 终止任务（状态变为 rejected，任务关闭并放入已失效）
 */
export const rejectTask = async (taskId: string, reason: string, baseUrl: string, rejectOption?: 'resubmit' | 'reclaim' | 'rejected'): Promise<{ success: boolean; message: string }> =>
{
  try
  {
    // 构建请求体，确保 rejectOption 总是被包含（如果存在）
    const body: any = { reason }
    if (rejectOption) {
      body.rejectOption = rejectOption
    }
    
    console.log('[API] rejectTask 调用 - taskId:', taskId)
    console.log('[API] rejectTask 调用 - reason:', reason)
    console.log('[API] rejectTask 调用 - rejectOption:', rejectOption)
    console.log('[API] rejectTask 调用 - body:', JSON.stringify(body, null, 2))
    
    const response = await fetch(`${baseUrl}/api/tasks/${taskId}/reject`,
      {
        method: 'PATCH',
        headers:
        {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(body),
      }
    )

    console.log('[API] rejectTask 响应 - status:', response.status, response.statusText)

    if (!response.ok)
    {
      const error = await response.json()
      console.error('[API] rejectTask 错误响应:', error)
      return { success: false, message: error.message || '审核失败'}
    }

    const result = await response.json()
    console.log('[API] rejectTask 成功响应:', result)
    return result
  } catch (error: any)
  {
    console.error('[API] rejectTask 异常:', error)
    return { success: false, message: error.message || '审核失败' }
  }
}

/**
 * 打折审核任务
 * @param taskId 任务 ID (number 或 string)
 * @param discount 打折百分数
 * @param reason 打折理由
 * TODO: 等待后端实现打折 API
 */
export const discountTask = async (
  taskId: number | string,
  discount: number,
  reason: string
): Promise<{ success: boolean; message: string }> => {
  console.warn('打折功能暂未实现')
  return { success: false, message: '打折功能暂未实现，请使用审核功能' }
}

// ==================== 用户相关 API ====================

// 注意：钱包相关功能保留，但钱包地址应从后端数据库的 evm_chain_address 字段获取
// 钱包地址由外部身份系统同步到本地数据库，不再使用硬编码映射表

// Mock API 函数
/**
 * 发送短信验证码
 * @param phone 手机号
 * @param baseUrl API 基础 URL
 */
export const sendSMS = async (phone: string, baseUrl: string): Promise<{ result: string }> => {
  const response = await fetch(`${baseUrl}/api/auth/send-sms`,
    {
      method:'POST',
      headers:
      {
        'Content-Type':'application/json',
      },
      body:JSON.stringify({phone}),
    }
  )

  if(!response.ok)
  {
    const error= await response.json()
    throw new Error(error.message||'Failed to send SMS')
  }
  return response.json()
}

/**
 * 发送邮箱验证码
 * @param email 邮箱地址
 * TODO: 等待后端实现邮箱验证码 API
 */
export const sendEmailCode = async (email: string): Promise<{ result: string }> => {
  console.warn('邮箱验证码功能暂未实现，返回 Mock 响应')
  await new Promise(resolve => setTimeout(resolve, 1000))
  return { result: 'ok' }
}

/**
 * 登录
 * @param identifier 手机号或邮箱
 * @param code 验证码
 * @param baseUrl API 基础 URL
 */
export const signIn = async (identifier: string, code: string, baseUrl: string): Promise<{ result: string; auth_token?:string }> => {
  const response = await fetch(`${baseUrl}/api/auth/signin`,
    {
      method:'POST',
      headers:
      {
        'Content-Type':'application/json',
      },
      body:JSON.stringify({phone: identifier, code}),
    }
  )

  if(!response.ok)
  {
    const error = await response.json()
    throw new Error(error.message || 'Failed to sign in')
  }

  const data = await response.json()

  // 保存token到cookie
  if (data.auth_token)
  {
    setCookie(AUTH_TOKEN_KEY,data.auth_token)
  }

  return data
}

/**
 * 使用邮箱登录
 * @param email 邮箱
 * @param code 验证码
 * @param baseUrl API 基础 URL
 * @param userType 用户类型（可选）
 */
export const signInWithEmail = async (email: string, code: string, baseUrl: string, userType?: 'member' | 'community'): Promise<{ result: string; isNewUser?: boolean }> => {
  return signIn(email, code, baseUrl)
}

/**
 * 获取当前用户信息
 * @param baseUrl API 基础 URL
 */
export const getMe = async (baseUrl: string): Promise<any> => {
  const response = await fetch(`${baseUrl}/api/auth/me`,
    {
      method:'GET',
      headers: getAuthHeaders(),
    }
  )

  if(!response.ok)
  {
    if(response.status===401)
    {
      clearAuthToken()
    }
    throw new Error('Failed to get user info')
  }
  const userData = await response.json()
  
  // 统一字段名：确保 avatar 字段存在（后端已处理，这里做双重保险）
  if (userData && !userData.avatar && userData.image_url) {
    userData.avatar = userData.image_url
  }
  
  return userData
}

/** 用户列表项（用于搜索/选择） */
export interface UserListItem {
  id: string
  name?: string
  phone?: string
  email?: string
}

/** 获取所有用户列表（用于搜索/选择，需登录） */
export const getAllUsers = async (baseUrl?: string): Promise<UserListItem[]> => {
  const url = baseUrl ?? getApiBaseUrl()
  const res = await fetch(`${url}/api/auth/users`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
  })
  if (!res.ok) throw new Error('获取用户列表失败')
  const data = await res.json()
  return (data.users || []).map((u: any) => ({
    id: u.id,
    name: u.name,
    phone: u.phone,
    email: u.email,
  }))
}

export const setEncryptedKeys = async (keys: string): Promise<{ result: string }> => {
  await new Promise(resolve => setTimeout(resolve, 500))
  console.log('[Mock] 设置加密密钥')
  return { result: 'ok' }
}

export const AUTH_TOKEN_KEY = 'auth_token'

// 使用 localStorage 存储 token，避免部署后丢失
export const getCookie = (key: string): string | null => {
  if(typeof window === 'undefined') return null
  try {
    // 优先从 localStorage 读取
    let token = localStorage.getItem(key)
    
    // 如果 localStorage 中没有，尝试从 cookie 读取（兼容旧数据）
    if (!token) {
      const cookies = document.cookie.split(';')
      for (let cookie of cookies)
      {
        const [name,value]= cookie.trim().split('=')
        if(name===key)
        {
          token = decodeURIComponent(value)
          // 迁移到 localStorage
          if (token) {
            localStorage.setItem(key, token)
            // 删除旧的 cookie
            document.cookie=`${key}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/`
          }
          break
        }
      }
    }
    
    return token
  } catch (e) {
    // 如果 localStorage 不可用，回退到 cookie
    const cookies = document.cookie.split(';')
    for (let cookie of cookies)
    {
      const [name,value]= cookie.trim().split('=')
      if(name===key)
      {
        return decodeURIComponent(value)
      }
    }
    return null
  }
}

export const setCookie = (key:string,value:string,days:number=365)=>
{
  if (typeof window ==='undefined') return
  try {
    // 优先使用 localStorage
    localStorage.setItem(key, value)
  } catch (e) {
    // 如果 localStorage 不可用，回退到 cookie
    const expires=new Date()
    expires.setTime(expires.getTime()+days*24*60*60*1000)
    document.cookie=`${key}=${encodeURIComponent(value)};expires=${expires.toUTCString()};path=/;SameSite=Lax`
  }
}

export const deleteCookie = (key:string)=>
{
  if(typeof window ==='undefined') return
  try {
    localStorage.removeItem(key)
  } catch (e) {
    // 如果 localStorage 不可用，回退到 cookie
    document.cookie=`${key}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/`
  }
}

export const clearAuthToken =(): void=>
{
  deleteCookie(AUTH_TOKEN_KEY)
}

// 保存当前登录标识符
export const setCurrentIdentifier = (identifier: string): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('current_identifier', identifier)
  }
}

/**
 * 上传头像
 * @param file 头像文件
 * @param baseUrl API 基础 URL
 */
export const uploadAvatar = async (file: File, baseUrl: string): Promise<{ url: string; hash: string }> => {
  try {
    const formData = new FormData()
    formData.append('file', file)

    const headers = getAuthHeaders()
    // 移除 content-type,让浏览器自动设置（包含boundary）
    delete (headers as any)['Content-Type']

    const response = await fetch(`${baseUrl}/api/upload/avatar`, {
      method: 'POST',
      headers,
      body: formData
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || '上传头像失败')
    }

    const result = await response.json()
    return { url: result.url, hash: result.hash }
  } catch (error: any) {
    console.error('Upload avatar error:', error)
    throw error
  }
}

// 更新用户信息
export interface UserProfile {
  name: string
  bio?: string
  avatar?: string
}

export const updateUserProfile = async (userId: string | number, profile: UserProfile, baseUrl: string): Promise<{ success: boolean; message: string }> => {
  try {
    const headers = getAuthHeaders()

    const response = await fetch(`${baseUrl}/api/auth/me`, {
      method: 'PATCH',
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(profile)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || '更新用户信息失败')
    }

    const result = await response.json()

    if (result.result === 'ok') {
      return { success: true, message: '用户信息更新成功'}
    } else {
      throw new Error(result.message || '更新用户信息失败')
    }
  } catch (error: any) {
    console.error('Update user profile error:', error)
    throw error
  }
}

/**
 * 上传任务凭证照片
 * @param files 照片数组
 * @param taskId 任务 ID
 * @param baseUrl API 基础 URL
 */
export const uploadProofFile = async (
  files: File[],
  taskId: string,
  baseUrl: string
): Promise<ProofFile[]> => {
  try {
    const formData = new FormData()
    files.forEach(file => {
      formData.append('files', file)
    })
    formData.append('taskId', taskId)

    const headers = getAuthHeaders()
    // 移除 content-type,让浏览器自动设置（包含boundary）
    delete (headers as any)['Content-Type']

    const response = await fetch(`${baseUrl}/api/upload/proof`, {
      method: 'POST',
      headers,
      body: formData
    })

    if (!response.ok) {
      // 检查响应内容类型
      const contentType = response.headers.get('content-type')
      if (contentType && contentType.includes('application/json')) {
        const error = await response.json()
        throw new Error(error.message || error.error || '上传文件失败')
      } else {
        // 如果不是 JSON，可能是 HTML 错误页面（如 404）
        if (response.status === 404) {
          throw new Error('上传接口不存在，请检查后端服务是否正常运行')
        }
        throw new Error(`上传文件失败 (${response.status}): ${response.statusText}`)
      }
    }

    const result = await response.json()
    return result.files
  } catch (error: any) {
    console.error('Upload proof file error:', error)
    throw error
  }
}

// 更新社区信息
export interface CommunityProfile {
  name: string
  description?: string
  avatar?: string
}

export const updateCommunityProfile = async (communityId: number, profile: CommunityProfile): Promise<{ success: boolean; message: string }> => {
  // TODO: 等待后端实现社区资料更新 API
  await new Promise(resolve => setTimeout(resolve, 500))
  console.log('[Mock] 更新社区信息:', communityId, profile)
  
  // 注意：社区数据库已移除，此功能需要后端 API 支持
  // 社区信息应存储在数据库中，通过后端 API 更新
  
  return { success: true, message: '社区信息更新成功' }
}

// ==================== 社群相关 API ====================

/**
 * 社群数据结构
 */
export interface Community {
  id: string                     // 社群ID (UUID)
  name: string                    // 社群名称
  description: string            // 社群描述
  memberCount: number            // 成员数量
  activityCount?: number         // 活动数量（可选）
  totalPoints?: number           // 总积分（可选）
  markdownIntro?: string         // Markdown 格式的介绍
  category?: string              // 社群类别
  location?: string              // 社群位置
  pointName?: string             // 社区积分名称
  createdAt: string              // 创建时间
  slug?: string                  // 邀请码（英文/拼音）
  isPublic?: boolean             // 是否公开
  superAdminId?: string | null   // 总管理员 user_id
  avatarUrl?: string | null      // 社区头像 URL
  myRole?: 'member' | 'sub_admin' | 'super_admin'  // 当前用户在该社区的角色（仅 getById 返回）
}

/**
 * 成员数据结构
 */
export interface Member {
  id: number
  name: string                   // 成员名称
  title?: string                 // 头衔
  bio?: string                   // 个人简介
  avatar?: string                 // 头像URL
  reputation: number             // 声誉值
  totalContributions: number     // 总贡献数
  completedTasks: number         // 完成任务数
  totalReward: number            // 总奖励
  skills: string[]               // 技能标签
  communities: number[]          // 所属社群ID列表
  participationScore: number    // 参与度分数 (0-100)
  activityScore: number          // 活跃度分数 (0-100)
  avatarSeed?: string            // 头像种子
}

/**
 * 网络节点数据结构
 */
export interface NetworkNode {
  id: string
  name: string
  type: 'COMMUNITY' | 'USER'
  value: number                  // 用于显示的权重值
  participationScore?: number   // 参与度
  activityScore?: number         // 活跃度
  communityId?: number           // 如果是成员，所属社群ID
  location?: string              // 节点位置（针对社群）
}

/**
 * 网络连接数据结构
 */
export interface NetworkLink {
  source: string                 // 源节点ID
  target: string                 // 目标节点ID
  weight: number                 // 连接权重（基于参与度和活跃度）
}

// ==================== 社区圈相关类型定义 ====================

/**
 * 社区动态（Post）数据结构
 */
export interface Post {
  id: string                                    // 动态ID (UUID)
  communityId?: string | number | null         // 所属社区ID（预留字段，暂时允许NULL）
  authorId: string                             // 发布者ID (UUID)
  content: string                              // 动态内容（纯文本）
  images: string[]                             // 图片URL数组，最多9张
  taskId?: string | null                       // 关联的任务ID
  isPinned: boolean                            // 是否置顶
  createdAt: string                            // 创建时间
  updatedAt: string

  /** 关联数据（列表/详情接口可能返回） */
  author?: { id: string; name?: string; avatar?: string }
  taskInfo?: { id: string; title: string }
  likesCount?: number
  commentsCount?: number
  isLiked?: boolean
}

/**
 * 评论（Comment）数据结构
 */
export interface Comment {
  id: string
  postId: string
  authorId: string
  content: string
  createdAt: string
  updatedAt: string
  author?: { id: string; name?: string; avatar?: string }
  /** 回复某人（平面、朋友圈式） */
  replyToUserId?: string
  replyTo?: { id: string; name?: string }
}

/**
 * 点赞（Like）数据结构
 */
export interface Like {
  id: string
  postId: string
  userId: string
  createdAt: string
  user?: { id: string; name?: string; avatar?: string }
}

/**
 * 创建动态参数（前端可传 postId 用于预生成 UUID 流程）
 */
export interface CreatePostParams {
  communityId: string | null
  content: string
  images?: string[]
  taskId?: string | null
  postId?: string
}

/**
 * 创建评论参数
 */
export interface CreateCommentParams {
  postId: string
  content: string
  /** 被回复用户ID（可选，展示「回复 某人」） */
  replyToUserId?: string
}

/**
 * 获取社区动态列表参数
 */
export interface GetCommunityPostsParams {
  communityId: string
  page?: number
  limit?: number
}

/**
 * 获取社区动态列表响应
 */
export interface GetCommunityPostsResponse {
  posts: Post[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

/**
 * 获取评论列表响应
 */
export interface GetCommentsResponse {
  comments: Comment[]
  total: number
}

/**
 * 点赞接口响应
 */
export interface LikeResponse {
  liked: boolean
  message: string
}

/**
 * 获取点赞列表响应
 */
export interface GetLikesResponse {
  likes: Like[]
  total: number
}

// ==================== 社区圈 API（调用后端） ====================
/**
 * 获取社区动态列表（分页）
 */
export async function getCommunityPosts (
  params: GetCommunityPostsParams,
  baseUrl?: string
): Promise<GetCommunityPostsResponse> {
  const url = baseUrl ?? getApiBaseUrl()
  const { communityId, page = 1, limit = 20 } = params
  const query = new URLSearchParams({ page: String(page), limit: String(limit) })
  const res = await fetch(
    `${url}/api/communities/${communityId}/posts?${query}`,
    { method: 'GET', headers: getAuthHeaders() }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || res.statusText)
  }
  return res.json()
}

/**
 * 发布动态（可选传 postId，用于先上传图片再发帖的流程）
 */
export async function createPost (
  params: CreatePostParams,
  baseUrl?: string
): Promise<Post> {
  const url = baseUrl ?? getApiBaseUrl()
  const communityId = params.communityId
  if (!communityId) throw new Error('请先选择社区再发帖')
  const body: Record<string, unknown> = {
    communityId,
    content: params.content,
    images: params.images ?? [],
    taskId: params.taskId ?? null
  }
  if (params.postId) body.postId = params.postId
  const res = await fetch(`${url}/api/communities/${communityId}/posts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(body)
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || res.statusText)
  }
  return res.json()
}

/**
 * 获取动态详情
 */
export async function getPostById (postId: string, baseUrl?: string): Promise<Post> {
  const url = baseUrl ?? getApiBaseUrl()
  const res = await fetch(`${url}/api/posts/${postId}`, {
    method: 'GET',
    headers: getAuthHeaders()
  })
  if (!res.ok) {
    if (res.status === 404) throw new Error('动态不存在')
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || res.statusText)
  }
  return res.json()
}

/**
 * 删除动态
 */
export async function deletePost (postId: string, baseUrl?: string): Promise<void> {
  const url = baseUrl ?? getApiBaseUrl()
  const res = await fetch(`${url}/api/posts/${postId}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || res.statusText)
  }
}

/**
 * 获取动态评论列表
 */
export async function getPostComments (
  postId: string,
  baseUrl?: string
): Promise<GetCommentsResponse> {
  const url = baseUrl ?? getApiBaseUrl()
  const res = await fetch(`${url}/api/posts/${postId}/comments`, {
    method: 'GET',
    headers: getAuthHeaders()
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || res.statusText)
  }
  return res.json()
}

/**
 * 发表评论
 */
export async function createComment (
  params: CreateCommentParams,
  baseUrl?: string
): Promise<Comment> {
  const url = baseUrl ?? getApiBaseUrl()
  const body: { content: string; replyToUserId?: string } = { content: params.content }
  if (params.replyToUserId) body.replyToUserId = params.replyToUserId
  const res = await fetch(`${url}/api/posts/${params.postId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(body)
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || res.statusText)
  }
  return res.json()
}

/**
 * 删除评论
 */
export async function deleteComment (commentId: string, baseUrl?: string): Promise<void> {
  const url = baseUrl ?? getApiBaseUrl()
  const res = await fetch(`${url}/api/comments/${commentId}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || res.statusText)
  }
}

/**
 * 点赞/取消点赞
 */
export async function togglePostLike (
  postId: string,
  baseUrl?: string
): Promise<LikeResponse> {
  const url = baseUrl ?? getApiBaseUrl()
  const res = await fetch(`${url}/api/posts/${postId}/like`, {
    method: 'POST',
    headers: getAuthHeaders()
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || res.statusText)
  }
  return res.json()
}

/**
 * 获取动态点赞列表
 */
export async function getPostLikes (
  postId: string,
  baseUrl?: string
): Promise<GetLikesResponse> {
  const url = baseUrl ?? getApiBaseUrl()
  const res = await fetch(`${url}/api/posts/${postId}/likes`, {
    method: 'GET',
    headers: getAuthHeaders()
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || res.statusText)
  }
  return res.json()
}

/**
 * 置顶动态
 */
export async function pinPost (postId: string, baseUrl?: string): Promise<Post> {
  const url = baseUrl ?? getApiBaseUrl()
  const res = await fetch(`${url}/api/posts/${postId}/pin`, {
    method: 'POST',
    headers: getAuthHeaders()
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || res.statusText)
  }
  return res.json()
}

/**
 * 取消置顶
 */
export async function unpinPost (postId: string, baseUrl?: string): Promise<Post> {
  const url = baseUrl ?? getApiBaseUrl()
  const res = await fetch(`${url}/api/posts/${postId}/unpin`, {
    method: 'POST',
    headers: getAuthHeaders()
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || res.statusText)
  }
  return res.json()
}

/**
 * 上传社区动态图片（多图，最多 9 张）
 * 用于「先传图再发帖」流程：先调此接口拿到 urls，再在 createPost 的 images 里传这些 url，并传 postId 与后端一致。
 */
export async function uploadPostImage (params: {
  postId: string
  communityId: string | null
  files: File[]
  baseUrl?: string
}): Promise<{ success: boolean; files: { url: string; hash?: string; name?: string; size?: number; type?: string }[] }> {
  console.log('uploadPostImage params.baseUrl:', params.baseUrl)
  const url = params.baseUrl ?? getApiBaseUrl()
  const communityId = params.communityId || DEFAULT_COMMUNITY_UUID
  const form = new FormData()
  form.append('postId', params.postId)
  form.append('communityId', communityId)
  params.files.forEach((file) => form.append('files', file))

  const headers = getAuthHeaders()
  delete (headers as any)['Content-Type']

  const res = await fetch(`${url}/api/upload/post-image`, {
    method: 'POST',
    headers,
    body: form
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { message?: string }).message || '上传图片失败')
  }
  return res.json()
}

// Mock 社群数据（两个社区）
const mockCommunities: Community[] = [
  {
    id: DEFAULT_COMMUNITY_UUID,
    name: '有种行动队',
    description: '社区种菜志愿者组织，一起种植、收获、分享绿色生活。',
    memberCount: 68,
    activityCount: 18,
    totalPoints: 18900,
    category: '园艺',
    location: '上海',
    pointName: '零废弃积分',
    createdAt: '2024-02-01T00:00:00Z',
    markdownIntro: `# 有种行动队

欢迎加入我们的社区种菜志愿者组织！一起体验种植的乐趣，践行零废弃生活。

## 我们的目标
- 推广绿色生活理念
- 学习有机种植技术
- 分享收获的喜悦
- 践行零废弃生活方式

## 活动安排
- 每周六上午：集体种植
- 每月一次：收获分享会
- 不定期：种植技术讲座
- 零废弃积分奖励机制
    `
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    name: '南塘',
    description: '素舍提供乡村村民宿餐饮，体验乡村生活，感受自然之美。',
    memberCount: 45,
    activityCount: 12,
    totalPoints: 12500,
    category: '乡村生活',
    location: '安徽',
    pointName: '南塘豆',
    createdAt: '2024-03-15T00:00:00Z',
    markdownIntro: `# 南塘

欢迎来到南塘，素舍提供乡村村民宿餐饮服务。

## 我们的特色
- 乡村民宿体验
- 地道乡村餐饮
- 自然生态体验
- 南塘豆积分奖励

## 服务内容
- 民宿住宿服务
- 乡村特色餐饮
- 农事体验活动
- 乡村文化体验
    `
  }
]

// Mock 成员数据（关联到两个社区）
const mockMembers: Member[] = [
  { id: 1, name: '赵园丁', title: '资深园丁', reputation: 920, totalContributions: 30, completedTasks: 22, totalReward: 4.0, skills: ['有机种植', '土壤管理', '病虫害防治'], communities: [1], participationScore: 98, activityScore: 95, avatarSeed: 'gardener1' },
  { id: 2, name: '钱农夫', title: '种植专家', reputation: 780, totalContributions: 22, completedTasks: 18, totalReward: 3.0, skills: ['蔬菜种植', '堆肥制作'], communities: [1], participationScore: 88, activityScore: 85, avatarSeed: 'farmer1' },
  { id: 3, name: '孙绿手指', title: '园艺爱好者', reputation: 650, totalContributions: 16, completedTasks: 13, totalReward: 2.2, skills: ['花卉种植', '园艺设计'], communities: [1], participationScore: 75, activityScore: 72, avatarSeed: 'green1' },
  { id: 4, name: '周菜农', title: '菜园管理员', reputation: 580, totalContributions: 12, completedTasks: 10, totalReward: 1.8, skills: ['菜园管理', '收获分享'], communities: [1], participationScore: 68, activityScore: 65, avatarSeed: 'veggie1' },
  { id: 5, name: '吴新手', title: '种植新手', reputation: 420, totalContributions: 8, completedTasks: 6, totalReward: 1.0, skills: ['基础种植'], communities: [1], participationScore: 58, activityScore: 55, avatarSeed: 'newbie1' },
  { id: 6, name: '李素舍', title: '民宿主人', reputation: 850, totalContributions: 25, completedTasks: 20, totalReward: 3.5, skills: ['民宿管理', '乡村餐饮', '文化体验'], communities: [2], participationScore: 92, activityScore: 88, avatarSeed: 'host1' },
  { id: 7, name: '王乡村', title: '乡村体验师', reputation: 720, totalContributions: 18, completedTasks: 15, totalReward: 2.8, skills: ['农事体验', '乡村导览'], communities: [2], participationScore: 82, activityScore: 78, avatarSeed: 'rural1' },
  { id: 8, name: '张田园', title: '田园生活家', reputation: 600, totalContributions: 14, completedTasks: 11, totalReward: 2.0, skills: ['田园生活', '自然体验'], communities: [2], participationScore: 70, activityScore: 68, avatarSeed: 'field1' }
]

/**
 * 获取社群列表（公开列表或我加入的）
 * @param options.mine 为 true 时返回当前用户已加入的社区（需登录）
 * @param options.q 搜索关键词
 */
export const getCommunities = async (
  options?: { mine?: boolean; q?: string },
  baseUrl?: string
): Promise<Community[]> => {
  const url = baseUrl ?? getApiBaseUrl()
  const params = new URLSearchParams()
  if (options?.mine) params.set('mine', '1')
  if (options?.q) params.set('q', options.q)
  const res = await fetch(`${url}/api/communities?${params}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || '获取社区列表失败')
  }
  const list = await res.json()
  return (list || []).map((c: any) => ({
    id: c.id,
    name: c.name,
    description: c.description || '',
    memberCount: c.memberCount ?? 0,
    totalPoints: 0,
    pointName: c.pointName || '积分',
    markdownIntro: c.markdownIntro,
    slug: c.slug,
    isPublic: c.isPublic,
    superAdminId: c.superAdminId,
    avatarUrl: c.avatarUrl ?? c.avatar_url ?? null,
    createdAt: c.createdAt || '',
  }))
}

/**
 * 根据 ID 获取单个社群详情（可选传 slug 查看私有社区基础信息）
 */
export const getCommunityById = async (
  id: string,
  baseUrl?: string,
  options?: { slug?: string }
): Promise<Community | null> => {
  const url = baseUrl ?? getApiBaseUrl()
  const params = options?.slug ? `?slug=${encodeURIComponent(options.slug)}` : ''
  const res = await fetch(`${url}/api/communities/${id}${params}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
  })
  if (res.status === 404) return null
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || '获取社区详情失败')
  }
  const c = await res.json()
  return {
    id: c.id,
    name: c.name,
    description: c.description || '',
    memberCount: c.memberCount ?? 0,
    totalPoints: 0,
    pointName: c.pointName || '积分',
    markdownIntro: c.markdownIntro,
    slug: c.slug,
    isPublic: c.isPublic,
    superAdminId: c.superAdminId,
    avatarUrl: c.avatarUrl ?? c.avatar_url ?? null,
    myRole: c.myRole,
    createdAt: c.createdAt || '',
  }
}

/** 社区成员项（后端返回） */
export interface CommunityMemberItem {
  userId: string
  name?: string
  avatar?: string
  role: 'member' | 'sub_admin' | 'super_admin'
  joinedAt: string
}

/**
 * 获取社群成员列表（需登录且为成员）
 * 返回格式兼容首页村民展示：id(userId)、name、avatar、avatarSeed、role、joinedAt
 */
export const getCommunityMembers = async (
  communityId: string,
  baseUrl?: string
): Promise<(CommunityMemberItem & { id: string; avatarSeed?: string })[]> => {
  const url = baseUrl ?? getApiBaseUrl()
  const res = await fetch(`${url}/api/communities/${communityId}/members`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || '获取成员列表失败')
  }
  const list = await res.json() as CommunityMemberItem[]
  return (list || []).map(m => ({
    ...m,
    id: m.userId,
    avatarSeed: m.avatar || m.name || m.userId,
  }))
}

/** 加入社区（公开直接加入，私有传 slug 后提交申请） */
export const joinCommunity = async (
  communityId: string,
  baseUrl: string,
  body?: { slug?: string }
): Promise<{ result: string; message?: string }> => {
  const res = await fetch(`${baseUrl}/api/communities/${communityId}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(body || {}),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.message || '加入失败')
  return data
}

/** 凭邀请码加入（仅传 slug，后端查社区并加入或提交申请） */
export const joinCommunityByInviteCode = async (
  slug: string,
  baseUrl?: string
): Promise<{ result: string; message?: string; communityId?: string }> => {
  const url = baseUrl ?? getApiBaseUrl()
  const res = await fetch(`${url}/api/communities/join-by-invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ slug: slug.trim().toLowerCase().replace(/\s+/g, '-') }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.message || '加入失败')
  return data
}

/** 退出社区 */
export const leaveCommunity = async (communityId: string, baseUrl: string): Promise<void> => {
  const res = await fetch(`${baseUrl}/api/communities/${communityId}/leave`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.message || '退出失败')
}

/** 公告项（按社区） */
export interface Announcement {
  id: string
  communityId: string
  authorId: string
  title: string
  content?: string
  isPinned: boolean
  createdAt: string
  updatedAt: string
}

/** 获取社区公告列表 */
export const getCommunityAnnouncements = async (
  communityId: string,
  baseUrl?: string
): Promise<Announcement[]> => {
  const url = baseUrl ?? getApiBaseUrl()
  const res = await fetch(`${url}/api/communities/${communityId}/announcements`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
  })
  if (!res.ok) throw new Error('获取公告失败')
  const list = await res.json()
  return list || []
}

/** 创建社区（仅系统管理员） */
export const createCommunity = async (
  payload: {
    name: string
    slug: string
    description?: string
    markdownIntro?: string
    isPublic?: boolean
    pointName?: string
    superAdminId?: string
    avatarUrl?: string
  },
  baseUrl?: string
): Promise<Community> => {
  const url = baseUrl ?? getApiBaseUrl()
  const res = await fetch(`${url}/api/communities`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({
      name: payload.name,
      slug: payload.slug,
      description: payload.description,
      markdown_intro: payload.markdownIntro,
      is_public: payload.isPublic !== false,
      point_name: payload.pointName || '积分',
      super_admin_id: payload.superAdminId || null,
      avatar_url: payload.avatarUrl || null,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || '创建失败')
  }
  const c = await res.json()
  return {
    id: c.id,
    name: c.name,
    description: c.description || '',
    memberCount: c.memberCount ?? 0,
    pointName: c.pointName || '积分',
    markdownIntro: c.markdownIntro,
    slug: c.slug,
    isPublic: c.isPublic,
    superAdminId: c.superAdminId,
    avatarUrl: c.avatarUrl ?? c.avatar_url ?? null,
    createdAt: c.createdAt || '',
  }
}

/** 更新社区（名称、简介、公开性、头像等，需总管理员或系统管理员） */
export const updateCommunity = async (
  communityId: string,
  payload: { name?: string; description?: string; markdownIntro?: string; isPublic?: boolean; pointName?: string; avatarUrl?: string },
  baseUrl?: string
): Promise<Community> => {
  const url = baseUrl ?? getApiBaseUrl()
  const res = await fetch(`${url}/api/communities/${communityId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || '更新失败')
  }
  const c = await res.json()
  return {
    id: c.id,
    name: c.name,
    description: c.description || '',
    memberCount: c.memberCount ?? 0,
    pointName: c.pointName || '积分',
    markdownIntro: c.markdownIntro,
    slug: c.slug,
    isPublic: c.isPublic,
    avatarUrl: c.avatarUrl ?? c.avatar_url ?? null,
    createdAt: c.createdAt || '',
  }
}

/** 转让总管理员 */
export const transferSuperAdmin = async (
  communityId: string,
  body: { targetUserId: string; demoteTo: 'member' | 'sub_admin' },
  baseUrl?: string
): Promise<void> => {
  const url = baseUrl ?? getApiBaseUrl()
  const res = await fetch(`${url}/api/communities/${communityId}/transfer-super-admin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.message || '转让失败')
}

/** 添加成员（管理员直接添加，无需审批） */
export const addCommunityMember = async (
  communityId: string,
  body: { userId: string; role?: 'member' | 'sub_admin' },
  baseUrl?: string
): Promise<void> => {
  const url = baseUrl ?? getApiBaseUrl()
  const res = await fetch(`${url}/api/communities/${communityId}/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.message || '添加失败')
}

/** 更新成员角色或移除成员 */
export const patchCommunityMember = async (
  communityId: string,
  userId: string,
  body: { action: 'remove' } | { role: 'member' | 'sub_admin' },
  baseUrl?: string
): Promise<void> => {
  const url = baseUrl ?? getApiBaseUrl()
  const res = await fetch(`${url}/api/communities/${communityId}/members/${userId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.message || '操作失败')
}

/** 入群申请项 */
export interface JoinRequestItem {
  id: string
  userId: string
  name?: string
  avatar?: string
  status: string
  createdAt: string
}

/** 待审批入群申请列表 */
export const getCommunityJoinRequests = async (communityId: string, baseUrl?: string): Promise<JoinRequestItem[]> => {
  const url = baseUrl ?? getApiBaseUrl()
  const res = await fetch(`${url}/api/communities/${communityId}/join-requests`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
  })
  if (!res.ok) throw new Error('获取申请列表失败')
  return res.json()
}

/** 通过/拒绝入群申请 */
export const approveJoinRequest = async (communityId: string, requestId: string, baseUrl?: string): Promise<void> => {
  const url = baseUrl ?? getApiBaseUrl()
  const res = await fetch(`${url}/api/communities/${communityId}/join-requests/${requestId}/approve`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() } })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || '操作失败')
}
export const rejectJoinRequest = async (communityId: string, requestId: string, baseUrl?: string): Promise<void> => {
  const url = baseUrl ?? getApiBaseUrl()
  const res = await fetch(`${url}/api/communities/${communityId}/join-requests/${requestId}/reject`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() } })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || '操作失败')
}

/**
 * 获取所有成员列表
 */
export const getMembers = async (): Promise<Member[]> => {
  await new Promise(resolve => setTimeout(resolve, 200))
  return mockMembers
}

/**
 * 根据 ID 获取单个成员详情
 * 调用后端 API 获取用户信息，并转换为 Member 格式
 * 
 * @param id 用户ID（UUID 字符串或数字）
 * @param baseUrl API 基础 URL（可选，如果不提供会从环境变量读取）
 */
export const getMemberById = async (id: number | string, baseUrl?: string): Promise<Member | null> => {
  try {
    // 如果没有提供 baseUrl，从环境变量读取
    if (!baseUrl) {
      baseUrl = getApiBaseUrl()
    }
    
    const userId = String(id) // 确保是字符串类型（UUID）
    
    const response = await fetch(`${baseUrl}/api/auth/users/${userId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      if (response.status === 404) {
        // 用户不存在，返回 null
        console.error(`User not found.`,response.statusText);
        return null;
      }
      console.error(`Failed to get member: ${response.statusText}`)
      throw new Error(`Failed to get member: ${response.statusText}`)
    }

    const data = await response.json()
    
    if (data.result !== 'ok' || !data.user) {
      return null
    }

    const user = data.user

    // 将后端 User 格式转换为前端 Member 格式
    // 注意：部分字段（如 reputation, totalContributions 等）暂时使用默认值
    // 等后续实现了这些功能后再从数据库获取
    const member: Member = {
      id: typeof id === 'number' ? id : parseInt(user.id.slice(0, 8), 16) || 0, // 将 UUID 转换为数字 ID（临时方案，用于兼容前端）
      name: user.name || '未知用户',
      bio: user.bio || undefined,
      avatar: user.avatar || undefined,
      title: undefined, // 暂时没有头衔字段
      reputation: 0, // 暂时使用默认值，后续可以从任务完成数等计算
      totalContributions: 0, // 暂时使用默认值
      completedTasks: 0, // 暂时使用默认值，后续可以从任务表统计
      totalReward: 0, // 暂时使用默认值，后续可以从任务表统计
      skills: [], // 暂时使用空数组
      communities: [], // 暂时使用空数组（数据库中没有社区表）
      participationScore: 0, // 暂时使用默认值
      activityScore: 0, // 暂时使用默认值
      avatarSeed: user.id, // 使用用户 ID 作为头像种子
    }

    return member
  } catch (error) {
    console.error('Failed to get member by ID:', error)
    return null
  }
}

/**
 * 根据成员ID获取钱包地址
 * 从后端 API 获取真实的钱包地址（evm_chain_address)
 */
export const getWalletAddressByMemberId = async (id: number | string): Promise<string> => {
  try {
    const baseUrl = getApiBaseUrl()
    const userId = String(id) // 确保是字符串类型（UUID）

    const response = await fetch(`${baseUrl}/api/auth/users/${userId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      console.error('Failed to get wallet address:', response.statusText)
      return ''
    }

    const data = await response.json()

    // 返回真实的钱包地址，如果没有则返回空字符串
    return data.user?.evm_chain_address || ''

  } catch (error) {
    console.error('Failed to get wallet address by member ID:', error)
    return ''
  }
}

/**
 * 获取网络图数据（包含节点和连接）
 * 根据参与度和活跃度进行加权
 */
export const getNetworkData = async (): Promise<{ nodes: NetworkNode[], links: NetworkLink[] }> => {
  await new Promise(resolve => setTimeout(resolve, 300))
  
  const nodes: NetworkNode[] = []
  const links: NetworkLink[] = []
  
  // 添加社群节点
  mockCommunities.forEach(comm => {
    // 将 UUID 转换为数字 ID 用于 mock 数据兼容性（临时处理）
    const commIdNum = comm.id === DEFAULT_COMMUNITY_UUID ? 1 : 
                      comm.id === '00000000-0000-0000-0000-000000000002' ? 2 : null
    if (commIdNum === null) return
    
    // 社群的价值基于成员数量和活跃度
    const memberCount = mockMembers.filter(m => m.communities.includes(commIdNum)).length
    const avgParticipation = mockMembers
      .filter(m => m.communities.includes(commIdNum))
      .reduce((sum, m) => sum + m.participationScore, 0) / memberCount || 0
    const avgActivity = mockMembers
      .filter(m => m.communities.includes(commIdNum))
      .reduce((sum, m) => sum + m.activityScore, 0) / memberCount || 0
    
    // 综合权重 = 成员数 * (参与度 + 活跃度) / 2
    const value = Math.round(memberCount * (avgParticipation + avgActivity) / 2)
    
    nodes.push({
      id: `comm${comm.id}`,
      name: comm.name,
      type: 'COMMUNITY',
      value: value,
      participationScore: avgParticipation,
      activityScore: avgActivity,
      location: comm.location
    })
  })
  
  // 添加成员节点
  mockMembers.forEach(member => {
    // 成员的价值基于参与度和活跃度的加权平均
    const value = Math.round((member.participationScore * 0.6 + member.activityScore * 0.4) * 10)
    
    nodes.push({
      id: `user${member.id}`,
      name: member.name,
      type: 'USER',
      value: value,
      participationScore: member.participationScore,
      activityScore: member.activityScore,
      communityId: member.communities[0] // 主要社群
    })
    
    // 创建成员与社群的连接
    member.communities.forEach(commId => {
      // 连接权重基于成员的参与度和活跃度
      const weight = Math.round((member.participationScore + member.activityScore) / 20)
      links.push({
        source: `user${member.id}`,
        target: `comm${commId}`,
        weight: Math.max(1, weight) // 最小权重为1
      })
    })
    
    // 创建成员之间的连接（同一社群的成员）
    member.communities.forEach(commId => {
      const sameCommunityMembers = mockMembers.filter(
        m => m.id !== member.id && m.communities.includes(commId)
      )
      
      // 只连接活跃度相近的成员（避免连接过多）
      sameCommunityMembers.forEach(otherMember => {
        const activityDiff = Math.abs(member.activityScore - otherMember.activityScore)
        if (activityDiff < 20 && Math.random() > 0.7) { // 30%概率连接
          const weight = Math.round((100 - activityDiff) / 10)
          // 检查是否已存在反向连接
          if (!links.find(l => 
            (l.source === `user${otherMember.id}` && l.target === `user${member.id}`) ||
            (l.source === `user${member.id}` && l.target === `user${otherMember.id}`)
          )) {
            links.push({
              source: `user${member.id}`,
              target: `user${otherMember.id}`,
              weight: Math.max(1, weight)
            })
          }
        }
      })
    })
  })
  
  return { nodes, links }
}

/**
 * 活动日志数据结构
 */
export interface ActivityLog {
  id: number
  type: 'join' | 'complete_task' | 'create_proposal' | 'new_community'
  userId?: number
  userName?: string
  targetId: number // communityId or taskId
  targetName: string
  timestamp: string
}

/**
 * 交易记录数据结构
 */
export interface Transaction {
  id: number
  type: 'in' | 'out'
  title: string
  date: string
  amount: number
  currency: string  // 'CP', 'ETH', 'ZWP', 'NTD' 等
  taskId?: number   // 关联的任务ID
  taskTitle?: string // 任务标题
}

/**
 * 社区交易记录数据结构（包含用户信息）
 */
export interface CommunityTransaction {
  id: number
  userId: number
  userName: string
  userAvatarSeed?: string
  type: 'in' | 'out'
  title: string
  date: string
  amount: number
  currency: string
  taskId?: number
  taskTitle?: string
}

/**
 * 获取活动日志（Live Feed）
 */
export const getActivityFeed = async (): Promise<ActivityLog[]> => {
  await new Promise(resolve => setTimeout(resolve, 100))
  
  // Mock 一些动态数据
  const logs: ActivityLog[] = [
    { id: 1, type: 'join', userId: 5, userName: '吴新手', targetId: 1, targetName: '有种行动队', timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString() },
    { id: 2, type: 'complete_task', userId: 1, userName: '赵园丁', targetId: 101, targetName: '修剪灌木', timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString() },
    { id: 3, type: 'join', userId: 8, userName: '张田园', targetId: 2, targetName: '南塘', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString() },
    { id: 4, type: 'complete_task', userId: 6, userName: '李素舍', targetId: 102, targetName: '民宿接待', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString() },
    { id: 5, type: 'create_proposal', userId: 2, userName: '钱农夫', targetId: 1, targetName: '增加堆肥箱', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString() },
    { id: 6, type: 'join', userId: 7, userName: '王乡村', targetId: 2, targetName: '南塘', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString() }
  ]
  
  return logs
}

/**
 * 获取社区所有成员的交易记录
 * @param communityId 社区ID
 */
export const getCommunityTransactions = async (communityId: number): Promise<CommunityTransaction[]> => {
  await new Promise(resolve => setTimeout(resolve, 300))
  
  try {
    // 获取该社区的所有成员
    const members = mockMembers.filter(m => m.communities.includes(communityId))
    
    // 获取所有成员的交易记录
    const allTransactions: CommunityTransaction[] = []
    
    for (const member of members) {
      const userTransactions = await getTransactions(member.id)
      
      // 转换为社区交易记录格式
      for (const tx of userTransactions) {
        allTransactions.push({
          id: tx.id,
          userId: member.id,
          userName: member.name,
          userAvatarSeed: member.avatarSeed,
          type: tx.type,
          title: tx.title,
          date: tx.date,
          amount: tx.amount,
          currency: tx.currency,
          taskId: tx.taskId,
          taskTitle: tx.taskTitle
        })
      }
    }
    
    // 按时间倒序排列（最新的在前）
    return allTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  } catch (error) {
    console.error('Failed to load community transactions:', error)
    return []
  }
}

// ==================== Semi OAuth2 相关 API ====================

/**
 * 从 Semi 获取用户信息
 * @param accessToken Semi 的 access_token
 * @param semiApiUrl Semi API 基础 URL
 */
export const getSemiUserInfo = async (accessToken: string, semiApiUrl: string): Promise<any> => {
  const response = await fetch(`${semiApiUrl}/get_me`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    }
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || error.message || 'Failed to get user info from Semi')
  }

  return response.json()
}

/**
 * 同步 Semi 用户信息到 Mycoseed
 * @param semiUserData Semi 用户数据
 * @param baseUrl Mycoseed API 基础 URL
 */
export const syncFromSemi = async (semiUserData: any, baseUrl: string): Promise<{ result: string; auth_token?: string; user?: any}> => {
  const response = await fetch(`${baseUrl}/api/auth/sync-from-semi`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(semiUserData)
  })

  if (!response.ok) {
    const raw = await response.text()
    try {
      const parsed = JSON.parse(raw)
      throw new Error(parsed.message || 'Failed to sync user from Semi')
    } catch {
      throw new Error(`Failed to sync user from Semi (HTTP ${response.status}): ${raw.slice(0, 120)}`)
    }
  }

  return response.json()
}

/**
 * 生成随机 state（用于 OAuth2 CSRF 防护）
 */
export const generateRandomState = (): string => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

/**
 * 构建 OAuth2 授权 URL
 * @param clientId 客户端 ID
 * @param redirectUri 回调地址
 * @param state 状态参数（用于 CSRF 防护）
 * @param oauthUrl OAuth 服务器地址
 */
export const buildOAuthUrl = (clientId: string, redirectUri: string, state: string, oauthUrl: string): string => {
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'token',
    redirect_uri: redirectUri,
    state: state,
    scope: 'read:user'
  })
  return `${oauthUrl}/api/oauth/authorize?${params.toString()}`
}

/**
 * 解析 URL fragment（用于提取 OAuth2 返回的 token）
 * @param fragment URL fragment（例如：#access_token=xxx&token_type=Bearer）
 */
export const parseFragment = (fragment: string): Record<string, string> => {
  const params: Record<string, string> = {}
  if (fragment && fragment.startsWith('#')) {
    fragment.substring(1).split('&').forEach(param => {
      const [key, value] = param.split('=')
      if (key && value) {
        params[key] = decodeURIComponent(value)
      }
    })
  }
  return params
}

// ==================== Semi转账跳转相关 ====================

/**
 * 构造跳转到Semi-app转账页面的链接
 * @param receiverAddress 接收方钱包地址（参与者的钱包地址）
 * @param amount 转账金额（字符串格式，如 "100"）
 * @param tokenAddress 代币合约地址（可选，默认NT代币）
 * @param chainId 链ID（可选，默认10-Optimism）
 * @returns Semi-app转账页面URL
 */
export function buildSemiTransferUrl(
  receiverAddress: string,
  amount: string,
  tokenAddress: string = '0x7563cb33148cD2b929ed85e69F697be13b515Bd0', // NT代币
  chainId: number = 10 //Optimism
): string {
  const semiAppBaseUrl = 'https://www.semi.im'
  const params = new URLSearchParams({
    chain_id: chainId.toString(),
    token_address: tokenAddress,
    to: receiverAddress,
    amount: amount,
  })

  return `${semiAppBaseUrl}/transfer?${params.toString()}`
}

/**
 * 根据用户ID获取钱包地址
 * @param userId 用户ID
 * @param baseUrl API基础URL
 * @returns 钱包地址或null
 */
export async function getWalletAddressByUserId(
  userId: string,
  baseUrl: string
): Promise<string | null> {
  try {
    const response = await fetch(`${baseUrl}/api/auth/users/${userId}`)
    if (!response.ok) return null
    const data = await response.json()
    return data.user?.evm_chain_address || null
  } catch (error) {
    console.error('Get wallet address error:', error)
    return null
  }
}
