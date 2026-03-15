import { defineStore } from 'pinia'
// 直接导入 semi 的 API - 已注释，使用本地mock API
// import { AUTH_TOKEN_KEY, getCookie, clearAuthToken, getMe } from '../../../semi/semi-app-main/utils/semi_api'
import { AUTH_TOKEN_KEY, getCookie, clearAuthToken, getMe } from '~/utils/api'

export interface User {
    id: string
    phone?: string
    email?: string
    handle?: string
    name?: string
    bio?: string
    avatar?: string
    phone_verified: boolean
    created_at?: string
    updated_at?: string
    userType?: 'member' | 'community'
    isProfileSetup?: boolean
    isSystemAdmin?: boolean  // 是否为系统管理员
}

export const useUserStore = defineStore('user', {
    state: () => ({
        user: null as User | null,
    }),
    getters: {
        isAuthenticated: (state) => !!state.user,
        isMember: (state) => (state.user?.userType || 'member') === 'member',
        isCommunity: (state) => state.user?.userType === 'community',
        isSystemAdmin: (state) => !!state.user?.isSystemAdmin,
        needsProfileSetup: (state) => {
            if (!state.user) return false
            // 根据 name 或 handle 是否存在判断是否完成资料设置
            return !state.user.isProfileSetup && !state.user.name && !state.user.handle
        },
        // 计算属性：从 phone 或 email
        identifier: (state) => {
            if (!state.user) return ''
            return state.user.phone || state.user.email || ''
        },
        // 计算属性：判断 identifierType
        identifierType: (state): 'phone' | 'email' => {
            if (!state.user) return 'phone'
            return state.user.phone ? 'phone' : 'email'
        },
    },
    actions: {
        async getUser(force = false) {
            if (this.user && !force) {
                return this.user
            }
            
            if (getCookie(AUTH_TOKEN_KEY)) {
              // 在 store 中获取运行时配置
              const config = useRuntimeConfig()
              const apiBaseUrl = config.public.apiUrl 
              const userData = await getMe(apiBaseUrl)

              // 映射后端数据到前端 User 类型
              this.user = {
                ...userData,
                userType: 'member' as 'member' | 'community',
                isProfileSetup: !!userData.name
              }
              return this.user
            }

            return null
        },
        async signout() {
            // 清除认证 token
            clearAuthToken()
            // 清除用户状态
            this.user = null
            // 清除当前标识符（localStorage）
            if (typeof window !== 'undefined') {
                localStorage.removeItem('current_identifier')
            }
        },
        setUser(user: User | null) {
            this.user = user
        }
    }
})
