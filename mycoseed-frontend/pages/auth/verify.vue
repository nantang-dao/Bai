<template>
  <div class="w-full max-w-md">
    <PixelCard>
      <template #header>
        <div class="text-center text-xl font-bold text-primary">验证码</div>
      </template>

      <div class="flex flex-col gap-6 py-4">
        <div class="text-center text-lg text-text-body">
          <div v-if="setPassword" class="mb-2 text-success font-bold text-xl">
            设置密码验证
          </div>
          请输入发送到
          <span class="text-primary font-bold">
            {{ maskedIdentifier }}
          </span>
          的{{ identifierType === 'phone' ? '短信' : '邮件' }}验证码
        </div>

        <!-- 验证码输入 -->
        <div class="space-y-2">
          <label class="block text-base font-bold text-text-body">验证码 (6位数字)</label>
          <div class="flex gap-2 justify-center">
            <input 
              v-for="(digit, index) in formState.pin" 
              :key="index"
              v-model="formState.pin[index]"
              type="text"
              maxlength="1"
              class="w-12 h-12 text-center text-xl font-bold rounded-2xl bg-input-bg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-card border-0"
              :disabled="loading"
              @input="handlePinInput(index, $event)"
              @keydown="handleKeydown(index, $event)"
            />
          </div>
        </div>

        <!-- 重新发送 -->
        <div class="flex justify-between items-center">
          <button
            type="button"
            :disabled="countdown > 0 || loading"
            @click="resendCode"
            class="text-sm font-medium text-primary hover:underline disabled:text-text-placeholder disabled:no-underline"
          >
            {{ countdown > 0 ? `重新发送(${countdown}s)` : '重新发送验证码' }}
          </button>
        </div>

        <PixelButton 
          variant="primary" 
          block 
          size="lg"
          :disabled="loading || !isPinComplete"
          @click="onSubmit"
        >
          {{ loading ? '验证中...' : '验证' }}
        </PixelButton>

        <PixelButton 
          variant="secondary" 
          block 
          @click="router.push('/auth/login')"
        >
          返回登录
        </PixelButton>
      </div>
    </PixelCard>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useApi } from '~/composables/useApi'
import { useUserStore } from '~/stores/user'
import { getApiBaseUrl } from '~/utils/api'
definePageMeta({
  layout: 'unauth'
})

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const toast = useToast()
const { sendSMS, sendEmailCode, signIn, signInWithEmail, getMe, setCurrentIdentifier } = useApi()

const identifier = computed(() => route.query.identifier as string || '')
const identifierType = computed(() => (route.query.type as string) || 'phone')
const userType = computed(() => (route.query.userType as string) || 'member')
const isLogin = computed(() => route.query.isLogin === 'true')
const setPassword = computed(() => route.query.setPassword === 'true')
const password = computed(() => route.query.password as string || '')

const loading = ref(false)
const countdown = ref(60)

const formState = reactive({
  pin: Array(6).fill('')
})

const maskedIdentifier = computed(() => {
  const id = identifier.value
  if (identifierType.value === 'phone') {
    return `${id.slice(0, 3)}****${id.slice(-4)}`
  } else {
    const [local, domain] = id.split('@')
    return `${local.slice(0, 2)}***@${domain}`
  }
})

const isPinComplete = computed(() => {
  return formState.pin.every(digit => /^\d$/.test(digit))
})

const handlePinInput = (index: number, event: Event) => {
  const target = event.target as HTMLInputElement
  const value = target.value
  
  // 只允许数字
  if (!/^\d$/.test(value) && value !== '') {
    target.value = ''
    formState.pin[index] = ''
    return
  }
  
  formState.pin[index] = value
  
  // 自动跳转到下一个输入框
  if (value && index < 5) {
    const nextInput = target.parentElement?.children[index + 1] as HTMLInputElement
    nextInput?.focus()
  }
}

const handleKeydown = (index: number, event: KeyboardEvent) => {
  // 处理退格键
  if (event.key === 'Backspace' && !formState.pin[index] && index > 0) {
    const target = event.target as HTMLInputElement
    const prevInput = target.parentElement?.children[index - 1] as HTMLInputElement
    prevInput?.focus()
  }
}

const startCountdown = () => {
  countdown.value = 60
  const timer = setInterval(() => {
    countdown.value--
    if (countdown.value <= 0) {
      clearInterval(timer)
    }
  }, 1000)
}

const resendCode = async () => {
  if (countdown.value > 0) return
  
  try {
    if (identifierType.value === 'phone') {
      await sendSMS(identifier.value)
    } else {
      await sendEmailCode(identifier.value)
    }
    toast.add({
      title: '验证码已重新发送'
    })
    startCountdown()
  } catch (error) {
    toast.add({
      title: '发送失败',
      description: '请稍后重试'
    })
  }
}

const onSubmit = async () => {
  loading.value = true
  try {
    const pinCode = formState.pin.join('')
    
    if (!isPinComplete.value) {
      loading.value = false
      toast.add({
        title: '请输入完整的验证码'
      })
      return
    }

    // 保存当前标识符
    setCurrentIdentifier(identifier.value)

    // 如果是设置密码流程
    if (setPassword.value && password.value) {
      const baseUrl = getApiBaseUrl()
      const response = await fetch(`${baseUrl}/api/auth/set-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: identifier.value,
          code: pinCode,
          password: password.value
        })
      })
      
      const data = await response.json()
      
      if (data.result === 'ok' && data.auth_token) {
        // 保存认证token
        if (typeof window !== 'undefined') {
          localStorage.setItem('auth_token', data.auth_token)
        }
        
        // 获取用户信息
        const user = await getMe()
        if (user) {
          const userWithMetadata = {
            ...user,
            isProfileSetup: !!user.name,
            userType: user.userType || 'member'
          }
          userStore.setUser(userWithMetadata)
        }
        
        toast.add({
          title: '密码设置成功',
          description: '已自动登录',
          color: 'green'
        })
        
        // 跳转到首页
        await router.push('/')
        return
      } else {
        toast.add({
          title: '设置密码失败',
          description: data.message || '验证码错误或设置失败'
        })
        return
      }
    }

    // 验证码验证（原有逻辑）
    let response
    if (identifierType.value === 'phone') {
      response = await signIn(identifier.value, pinCode)
    } else {
      response = await signInWithEmail(identifier.value, pinCode, isLogin.value ? undefined : userType.value as 'member' | 'community')
    }

    if (response.result === 'ok') {
      // 获取用户信息
      const user = await getMe()
      console.log('[user]:', user)

      if (!user) {
        loading.value = false
        toast.add({
          title: '获取用户信息失败',
          description: '请重试'
        })
        return
      }

      // 准备用户对象，确保包含必要的字段
      const userWithMetadata = {
        ...user,
        isProfileSetup: !!user.name, // 根据是否有 name 判断是否完成设置
        userType: user.userType || (userType.value as 'member' | 'community') || 'member' // 从查询参数或默认值获取
      }

      // 设置用户信息到store
      userStore.setUser(userWithMetadata)

      // 检查是否是新用户且未完成设置（使用 name 判断是否完成设置）
      // 注意：后端不返回 isNewUser 字段，只通过 !user.name 判断
      if (!user.name) {
        // 新用户或未完成设置，根据用户类型跳转到对应的设置页面
        const finalUserType = userWithMetadata.userType
        if (finalUserType === 'community') {
          toast.add({
            title: '注册成功',
            description: '欢迎加入，请完成资料设置'
          })
          await router.push('/community/setup')
        } else {
          toast.add({
            title: '注册成功',
            description: '欢迎加入，请完成资料设置'
          })
          await router.push('/profile/setup')
        }
      } else {
        // 老用户直接登录
        toast.add({
          title: '登录成功',
          description: '欢迎回来'
        })
        await router.push('/')
      }
    } else {
      toast.add({
        title: '验证失败',
        description: '请检查验证码是否正确'
      })
    }
  } catch (error) {
    console.error('验证失败:', error)
    toast.add({
      title: '验证失败',
      description: '请检查验证码是否正确'
    })
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  if (!identifier.value) {
    router.push('/auth/login')
    return
  }
  startCountdown()
})
</script>
