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
      <h1 class="text-lg font-bold text-text-title">联系我们</h1>
      <div class="w-9" />
    </header>

    <section class="px-4 pt-6 space-y-4">
      <div class="bg-card rounded-2xl shadow-soft border border-border p-4">
        <div class="text-sm font-bold text-text-body mb-2">反馈渠道</div>
        <div class="text-text-placeholder text-sm leading-relaxed">
          这里是占位内容：你可以在这里放邮箱、微信群、Discord、工单链接等联系方式。
        </div>
      </div>

      <div class="bg-card rounded-2xl shadow-soft border border-border p-4">
        <div class="text-sm font-bold text-text-body mb-2">建议写法</div>
        <ul class="text-text-placeholder text-sm leading-relaxed list-disc pl-5 space-y-1">
          <li>问题描述：发生了什么、期望是什么</li>
          <li>复现步骤：从哪里点击到哪里</li>
          <li>截图/录屏：能更快定位</li>
        </ul>
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

