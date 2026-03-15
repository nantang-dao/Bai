<template>
    <div class="w-full max-w-md mx-auto">
        <PixelCard>
            <template #header>
                <div class="text-center text-xl font-bold text-primary">登录中...</div>
            </template>

            <div class="flex flex-col gap-6 py-4 items-center">
                <div v-if="loading" class="text-center text-lg text-text-body">
                    正在处理登录...
                </div>
                <div v-if="error" class="text-center text-lg text-destructive">
                    {{ error }}
                </div>
            </div>
        </PixelCard>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from '~/composables/useToast'
import { useUserStore } from '~/stores/user'
import { parseFragment, getSemiUserInfo, syncFromSemi } from '~/utils/api'
definePageMeta({
  layout: 'unauth',
  // 移除 ssr: false，确保路由在构建时被正确注册
  // 客户端逻辑在 onMounted 中处理，通过 typeof window 检查确保只在客户端执行
})

const router = useRouter()
const toast = useToast()
const userStore = useUserStore()
const config = useRuntimeConfig()
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  // 确保在客户端执行
  if (typeof window === 'undefined') {
    return
  }

  try {
    // 1. 从 URL fragment 中提取参数
    const hash = window.location.hash
    const params = parseFragment(hash)

    // 2. 提取 access_token
    const accessToken = params.access_token
    if (!accessToken) {
      // 如果没有 access_token，显示错误但不要抛出异常（这样页面可以正常显示）
      error.value = '未找到访问令牌，请重新登录'
      loading.value = false
      
      toast.add({
        title: '登录失败',
        description: '未找到访问令牌，请重新登录',
        color: 'red'
      })
      
      // 3秒后跳转回登录页
      setTimeout(() => {
        router.push('/auth/login')
      }, 3000)
      return
    }
    
    // 3. 立即清理地址栏（移除 fragment，不刷新页面）
    window.history.replaceState(
      {}, 
      document.title, 
      window.location.pathname + window.location.search
    )
    
    // 4. 验证 state（防止 CSRF 攻击）
    const savedState = sessionStorage.getItem('oauth_state')
    const receivedState = params.state

    if (!savedState || savedState !== receivedState) {
      error.value = '无效的状态参数，请重新登录'
      loading.value = false
      
      toast.add({
        title: '登录失败',
        description: '无效的状态参数，请重新登录',
        color: 'red'
      })
      
      setTimeout(() => {
        router.push('/auth/login')
      }, 3000)
      return
    }

    // 清除 state
    sessionStorage.removeItem('oauth_state')

    // 5. 保存 Semi 的 access_token（存储为 semi_token）
    localStorage.setItem('semi_token', accessToken)
    
    const semiApiUrl = config.public.semiApiUrl
    const apiBaseUrl = config.public.apiUrl
    
    // 检查必要的配置
    if (!semiApiUrl || !apiBaseUrl) {
      throw new Error('API 配置不完整，请检查环境变量设置')
    }
    
    // 7. 调用 Semi API 获取用户信息
    const semiUserData = await getSemiUserInfo(accessToken, semiApiUrl)
    
    // ===== DEBUG: 打印 Semi 返回的用户数据 =====
    console.log('=== Semi API 返回的用户数据 ===')
    console.log('Semi User Data:', JSON.stringify(semiUserData, null, 2))
    console.log('Semi User ID:', semiUserData?.id)
    console.log('Semi User Phone:', semiUserData?.phone)
    console.log('Semi User Email:', semiUserData?.email)
    console.log('Semi User Handle:', semiUserData?.handle)
    console.log('Semi User EVM Address:', semiUserData?.evm_chain_address)
    console.log('================================')
    
    // 8. 同步用户信息到 Mycoseed
    const syncResult = await syncFromSemi(semiUserData, apiBaseUrl)
    
    if (syncResult.result === 'ok' && syncResult.auth_token) {
      // 9. 保存 mycoseed 的 auth_token
      localStorage.setItem('auth_token', syncResult.auth_token)
      
      // 10. 获取用户信息并设置到 store
      const user = syncResult.user || semiUserData
      const userWithMetadata = {
        ...user,
        // 使用 name 或 handle 判断是否完成资料设置
        isProfileSetup: !!(user.name || user.handle),
        userType: user.userType || 'member'
      }
      userStore.setUser(userWithMetadata)
      
      // 11. 根据用户状态跳转
      // 判断逻辑：如果既没有 name 也没有 handle，说明是新用户
      if (!user.name && !user.handle) {
        // 新用户，跳转到设置页面
        toast.add({
          title: '注册成功',
          description: '欢迎加入，请完成资料设置',
          color: 'green'
        })
        await router.push('/profile/setup')
      } else {
        // 老用户，跳转到首页
        toast.add({
          title: '登录成功',
          description: '欢迎回来',
          color: 'green'
        })
        await router.push('/')
      }
    } else {
      throw new Error('Failed to sync user')
    }
  } catch (err: any) {
    console.error('OAuth callback error:', err)
    error.value = err.message || '登录失败，请重试'
    loading.value = false
    
    toast.add({
      title: '登录失败',
      description: err.message || '请重试',
      color: 'red'
    })
    
    // 3秒后跳转回登录页
    setTimeout(() => {
      router.push('/auth/login')
    }, 3000)
  }
})
</script>