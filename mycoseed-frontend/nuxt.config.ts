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
      // Semi OAuth2 配置（从环境变量读取，生产环境必须在 Vercel 中配置）
      // 开发环境提供默认值方便本地开发，生产环境必须通过环境变量配置
      semiApiUrl: env.NUXT_PUBLIC_SEMI_API_URL || (nodeEnv === 'development' ? 'https://testsemi.ntdao.xyz' : ''),
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
