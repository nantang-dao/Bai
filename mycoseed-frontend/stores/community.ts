import { defineStore } from 'pinia'
import { AUTH_TOKEN_KEY, getCookie, getCommunities, getCommunityById, type Community } from '~/utils/api'

const STORAGE_KEY = 'mycoseed_current_community_id'

/** 当前社区 ID：发布任务、社区圈发帖/列表、公告等均依赖此值，仅通过 setCurrentCommunity / loadFromStorage 更新 */
export const useCommunityStore = defineStore('community', {
  state: () => ({
    currentCommunityId: null as string | null,
    currentCommunity: null as Community | null,
  }),
  
  getters: {
    hasCurrentCommunity: (state) => state.currentCommunityId !== null,
  },
  
  actions: {
    loadFromStorage() {
      if (typeof window === 'undefined') return
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored && stored.trim()) {
        this.currentCommunityId = stored.trim()
      }
    },
    
    /** 切换当前社区（左上角或社区广场进入时调用），保证与 localStorage 同步 */
    async setCurrentCommunity(id: string) {
      const idStr = String(id).trim()
      this.currentCommunityId = idStr
      if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, idStr)
      try {
        this.currentCommunity = await getCommunityById(idStr)
      } catch (error) {
        console.error('Failed to load community:', error)
        this.currentCommunity = null
      }
    },
    
    async initialize() {
      this.loadFromStorage()
      if (this.currentCommunityId) {
        // 未登录/无 token 时不要清空本地选择，等用户完成登录后再自动恢复详情
        if (!getCookie(AUTH_TOKEN_KEY)) {
          this.currentCommunity = null
          return
        }
        try {
          this.currentCommunity = await getCommunityById(this.currentCommunityId)
          return
        } catch (error) {
          console.error('Failed to load stored community:', error)
          // 这里不清空 currentCommunityId / localStorage，避免每次登录都要重新选择社区
          this.currentCommunity = null
        }
      }
      // 不再自动设置默认社区，用户需要手动选择
    },
    
    /** 用于获取当前用户已加入的社区 */
    async getAllCommunities(): Promise<Community[]> {
      try {
        return await getCommunities({ mine: true })
      } catch (_) {
        return []
      }
    },
  },
})




