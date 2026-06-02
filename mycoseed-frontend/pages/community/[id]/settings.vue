<template>
  <div class="min-h-screen bg-background pb-24">
    <header class="sticky top-0 z-40 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
      <button type="button" class="p-2 -ml-2 rounded-xl hover:bg-input-bg" @click="router.back()">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7 7 7-7"/></svg>
      </button>
      <h1 class="text-lg font-bold text-text-title">社区功能设置</h1>
      <div class="w-9" />
    </header>
    <div class="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <p class="text-sm text-text-placeholder">社区公开可见性，社区标签管理，社区功能包管理</p>

      <p v-if="!community" class="text-text-placeholder">加载中...</p>
      <template v-else>
        <p v-if="!isAdmin" class="text-red-600">无权限</p>
        <template v-else>
          <section v-if="community.myRole === 'super_admin'" class="bg-card rounded-2xl border border-border p-4 space-y-3">
            <h2 class="font-bold text-text-title">社区可见性</h2>
            <div class="flex items-center gap-2">
              <input id="isPublic" v-model="isPublic" type="checkbox" class="rounded" @change="updatePublic" />
              <label for="isPublic" class="text-sm text-text-body">公开（未勾选则需邀请码加入并审批）</label>
            </div>
            <div v-if="community.slug" class="flex items-center gap-2">
              <span class="text-sm text-text-body">邀请码：</span>
              <code class="flex-1 px-2 py-1 rounded bg-input-bg text-text-title">{{ community.slug }}</code>
              <button type="button" class="px-3 py-1 rounded-lg border border-border text-sm" @click="copySlug">复制</button>
            </div>
          </section>

          <section class="bg-card rounded-2xl border border-border p-4 space-y-3">
            <h2 class="font-bold text-text-title">社区标签管理</h2>
            <NuxtLink
              :to="`/community/${id}/marketplace/settings`"
              class="flex items-center justify-between py-3 border-b border-border"
            >
              <span class="text-text-body">商城标签管理</span>
              <span class="text-text-placeholder">›</span>
            </NuxtLink>
            <NuxtLink
              :to="`/community/${id}/events/calendar-settings`"
              class="flex items-center justify-between py-3 border-b border-border"
            >
              <span class="text-text-body">活动标签管理</span>
              <span class="text-text-placeholder">›</span>
            </NuxtLink>
            <div class="flex items-center justify-between py-3 opacity-50 cursor-not-allowed">
              <span class="text-text-body">任务标签管理</span>
              <span class="text-xs text-text-placeholder">待完善</span>
            </div>
          </section>

          <section class="bg-card rounded-2xl border border-border p-4 space-y-3">
            <h2 class="font-bold text-text-title">社区功能包管理</h2>
            <div class="flex items-center justify-between py-3 opacity-50 cursor-not-allowed">
              <span class="text-text-body">功能包管理</span>
              <span class="text-xs text-text-placeholder">待完善</span>
            </div>
          </section>
        </template>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  getCommunityById,
  updateCommunity,
  type Community,
} from '~/utils/api'

definePageMeta({ layout: 'default' })

const route = useRoute()
const router = useRouter()
const id = route.params.id as string
const community = ref<Community | null>(null)
const isPublic = ref(true)

const isAdmin = computed(() => community.value?.myRole === 'super_admin' || community.value?.myRole === 'sub_admin')

async function load() {
  try {
    community.value = await getCommunityById(id)
    if (!community.value) return
    isPublic.value = community.value.isPublic !== false
  } catch (_) {}
}

async function updatePublic() {
  if (!community.value) return
  try {
    await updateCommunity(id, { isPublic: isPublic.value }, (await import('~/utils/api')).getApiBaseUrl())
    community.value = { ...community.value, isPublic: isPublic.value }
  } catch (e: any) {
    alert(e.message || '更新失败')
  }
}

function copySlug() {
  if (!community.value?.slug) return
  navigator.clipboard.writeText(community.value.slug)
  alert('已复制邀请码')
}

onMounted(load)
</script>
