// composables/useApi.ts
import * as api from '~/utils/api'
import type { UserProfile } from '~/utils/api'

/**
 * API Composable - 使用运行时配置获取 API URL
 * 这个 composable 从 Nuxt 的 runtimeConfig 中获取 API URL，
 * 确保在运行时动态获取，而不是构建时固定
 */
export const useApi = () => {
  // 使用 Nuxt 的运行时配置获取 API URL
  const config = useRuntimeConfig()
  const apiBaseUrl = config.public.apiUrl 
  
  return {
    apiBaseUrl,
    
    // 认证相关 API
    sendSMS: (phone: string) => api.sendSMS(phone, apiBaseUrl),
    signIn: (identifier: string, code: string) => api.signIn(identifier, code, apiBaseUrl),
    signInWithEmail: (email: string, code: string, userType?: 'member' | 'community') => 
      api.signInWithEmail(email, code, apiBaseUrl, userType),
    getMe: () => api.getMe(apiBaseUrl),
    
    getActivityFeed: () => api.getActivityFeed(),
    // 任务相关 API
    getAllTasks: () => api.getAllTasks(apiBaseUrl),
    getTaskById: (id: string) => api.getTaskById(id, apiBaseUrl),
    createTask: (params: api.CreateTaskParams) => api.createTask(params, apiBaseUrl),
    claimTask: (taskId: string, userIdentifier?: string) => api.claimTask(taskId, apiBaseUrl, userIdentifier),
    submitProof: (taskId: string, proof: api.ProofData) => api.submitProof(taskId, proof, apiBaseUrl),
    getTasks: (activityId: number) => api.getTasks(activityId, apiBaseUrl),
    getMyTasks: () => api.getMyTasks(apiBaseUrl),
    getReviewTasks: () => api.getReviewTasks(apiBaseUrl),

    // 文件上传
    uploadAvatar: (file: File) => api.uploadAvatar(file, apiBaseUrl),
    uploadProofFile: (files: File[], taskId: string) => api.uploadProofFile(files, taskId, apiBaseUrl),
    
    // 活动相关 API（暂时返回空数据）
    getActivities: api.getActivities,
    getActivityById: api.getActivityById,
    joinActivity: api.joinActivity,
    
    // 审核相关 API
    approveTask: (taskId: string, comments?: string) => api.approveTask(taskId, apiBaseUrl, comments),
    rejectTask: (taskId: string, reason: string, rejectOption?: 'resubmit' | 'reclaim') => api.rejectTask(taskId, reason, apiBaseUrl, rejectOption),
    
    // 社群相关 API（暂时返回空数据）
    getCommunities: api.getCommunities,
    getCommunityById: api.getCommunityById,
    getCommunityMembers: api.getCommunityMembers,
    getMembers: api.getMembers,
    getMemberById: api.getMemberById,
    getNetworkData: api.getNetworkData,

    // 社区圈动态/评论/点赞 API（调用后端）
    getCommunityPosts: (params: api.GetCommunityPostsParams) => api.getCommunityPosts(params, apiBaseUrl),
    createPost: (params: api.CreatePostParams) => api.createPost(params, apiBaseUrl),
    getPostById: (postId: string) => api.getPostById(postId, apiBaseUrl),
    deletePost: (postId: string) => api.deletePost(postId, apiBaseUrl),
    getPostComments: (postId: string) => api.getPostComments(postId, apiBaseUrl),
    createComment: (params: api.CreateCommentParams) => api.createComment(params, apiBaseUrl),
    deleteComment: (commentId: string) => api.deleteComment(commentId, apiBaseUrl),
    togglePostLike: (postId: string) => api.togglePostLike(postId, apiBaseUrl),
    getPostLikes: (postId: string) => api.getPostLikes(postId, apiBaseUrl),
    pinPost: (postId: string) => api.pinPost(postId, apiBaseUrl),
    unpinPost: (postId: string) => api.unpinPost(postId, apiBaseUrl),
    uploadPostImage: (params: { postId: string; communityId: string | null; files: File[] }) =>
      api.uploadPostImage({ ...params, baseUrl: apiBaseUrl }),
    
    // 其他工具函数（不需要 API URL）
    AUTH_TOKEN_KEY: api.AUTH_TOKEN_KEY,
    getCookie: api.getCookie,
    setCookie: api.setCookie,
    deleteCookie: api.deleteCookie,
    clearAuthToken: api.clearAuthToken,
    setCurrentIdentifier: api.setCurrentIdentifier,
    getFinalReward: api.getFinalReward,
    updateUserProfile: (userId: string | number, profile: UserProfile) => api.updateUserProfile(userId, profile, apiBaseUrl),
    updateCommunityProfile: api.updateCommunityProfile,
    sendEmailCode: api.sendEmailCode,
  }
}





