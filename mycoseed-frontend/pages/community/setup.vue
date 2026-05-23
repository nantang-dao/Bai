<template>
  <div class="min-h-screen pb-24">
    <div class="w-full max-w-2xl mx-auto px-4 py-8">
      <PixelCard>
        <template #header>
          <div class="text-center text-xl font-bold text-primary">设置社区信息</div>
        </template>

        <div class="flex flex-col gap-6 py-4">
          <!-- 头像上传 -->
          <div class="space-y-4">
            <label class="block text-base font-bold text-text-body">社区头像</label>
            <div class="flex flex-col items-center gap-4">
              <div class="relative">
                <div v-if="previewUrl" class="w-32 h-32 border-4 border-black overflow-hidden">
                  <img :src="previewUrl" alt="头像预览" class="w-full h-full object-cover" />
                </div>
                <div v-else class="w-32 h-32 border-4 border-black bg-input-bg flex items-center justify-center">
                  <span class="text-4xl">🏘️</span>
                </div>
                <input
                  ref="fileInput"
                  type="file"
                  accept="image/*"
                  class="hidden"
                  @change="handleFileChange"
                />
              </div>
              <div class="flex gap-2">
                <PixelButton
                  variant="secondary"
                  size="sm"
                  @click="fileInput?.click()"
                  :disabled="uploading"
                >
                  {{ uploading ? '上传中...' : '选择头像' }}
                </PixelButton>
                <PixelButton
                  v-if="previewUrl"
                  variant="secondary"
                  size="sm"
                  @click="clearPreview"
                >
                  清除
                </PixelButton>
              </div>
              <div v-if="uploadError" class="text-red-500 text-sm ">
                {{ uploadError }}
              </div>
            </div>
          </div>

          <!-- 社区名称输入 -->
          <div class="space-y-2">
            <label class="block text-base font-bold text-text-body">社区名称 *</label>
            <input
              v-model="formState.name"
              type="text"
              placeholder="输入社区名称"
              class="w-full h-12 px-4 bg-input-bg border border-border rounded-2xl text-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-card"
              :disabled="loading"
            />
          </div>

          <!-- 社区简介输入 -->
          <div class="space-y-2">
            <label class="block text-base font-bold text-text-body">社区简介</label>
            <textarea
              v-model="formState.description"
              placeholder="介绍一下您的社区..."
              rows="4"
              class="w-full px-4 py-3 bg-input-bg border border-border rounded-2xl text-base focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-card resize-none"
              :disabled="loading"
            />
          </div>

          <!-- 错误提示 -->
          <div v-if="error" class="text-red-500 text-sm  bg-red-50 border border-destructive rounded-2xl p-3">
            {{ error }}
          </div>

          <!-- 保存按钮 -->
          <PixelButton
            variant="primary"
            block
            size="lg"
            :disabled="loading || !formState.name || uploading"
            @click="onSubmit"
          >
            {{ loading ? '保存中...' : '保存并继续' }}
          </PixelButton>
        </div>
      </PixelCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '~/stores/user'
import { updateCommunityProfile, getMe, getApiBaseUrl } from '~/utils/api'
import { useFileUpload } from '~/composables/useFileUpload'
import PixelCard from '~/components/pixel/PixelCard.vue'
import PixelButton from '~/components/pixel/PixelButton.vue'

definePageMeta({
  layout: 'default'
})

const router = useRouter()
const userStore = useUserStore()
const toast = useToast()

const fileInput = ref<HTMLInputElement | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

const { uploading, previewUrl, error: uploadError, handleFileSelect, uploadFile, clearPreview } = useFileUpload()

const formState = reactive({
  name: '',
  description: '',
  avatar: ''
})

const handleFileChange = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  if (handleFileSelect(file)) {
    // 上传文件
    const url = await uploadFile(file)
    if (url) {
      formState.avatar = url
    }
  }
}

const validateForm = (): string | true => {
  if (!formState.name.trim()) {
    return '请输入社区名称'
  }
  if (formState.name.length > 50) {
    return '社区名称不能超过50个字符'
  }
  if (formState.description && formState.description.length > 500) {
    return '社区简介不能超过500个字符'
  }
  return true
}

const onSubmit = async () => {
  const validation = validateForm()
  if (validation !== true) {
    error.value = validation
    return
  }

  loading.value = true
  error.value = null

  try {
    const baseUrl = getApiBaseUrl()
    const user = userStore.user || await getMe(baseUrl)
    if (!user) {
      loading.value = false
      error.value = '用户信息获取失败，请重新登录'
      return
    }

    if (user.userType !== 'community') {
      loading.value = false
      error.value = '当前账号不是社区账号'
      return
    }

    const result = await updateCommunityProfile(user.id, {
      name: formState.name.trim(),
      description: formState.description.trim() || undefined,
      avatar: formState.avatar || undefined
    })

    if (result.success) {
      // 更新store中的用户信息
      const updatedUser = await getMe(baseUrl)
      // 确保包含必要的字段
      const userWithMetadata = {
        ...updatedUser,
        isProfileSetup: !!updatedUser.name, // 已设置 name，表示完成设置
        userType: updatedUser.userType || 'community' // 保持原有类型或默认 community
      }
      userStore.setUser(userWithMetadata)

      toast.add({
        title: '保存成功',
        description: '社区信息已更新'
      })

      // 跳转到主页
      await router.push('/')
    } else {
      error.value = result.message || '保存失败，请重试'
    }
  } catch (err) {
    console.error('Save error:', err)
    error.value = '保存失败，请重试'
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  // 检查是否已登录
  const user = userStore.user || await userStore.getUser()
  if (!user) {
    router.push('/auth/login')
    return
  }

  // 检查用户类型
  if (user.userType !== 'community') {
    router.push('/')
    return
  }

  // 如果已完成设置，跳转到主页
  if (user.isProfileSetup) {
    router.push('/')
    return
  }

  // 预填充已有信息
  if (user.name) {
    formState.name = user.name
  }
  if (user.description) {
    formState.description = user.description
  }
  if (user.avatar) {
    formState.avatar = user.avatar
    previewUrl.value = user.avatar
  }
})

onUnmounted(() => {
  clearPreview()
})
</script>













