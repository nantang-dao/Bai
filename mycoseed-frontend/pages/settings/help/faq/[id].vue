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
      <h1 class="text-lg font-bold text-text-title">FAQ 详情</h1>
      <div class="w-9" />
    </header>

    <section class="px-4 pt-6">
      <div class="text-sm text-text-placeholder" v-if="loading">加载中...</div>
      <div class="text-sm text-destructive" v-else-if="error">{{ error }}</div>

      <div v-else class="bg-card rounded-2xl shadow-soft border border-border p-4">
        <div class="text-base font-bold text-text-title leading-snug">
          {{ faq?.question }}
        </div>
        <div class="mt-3 text-sm text-text-body leading-relaxed whitespace-pre-line">
          {{ faq?.answer }}
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

type FaqItem = { id: string | number; question: string; answer: string }

const router = useRouter()
const route = useRoute()
const { getFaqById } = useApi()

const loading = ref(false)
const error = ref<string | null>(null)
const faq = ref<FaqItem | null>(null)

async function load() {
  const id = String(route.params.id || '').trim()
  if (!id) {
    error.value = '参数错误'
    return
  }
  loading.value = true
  error.value = null
  try {
    faq.value = await getFaqById(id)
  } catch (e: any) {
    error.value = e?.message || '加载失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

onMounted(() => load())
</script>

