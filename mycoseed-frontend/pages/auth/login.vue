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
import { useToast } from '~/composables/useToast'
import { useUserStore } from '~/stores/user'
import { apiUrl, resolvePublicApiBase } from '~/utils/publicApiBase'
import PixelCard from '~/components/pixel/PixelCard.vue'
import PixelButton from '~/components/pixel/PixelButton.vue'
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
  if (import.meta.dev) return true
  const url = config.public.apiUrl || ''
  return url.includes('localhost') || url.includes('127.0.0.1')
})

const devLoggingIn = ref(false)

const mapDevUser = (raw: Record<string, unknown>) => ({
  id: String(raw.id),
  phone: raw.phone as string | undefined,
  email: raw.email as string | undefined,
  handle: raw.handle as string | undefined,
  name: raw.name as string | undefined,
  bio: raw.bio as string | undefined,
  avatar: (raw.avatar || raw.image_url) as string | undefined,
  phone_verified: Boolean(raw.phone_verified ?? true),
  isSystemAdmin: Boolean(raw.isSystemAdmin),
  userType: 'member' as const,
  isProfileSetup: !!(raw.name || raw.handle),
})

const handleDevLogin = async (userIndex: number) => {
  devLoggingIn.value = true
  try {
    const data = await devLogin(userIndex)
    if (!data.auth_token) {
      throw new Error('未返回登录凭证')
    }
    if (data.user) {
      userStore.setUser(mapDevUser(data.user))
    }
    await userStore.getUser(true)
    if (!userStore.user) {
      throw new Error('登录成功但会话未生效，请确认后端已设置 DEV_BYPASS_AUTH=true 与 SESSION_SECRET')
    }
    toast.add({ title: '开发者登录成功', description: `已登录为 ${userStore.user.name || '开发者'}`, color: 'green' })
    router.push('/')
  } catch (error: any) {
    toast.add({ title: '开发者登录失败', description: error.message, color: 'red' })
  } finally {
    devLoggingIn.value = false
  }
}

const handleOAuth2Login = () => {
  const base = resolvePublicApiBase(config.public.apiUrl as string)
  // redirect_uri 由 Fly REDIRECT_URI；return_origin 让登录后回到当前 BAI 域名
  const returnOrigin = encodeURIComponent(window.location.origin)
  window.location.href = apiUrl(
    `/api/auth/semi/login?return_origin=${returnOrigin}`,
    base
  )
}

</script>

