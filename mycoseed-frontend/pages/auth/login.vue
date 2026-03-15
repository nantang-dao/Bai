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
definePageMeta({
  layout: 'unauth'
})

const router = useRouter()
const toast = useToast()
const config = useRuntimeConfig()

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

