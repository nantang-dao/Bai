<template>
  <div class="min-h-screen pb-24">
    <header class="sticky top-0 z-40 bg-card/95 backdrop-blur border-b border-border px-3 md:px-4 py-3">
      <div class="max-w-7xl mx-auto flex items-center justify-between gap-2">
        <div class="flex items-center gap-2 min-w-0">
          <button type="button" class="p-2 -ml-1 rounded-xl hover:bg-input-bg shrink-0" @click="router.back()">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 class="text-lg font-bold text-text-title truncate">社区商城</h1>
        </div>
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
          v-for="t in tags"
          :key="t.id"
          type="button"
          class="px-3 py-1 rounded-full text-xs font-medium border border-transparent text-white"
          :style="{ backgroundColor: t.colorHex }"
          @click="filterTagId = t.id; load(true)"
        >
          {{ t.name }}
        </button>
        <NuxtLink
          v-if="isSuperAdmin"
          :to="`/community/${communityId}/marketplace/settings`"
          class="ml-auto text-xs text-primary font-medium py-1"
        >
          标签管理
        </NuxtLink>
      </div>
    </header>

    <div
      ref="scrollRoot"
      class="max-w-7xl mx-auto px-2 md:px-4 py-4 overflow-y-auto"
      :style="{ maxHeight: 'calc(100vh - 12rem)' }"
      @scroll.passive="onScroll"
    >
      <div v-if="loading && !listings.length" class="text-center py-16 text-text-placeholder">加载中…</div>
      <div v-else-if="!listings.length" class="text-center py-16 text-text-placeholder">暂无商品</div>
      <template v-else>
        <div class="relative" :style="{ height: `${totalHeight}px` }">
          <div
            class="grid grid-cols-2 md:grid-cols-4 gap-3 absolute left-0 right-0"
            :style="{ transform: `translateY(${paddingTop}px)` }"
          >
            <NuxtLink
              v-for="item in visibleItems"
              :key="item.id"
              :to="`/community/${communityId}/marketplace/${item.id}`"
              class="block rounded-2xl border border-border bg-card overflow-hidden shadow-soft hover:shadow-md transition-shadow"
              :class="{ 'opacity-60 grayscale': item.status === 'sold' }"
            >
              <div class="aspect-square bg-input-bg relative">
                <img
                  v-if="item.imageUrls[0]"
                  :src="item.imageUrls[0]"
                  :alt="item.title"
                  class="w-full h-full object-cover"
                  loading="lazy"
                />
                <div v-else class="w-full h-full flex items-center justify-center text-3xl">📷</div>
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
        </div>
        <div v-if="loadingMore" class="text-center py-4 text-sm text-text-placeholder">加载更多…</div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
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

const isSuperAdmin = computed(() => communityStore.currentCommunity?.id === communityId.value && communityStore.currentCommunity?.myRole === 'super_admin')

const scrollRoot = ref<HTMLElement | null>(null)
const scrollTop = ref(0)

/** 近似等高卡片，用于窗口切片虚拟列表 */
const ROW_PX = 300
const cols = computed(() => (typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches ? 4 : 2))

const rowsTotal = computed(() => Math.ceil(listings.value.length / cols.value) || 1)
const totalHeight = computed(() => rowsTotal.value * ROW_PX)

const visibleWindow = computed(() => {
  const c = cols.value
  const st = scrollTop.value
  const h = scrollRoot.value?.clientHeight ?? 800
  const startRow = Math.max(0, Math.floor(st / ROW_PX) - 1)
  const endRow = Math.min(rowsTotal.value, Math.ceil((st + h) / ROW_PX) + 1)
  const start = startRow * c
  const end = Math.min(listings.value.length, endRow * c)
  return { start, end, padTop: startRow * ROW_PX }
})

const visibleItems = computed(() => {
  const { start, end } = visibleWindow.value
  return listings.value.slice(start, end)
})

const paddingTop = computed(() => visibleWindow.value.padTop)

function formatPrice(p: number) {
  return Number(p).toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function onScroll(e: Event) {
  const el = e.target as HTMLElement
  scrollTop.value = el.scrollTop
  const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 200
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
  try {
    await communityStore.setCurrentCommunity(communityId.value)
    tags.value = await api.getMarketplaceTags(communityId.value)
  } catch (_) {
    tags.value = []
  }
  await load(true)
})

watch(communityId, async () => {
  tags.value = await api.getMarketplaceTags(communityId.value)
  await load(true)
})
</script>
