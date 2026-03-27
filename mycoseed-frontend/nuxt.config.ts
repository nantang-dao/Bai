// https://nuxt.com/docs/api/configuration/nuxt-config
import { loadEnv } from 'vite'

// 根据 NODE_ENV 加载对应的环境变量文件
const nodeEnv = process.env.NODE_ENV || 'development'
const env = loadEnv(nodeEnv, process.cwd(), '')

export default defineNuxtConfig({
  devtools: { enabled: true },
  modules: [
    '@nuxt/ui',
    '@pinia/nuxt',
    '@nuxt/icon'
  ],
  // #region agent log
  // Logging config load (server-side only)
  // #endregion
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    public: {
      // 开发环境默认使用本地后端，生产环境使用云端
      apiUrl: env.NUXT_PUBLIC_API_URL || (nodeEnv === 'development' ? 'http://localhost:3001' : 'https://mycoseed-backend.fly.dev'),
      amapApiKey: env.AMAP_API_KEY || 'YOUR_AMAP_API_KEY_HERE',
      // Semi 前端跳转基址（用于打开 /transfer 等页面）
      semiAppUrl: env.NUXT_PUBLIC_SEMI_APP_URL || (nodeEnv === 'development' ? 'http://localhost:3000' : ''),
      // Semi Rails API（/get_me 等）：必须通过 NUXT_PUBLIC_SEMI_API_URL 配置，无内置默认
      // 其余 OAuth 项亦依赖环境变量；redirect URI 在开发环境仍有下方默认回调地址
      semiApiUrl: env.NUXT_PUBLIC_SEMI_API_URL || '',
      semiOAuthUrl: env.NUXT_PUBLIC_SEMI_OAUTH_URL || '',
      // clientId 不提供默认值，必须通过环境变量配置（安全考虑）
      semiClientId: env.NUXT_PUBLIC_SEMI_CLIENT_ID || '',
      semiRedirectUri: env.NUXT_PUBLIC_SEMI_REDIRECT_URI || 
        (nodeEnv === 'development' 
          ? 'http://localhost:3003/auth/callback'
          : ''),
    }
  },
  // 配置UI主题
  ui: {
    global: true,
    // @ts-expect-error nuxt/ui types in this repo may not include icons
    icons: ['heroicons']
  }
})
