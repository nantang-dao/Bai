<template>
  <div class="min-h-screen bg-background pb-24">
    <header class="sticky top-0 z-40 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
      <button
        class="p-2 -ml-2 rounded-xl hover:bg-input-bg text-text-title transition-colors"
        @click="router.back()"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <h1 class="text-lg font-bold text-text-title">消息</h1>
      <div class="w-9" />
    </header>

    <section class="px-4 pt-6 space-y-4">
      <div v-if="loading" class="text-sm text-text-placeholder">加载中...</div>
      <div v-else-if="error" class="text-sm text-destructive">{{ error }}</div>

      <div v-else class="space-y-4">
        <button
          type="button"
          class="w-full text-left bg-card rounded-2xl shadow-soft border border-border p-4 active:bg-input-bg transition-colors"
          @click="go('community')"
        >
          <div class="flex items-center justify-between">
            <div>
              <div class="font-bold text-text-title">社区圈消息</div>
              <div class="text-sm text-text-placeholder mt-1">谁点赞了、谁评论了</div>
            </div>
            <div class="text-sm font-bold text-text-title">
              <span v-if="summary?.unreadByCategory.community">{{ summary?.unreadByCategory.community }}</span>
              <span v-else class="text-text-placeholder">0</span>
            </div>
          </div>
        </button>

        <button
          type="button"
          class="w-full text-left bg-card rounded-2xl shadow-soft border border-border p-4 active:bg-input-bg transition-colors"
          @click="go('task')"
        >
          <div class="flex items-center justify-between">
            <div>
              <div class="font-bold text-text-title">任务交互</div>
              <div class="text-sm text-text-placeholder mt-1">领取、提交凭证、审核结果</div>
            </div>
            <div class="text-sm font-bold text-text-title">
              <span v-if="summary?.unreadByCategory.task">{{ summary?.unreadByCategory.task }}</span>
              <span v-else class="text-text-placeholder">0</span>
            </div>
          </div>
        </button>

        <button
          type="button"
          class="w-full text-left bg-card rounded-2xl shadow-soft border border-border p-4 active:bg-input-bg transition-colors"
          @click="go('due')"
        >
          <div class="flex items-center justify-between">
            <div>
              <div class="font-bold text-text-title">到期提醒</div>
              <div class="text-sm text-text-placeholder mt-1">距截止 3 小时/1 小时提醒</div>
            </div>
            <div class="text-sm font-bold text-text-title">
              <span v-if="summary?.unreadByCategory.due">{{ summary?.unreadByCategory.due }}</span>
              <span v-else class="text-text-placeholder">0</span>
            </div>
          </div>
        </button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'default',
  middleware: 'auth'
})

import type { NotificationCategory, NotificationSummary } from '~/utils/api'
import { useCommunityStore } from '~/stores/community'

const router = useRouter()
const api = useApi()
const communityStore = useCommunityStore()

const loading = ref(false)
const error = ref<string | null>(null)
const summary = ref<NotificationSummary | null>(null)

async function load() {
  loading.value = true
  error.value = null
  try {
    summary.value = await api.getNotificationSummary({ communityId: communityStore.currentCommunityId })
  } catch (e: any) {
    error.value = e?.message || '加载失败'
  } finally {
    loading.value = false
  }
}

function go(category: NotificationCategory) {
  router.push(`/messages/${category}`)
}

onMounted(() => load())
</script>

