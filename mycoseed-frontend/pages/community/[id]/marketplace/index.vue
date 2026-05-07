<template>
  <div class="min-h-screen pb-24">
    <header class="sticky top-0 z-40 bg-card/95 backdrop-blur border-b border-border px-3 md:px-4 py-3">
      <div class="max-w-7xl mx-auto flex items-center justify-between gap-2">
        <h1 class="text-lg font-bold text-text-title truncate">商城</h1>
        <NuxtLink
          v-if="userStore.isAuthenticated"
          :to="`/community/${communityId}/marketplace/create`"
          class="shrink-0 px-3 py-1.5 rounded-xl bg-primary text-white text-sm font-medium"
        >
          发布
        </NuxtLink>
      </div>
      <div class="max-w-7xl mx-auto mt-3 flex flex-col sm:flex-row gap-2">
        <div class="flex-1 relative">
          <input
            v-model="searchQ"
            type="search"
            placeholder="搜索标题、描述、卖家、标签…"
            class="w-full h-10 pl-9 pr-3 rounded-xl border border-border bg-input-bg text-sm"
            @keydown.enter="applySearch"
          />
          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-text-placeholder">🔍</span>
        </div>
        <button
          type="button"
          class="h-10 px-4 rounded-xl border border-border bg-card text-sm font-medium"
          @click="applySearch"
        >
          搜索
        </button>
      </div>
      <div v-if="tags.length" class="max-w-7xl mx-auto mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          class="px-3 py-1 rounded-full text-xs font-medium border transition-colors"
          :class="filterTagId === '' ? 'bg-primary text-white border-primary' : 'bg-input-bg border-border'"
          @click="filterTagId = ''; load(true)"
        >
          全部
        </button>
        <button
          v-for="t in tags.filter(t => !t.archived)"
          :key="t.id"
          type="button"
          class="px-3 py-1 rounded-full text-xs font-medium border border-transparent text-white"
          :style="{ backgroundColor: t.colorHex }"
          @click="filterTagId = t.id; load(true)"
        >
          {{ t.name }}
        </button>
      </div>
    </header>

    <div class="max-w-7xl mx-auto px-2 md:px-4 py-4">
      <div v-if="loading && !listings.length" class="text-center py-16 text-text-placeholder">加载中…</div>
      <div v-else-if="!listings.length" class="text-center py-16 text-text-placeholder">暂无商品</div>
      <template v-else>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <NuxtLink
            v-for="item in listings"
            :key="item.id"
            :to="`/community/${communityId}/marketplace/${item.id}`"
            class="block rounded-2xl border border-border bg-card overflow-hidden shadow-soft hover:shadow-md transition-shadow"
            :class="{ 'opacity-60 grayscale': item.status === 'sold' }"
          >
            <div class="aspect-square bg-input-bg relative">
              <img
                v-if="item.imageUrls && item.imageUrls[0]"
                :src="item.imageUrls[0]"
                :alt="item.title"
                class="w-full h-full object-cover"
                loading="lazy"
              />
              <div v-else class="w-full h-full flex items-center justify-center bg-gradient-to-br from-input-bg to-card text-text-placeholder">
                <svg class="w-12 h-12 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" stroke-width="1.5"/><circle cx="8.5" cy="8.5" r="1.5" stroke-width="1.5"/><path d="M21 15l-5-5L5 21" stroke-width="1.5"/></svg>
              </div>
              <span
                v-if="item.status === 'locked'"
                class="absolute top-2 right-2 px-2 py-0.5 rounded-lg bg-amber-500 text-white text-xs font-bold"
              >
                已预订
              </span>
              <span
                v-if="item.status === 'sold'"
                class="absolute top-2 right-2 px-2 py-0.5 rounded-lg bg-muted text-text-body text-xs font-bold"
              >
                已售
              </span>
            </div>
            <div class="p-3 space-y-2">
              <div class="flex flex-wrap gap-1 min-h-[1.25rem]">
                <span
                  v-for="tg in item.tags.slice(0, 3)"
                  :key="tg.id"
                  class="px-1.5 py-0.5 rounded text-[10px] text-white font-medium"
                  :style="{ backgroundColor: tg.colorHex }"
                >
                  {{ tg.name }}
                </span>
              </div>
              <div class="font-bold text-text-title line-clamp-2 text-sm">{{ item.title }}</div>
              <div class="text-primary font-bold">¥ {{ formatPrice(item.price) }}</div>
            </div>
          </NuxtLink>
        </div>
        <div v-if="loadingMore" class="text-center py-4 text-sm text-text-placeholder">加载更多…</div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { MarketplaceListing, MarketplaceTag } from '~/utils/api'
import { useCommunityStore } from '~/stores/community'

definePageMeta({ layout: 'default', middleware: 'auth' })

const route = useRoute()
const router = useRouter()
const api = useApi()
const userStore = useUserStore()
const communityStore = useCommunityStore()

const communityId = computed(() => route.params.id as string)

const tags = ref<MarketplaceTag[]>([])
const listings = ref<MarketplaceListing[]>([])
const total = ref(0)
const loading = ref(true)
const loadingMore = ref(false)
const searchInput = ref('')
const searchQ = ref('')
const filterTagId = ref('')
const offset = ref(0)
const pageSize = 24

function formatPrice(p: number) {
  return Number(p).toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function onWindowScroll() {
  const nearBottom = document.documentElement.scrollHeight - window.scrollY - window.innerHeight < 400
  if (nearBottom && !loadingMore.value && listings.value.length < total.value) {
    loadMore()
  }
}

async function load(reset: boolean) {
  if (reset) {
    offset.value = 0
    listings.value = []
  }
  loading.value = true
  try {
    const { listings: rows, total: t } = await api.listMarketplaceListings(communityId.value, {
      q: searchInput.value || undefined,
      tagId: filterTagId.value || undefined,
      limit: pageSize,
      offset: offset.value
    })
    if (reset) listings.value = rows
    else listings.value = [...listings.value, ...rows]
    total.value = t
  } catch (e: any) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

async function loadMore() {
  if (listings.value.length >= total.value) return
  loadingMore.value = true
  offset.value = listings.value.length
  try {
    const { listings: rows, total: t } = await api.listMarketplaceListings(communityId.value, {
      q: searchInput.value || undefined,
      tagId: filterTagId.value || undefined,
      limit: pageSize,
      offset: offset.value
    })
    listings.value = [...listings.value, ...rows]
    total.value = t
  } catch (_) {
    /* ignore */
  } finally {
    loadingMore.value = false
  }
}

function applySearch() {
  searchInput.value = searchQ.value.trim()
  load(true)
}

onMounted(async () => {
  window.addEventListener('scroll', onWindowScroll, { passive: true })
  try {
    await communityStore.setCurrentCommunity(communityId.value)
    tags.value = await api.getMarketplaceTags(communityId.value)
  } catch (_) {
    tags.value = []
  }
  await load(true)
})

onUnmounted(() => {
  window.removeEventListener('scroll', onWindowScroll)
})

watch(communityId, async () => {
  tags.value = await api.getMarketplaceTags(communityId.value)
  await load(true)
})
</script>
