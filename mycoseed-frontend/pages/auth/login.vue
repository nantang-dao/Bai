<template>
  <div class="w-full max-w-md mx-auto">
    <PixelCard>
      <template #header>
        <div class="text-center text-2xl font-bold text-primary">登录</div>
      </template>

      <div class="flex flex-col gap-6 py-4">
        <div class="text-center text-lg text-text-body">
          使用 Semi 账号登录/注册
        </div>

        <PixelButton 
          variant="primary" 
          block 
          size="lg"
          @click="handleOAuth2Login"
        >
          使用 Semi 登录
        </PixelButton>

        <PixelButton 
          variant="secondary" 
          block 
          @click="router.push('/')"
        >
          返回地图
        </PixelButton>

        <!-- [DEV_BYPASS] 开发者免验登录（仅开发环境显示） -->
        <div v-if="isDev" class="mt-4 pt-4 border-t-2 border-dashed border-amber-400">
          <div class="text-center text-sm font-bold text-amber-600 mb-3">
            🛠 开发者免验登录
          </div>
          <div class="flex gap-3">
            <PixelButton
              variant="secondary"
              block
              size="sm"
              :disabled="devLoggingIn"
              @click="handleDevLogin(0)"
            >
              {{ devLoggingIn ? '登录中...' : '👤 开发者A（发包方）' }}
            </PixelButton>
            <PixelButton
              variant="secondary"
              block
              size="sm"
              :disabled="devLoggingIn"
              @click="handleDevLogin(1)"
            >
              {{ devLoggingIn ? '登录中...' : '👤 开发者B（接包方）' }}
            </PixelButton>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="w-full text-center text-sm text-text-placeholder font-medium">
          由 AA 驱动的 Web3 登录
        </div>
      </template>
    </PixelCard>
  </div>
</template>

<script setup lang="ts">
import { buildOAuthUrl, generateRandomState } from '~/utils/api'
import { useToast } from '~/composables/useToast'
import { useUserStore } from '~/stores/user'
definePageMeta({
  layout: 'unauth'
})

const router = useRouter()
const toast = useToast()
const config = useRuntimeConfig()
const userStore = useUserStore()
const { devLogin } = useApi()

const isDev = computed(() => {
  if (process.server) return false
  const url = config.public.apiUrl || ''
  return url.includes('localhost') || url.includes('127.0.0.1')
})

const devLoggingIn = ref(false)

const handleDevLogin = async (userIndex: number) => {
  devLoggingIn.value = true
  try {
    const data = await devLogin(userIndex)
    if (data.auth_token) {
      await userStore.getUser(true)
      toast.add({ title: '开发者登录成功', description: `已登录为 ${data.user?.name || '开发者'}`, color: 'green' })
      router.push('/')
    }
  } catch (error: any) {
    toast.add({ title: '开发者登录失败', description: error.message, color: 'red' })
  } finally {
    devLoggingIn.value = false
  }
}

const handleOAuth2Login = () => {
  const clientId = config.public.semiClientId
  const redirectUri = config.public.semiRedirectUri
  const oauthUrl = config.public.semiOAuthUrl

  // 检查必要的配置
  if (!clientId || !redirectUri || !oauthUrl) {
    toast.add({
      title: '配置错误',
      description: 'OAuth2 配置不完整，请检查环境变量设置',
      color: 'red'
    })
    console.error('OAuth2 配置缺失:', { clientId, redirectUri, oauthUrl })
    return
  }

  // 生成随机 state, 存储到 sessionStorage（用于回调时验证）
  const state = generateRandomState()
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('oauth_state', state)
  }

  // 构建授权 URL 并跳转
  const authUrl = buildOAuthUrl(clientId, redirectUri, state, oauthUrl)
  window.location.href = authUrl
}

</script>

