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
      <h1 class="text-lg font-bold text-text-title">FAQ</h1>
      <div class="w-9" />
    </header>

    <section class="px-4 pt-6">
      <div class="bg-card rounded-2xl shadow-soft border border-border p-3">
        <div class="flex items-center gap-2">
          <svg class="w-5 h-5 text-text-placeholder" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
          </svg>
          <input
            v-model="keyword"
            type="text"
            placeholder="搜索问题/答案"
            class="w-full h-11 px-2 bg-transparent text-base focus:outline-none"
          />
        </div>
      </div>

      <div class="mt-4 text-sm text-text-placeholder" v-if="loading">加载中...</div>
      <div class="mt-4 text-sm text-destructive" v-else-if="error">{{ error }}</div>

      <div class="mt-4 bg-card rounded-2xl shadow-soft overflow-hidden border border-border" v-else>
        <NuxtLink
          v-for="item in faqs"
          :key="item.id"
          :to="`/settings/help/faq/${item.id}`"
          class="flex items-start gap-3 px-4 py-4 border-b border-border last:border-b-0 active:bg-input-bg transition-colors"
        >
          <span class="w-10 h-10 rounded-xl bg-input-bg flex items-center justify-center text-xl">❔</span>
          <div class="flex-1">
            <div class="font-medium text-text-title leading-snug">{{ item.question }}</div>
            <div class="mt-1 text-sm text-text-placeholder line-clamp-2">{{ item.answer }}</div>
          </div>
          <svg class="w-5 h-5 text-text-placeholder mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </NuxtLink>
      </div>

      <div class="mt-4 text-sm text-text-placeholder" v-if="!loading && !error && faqs.length === 0">
        没有找到相关 FAQ
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
const { getFaqs } = useApi()

const keyword = ref('')
const faqs = ref<FaqItem[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

let timer: any = null

async function load() {
  loading.value = true
  error.value = null
  try {
    faqs.value = await getFaqs({ q: keyword.value.trim() || undefined, limit: 50 })
  } catch (e: any) {
    error.value = e?.message || '加载失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

watch(
  () => keyword.value,
  () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => load(), 300)
  }
)

onMounted(() => load())
</script>

