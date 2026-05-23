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
      <h1 class="text-lg font-bold text-text-title">{{ title }}</h1>
      <button
        type="button"
        class="text-sm font-medium text-primary"
        @click="markAllRead"
      >
        全部已读
      </button>
    </header>

    <section class="px-4 pt-6">
      <div v-if="loading" class="text-sm text-text-placeholder">加载中...</div>
      <div v-else-if="error" class="text-sm text-destructive">{{ error }}</div>

      <div v-else class="space-y-3">
        <div v-if="items.length === 0" class="text-sm text-text-placeholder">暂无消息</div>
        <div
          v-for="n in items"
          :key="n.id"
          class="bg-card rounded-2xl shadow-soft border border-border p-4"
          :class="!n.read_at ? 'ring-2 ring-primary/15' : ''"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="font-bold text-text-title leading-snug">{{ n.title }}</div>
              <div v-if="n.body" class="text-sm text-text-body mt-1 whitespace-pre-line">{{ n.body }}</div>
              <div class="text-xs text-text-placeholder mt-2">{{ formatTime(n.created_at) }}</div>
            </div>
            <button
              v-if="!n.read_at"
              type="button"
              class="text-xs text-primary font-medium shrink-0"
              @click="markOneRead(n.id)"
            >
              标已读
            </button>
          </div>

          <div v-if="n.data?.taskId" class="mt-3">
            <NuxtLink
              :to="`/tasks/${n.data.taskId}`"
              class="inline-flex items-center text-sm text-primary hover:underline"
            >
              查看任务 →
            </NuxtLink>
          </div>
          <div v-if="n.data?.eventId" class="mt-3">
            <NuxtLink
              :to="`/community/${communityStore.currentCommunityId}/events/${n.data.eventId}`"
              class="inline-flex items-center text-sm text-primary hover:underline"
            >
              查看活动 →
            </NuxtLink>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'default',
  middleware: 'auth'
})

import type { NotificationCategory, NotificationItem } from '~/utils/api'
import { useCommunityStore } from '~/stores/community'

const router = useRouter()
const route = useRoute()
const api = useApi()
const communityStore = useCommunityStore()

const category = computed(() => String(route.params.category || '') as NotificationCategory)
const title = computed(() => {
  if (category.value === 'community') return '社区圈消息'
  if (category.value === 'task') return '任务交互'
  if (category.value === 'due') return '到期提醒'
  return '消息'
})

const items = ref<NotificationItem[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

function formatTime(iso: string) {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleString('zh-CN')
}

async function load() {
  loading.value = true
  error.value = null
  try {
    const res = await api.listNotifications({ communityId: communityStore.currentCommunityId, category: category.value, limit: 100 })
    items.value = res.notifications || []
  } catch (e: any) {
    error.value = e?.message || '加载失败'
  } finally {
    loading.value = false
  }
}

async function markOneRead(id: string) {
  try {
    await api.markNotificationsRead({ ids: [id] })
    items.value = items.value.map(x => (x.id === id ? { ...x, read_at: new Date().toISOString() } : x))
  } catch {}
}

async function markAllRead() {
  try {
    await api.markNotificationsRead({ category: category.value, communityId: communityStore.currentCommunityId })
    const now = new Date().toISOString()
    items.value = items.value.map(x => ({ ...x, read_at: x.read_at || now }))
  } catch {}
}

onMounted(() => load())
watch(() => communityStore.currentCommunityId, () => load())
</script>

