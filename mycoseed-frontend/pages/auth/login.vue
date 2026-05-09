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
import { useToast } from '~/composables/useToast'
definePageMeta({
  layout: 'unauth'
})

const router = useRouter()
const toast = useToast()
const config = useRuntimeConfig()

const handleOAuth2Login = () => {
  const apiUrl = config.public.apiUrl
  if (!apiUrl) {
    toast.add({
      title: '配置错误',
      description: '后端 API URL 未配置（NUXT_PUBLIC_API_URL）',
      color: 'red'
    })
    return
  }

  // Hola-aligned：OAuth 逻辑全部由后端完成（PKCE / token exchange / session）
  window.location.href = `${apiUrl}/api/auth/semi/login`
}

</script>

