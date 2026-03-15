<template>
  <div class="min-h-screen bg-background pb-24">
    <header class="sticky top-0 z-40 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
      <button type="button" class="p-2 -ml-2 rounded-xl hover:bg-input-bg" @click="router.back()">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7 7 7-7"/></svg>
      </button>
      <h1 class="text-lg font-bold text-text-title">编辑社区</h1>
      <div class="w-9" />
    </header>
    <div class="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <div v-if="error" class="text-red-600 text-sm">{{ error }}</div>
      <div class="space-y-2">
        <label class="text-sm font-medium text-text-title">社区头像（可选）</label>
        <input v-model="form.avatarUrl" type="url" class="w-full px-4 py-2 rounded-xl border border-border bg-input-bg text-text-body text-sm" placeholder="图片 URL，留空则使用默认" />
      </div>
      <div class="space-y-2">
        <label class="text-sm font-medium text-text-title">背景图（最多三张）</label>
        <input v-model="form.backgroundImages[0]" type="url" class="w-full px-4 py-2 rounded-xl border border-border bg-input-bg text-text-body text-sm" placeholder="背景图 1 URL" />
        <input v-model="form.backgroundImages[1]" type="url" class="w-full px-4 py-2 rounded-xl border border-border bg-input-bg text-text-body text-sm" placeholder="背景图 2 URL" />
        <input v-model="form.backgroundImages[2]" type="url" class="w-full px-4 py-2 rounded-xl border border-border bg-input-bg text-text-body text-sm" placeholder="背景图 3 URL" />
      </div>
      <div class="space-y-2">
        <label class="text-sm font-medium text-text-title">社区名称</label>
        <input v-model="form.name" type="text" class="w-full px-4 py-2 rounded-xl border border-border bg-input-bg text-text-body" placeholder="名称" />
      </div>
      <div class="space-y-2">
        <label class="text-sm font-medium text-text-title">简介（短文）</label>
        <textarea v-model="form.description" rows="2" class="w-full px-4 py-2 rounded-xl border border-border bg-input-bg text-text-body" placeholder="简短描述" />
      </div>
      <div class="space-y-2">
        <label class="text-sm font-medium text-text-title">社区介绍（Markdown）</label>
        <textarea v-model="form.markdownIntro" rows="8" class="w-full px-4 py-2 rounded-xl border border-border bg-input-bg text-text-body font-mono text-sm" placeholder="支持 Markdown" />
      </div>
      <div class="space-y-2">
        <label class="text-sm font-medium text-text-title">积分名称</label>
        <input v-model="form.pointName" type="text" class="w-full px-4 py-2 rounded-xl border border-border bg-input-bg text-text-body" placeholder="如：南塘豆" />
      </div>
      <div v-if="community?.myRole === 'super_admin'" class="flex items-center gap-2">
        <input id="isPublic" v-model="form.isPublic" type="checkbox" class="rounded" />
        <label for="isPublic" class="text-sm text-text-body">公开社区（未勾选则为私有，需邀请码加入）</label>
      </div>
      <button
        type="button"
        class="w-full py-3 rounded-xl bg-primary text-white font-medium"
        :disabled="saving"
        @click="save"
      >
        {{ saving ? '保存中...' : '保存' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getCommunityById, updateCommunity, getApiBaseUrl, type Community } from '~/utils/api'

definePageMeta({ layout: 'default' })

const route = useRoute()
const router = useRouter()
const id = route.params.id as string
const community = ref<Community | null>(null)
const error = ref('')
const saving = ref(false)
const form = reactive({ name: '', description: '', markdownIntro: '', pointName: '积分', isPublic: true, avatarUrl: '', backgroundImages: ['', '', ''] as string[] })

onMounted(async () => {
  try {
    community.value = await getCommunityById(id)
    if (community.value) {
      form.name = community.value.name
      form.description = community.value.description || ''
      form.markdownIntro = community.value.markdownIntro || ''
      form.pointName = community.value.pointName || '积分'
      form.isPublic = community.value.isPublic !== false
      form.avatarUrl = community.value.avatarUrl || ''
      const bg = community.value.backgroundImages || []
      form.backgroundImages = [bg[0] || '', bg[1] || '', bg[2] || '']
    }
  } catch (e: any) {
    error.value = e.message || '加载失败'
  }
})

async function save() {
  if (!community.value?.myRole || (community.value.myRole !== 'super_admin' && community.value.myRole !== 'sub_admin')) {
    error.value = '无编辑权限'
    return
  }
  saving.value = true
  error.value = ''
  try {
    await updateCommunity(id, {
      name: form.name,
      description: form.description,
      markdownIntro: form.markdownIntro,
      pointName: form.pointName,
      isPublic: form.isPublic,
      avatarUrl: form.avatarUrl || undefined,
      backgroundImages: form.backgroundImages.filter(u => (u || '').trim()).slice(0, 3),
    }, getApiBaseUrl())
    await getCommunityById(id).then(c => { if (c) community.value = c })
    router.push('/')
  } catch (e: any) {
    error.value = e.message || '保存失败'
  } finally {
    saving.value = false
  }
}
</script>
