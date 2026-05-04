<template>
  <div class="min-h-screen pb-32">
    <header class="sticky top-0 z-40 bg-card border-b border-border px-4 py-3 flex items-center gap-3">
      <button type="button" class="p-2 -ml-2 rounded-xl hover:bg-input-bg" @click="router.back()">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <h1 class="text-lg font-bold text-text-title truncate flex-1">商品详情</h1>
      <NuxtLink
        v-if="isSeller && listing?.status === 'active'"
        :to="`/community/${communityId}/marketplace/create?edit=${listingId}`"
        class="text-sm text-primary font-medium"
      >
        编辑
      </NuxtLink>
    </header>

    <div v-if="loading" class="p-8 text-center text-text-placeholder">加载中…</div>
    <template v-else-if="listing">
      <div class="max-w-2xl mx-auto px-4">
        <div class="relative aspect-square bg-input-bg rounded-2xl overflow-hidden mt-4 border border-border">
          <img v-if="gallery.length" :src="gallery[imgIndex]" :alt="listing.title" class="w-full h-full object-contain" />
          <button
            v-if="gallery.length > 1"
            type="button"
            class="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 text-white"
            @click="imgIndex = (imgIndex - 1 + gallery.length) % gallery.length"
          >
            ‹
          </button>
          <button
            v-if="gallery.length > 1"
            type="button"
            class="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 text-white"
            @click="imgIndex = (imgIndex + 1) % gallery.length"
          >
            ›
          </button>
        </div>
        <div class="mt-3 flex flex-wrap gap-2">
          <span
            v-for="t in listing.tags"
            :key="t.id"
            class="px-2 py-0.5 rounded-full text-xs text-white font-medium"
            :style="{ backgroundColor: t.colorHex }"
          >
            {{ t.name }}
          </span>
        </div>
        <h2 class="text-xl font-bold text-text-title mt-4">{{ listing.title }}</h2>
        <p :class="listing.status === 'sold' ? 'text-text-placeholder line-through' : 'text-primary font-bold text-2xl mt-2'">
          ¥ {{ formatPrice(listing.price) }}
        </p>
        <p class="text-sm text-text-placeholder mt-1">
          <span v-if="listing.status === 'locked'">已预订 · 等待买家付款</span>
          <span v-else-if="listing.status === 'sold'">已售出</span>
          <span v-else-if="listing.status === 'active'">在售</span>
        </p>

        <div class="mt-6 flex items-center gap-3 p-4 rounded-2xl bg-card border border-border">
          <PixelAvatar :src="listing.seller?.avatar || undefined" :seed="listing.seller?.name || 's'" size="md" />
          <div>
            <div class="font-bold text-text-title">{{ listing.seller?.name || '卖家' }}</div>
            <NuxtLink :to="`/member/${listing.sellerId}`" class="text-xs text-primary">查看主页</NuxtLink>
          </div>
        </div>

        <div class="mt-6 whitespace-pre-wrap text-text-body leading-relaxed">{{ listing.description }}</div>

        <!-- 买家：预订 -->
        <div v-if="showBuy" class="mt-8 space-y-3">
          <PixelButton variant="warning" block @click="confirmBuyOpen = true">购买（锁单）</PixelButton>
        </div>

        <!-- 卖家：锁单 / 成交 -->
        <div v-if="isSeller && listing.status === 'locked'" class="mt-8 space-y-3">
          <PixelButton variant="primary" block @click="doConfirmSold">确认收款并下架</PixelButton>
          <PixelButton variant="secondary" block @click="doCancelLock">取消锁单，重新上架</PixelButton>
        </div>

        <!-- 买家评价 -->
        <div v-if="listing.status === 'sold' && isBuyer && !existingReview" class="mt-10 p-4 rounded-2xl border border-border bg-card space-y-3">
          <h3 class="font-bold text-text-title">评价商品（0–5 分整数）</h3>
          <div class="flex flex-wrap gap-1">
            <button
              v-for="n in 6"
              :key="n"
              type="button"
              class="px-2 py-1 rounded-lg text-sm font-medium border-2"
              :class="reviewRating === n - 1 ? 'border-primary bg-primary/10' : 'border-border bg-input-bg'"
              @click="reviewRating = n - 1"
            >
              {{ n - 1 }} 分
            </button>
          </div>
          <textarea v-model="reviewText" rows="3" placeholder="写几句评价…" class="w-full rounded-xl border border-border px-3 py-2 bg-input-bg text-sm" />
          <PixelButton variant="primary" :disabled="reviewSubmitting" @click="submitReview">提交评价</PixelButton>
        </div>

        <!-- 本商品评价 -->
        <div v-if="existingReview" class="mt-10 p-4 rounded-2xl border border-border bg-input-bg">
          <div class="text-sm text-text-placeholder">我的评价</div>
          <div class="text-amber-500 mt-1">{{ '★'.repeat(existingReview.rating) }}{{ '☆'.repeat(5 - existingReview.rating) }}</div>
          <p class="mt-2 text-text-body">{{ existingReview.content }}</p>
        </div>

        <!-- 社区全部评价 -->
        <section class="mt-12 border-t border-border pt-8">
          <h3 class="text-lg font-bold text-text-title mb-4">本社区商品评价</h3>
          <div v-if="communityReviewsLoading" class="text-text-placeholder text-sm">加载中…</div>
          <ul v-else class="space-y-4">
            <li
              v-for="r in communityReviews"
              :key="r.id"
              class="p-4 rounded-2xl border border-border bg-card text-sm"
            >
              <div class="flex items-center gap-2 mb-2">
                <PixelAvatar :src="r.buyer?.avatar || undefined" :seed="r.buyer?.name || 'b'" size="sm" />
                <span class="font-medium">{{ r.buyer?.name || '买家' }}</span>
                <span class="text-text-placeholder">·</span>
                <span class="text-amber-500">{{ '★'.repeat(r.rating) }}</span>
              </div>
              <div class="text-xs text-primary mb-1">{{ r.productTitle }}</div>
              <p class="text-text-body">{{ r.content }}</p>
            </li>
          </ul>
        </section>
      </div>
    </template>

    <!-- 确认购买 -->
    <Teleport to="body">
      <div
        v-if="confirmBuyOpen"
        class="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4"
        @click.self="confirmBuyOpen = false"
      >
        <div class="bg-card rounded-3xl p-6 max-w-sm w-full shadow-soft-lg">
          <h3 class="text-lg font-bold mb-2">确认预订</h3>
          <p class="text-sm text-text-body mb-4">
            预订后商品将显示「已预订」，随后将打开 Semi 转账页，已填入卖家钱包地址、金额及备注（商品名与购买日期）。
          </p>
          <div class="flex gap-3">
            <PixelButton variant="secondary" block @click="confirmBuyOpen = false">取消</PixelButton>
            <PixelButton variant="primary" block :disabled="locking" @click="doLockAndPay">确认</PixelButton>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PixelButton from '~/components/pixel/PixelButton.vue'
import PixelAvatar from '~/components/pixel/PixelAvatar.vue'
import {
  buildSemiTransferUrl,
  getApiBaseUrl,
  getWalletAddressByUserId,
  type MarketplaceListing,
  type MarketplaceReviewItem
} from '~/utils/api'
import { useCommunityStore } from '~/stores/community'

definePageMeta({ layout: 'default', middleware: 'auth' })

const route = useRoute()
const router = useRouter()
const api = useApi()
const toast = useToast()
const userStore = useUserStore()
const communityStore = useCommunityStore()

const communityId = computed(() => route.params.id as string)
const listingId = computed(() => route.params.listingId as string)

const loading = ref(true)
const listing = ref<MarketplaceListing | null>(null)
const existingReview = ref<{ rating: number; content: string } | null>(null)
const imgIndex = ref(0)
const confirmBuyOpen = ref(false)
const locking = ref(false)

const communityReviews = ref<MarketplaceReviewItem[]>([])
const communityReviewsLoading = ref(false)

const reviewRating = ref(5)
const reviewText = ref('')
const reviewSubmitting = ref(false)

const gallery = computed(() => listing.value?.imageUrls || [])

const isSeller = computed(() => listing.value?.sellerId === userStore.user?.id)
const isBuyer = computed(() => listing.value?.buyerId === userStore.user?.id)
const showBuy = computed(() => {
  const u = userStore.user?.id
  if (!u || !listing.value) return false
  if (listing.value.status !== 'active') return false
  if (listing.value.sellerId === u) return false
  return true
})

function formatPrice(p: number) {
  return Number(p).toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

async function load() {
  loading.value = true
  try {
    const { listing: l, review } = await api.getMarketplaceListing(communityId.value, listingId.value)
    listing.value = l as MarketplaceListing
    if (review && (review as { rating?: number }).rating != null) {
      existingReview.value = {
        rating: (review as { rating: number }).rating,
        content: (review as { content?: string }).content || ''
      }
    } else {
      existingReview.value = null
    }
  } catch (e: any) {
    toast.add({ title: e?.message || '加载失败', color: 'red' })
    listing.value = null
  } finally {
    loading.value = false
  }
}

async function loadReviews() {
  communityReviewsLoading.value = true
  try {
    const { reviews } = await api.listMarketplaceCommunityReviews(communityId.value, { limit: 50, offset: 0 })
    communityReviews.value = reviews
  } catch (_) {
    communityReviews.value = []
  } finally {
    communityReviewsLoading.value = false
  }
}

async function doLockAndPay() {
  if (!listing.value) return
  locking.value = true

  const newWindow = window.open('about:blank', '_blank')
  if (!newWindow) {
    toast.add({
      title: '无法打开转账页面',
      description: '浏览器阻止了弹窗，请允许弹窗后重试',
      color: 'orange'
    })
    locking.value = false
    return
  }

  try {
    newWindow.document.title = '正在跳转…'
    newWindow.document.body.innerHTML = `
      <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; padding: 24px; color: #111;">
        <div style="font-size: 16px; font-weight: 600; margin-bottom: 8px;">正在跳转到 Semi…</div>
        <div style="font-size: 13px; color: #555;">请稍候，如果没有自动跳转请返回重试。</div>
      </div>
    `
  } catch {
    /* 部分浏览器不允许写 about:blank */
  }

  try {
    await api.lockMarketplaceListing(communityId.value, listing.value.id)
    confirmBuyOpen.value = false

    const config = useRuntimeConfig()
    const semiAppUrl = String(config.public.semiAppUrl || '').trim()
    if (!semiAppUrl) {
      try {
        newWindow.close()
      } catch {
        /* ignore */
      }
      toast.add({
        title: '未配置 Semi 转账入口',
        description: '请在 .env 中设置 NUXT_PUBLIC_SEMI_APP_URL（与任务转账相同的 Semi 前端基址）',
        color: 'orange'
      })
      await load()
      return
    }

    const baseUrl = getApiBaseUrl()
    const sellerId = listing.value.sellerId
    const sellerAddress = await getWalletAddressByUserId(sellerId, baseUrl)
    if (!sellerAddress) {
      try {
        newWindow.close()
      } catch {
        /* ignore */
      }
      toast.add({
        title: '无法跳转转账',
        description: '卖家未绑定链上钱包地址',
        color: 'orange'
      })
      await load()
      return
    }

    const amount = String(listing.value.price)
    const now = new Date()
    const y = now.getFullYear()
    const mo = String(now.getMonth() + 1).padStart(2, '0')
    const da = String(now.getDate()).padStart(2, '0')
    const hh = String(now.getHours()).padStart(2, '0')
    const mi = String(now.getMinutes()).padStart(2, '0')
    const purchaseDate = `${y}-${mo}-${da}`
    const shortTime = `${mo}${da}-${hh}:${mi}`
    const title = (listing.value.title || '商品').trim()
    const memo = `商城：《${title}》${shortTime}`.slice(0, 32)
    const metadata = JSON.stringify({
      type: 'marketplace',
      listingId: listing.value.id,
      title,
      purchaseDate,
      remark: `${title} · 购买日 ${purchaseDate}`
    })

    const transferUrl = buildSemiTransferUrl(sellerAddress, amount, {
      semiAppUrl,
      memo,
      metadata
    })

    try {
      newWindow.location.href = transferUrl
    } catch {
      window.open(transferUrl, '_blank')
    }

    toast.add({
      title: '已预订并打开 Semi 转账',
      description: '请核对收款地址与金额后完成付款',
      color: 'green'
    })
    await load()
  } catch (e: any) {
    try {
      newWindow.close()
    } catch {
      /* ignore */
    }
    toast.add({ title: e?.message || '锁单失败', color: 'red' })
  } finally {
    locking.value = false
  }
}

async function doConfirmSold() {
  if (!listing.value) return
  try {
    await api.confirmMarketplaceSold(communityId.value, listing.value.id)
    toast.add({ title: '已标记为售出', color: 'green' })
    await load()
  } catch (e: any) {
    toast.add({ title: e?.message || '操作失败', color: 'red' })
  }
}

async function doCancelLock() {
  if (!listing.value) return
  try {
    await api.cancelMarketplaceLock(communityId.value, listing.value.id)
    toast.add({ title: '已重新上架', color: 'green' })
    await load()
  } catch (e: any) {
    toast.add({ title: e?.message || '操作失败', color: 'red' })
  }
}

async function submitReview() {
  if (!listing.value) return
  reviewSubmitting.value = true
  try {
    await api.submitMarketplaceReview(communityId.value, listing.value.id, {
      rating: reviewRating.value,
      content: reviewText.value.trim()
    })
    toast.add({ title: '评价已提交', color: 'green' })
    existingReview.value = { rating: reviewRating.value, content: reviewText.value.trim() }
    await loadReviews()
  } catch (e: any) {
    toast.add({ title: e?.message || '提交失败', color: 'red' })
  } finally {
    reviewSubmitting.value = false
  }
}

onMounted(async () => {
  await communityStore.setCurrentCommunity(communityId.value)
  await userStore.getUser()
  await load()
  await loadReviews()
})
</script>
