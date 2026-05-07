<template>
  <div class="min-h-screen pb-24 px-4 py-6 max-w-lg mx-auto">
    <header class="flex items-center gap-3 mb-6">
      <button type="button" class="p-2 -ml-2 rounded-xl hover:bg-input-bg" @click="router.back()">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <h1 class="text-xl font-bold text-text-title">{{ editingId ? '编辑商品' : '发布商品' }}</h1>
    </header>

    <div class="space-y-4">
      <div>
        <label class="block text-sm font-bold text-text-body mb-1">图片（可选，最多3张，首张为主图）</label>
        <input ref="fileRef" type="file" accept="image/*" multiple class="hidden" @change="onFiles" />
        <div class="flex gap-2 flex-wrap">
          <button
            type="button"
            class="w-24 h-24 rounded-xl border-2 border-dashed border-border bg-input-bg flex items-center justify-center text-2xl"
            :disabled="images.length >= 3 || uploading"
            @click="fileRef?.click()"
          >
            +
          </button>
          <div v-for="(url, i) in images" :key="i" class="relative w-24 h-24 rounded-xl overflow-hidden border border-border">
            <img :src="url" alt="" class="w-full h-full object-cover" />
            <button
              type="button"
              class="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white text-xs"
              @click="images.splice(i, 1)"
            >
              ×
            </button>
          </div>
        </div>
        <p v-if="uploading" class="text-sm text-text-placeholder mt-1">上传中…</p>
      </div>

      <div>
        <label class="block text-sm font-bold text-text-body mb-1">标题</label>
        <input v-model="title" type="text" maxlength="200" class="w-full h-11 px-3 rounded-xl border border-border bg-input-bg" />
      </div>

      <div>
        <label class="block text-sm font-bold text-text-body mb-1">详情描述</label>
        <textarea v-model="description" rows="5" class="w-full px-3 py-2 rounded-xl border border-border bg-input-bg resize-none" />
      </div>

      <div>
        <label class="block text-sm font-bold text-text-body mb-1">价格（元）</label>
        <input v-model.number="price" type="number" min="0" step="0.5" class="w-full h-11 px-3 rounded-xl border border-border bg-input-bg" />
      </div>

      <div>
        <label class="block text-sm font-bold text-text-body mb-2">标签</label>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="t in tagList.filter(t => !t.archived)"
            :key="t.id"
            type="button"
            class="px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-colors"
            :class="selectedTagIds.has(t.id) ? 'border-primary' : 'border-border opacity-80'"
            :style="selectedTagIds.has(t.id) ? { backgroundColor: t.colorHex, color: '#fff' } : { color: t.colorHex, borderColor: t.colorHex }"
            @click="toggleTag(t.id)"
          >
            {{ t.name }}
          </button>
        </div>
      </div>

      <p v-if="err" class="text-destructive text-sm">{{ err }}</p>

      <div class="flex gap-3 pt-2">
        <PixelButton variant="primary" block :disabled="saving || uploading" @click="submit">
          {{ saving ? '保存中…' : '发布' }}
        </PixelButton>
      </div>

      <div v-if="canWithdraw" class="pt-4 border-t border-border">
        <p class="text-sm text-text-placeholder mb-2">仅「上架中」且无人预订时可撤回，删除后可在本页用原数据重新发布。</p>
        <PixelButton variant="secondary" block :disabled="withdrawing" @click="doWithdraw">
          {{ withdrawing ? '处理中…' : '撤回 / 删除商品' }}
        </PixelButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PixelButton from '~/components/pixel/PixelButton.vue'
import type { MarketplaceTag } from '~/utils/api'
import { useCommunityStore } from '~/stores/community'

definePageMeta({ layout: 'default', middleware: 'auth' })

const route = useRoute()
const router = useRouter()
const api = useApi()
const toast = useToast()
const userStore = useUserStore()
const communityStore = useCommunityStore()

const communityId = computed(() => route.params.id as string)
const editId = computed(() => (route.query.edit as string) || '')
const fromWithdraw = computed(() => (route.query.fromWithdraw as string) || '')

const fileRef = ref<HTMLInputElement | null>(null)
const tagList = ref<MarketplaceTag[]>([])
const title = ref('')
const description = ref('')
const price = ref<number | null>(null)
const images = ref<string[]>([])
const selectedTagIds = ref<Set<string>>(new Set())
const draftListingId = ref('')
const editingId = ref<string | null>(null)

const uploading = ref(false)
const saving = ref(false)
const withdrawing = ref(false)
const err = ref('')

function safeUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function generateTitleImage(t: string) {
  const display = t.length > 12 ? t.slice(0, 12) + '…' : t
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
    <rect width="400" height="400" fill="#f1f5f9"/>
    <rect x="20" y="20" width="360" height="360" rx="16" fill="#e2e8f0"/>
    <text x="200" y="200" text-anchor="middle" dominant-baseline="central" font-family="system-ui,sans-serif" font-size="36" font-weight="bold" fill="#334155">${display}</text>
    <text x="200" y="340" text-anchor="middle" font-family="system-ui,sans-serif" font-size="14" fill="#94a3b8">商城商品</text>
  </svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

const canWithdraw = computed(() => {
  if (!editingId.value) return false
  return listingStatus.value === 'active'
})

const listingStatus = ref<string | null>(null)

function toggleTag(id: string) {
  const s = new Set(selectedTagIds.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  selectedTagIds.value = s
}

async function onFiles(e: Event) {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files || []).slice(0, 3 - images.value.length)
  input.value = ''
  if (!files.length) return
  if (!draftListingId.value) draftListingId.value = safeUUID()
  uploading.value = true
  try {
    const res = await api.uploadMarketplaceImages({
      communityId: communityId.value,
      listingId: draftListingId.value,
      files
    })
    if (res.success && res.files?.length) {
      images.value = [...images.value, ...res.files.map((f) => f.url)].slice(0, 3)
    }
  } catch (e: any) {
    toast.add({ title: e?.message || '上传失败', color: 'red' })
  } finally {
    uploading.value = false
  }
}

async function submit() {
  err.value = ''
  if (!title.value.trim()) {
    err.value = '请填写标题'
    return
  }
  if (price.value == null || price.value < 0) {
    err.value = '请填写有效价格'
    return
  }
  const finalImages = images.value.length > 0
    ? images.value
    : [generateTitleImage(title.value.trim())]
  saving.value = true
  try {
    const tagIds = [...selectedTagIds.value]
    if (editingId.value) {
      await api.updateMarketplaceListing(communityId.value, editingId.value, {
        title: title.value.trim(),
        description: description.value,
        price: Number(price.value),
        imageUrls: finalImages,
        tagIds
      })
      toast.add({ title: '已保存', color: 'green' })
    } else {
      const id = draftListingId.value || safeUUID()
      await api.createMarketplaceListing(communityId.value, {
        id,
        title: title.value.trim(),
        description: description.value,
        price: Number(price.value),
        imageUrls: finalImages,
        tagIds
      })
      toast.add({ title: '发布成功', color: 'green' })
    }
    router.push(`/community/${communityId.value}/marketplace`)
  } catch (e: any) {
    err.value = e?.message || '保存失败'
  } finally {
    saving.value = false
  }
}

async function doWithdraw() {
  if (!editingId.value) return
  withdrawing.value = true
  try {
    await api.withdrawMarketplaceListing(communityId.value, editingId.value)
    toast.add({ title: '已撤回', color: 'green' })
    router.replace({
      path: `/community/${communityId.value}/marketplace/create`,
      query: {
        fromWithdraw: editingId.value
      }
    })
    editingId.value = null
    listingStatus.value = null
    draftListingId.value = safeUUID()
  } catch (e: any) {
    toast.add({ title: e?.message || '撤回失败', color: 'red' })
  } finally {
    withdrawing.value = false
  }
}

async function loadForEdit(id: string) {
  const { listing } = await api.getMarketplaceListing(communityId.value, id)
  if (listing.sellerId !== userStore.user?.id) {
    router.replace(`/community/${communityId.value}/marketplace`)
    return
  }
  if (listing.status !== 'active') {
    toast.add({ title: '当前状态不可编辑', color: 'red' })
    router.replace(`/community/${communityId.value}/marketplace/${id}`)
    return
  }
  editingId.value = listing.id
  listingStatus.value = listing.status
  draftListingId.value = listing.id
  title.value = listing.title
  description.value = listing.description
  price.value = listing.price
  images.value = [...listing.imageUrls]
  selectedTagIds.value = new Set(listing.tags.map((t) => t.id))
}

async function loadFromWithdraw(id: string) {
  try {
    const { listing } = await api.getMarketplaceListing(communityId.value, id)
    if (listing.sellerId !== userStore.user?.id) return
    title.value = listing.title
    description.value = listing.description
    price.value = listing.price
    images.value = [...listing.imageUrls]
    selectedTagIds.value = new Set(listing.tags.map((t) => t.id))
    draftListingId.value = safeUUID()
  } catch (_) {
    /* ignore */
  }
}

async function initPage() {
  await communityStore.setCurrentCommunity(communityId.value)
  tagList.value = await api.getMarketplaceTags(communityId.value)
  draftListingId.value = safeUUID()

  if (editId.value) {
    await loadForEdit(editId.value)
  } else if (fromWithdraw.value) {
    await loadFromWithdraw(fromWithdraw.value)
  }
}

onMounted(() => initPage())

watch(
  () => route.query.fromWithdraw,
  async (v) => {
    if (typeof v === 'string' && v) await loadFromWithdraw(v)
  }
)
</script>
