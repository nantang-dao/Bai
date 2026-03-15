export type TaskStatus = 'unclaimed' | 'claimed' | 'unsubmit' | 'submitted' | 'under_review' | 'completed' | 'rejected'

/**
 * 时间线状态项（记录所有状态变化）
 * 每个状态变化都会在时间线数组中追加一个新元素
 */
export interface TimelineStatus {
  status: TaskStatus | 'resubmit' | 'reclaim'  // 状态值（包括中间状态如 resubmit、reclaim）
  actorId?: string                              // 操作者ID
  actorName?: string                            // 操作者名称
  action?: string                               // 操作选项（如 '审核驳回'、'重新提交'、'重新发布' 等）
  reason?: string                               // 操作理由（如驳回原因、审核意见等，如果影响性能可以不加）
  timestamp: string                             // 状态变化时间
}

export interface ProofConfig{
    photo?:
    {
        enabled: boolean
        count?: string
        requirements?: string
    }
    gps?:
    {
        enabled: boolean
        accuracy?: string
    }
    description?:
    {
        enabled: boolean
        minWords?: number
        prompt?: string
    }
}

/**
 * 任务信息（多人任务共享的基本信息）
 */
export interface TaskInfo {
    id: string
    title: string
    description: string
    activityId: number
    startDate?: string
    deadline?: string
    submitDeadline?: string
    participantLimit?: number | null
    rewardDistributionMode: 'per_person' | 'custom'  // 奖励分配模式
    proofConfig?: ProofConfig
    submissionInstructions?: string
    creatorId: string  // 任务组创建者ID
    assignedUserId?: string  // 指定参与人员ID（可选，向后兼容）
    assignedUserIds?: string[]  // 指定参与人员ID列表（多人任务）
    createdAt?: string
    updatedAt?: string
}

/**
 * 任务（每个行代表一个创建者-领取者对）
 */
export interface Task{
    id: string
    taskInfoId: string           // 关联的任务信息ID
    taskInfo?: TaskInfo          // 关联的任务信息（JOIN后填充）
    
    // 创建者和领取者（每个任务行只有一个）
    creatorId: string            // 创建者ID (UUID)
    claimerId?: string           // 领取者ID (UUID，未领取时为null)
    
    // 奖励相关（每个参与者独立）
    reward: number               // 奖励金额
    currency: 'ETH' | 'NT' | 'USDT' | 'USDC' | 'DAI'  // 货币类型
    weightCoefficient?: number   // 权重系数（用于自定义分配，默认1.0）
    participantIndex?: number    // 参与者序号（多人任务中的第几个）
    
    // 状态相关（每个参与者独立）
    status: TaskStatus
    proof?: string               // 该参与者的凭证
    rejectReason?: string
    rejectOption?: 'resubmit' | 'reclaim' | 'rejected'
    discount?: number
    discountReason?: string
    
    // 时间线（每个参与者独立）
    timeline?: TimelineStatus[]
    
    // 时间戳字段（每个参与者独立）
    claimedAt?: string
    submittedAt?: string
    completedAt?: string
    transferredAt?: string  // 转账完成时间
    createdAt?: string
    updatedAt?: string
    
    // 向后兼容字段（从 taskInfo 中获取）
    title?: string
    description?: string
    activityId?: number
    startDate?: string
    deadline?: string
    submitDeadline?: string
    participantLimit?: number | null
    rewardDistributionMode?: 'per_person' | 'custom'
    proofConfig?: ProofConfig
    submissionInstructions?: string
    assignedUserId?: string  // 指定参与人员ID（从 taskInfo 中获取）
    
    // 参与者列表（用于多人任务）
    participantsList?: Array<{
        id: string
        name?: string
        creatorId?: string
        claimerId?: string
        reward: number
        currency: string
        status: TaskStatus
        participantIndex?: number
        claimedAt?: string
        submittedAt?: string
        proof?: string
        transferredAt?: string
    }>
}

/**
 * 创建任务参数
 */
export interface CreateTaskParams{
    // 任务基本信息（存储在 task_info 表）
    title: string
    communityId?: string  // 所属社区 UUID
    assignedUserId?: string  // 指定参与人员ID（可选，向后兼容）
    assignedUserIds?: string[]  // 指定参与人员ID列表（多人任务）
    description: string
    activityId?: number
    startDate: string
    deadline: string
    submitDeadline?: string
    participantLimit?: number | null
    rewardDistributionMode?: 'per_person' | 'custom'
    proofConfig?: ProofConfig
    submissionInstructions?: string
    
    // 奖励相关（每个参与者）
    reward: number
    currency?: 'ETH' | 'NT' | 'USDT' | 'USDC' | 'DAI'
    
    // 权重分配（如果 rewardDistributionMode 是 'custom'）
    weights?: Array<{ participantIndex: number; weight: number }>
}

export interface TaskResponse
{
    success: boolean
    message: string
    task?: Task
}
