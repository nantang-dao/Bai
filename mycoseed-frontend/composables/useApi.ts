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
    devLogin: (userIndex: number) => api.devLogin(userIndex, apiBaseUrl),  // [DEV_BYPASS]
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
    withdrawTask: (taskId: string) => api.withdrawTask(taskId, apiBaseUrl),
    deleteTask: (taskId: string) => api.deleteTask(taskId, apiBaseUrl),
    
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
    withdrawPost: (postId: string) => api.withdrawPost(postId, apiBaseUrl),
    getPostComments: (postId: string) => api.getPostComments(postId, apiBaseUrl),
    createComment: (params: api.CreateCommentParams) => api.createComment(params, apiBaseUrl),
    deleteComment: (commentId: string) => api.deleteComment(commentId, apiBaseUrl),
    togglePostLike: (postId: string) => api.togglePostLike(postId, apiBaseUrl),
    getPostLikes: (postId: string) => api.getPostLikes(postId, apiBaseUrl),
    pinPost: (postId: string) => api.pinPost(postId, apiBaseUrl),
    unpinPost: (postId: string) => api.unpinPost(postId, apiBaseUrl),
    uploadPostImage: (params: { postId: string; communityId: string | null; files: File[] }) =>
      api.uploadPostImage({ ...params, baseUrl: apiBaseUrl }),

    // FAQ / 帮助
    getFaqs: (params?: api.GetFaqsParams) => api.getFaqs(params, apiBaseUrl),
    getFaqById: (id: string) => api.getFaqById(id, apiBaseUrl),

    // 通知 / 消息
    getNotificationSummary: (params?: { communityId?: string | null }) => api.getNotificationSummary(params, apiBaseUrl),
    listNotifications: (params?: { communityId?: string | null; category?: api.NotificationCategory; limit?: number; offset?: number }) =>
      api.listNotifications(params, apiBaseUrl),
    markNotificationsRead: (body?: { ids?: string[]; category?: api.NotificationCategory; communityId?: string | null }) =>
      api.markNotificationsRead(body, apiBaseUrl),
    getNotificationSettings: () => api.getNotificationSettings(apiBaseUrl),
    updateNotificationSettings: (patch: Partial<Omit<api.NotificationSettings, 'user_id'>>) =>
      api.updateNotificationSettings(patch, apiBaseUrl),

    // 社区商城
    uploadMarketplaceImages: (params: Omit<Parameters<typeof api.uploadMarketplaceImages>[0], 'baseUrl'>) =>
      api.uploadMarketplaceImages({ ...params, baseUrl: apiBaseUrl }),
    getMarketplaceTags: (communityId: string) => api.getMarketplaceTags(communityId, apiBaseUrl),
    createMarketplaceTag: (communityId: string, body: { name: string; colorHex?: string }) =>
      api.createMarketplaceTag(communityId, body, apiBaseUrl),
    updateMarketplaceTag: (communityId: string, tagId: string, body: { name?: string; colorHex?: string }) =>
      api.updateMarketplaceTag(communityId, tagId, body, apiBaseUrl),
    deleteMarketplaceTag: (communityId: string, tagId: string) => api.deleteMarketplaceTag(communityId, tagId, apiBaseUrl),
    listMarketplaceListings: (communityId: string, params?: { q?: string; tagId?: string; limit?: number; offset?: number }) =>
      api.listMarketplaceListings(communityId, params || {}, apiBaseUrl),
    getMarketplaceListing: (communityId: string, listingId: string) =>
      api.getMarketplaceListing(communityId, listingId, apiBaseUrl),
    createMarketplaceListing: (communityId: string, body: Parameters<typeof api.createMarketplaceListing>[1]) =>
      api.createMarketplaceListing(communityId, body, apiBaseUrl),
    updateMarketplaceListing: (communityId: string, listingId: string, body: Parameters<typeof api.updateMarketplaceListing>[2]) =>
      api.updateMarketplaceListing(communityId, listingId, body, apiBaseUrl),
    withdrawMarketplaceListing: (communityId: string, listingId: string) =>
      api.withdrawMarketplaceListing(communityId, listingId, apiBaseUrl),
    lockMarketplaceListing: (communityId: string, listingId: string) =>
      api.lockMarketplaceListing(communityId, listingId, apiBaseUrl),
    confirmMarketplaceSold: (communityId: string, listingId: string) =>
      api.confirmMarketplaceSold(communityId, listingId, apiBaseUrl),
    cancelMarketplaceLock: (communityId: string, listingId: string) =>
      api.cancelMarketplaceLock(communityId, listingId, apiBaseUrl),
    submitMarketplaceReview: (communityId: string, listingId: string, body: { rating: number; content?: string }) =>
      api.submitMarketplaceReview(communityId, listingId, body, apiBaseUrl),
    listMarketplaceCommunityReviews: (communityId: string, params?: { limit?: number; offset?: number }) =>
      api.listMarketplaceCommunityReviews(communityId, params || {}, apiBaseUrl),

    listCalendarTags: (communityId: string) => api.listCalendarTags(communityId, apiBaseUrl),
    createCalendarTag: (communityId: string, body: { name: string; colorHex?: string }) =>
      api.createCalendarTag(communityId, body, apiBaseUrl),
    updateCalendarTag: (communityId: string, tagId: string, body: { name?: string; colorHex?: string }) =>
      api.updateCalendarTag(communityId, tagId, body, apiBaseUrl),
    deleteCalendarTag: (communityId: string, tagId: string) => api.deleteCalendarTag(communityId, tagId, apiBaseUrl),
    listCommunityEvents: (communityId: string, params?: { tagId?: string; mine?: boolean; limit?: number; offset?: number }) =>
      api.listCommunityEvents(communityId, params || {}, apiBaseUrl),
    listCommunityEventsCalendar: (communityId: string, params: { from: string; to: string; tagId?: string; mine?: boolean }) =>
      api.listCommunityEventsCalendar(communityId, params, apiBaseUrl),
    getCommunityEvent: (communityId: string, eventId: string) => api.getCommunityEvent(communityId, eventId, apiBaseUrl),
    createCommunityEvent: (communityId: string, body: Record<string, unknown>) =>
      api.createCommunityEvent(communityId, body, apiBaseUrl),
    deleteCommunityEvent: (communityId: string, eventId: string) => api.deleteCommunityEvent(communityId, eventId, apiBaseUrl),
    pinCommunityEvent: (communityId: string, eventId: string, isPinned: boolean) =>
      api.pinCommunityEvent(communityId, eventId, isPinned, apiBaseUrl),
    registerCommunityEvent: (communityId: string, eventId: string, body: { occurrenceId: string; optionId?: string; remark?: string }) =>
      api.registerCommunityEvent(communityId, eventId, body, apiBaseUrl),
    cancelCommunityEventRegistration: (communityId: string, eventId: string, occurrenceId: string) =>
      api.cancelCommunityEventRegistration(communityId, eventId, occurrenceId, apiBaseUrl),
    
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





