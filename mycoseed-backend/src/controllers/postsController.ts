import { Response } from 'express'
import { supabase } from '../services/supabase'
import { AuthRequest } from '../middleware/auth'
import { getMemberRole } from '../middleware/communityAdmin'
import { 
    Post, 
    Comment, 
    Like, 
    CreatePostParams, 
    CreateCommentParams,
    GetCommunityPostsResponse,
    GetCommentsResponse
} from '../types/post'
import { randomUUID } from 'crypto'

// ==================== 辅助函数 ====================

/**
 * 转换数据库字段名到接口字段名（snake_case -> camelCase）
 */
const transformPost = (dbPost: any): Post => {
    return {
        id: dbPost.id,
        communityId: dbPost.community_id,
        authorId: dbPost.author_id,
        content: dbPost.content,
        images: dbPost.images || [],
        taskId: dbPost.task_id,
        isPinned: dbPost.is_pinned || false,
        createdAt: dbPost.created_at,
        updatedAt: dbPost.updated_at,
        author: dbPost.author ? {
            id: dbPost.author.id,
            name: dbPost.author.name,
            avatar: dbPost.author.avatar || dbPost.author.image_url
        } : undefined,
        taskInfo: dbPost.task_info ? {
            id: dbPost.task_info.id,
            title: dbPost.task_info.title
        } : undefined,
        likesCount: dbPost.likes_count || 0,
        commentsCount: dbPost.comments_count || 0,
        isLiked: dbPost.is_liked || false
    }
}

const transformComment = (dbComment: any): Comment => {
    return {
        id: dbComment.id,
        postId: dbComment.post_id,
        authorId: dbComment.author_id,
        content: dbComment.content,
        createdAt: dbComment.created_at,
        updatedAt: dbComment.updated_at,
        author: dbComment.author ? {
            id: dbComment.author.id,
            name: dbComment.author.name,
            avatar: dbComment.author.avatar || dbComment.author.image_url
        } : undefined,
        replyToUserId: dbComment.reply_to_user_id ?? undefined,
        replyTo: dbComment.reply_to_user ? {
            id: dbComment.reply_to_user.id,
            name: dbComment.reply_to_user.name
        } : undefined
    }
}

// ==================== 控制器函数 ====================

/**
 * 获取社区动态列表
 * GET /api/communities/:communityId/posts
 */
export const getCommunityPosts = async (req: AuthRequest, res: Response) => {
    try {
        const communityId = req.params.communityId
        const page = parseInt(req.query.page as string) || 1
        const limit = Math.min(parseInt(req.query.limit as string) || 20, 100)
        const offset = (page - 1) * limit
        const userId = req.user?.id

        // 查询动态列表（排序：置顶在前，然后按时间倒序）
        const { data: posts, error: postsError } = await supabase
            .from('community_posts')
            .select(`
                *,
                author:users!community_posts_author_id_fkey (
                    id,
                    name,
                    avatar,
                    image_url
                ),
                task_info:task_info (
                    id,
                    title
                )
            `)
            .eq('community_id', communityId)
            .order('is_pinned', { ascending: false })
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1)

        if (postsError) {
            console.error('Supabase query failed:', postsError);
            throw new Error(`Failed to fetch posts: ${postsError.message}`);
        }

        // 获取总数
        const { count, error: countError } = await supabase
            .from('community_posts')
            .select('*', { count: 'exact', head: true })
            .eq('community_id', communityId)
        
        if (countError) throw countError

        // 获取每个动态的点赞数和评论数，以及当前用户是否点赞
        const postIds = posts?.map(p => p.id) || []

        // 获取点赞数
        const { data: likesData } = await supabase
            .from('community_post_likes')
            .select('post_id')
            .in('post_id', postIds)
        
        // 获取评论数
        const { data: commentsData } = await supabase
            .from('community_post_comments')
            .select('post_id')
            .in('post_id', postIds)

        // 获取当前用户的点赞状态
        const { data: userLikes } = userId ? await supabase
            .from('community_post_likes')
            .select('post_id')
            .in('post_id', postIds)
            .eq('user_id', userId) : { data: [] }

        const userLikedPostIds = new Set(userLikes?.map(l => l.post_id) || [])

        // 统计每个动态的点赞数和评论数
        const likesCountMap = new Map<string, number>()
        const commentsCountMap = new Map<string, number>()

        likesData?.forEach(like => {
            likesCountMap.set(like.post_id, (likesCountMap.get(like.post_id) || 0) + 1)
        })

        commentsData?.forEach(comment => {
            commentsCountMap.set(comment.post_id, (commentsCountMap.get(comment.post_id) || 0) + 1)
        })

        // 转换数据格式
        const transformedPosts: Post[] = (posts || []).map(
            post => {
                const transformed = transformPost(post)
                transformed.likesCount = likesCountMap.get(post.id) || 0
                transformed.commentsCount = commentsCountMap.get(post.id) || 0
                transformed.isLiked = userLikedPostIds.has(post.id)
                return transformed
            }
        )

        const response: GetCommunityPostsResponse = {
            posts: transformedPosts,
            total: count || 0,
            page,
            limit,
            hasMore: (count || 0) > offset + limit
        }

        res.json(response)
    } catch (error: any) {
        console.error('获取社区动态列表失败:', error)
        res.status(500).json({ error: '获取社区动态列表失败', details: error.message })
    }
}

/**
 * 创建动态
 * POST /api/communities/:communityId/posts
 */
export const createPost = async (req: AuthRequest, res: Response) => {
    try {
        const user = req.user
        if (!user) {
            return res.status(401).json({ error: '未授权' })
        }

        const communityId = req.params.communityId
        const { postId, content, images, taskId }: CreatePostParams & { postId?: string } = req.body

        // 验证必填字段
        if (!content || !content.trim()) {
            return res.status(400).json({ error: '动态内容不能为空' })
        }

        // 验证图片数量（最多9张）
        if (images && images.length > 9) {
            return res.status(400).json({ error: '最多只能上传9张图片' })
        }

        // 如果前端提供了 postId（预生成的UUID），直接使用；否则后端生成
        const finalPostId = postId || randomUUID()

        // 创建动态记录（使用预生成的 postId）
        const { data: post, error: createError } = await supabase
        .from('community_posts')
        .insert({
            id: finalPostId,  // 使用预生成的UUID
            community_id: communityId,
            author_id: user.id,
            content: content.trim(),
            images: images || [],
            task_id: taskId || null,
            is_pinned: false
        })
        .select(`
                *,
                author:users!community_posts_author_id_fkey (
                    id,
                    name,
                    avatar,
                    image_url
                ),
                task_info:task_info (
                    id,
                    title
                )
        `)
        .single()

        if (createError) {
            // 如果是主键冲突，说明前端预生成的UUID已存在（极小概率）
            if (createError.code === '23505') {
                // 重新生成UUID重试
                const retryPostId = randomUUID()
                const { data: retryPost, error: retryError } = await supabase
                    .from('community_posts')
                    .insert({
                        id: retryPostId,
                        community_id: communityId,
                        author_id: user.id,
                        content: content.trim(),
                        images: images || [],
                        task_id: taskId || null,
                        is_pinned: false
                    })
                    .select(`
                        *,
                        author:users!community_posts_author_id_fkey (
                            id,
                            name,
                            avatar,
                            image_url
                        ),
                        task_info:task_info (
                            id,
                            title
                        )
                    `)
                    .single()

                if (retryError) throw retryError

                const transformed = transformPost(retryPost)
                transformed.likesCount = 0
                transformed.commentsCount = 0
                transformed.isLiked = false

                return res.status(201).json(transformed)

            }
            throw createError
        }

        // 转换并返回
        const transformed = transformPost(post)
        transformed.likesCount = 0
        transformed.commentsCount = 0
        transformed.isLiked = false

        res.status(201).json(transformed)
    } catch (error: any) {
        console.error('创建动态失败:', error)
        res.status(500).json({ error: '创建动态失败', details: error.message })
    }
}

/**
 * 获取动态详情
 * GET /api/posts/:postId
 */
export const getPostById = async (req: AuthRequest, res: Response) => {
    try {
        const postId = req.params.postId
        const userId = req.user?.id

        // 查询动态详情
        const { data: post, error: postError } = await supabase
            .from('community_posts')
            .select(`
                *,
                author:users!community_posts_author_id_fkey (
                    id,
                    name,
                    avatar,
                    image_url
                ),
                task_info:task_info (
                    id,
                    title
                )
            `)
            .eq('id', postId)
            .single()
        
        if (postError) {
            if (postError.code === 'PGRST116') {
                return res.status(404).json({ error: '动态不存在' })
            }
            throw postError
        }

    // 获取点赞数和评论数
    const { count: likesCount } = await supabase
        .from('community_post_likes')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', postId)
    
    const { count: commentsCount } = await supabase
        .from('community_post_comments')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', postId)
    
        // 检查当前用户是否点赞
        let isLiked = false
        if (userId) {
            const { data: like } = await supabase
            .from('community_post_likes')
            .select('id')
            .eq('post_id', postId)
            .eq('user_id', userId)
            .single()
            isLiked = !!like
        }

        const transformed = transformPost(post)
        transformed.likesCount = likesCount || 0
        transformed.commentsCount = commentsCount || 0
        transformed.isLiked = isLiked

        res.json(transformed)
    } catch (error: any) {
        console.error('获取动态详情失败:', error)
        res.status(500).json({ error: '获取动态详情失败', details: error.message })
    }
}

/**
 * 删除动态
 * DELETE /api/posts/:postId
 */
export const deletePost = async (req: AuthRequest, res: Response) => {
    try {
        const user = req.user
        if (!user) {
            return res.status(401).json({ error: '未授权' })
        }

        const postId = req.params.postId

        // 查询动态
        const { data: post, error: postError } = await supabase
            .from('community_posts')
            .select('id, author_id')
            .eq('id', postId)
            .single()

        if (postError) {
                if (postError.code === 'PGRST116') {
                    return res.status(404).json({ error: '动态不存在' })
                }
                throw postError
        }

        // 权限检查：只有作者可以删除（TODO: 添加管理员权限检查）
        if (post.author_id !== user.id) {
            return res.status(403).json({ error: '无权删除此动态' })
        }

        // 删除动态（CASCADE会自动删除评论和点赞）
        const { error: deleteError } = await supabase
            .from('community_posts')
            .delete()
            .eq('id', postId)

        if (deleteError) throw deleteError
    
        res.json({ success: true, message: '动态已删除' })
    } catch (error: any) {
        console.error('删除动态失败:', error)
        res.status(500).json({ error: '删除动态失败', details: error.message })
    }
}

/**
 * 获取动态评论列表
 * GET /api/posts/:postId/comments
 */
export const getPostComments = async (req: AuthRequest, res: Response) => {
    try {
        const postId = req.params.postId

        // 查询评论列表（按时间正序），含被回复人信息
        const { data: comments, error: commentsError } = await supabase
            .from('community_post_comments')
            .select(`
                *,
                author:users!community_post_comments_author_id_fkey (
                    id,
                    name,
                    avatar,
                    image_url
                ),
                reply_to_user:users!community_post_comments_reply_to_user_id_fkey (
                    id,
                    name
                )
            `)
            .eq('post_id', postId)
            .order('created_at', { ascending: true })

        if (commentsError) throw commentsError

        // 获取总数
        const { count } = await supabase
            .from('community_post_comments')
            .select('*', { count: 'exact', head: true })
            .eq('post_id', postId)

        const transformedComments = (comments || []).map(transformComment)

        const response: GetCommentsResponse = {
            comments: transformedComments,
            total: count || 0
        }

        res.json(response)
    } catch (error: any) {
        console.error('获取评论列表失败:', error)
        res.status(500).json({ error: '获取评论列表失败', details: error.message })
    }
}

/**
 * 创建评论
 * POST /api/posts/:postId/comments
 */
export const createComment = async (req: AuthRequest, res: Response) => {
    try {
        const user = req.user
        if (!user) {
            return res.status(401).json({ error: '未授权' })
        }

        const postId = req.params.postId
        const { content, replyToUserId }: CreateCommentParams = req.body

        // 验证必填字段
        if (!content || !content.trim()) {
            return res.status(400).json({ error: '评论内容不能为空' })
        }

        // 验证评论长度（最多500字）
        if (content.length > 500) {
            return res.status(400).json({ error: '评论内容不能超过500字' })
        }

        // 验证动态是否存在
        const { data: post } = await supabase
            .from('community_posts')
            .select('id')
            .eq('id', postId)
            .single()

        if (!post) {
            return res.status(404).json({ error: '动态不存在' })
        }

        // 若指定回复某人，校验该用户存在
        if (replyToUserId) {
            const { data: replyToUser } = await supabase
                .from('users')
                .select('id')
                .eq('id', replyToUserId)
                .single()
            if (!replyToUser) {
                return res.status(400).json({ error: '被回复用户不存在' })
            }
        }

        // 创建评论
        const insertPayload: Record<string, unknown> = {
            post_id: postId,
            author_id: user.id,
            content: content.trim()
        }
        if (replyToUserId) insertPayload.reply_to_user_id = replyToUserId

        const { data: comment, error: createError } = await supabase
            .from('community_post_comments')
            .insert(insertPayload)
            .select(`
                *,
                author:users!community_post_comments_author_id_fkey (
                    id,
                    name,
                    avatar,
                    image_url
                ),
                reply_to_user:users!community_post_comments_reply_to_user_id_fkey (
                    id,
                    name
                )
            `)
            .single()

        if (createError) throw createError

        const transformed = transformComment(comment)
        res.status(201).json(transformed)
    } catch (error: any) {
        console.error('创建评论失败:', error)
        res.status(500).json({ error: '创建评论失败', details: error.message })
    }
}

/**
 * 删除评论
 * DELETE /api/comments/:commentId
 */
export const deleteComment = async (req: AuthRequest, res: Response) => {
    try {
        const user = req.user
        if (!user) {
            return res.status(401).json({ error: '未授权' })
        }

        const commentId = req.params.commentId

        // 查询评论
        const { data: comment, error: commentError } = await supabase
            .from('community_post_comments')
            .select('id, author_id')
            .eq('id', commentId)
            .single()

        if (commentError) {
            if (commentError.code === 'PGRST116') {
                return res.status(404).json({ error: '评论不存在' })
            }
            throw commentError
        }

        // 权限检查：只有作者可以删除（TODO: 添加管理员权限检查）
        if (comment.author_id !== user.id) {
            return res.status(403).json({ error: '无权删除此评论' })
        }

        // 删除评论
        const { error: deleteError } = await supabase
            .from('community_post_comments')
            .delete()
            .eq('id', commentId)

        if (deleteError) throw deleteError

        res.json({ success: true, message: '评论已删除' })
    } catch (error: any) {
        console.error('删除评论失败:', error)
        res.status(500).json({ error: '删除评论失败', details: error.message })
    }
}

/**
 * 点赞/取消点赞
 * POST /api/posts/:postId/like
 */
export const toggleLike = async (req: AuthRequest, res: Response) => {
    try {
        const user = req.user
        if (!user) {
            return res.status(401).json({ error: '未授权' })
        }

        const postId = req.params.postId

        // 检查是否已点赞
        const { data: existingLike } = await supabase
            .from('community_post_likes')
            .select('id')
            .eq('post_id', postId)
            .eq('user_id', user.id)
            .single()

        if (existingLike) {
            // 取消点赞
            const { error: deleteError } = await supabase
                .from('community_post_likes')
                .delete()
                .eq('id', existingLike.id)

            if (deleteError) throw deleteError

            res.json({ liked: false, message: '已取消点赞' })
        } else {
            // 点赞
            const { error: insertError } = await supabase
                .from('community_post_likes')
                .insert({
                    post_id: postId,
                    user_id: user.id
                })

            if (insertError) throw insertError

            res.json({ liked: true, message: '已点赞' })
        }
    } catch (error: any) {
        console.error('点赞操作失败:', error)
        res.status(500).json({ error: '点赞操作失败', details: error.message })
    }
}

/**
 * 获取点赞列表
 * GET /api/posts/:postId/likes
 */
export const getPostLikes = async (req: AuthRequest, res: Response) => {
    try {
        const postId = req.params.postId

        // 查询点赞列表
        const { data: likes, error: likesError } = await supabase
            .from('community_post_likes')
            .select(`
                *,
                user:users!community_post_likes_user_id_fkey (
                    id,
                    name,
                    avatar,
                    image_url
                )
            `)
            .eq('post_id', postId)
            .order('created_at', { ascending: false })

        if (likesError) throw likesError

        const transformedLikes: Like[] = (likes || []).map(like => ({
            id: like.id,
            postId: like.post_id,
            userId: like.user_id,
            createdAt: like.created_at,
            user: like.user ? {
                id: like.user.id,
                name: like.user.name,
                avatar: like.user.avatar || like.user.image_url
            } : undefined
        }))

        res.json({ likes: transformedLikes, total: transformedLikes.length })
    } catch (error: any) {
        console.error('获取点赞列表失败:', error)
        res.status(500).json({ error: '获取点赞列表失败', details: error.message })
    }
}

/**
 * 置顶动态
 * POST /api/posts/:postId/pin
 */
export const pinPost = async (req: AuthRequest, res: Response) => {
    try {
        const user = req.user
        if (!user) {
            return res.status(401).json({ error: '未授权' })
        }

        const postId = req.params.postId
        const { data: post } = await supabase.from('community_posts').select('community_id').eq('id', postId).single()
        if (!post?.community_id) return res.status(404).json({ error: '动态不存在' })
        const role = await getMemberRole(post.community_id, user.id)
        if (role !== 'super_admin' && role !== 'sub_admin') return res.status(403).json({ error: '仅社区管理员可置顶' })

        const { error: updateError } = await supabase
            .from('community_posts')
            .update({ is_pinned: true })
            .eq('id', postId)

        if (updateError) throw updateError

        res.json({ success: true, message: '动态已置顶' })
    } catch (error: any) {
        console.error('置顶动态失败:', error)
        res.status(500).json({ error: '置顶动态失败', details: error.message })
    }
}

/**
 * 取消置顶
 * POST /api/posts/:postId/unpin
 */
export const unpinPost = async (req: AuthRequest, res: Response) => {
    try {
        const user = req.user
        if (!user) {
            return res.status(401).json({ error: '未授权' })
        }

        const postId = req.params.postId
        const { data: post } = await supabase.from('community_posts').select('community_id').eq('id', postId).single()
        if (!post?.community_id) return res.status(404).json({ error: '动态不存在' })
        const role = await getMemberRole(post.community_id, user.id)
        if (role !== 'super_admin' && role !== 'sub_admin') return res.status(403).json({ error: '仅社区管理员可取消置顶' })

        const { error: updateError } = await supabase
            .from('community_posts')
            .update({ is_pinned: false })
            .eq('id', postId)

        if (updateError) throw updateError

        res.json({ success: true, message: '已取消置顶' })
    } catch (error: any) {
        console.error('取消置顶失败:', error)
        res.status(500).json({ error: '取消置顶失败', details: error.message })
    }
}