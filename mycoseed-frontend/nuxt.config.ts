// https://nuxt.com/docs/api/configuration/nuxt-config
import { loadEnv } from 'vite'

// 根据 NODE_ENV 加载对应的环境变量文件
const nodeEnv = process.env.NODE_ENV || 'development'
const env = loadEnv(nodeEnv, process.cwd(), '')

export default defineNuxtConfig({
  devtools: { enabled: true },
  modules: [
    './modules/persist-nuxt-paths',
    '@nuxt/ui',
    '@pinia/nuxt',
    '@nuxt/icon'
  ],
  // #region agent log
  // Logging config load (server-side only)
  // #endregion
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    // Upstream Fly URL for server/api/[...] proxy only (not exposed to client bundle)
    backendUrl:
      env.NUXT_BACKEND_URL ||
      env.NUXT_PUBLIC_API_URL ||
      'http://localhost:3001',
    public: {
      // Optional override; leave empty in production for same-origin /api via Vercel proxy
      apiUrl: env.NUXT_PUBLIC_API_URL || '',

      // Frontend base URL (optional; used for absolute links if needed)
      appUrl: env.NUXT_PUBLIC_APP_URL || (nodeEnv === 'development' ? 'http://localhost:3003' : ''),

      // Semi App base URL (business-page jumps: /transfer, /taskpool/prepay, etc.)
      semiAppUrl: env.NUXT_PUBLIC_SEMI_APP_URL || (nodeEnv === 'development' ? 'http://localhost:3000' : ''),

      // Semi Rails API（/get_me 等）：必须通过 NUXT_PUBLIC_SEMI_API_URL 配置，无内置默认
      semiApiUrl: env.NUXT_PUBLIC_SEMI_API_URL || '',
      semiOAuthUrl: env.NUXT_PUBLIC_SEMI_OAUTH_URL || '',
      semiClientId: env.NUXT_PUBLIC_SEMI_CLIENT_ID || '',
      semiRedirectUri: env.NUXT_PUBLIC_SEMI_REDIRECT_URI ||
        (nodeEnv === 'development'
          ? 'http://localhost:3003/auth/callback'
          : ''),

      /** TaskPool V2 Proxy：`verifyingContract`、合约读调用 */
      taskpoolProxyAddress: env.NUXT_PUBLIC_TASKPOOL_PROXY_ADDRESS,
      /** TaskPool V2 admin（平台兜底地址） */
      taskpoolAdminAddress: env.NUXT_PUBLIC_TASKPOOL_ADMIN_ADDRESS,
      /** OP Mainnet = 10 */
      chainId: Number(env.NUXT_PUBLIC_CHAIN_ID || '10'),
      /** OP JSON-RPC（读链、发送交易） */
      opRpcUrl: env.NUXT_PUBLIC_OP_RPC_URL || 'https://mainnet.optimism.io',
      /** NT ERC20 */
      ntTokenAddress:
        env.NUXT_PUBLIC_NT_TOKEN_ADDRESS ||
        '0x7563cb33148cD2b929ed85e69F697be13b515Bd0',
      taskpoolShowInjectedWalletDemo: env.NUXT_PUBLIC_TASKPOOL_SHOW_INJECTED_WALLET_DEMO === 'true',
    }
  },
  // 配置UI主题
  ui: {
    global: true,
    // @ts-expect-error nuxt/ui types in this repo may not include icons
    icons: ['heroicons']
  }
})
