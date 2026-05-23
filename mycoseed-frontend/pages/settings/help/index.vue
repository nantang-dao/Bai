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
      <h1 class="text-lg font-bold text-text-title">帮助与反馈</h1>
      <div class="w-9" />
    </header>

    <section class="px-4 pt-6">
      <div class="bg-card rounded-2xl shadow-soft overflow-hidden border border-border">
        <NuxtLink
          to="/settings/help/faq"
          class="flex items-center gap-3 px-4 py-4 border-b border-border active:bg-input-bg transition-colors"
        >
          <span class="w-10 h-10 rounded-xl bg-input-bg flex items-center justify-center text-xl">📚</span>
          <div class="flex-1 text-left">
            <div class="font-medium text-text-title">FAQ</div>
            <div class="text-sm text-text-placeholder">常见问题、流程说明、功能介绍</div>
          </div>
          <svg class="w-5 h-5 text-text-placeholder" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </NuxtLink>

        <NuxtLink
          to="/settings/help/contact"
          class="flex items-center gap-3 px-4 py-4 active:bg-input-bg transition-colors"
        >
          <span class="w-10 h-10 rounded-xl bg-input-bg flex items-center justify-center text-xl">✉️</span>
          <div class="flex-1 text-left">
            <div class="font-medium text-text-title">联系我们</div>
            <div class="text-sm text-text-placeholder">问题反馈、合作咨询</div>
          </div>
          <svg class="w-5 h-5 text-text-placeholder" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </NuxtLink>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'default',
  middleware: 'auth'
})

const router = useRouter()
</script>

