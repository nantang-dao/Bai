/**
 * 社区动态（Post）数据结构
 */
export interface Post {
    id: string // 动态ID(UUID)
    communityId?: string | number | null // 所属社区ID（预留字段，暂时允许NULL）
    authorId: string // 发布者ID(UUID)
    content: string // 动态内容（纯文本）
    images: string[] // 图片URL数组，最多9张
    taskId?: string | null // 关联的任务ID
    isPinned: boolean // 是否置顶
    createdAt: string // 创建时间
    updatedAt: string // 更新时间

    // 关联数据（JOIN后填充）
    author?: {
        id: string
        name?: string
        avatar?: string
    }
    taskInfo?: {
        id: string
        title: string
    }
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

    // 关联数据
    author?: {
        id: string
        name?: string
        avatar?: string
    }
    /** 回复某人（平面、朋友圈式） */
    replyToUserId?: string
    replyTo?: {
        id: string
        name?: string
    }
}

/**
 * 点赞（Like）数据结构
 */
export interface Like {
    id: string                                   // 点赞ID (UUID)
    postId: string                               // 动态ID (UUID)
    userId: string                               // 点赞用户ID (UUID)
    createdAt: string                            // 点赞时间

    // 关联数据（JOIN后填充）
    user?: {                                     // 点赞用户信息
      id: string
      name?: string
      avatar?: string
    }
}

/**
 * 创建动态参数
 */
export interface CreatePostParams {
    communityId: string | number                 // 社区ID
    content: string                              // 动态内容（必填）
    images?: string[]                            // 图片URL数组（可选，最多9张）
    taskId?: string | null                       // 关联的任务ID（可选）
}

/**
 * 创建评论参数
 */
export interface CreateCommentParams {
    postId: string                               // 动态ID
    content: string                              // 评论内容（最多500字）
    replyToUserId?: string                       // 被回复用户ID（可选，展示「回复 某人」）
}

/**
 * 获取社区动态列表参数
 */
export interface GetCommunityPostsParams {
    communityId: string | number                 // 社区ID
    page?: number                                // 页码（从1开始，默认1）
    limit?: number                              // 每页数量（默认20，最大100）
}

/**
 * 获取社区动态列表响应
 */
export interface GetCommunityPostsResponse {
    posts: Post[]                                // 动态列表
    total: number                                // 总数量
    page: number                                 // 当前页码
    limit: number                               // 每页数量
    hasMore: boolean                            // 是否还有更多
}

/**
 * 获取评论列表响应
 */
export interface GetCommentsResponse {
    comments: Comment[]                          // 评论列表（按时间正序）
    total: number                                // 总数量
}
