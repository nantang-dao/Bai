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
      // Mycoseed Backend base URL (auth/session + business APIs)
      apiUrl: env.NUXT_PUBLIC_API_URL || '',

      // Frontend base URL (optional; used for absolute links if needed)
      appUrl: env.NUXT_PUBLIC_APP_URL || (nodeEnv === 'development' ? 'http://localhost:3003' : ''),

      // Semi App base URL (business-page jumps: /transfer, /taskpool/prepay, etc.)
      semiAppUrl: env.NUXT_PUBLIC_SEMI_APP_URL || (nodeEnv === 'development' ? 'http://localhost:3000' : ''),

      // Chain / TaskPool config (exposed to client)
      chainId: Number(env.NUXT_PUBLIC_CHAIN_ID || '10'),
      taskpoolProxyAddress: env.NUXT_PUBLIC_TASKPOOL_PROXY_ADDRESS,
      ntTokenAddress: env.NUXT_PUBLIC_NT_TOKEN_ADDRESS || '0x7563cb33148cD2b929ed85e69F697be13b515Bd0',
      opRpcUrl: env.NUXT_PUBLIC_OP_RPC_URL || 'https://mainnet.optimism.io',
    }
  },
  // 配置UI主题
  ui: {
    global: true,
    // @ts-expect-error nuxt/ui types in this repo may not include icons
    icons: ['heroicons']
  }
})
