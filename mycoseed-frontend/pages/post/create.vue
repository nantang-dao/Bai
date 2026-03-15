<template>
  <div class="min-h-screen bg-background py-4 md:py-8">
    <div class="container mx-auto px-4 md:px-6 max-w-2xl pb-32 md:pb-24">
      <div class="mb-6 md:mb-8 text-center">
        <h1 class="text-2xl md:text-4xl font-bold text-text-title mb-2 md:mb-4">发动态</h1>
        <div class="w-24 md:w-32 h-1 bg-border mx-auto border border-border rounded-2xl"></div>
      </div>

      <PixelCard>
        <div class="space-y-4 md:space-y-6">
          <div>
            <label class="block font-bold text-xs uppercase mb-2 text-text-title">内容 *</label>
            <textarea
              v-model="content"
              placeholder="分享你的想法..."
              rows="6"
              maxlength="2000"
              class="w-full px-4 py-3 bg-input-bg border border-border rounded-2xl shadow-soft text-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-card transition-all resize-none"
            ></textarea>
            <p class="text-xs text-gray-500 mt-1">{{ content.length }} / 2000</p>
          </div>

          <div>
            <label class="block font-bold text-xs uppercase mb-2 text-text-title">图片（可选，最多 9 张）</label>
            <input
              type="file"
              accept="image/*"
              multiple
              class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary/80 cursor-pointer"
              @change="onFileChange"
            />
            <div v-if="previewUrls.length" class="grid grid-cols-3 gap-2 mt-4">
              <div
                v-for="(url, index) in previewUrls"
                :key="index"
                class="relative aspect-square rounded-lg overflow-hidden border border-gray-200"
              >
                <img :src="url" class="w-full h-full object-cover" alt="预览" />
                <button
                  type="button"
                  class="absolute top-1 right-1 w-6 h-6 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black/70"
                  @click="removeImage(index)"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <p v-if="error" class="text-red-600 text-sm">{{ error }}</p>

          <div class="flex gap-3 pt-4">
            <PixelButton
              variant="primary"
              :disabled="loading || !content.trim()"
              class="flex-1"
              @click="publish"
            >
              {{ loading ? '发布中...' : '发布' }}
            </PixelButton>
            <PixelButton variant="secondary" @click="goBack">
              取消
            </PixelButton>
          </div>
        </div>
      </PixelCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import PixelCard from '~/components/pixel/PixelCard.vue'
import PixelButton from '~/components/pixel/PixelButton.vue'
import { useUserStore } from '~/stores/user'
import { useCommunityStore } from '~/stores/community'
import { getMemberById, DEFAULT_COMMUNITY_UUID } from '~/utils/api'
import type { Community } from '~/utils/api'
import { useApi } from '~/composables/useApi'

const router = useRouter()
const api = useApi()
const userStore = useUserStore()
const communityStore = useCommunityStore()

// 获取用户所属社区
const userCommunity = ref<Community | null>(null)

// 获取当前社区ID（优先级：当前选择的社区 > 用户所属社区 > 默认UUID）
const communityId = computed(() => {
  return communityStore.currentCommunityId
})

const content = ref('')
const selectedFiles = ref<File[]>([])
const previewUrls = ref<string[]>([])
const loading = ref(false)
const error = ref('')

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const files = input.files
  if (!files?.length) return
  const list = Array.from(files).slice(0, 9)
  previewUrls.value.forEach(url => URL.revokeObjectURL(url))
  selectedFiles.value = list
  previewUrls.value = list.map(f => URL.createObjectURL(f))
}

function removeImage(index: number) {
  if (previewUrls.value[index]) URL.revokeObjectURL(previewUrls.value[index])
  selectedFiles.value.splice(index, 1)
  previewUrls.value.splice(index, 1)
  const input = document.querySelector('input[type="file"]') as HTMLInputElement
  if (input) input.value = ''
}

async function publish() {
  const text = content.value.trim()
  if (!text) {
    error.value = '请输入内容'
    return
  }
  loading.value = true
  error.value = ''
  try {
    const currentCommunityId = communityId.value
    if (selectedFiles.value.length > 0) {
      const postId = crypto.randomUUID()
      const uploadRes = await api.uploadPostImage({
        postId,
        communityId: currentCommunityId,
        files: selectedFiles.value,
      })
      const images = (uploadRes.files || []).map(f => f.url)
      await api.createPost({
        communityId: currentCommunityId,
        content: text,
        images,
        postId,
      })
    } else {
      await api.createPost({
        communityId: currentCommunityId,
        content: text,
      })
    }
    await navigateTo('/?tab=COMMUNITY')
  } catch (e: any) {
    error.value = e?.message || '发布失败'
  } finally {
    loading.value = false
  }
}

function goBack() {
  router.push('/')
}

// 加载用户所属社区
const loadUserCommunity = async () => {
  try {
    const user = await userStore.getUser()
    if (!user || !user.id) return

    const member = await getMemberById(user.id)
    if (!member || member.communities.length === 0) return

    // 获取所有社区信息（这里简化处理，实际应该从 store 或 API 获取）
    // 暂时使用第一个社区ID
    const firstCommunityId = member.communities[0]
    // 这里可以调用 getCommunityById 获取完整社区信息
    // 暂时只保存ID，后续可以从 communityStore 获取
  } catch (error) {
    console.error('Failed to load user community:', error)
  }
}

onMounted(async () => {
  await userStore.getUser()
  if (!userStore.user) {
    await navigateTo('/auth/verify')
    return
  }
  await loadUserCommunity()
})

onUnmounted(() => {
  previewUrls.value.forEach(url => URL.revokeObjectURL(url))
})
</script>
