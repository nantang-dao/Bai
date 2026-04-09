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
      <h1 class="text-lg font-bold text-text-title">消息通知</h1>
      <div class="w-9" />
    </header>

    <section class="px-4 pt-6 space-y-6">
      <div v-if="loading" class="text-sm text-text-placeholder">加载中...</div>
      <div v-else-if="error" class="text-sm text-destructive">{{ error }}</div>

      <template v-else>
        <div class="bg-card rounded-2xl shadow-soft border border-border p-4">
          <div class="font-bold text-text-title mb-3">提醒方式（占位）</div>
          <div class="space-y-3">
            <label class="flex items-center justify-between">
              <span class="text-text-body">短信推送</span>
              <input type="checkbox" v-model="form.push_sms_enabled" @change="save" />
            </label>
            <label class="flex items-center justify-between">
              <span class="text-text-body">邮箱推送</span>
              <input type="checkbox" v-model="form.push_email_enabled" @change="save" />
            </label>
            <div class="text-xs text-text-placeholder leading-relaxed">
              说明：当前版本先保存偏好设置，后续可接入真实短信/邮件发送服务。
            </div>
          </div>
        </div>

        <div class="bg-card rounded-2xl shadow-soft border border-border p-4">
          <div class="font-bold text-text-title mb-3">消息类别开关</div>
          <div class="space-y-3">
            <label class="flex items-center justify-between">
              <span class="text-text-body">社区圈消息（点赞/评论）</span>
              <input type="checkbox" v-model="form.community_enabled" @change="save" />
            </label>
            <label class="flex items-center justify-between">
              <span class="text-text-body">任务交互（领取/提交/审核）</span>
              <input type="checkbox" v-model="form.task_enabled" @change="save" />
            </label>
            <label class="flex items-center justify-between">
              <span class="text-text-body">任务时效提醒（1h/3h）</span>
              <input type="checkbox" v-model="form.due_enabled" @change="save" />
            </label>
          </div>
        </div>
      </template>
    </section>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'default',
  middleware: 'auth'
})

import type { NotificationSettings } from '~/utils/api'

const router = useRouter()
const api = useApi()

const loading = ref(false)
const error = ref<string | null>(null)

const form = reactive<Omit<NotificationSettings, 'user_id'>>({
  push_sms_enabled: false,
  push_email_enabled: false,
  community_enabled: true,
  task_enabled: true,
  due_enabled: true,
})

async function load() {
  loading.value = true
  error.value = null
  try {
    const res = await api.getNotificationSettings()
    const s = res.settings
    form.push_sms_enabled = !!s.push_sms_enabled
    form.push_email_enabled = !!s.push_email_enabled
    form.community_enabled = s.community_enabled !== false
    form.task_enabled = s.task_enabled !== false
    form.due_enabled = s.due_enabled !== false
  } catch (e: any) {
    error.value = e?.message || '加载失败'
  } finally {
    loading.value = false
  }
}

let savingTimer: any = null
async function save() {
  if (savingTimer) clearTimeout(savingTimer)
  savingTimer = setTimeout(async () => {
    try {
      await api.updateNotificationSettings({ ...form })
    } catch (e) {
      // 静默失败即可，避免频繁弹错
    }
  }, 200)
}

onMounted(() => load())
</script>

