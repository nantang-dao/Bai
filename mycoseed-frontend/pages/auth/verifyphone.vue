<template>
  <div class="flex flex-col container-size rounded-xl bg-[var(--ui-bg)] shadow-lg p-4">
    <UButton icon="i-heroicons-arrow-left" variant="ghost" class="self-start mb-4"
      @click="router.push('/auth/login')">
      返回
    </UButton>
    <div class="flex flex-col items-center justify-center h-full gap-4 py-8 w-[80%] mx-auto">
      <h1 class="text-2xl font-bold">验证手机号</h1>
      <div>请输入<span class="text-primary font-semibold mx-1">
        {{ phone.length >= 7 ? `${phone.slice(0, 3)}...${phone.slice(-4)}` : phone }}
      </span>收到的6位验证码</div>
      <UForm :state="formState" @submit="onSubmit" class="w-full">
        <UFormField name="pin">
          <div class="flex gap-2 justify-center">
            <input 
              v-for="(digit, index) in formState.pin" 
              :key="index"
              v-model="formState.pin[index]"
              type="text"
              maxlength="1"
              class="w-12 h-12 text-center text-xl font-bold border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
              :disabled="loading"
              @input="handlePinInput(index, $event)"
              @keydown="handleKeydown(index, $event)"
            />
          </div>
        </UFormField>
        <div class="flex justify-between items-center mt-2">
          <UButton type="button" variant="ghost" :disabled="countdown > 0 || loading"
            @click="resendCode">
            {{ countdown > 0 ? `重新发送(${countdown})` : '重新发送验证码' }}
          </UButton>
        </div>
        <UButton type="submit" color="primary" class="w-full mt-4 flex justify-center items-center" size="xl"
          :loading="loading" :disabled="loading">
          验证
        </UButton>
      </UForm>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
// import { sendSMS, signIn, getMe } from '../../../semi/semi-app-main/utils/semi_api' // 已注释，使用本地mock API
import { sendSMS, signIn, getMe, getApiBaseUrl } from '~/utils/api'
import { useUserStore } from '~/stores/user'

definePageMeta({
  layout: 'unauth'
})

const router = useRouter()
const route = useRoute()
const config = useRuntimeConfig()
// 清理手机号：只保留数字字符，防止 URL 参数中包含额外字符（如字母）
// 防御性处理：先移除 ? 和 & 及其后面的内容（处理 URL 格式错误的情况）
// 例如：如果 rawPhone 是 "19145787814?redirect=oauth"，先分割取第一部分
const phone = computed(() => {
  const rawPhone = route.query.phone as string || ''
  // 防御性处理：先移除 ? 和 & 及其后面的内容（处理 URL 格式错误的情况）
  const cleaned = rawPhone.split('?')[0].split('&')[0]
  // 只保留数字字符
  return cleaned.replace(/\D/g, '')
})
const loading = ref(false)
const countdown = ref(60)
const toast = useToast()

const formState = reactive({
  pin: Array(6).fill('')
})

const userStore = useUserStore()

const handlePinInput = (index: number, event: Event) => {
  const target = event.target as HTMLInputElement
  const value = target.value
  
  // 只允许数字
  if (!/^\d$/.test(value) && value !== '') {
    target.value = ''
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

const validatePin = (pin: string[]) => {
  if (pin.length !== 6) return '请输入6位验证码'
  if (!pin.every(digit => /^\d$/.test(digit))) return '验证码必须为数字'
  return true
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
    const baseUrl = config.public.apiUrl || getApiBaseUrl()
    await sendSMS(phone.value, baseUrl)
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
    const validation = validatePin(formState.pin)
    if (validation === true) {
      const baseUrl = config.public.apiUrl || getApiBaseUrl()
      const response = await signIn(phone.value, formState.pin.join(''), baseUrl)
      if (response.result === 'ok') {
        toast.add({
          title: '验证成功',
          description: '正在跳转到首页'
        })

        const user = await getMe(baseUrl)
        console.log('[user]:', user)

        if (!user.encrypted_keys) {
          router.replace('/paymentcode')
          return
        }

        // 确保包含必要的字段
        const userWithMetadata = {
          ...user,
          isProfileSetup: !!user.name, // 根据是否有 name 判断是否完成设置
          userType: user.userType || 'member' // 保持原有类型或默认 member
        }
        userStore.setUser(userWithMetadata)
        await router.push('/')
        return
      } else {
        toast.add({
          title: '验证失败',
          description: '请检查验证码是否正确'
        })
      }
    } else {
      toast.add({
        title: '请输入正确的验证码',
        description: validation
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
  startCountdown()
})
</script>

