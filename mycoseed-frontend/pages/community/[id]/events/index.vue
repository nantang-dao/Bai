<template>
  <div class="min-h-screen pb-28">
    <header class="sticky top-0 z-40 bg-card border-b border-border px-3 py-3">
      <div class="max-w-3xl mx-auto flex items-center justify-between gap-2">
        <div class="flex items-center gap-2 min-w-0">
          <button type="button" class="p-2 -ml-1 rounded-xl hover:bg-input-bg" @click="router.back()">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 class="text-lg font-bold text-text-title truncate">活动</h1>
        </div>
        <NuxtLink
          v-if="isAdmin"
          :to="`/community/${communityId}/events/create`"
          class="shrink-0 px-3 py-1.5 rounded-xl bg-primary text-white text-sm font-medium"
        >
          创建活动
        </NuxtLink>
      </div>
      <div v-if="tags.length" class="max-w-3xl mx-auto mt-2 flex flex-wrap gap-2 items-center">
        <span class="text-xs text-text-placeholder w-full sm:w-auto">标签</span>
        <button
          type="button"
          class="px-2 py-0.5 rounded-full text-xs border"
          :class="!filterTagId ? 'bg-primary text-white border-primary' : 'bg-input-bg border-border'"
          @click="filterTagId = ''; refreshData()"
        >
          全部
        </button>
        <button
          v-for="t in tags"
          :key="t.id"
          type="button"
          class="px-2 py-0.5 rounded-full text-xs text-white"
          :style="{ backgroundColor: t.colorHex, opacity: filterTagId && filterTagId !== t.id ? 0.5 : 1 }"
          @click="filterTagId = t.id; refreshData()"
        >
          {{ t.name }}
        </button>
        <label class="ml-auto flex items-center gap-1 text-xs text-text-body cursor-pointer">
          <input v-model="mineOnly" type="checkbox" class="rounded" @change="refreshData()" />
          我的活动
        </label>
      </div>
    </header>

    <!-- 列表视图 -->
    <div v-if="viewMode === 'list'" class="max-w-3xl mx-auto px-3 py-4">
      <p v-if="loading && !events.length" class="text-center text-text-placeholder py-12">加载中…</p>
      <p v-else-if="!events.length" class="text-center text-text-placeholder py-12">暂无活动</p>
      <ul v-else class="space-y-3">
        <li
          v-for="ev in events"
          :key="ev.id"
          class="relative rounded-2xl border border-border bg-card p-4 shadow-soft"
          :class="{ 'opacity-60': isEnded(ev) }"
        >
          <button
            v-if="isAdmin"
            type="button"
            class="absolute top-3 right-10 p-1 text-lg z-10"
            :class="ev.isPinned ? 'text-amber-500' : 'text-text-placeholder'"
            title="置顶"
            @click="togglePin(ev)"
          >
            📌
          </button>
          <NuxtLink :to="`/community/${communityId}/events/${ev.id}`" class="block pr-8">
            <div class="flex items-start gap-2 mb-2">
              <span
                v-if="ev.tag"
                class="shrink-0 px-2 py-0.5 rounded text-xs text-white font-medium"
                :style="{ backgroundColor: ev.tag.colorHex }"
              >
                {{ ev.tag.name }}
              </span>
              <span v-if="ev.isPinned" class="text-xs text-amber-600 font-bold">置顶</span>
            </div>
            <h2 class="font-bold text-text-title text-lg leading-snug">{{ ev.title }}</h2>
            <p class="text-xs text-text-placeholder mt-1 line-clamp-2">{{ ev.description }}</p>
            <div class="mt-2 text-sm text-text-body">
              <span>{{ fmtRange(ev) }}</span>
              <span class="mx-1">·</span>
              <span>{{ priceSummary(ev) }}</span>
              <span class="mx-1">·</span>
              <span>已报 {{ ev.participantCount }} 人</span>
            </div>
          </NuxtLink>
        </li>
      </ul>
      <p v-if="loadingMore" class="text-center text-sm text-text-placeholder py-4">加载更多…</p>
    </div>

    <!-- 日历视图 -->
    <div v-else class="max-w-3xl mx-auto px-3 py-4">
      <div class="flex flex-wrap items-center justify-center gap-2 mb-4">
        <button
          v-for="s in calScaleOptions"
          :key="s.v"
          type="button"
          class="px-3 py-1.5 rounded-xl text-sm border"
          :class="calScale === s.v ? 'border-primary bg-primary/15 text-text-title' : 'border-border bg-input-bg'"
          @click="calScale = s.v; loadCalendar()"
        >
          {{ s.l }}
        </button>
      </div>

      <div class="flex items-center justify-between gap-2 mb-3">
        <button type="button" class="p-2 rounded-xl hover:bg-input-bg" aria-label="上一段" @click="navCal(-1)">
          ‹
        </button>
        <span class="text-sm font-bold text-text-title text-center flex-1">{{ calTitle }}</span>
        <button type="button" class="p-2 rounded-xl hover:bg-input-bg" aria-label="下一段" @click="navCal(1)">
          ›
        </button>
      </div>

      <p v-if="calLoading" class="text-center text-text-placeholder py-8">加载中…</p>
      <template v-else>
        <!-- 月 -->
        <div v-if="calScale === 'month'" class="rounded-2xl border border-border overflow-hidden bg-card">
          <div class="grid grid-cols-7 text-center text-xs py-2 bg-input-bg border-b border-border">
            <span v-for="w in weekDayLabels" :key="w">{{ w }}</span>
          </div>
          <div class="grid grid-cols-7 gap-px bg-border">
            <button
              v-for="(cell, idx) in monthCells"
              :key="idx"
              type="button"
              class="min-h-[72px] p-1 text-left bg-card hover:bg-input-bg/80 transition-colors disabled:opacity-40"
              :disabled="!cell.dayKey"
              @click="cell.dayKey && openDayModal(cell.dayKey)"
            >
              <template v-if="cell.dayKey">
                <div class="text-xs font-medium text-text-title mb-1">{{ cell.dayNum }}</div>
                <div class="flex flex-wrap gap-0.5">
                  <span
                    v-for="(dot, di) in dotsForDay(cell.dayKey).slice(0, 4)"
                    :key="di"
                    class="w-2 h-2 rounded-full shrink-0"
                    :style="{ backgroundColor: dot.color }"
                  />
                  <span v-if="dotsForDay(cell.dayKey).length > 4" class="text-[10px] text-text-placeholder">+</span>
                </div>
              </template>
            </button>
          </div>
        </div>

        <!-- 周 -->
        <div v-else-if="calScale === 'week'" class="grid grid-cols-7 gap-2">
          <button
            v-for="wd in weekStrip"
            :key="wd.dayKey"
            type="button"
            class="rounded-2xl border border-border bg-card p-2 text-left min-h-[100px] hover:bg-input-bg/80"
            @click="openDayModal(wd.dayKey)"
          >
            <div class="text-xs font-bold text-text-title">{{ wd.label }}</div>
            <div class="mt-2 space-y-1">
              <div
                v-for="ev in uniqueEventsForDay(wd.dayKey).slice(0, 4)"
                :key="ev.id"
                class="text-[10px] truncate rounded px-1 text-white"
                :style="{ backgroundColor: ev.tag?.colorHex || '#64748b' }"
              >
                {{ ev.title }}
              </div>
            </div>
          </button>
        </div>

        <!-- 日 -->
        <div v-else class="space-y-2">
          <p v-if="!dayList.length" class="text-center text-text-placeholder py-8">当日无活动场次</p>
          <NuxtLink
            v-for="item in dayList"
            :key="item.ev.id + item.occ.id"
            :to="`/community/${communityId}/events/${item.ev.id}`"
            class="block rounded-2xl border border-border bg-card p-4 hover:bg-input-bg/50"
          >
            <div class="flex items-start gap-2">
              <span
                v-if="item.ev.tag"
                class="shrink-0 px-2 py-0.5 rounded text-xs text-white"
                :style="{ backgroundColor: item.ev.tag.colorHex }"
              >
                {{ item.ev.tag.name }}
              </span>
            </div>
            <h3 class="font-bold text-text-title mt-1">{{ item.ev.title }}</h3>
            <p class="text-xs text-text-placeholder mt-1">
              {{ fmtOcc(item.occ) }}
            </p>
          </NuxtLink>
        </div>
      </template>
    </div>

    <!-- 列表 / 日历 悬浮切换 -->
    <div class="fixed bottom-20 left-0 right-0 z-40 flex justify-center pointer-events-none px-4">
      <div
        class="pointer-events-auto flex rounded-full border border-border bg-card shadow-lg p-1 gap-1"
      >
        <button
          type="button"
          class="px-5 py-2.5 rounded-full text-sm font-medium transition-colors"
          :class="viewMode === 'list' ? 'bg-primary text-white' : 'text-text-body'"
          @click="viewMode = 'list'"
        >
          列表
        </button>
        <button
          type="button"
          class="px-5 py-2.5 rounded-full text-sm font-medium transition-colors"
          :class="viewMode === 'calendar' ? 'bg-primary text-white' : 'text-text-body'"
          @click="switchToCalendar()"
        >
          日历
        </button>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="modalDayKey"
        class="fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center p-4"
        @click.self="modalDayKey = null"
      >
        <div class="bg-card rounded-t-3xl sm:rounded-3xl p-4 max-w-lg w-full max-h-[70vh] overflow-y-auto">
          <div class="flex justify-between items-center mb-3">
            <h3 class="font-bold text-lg">{{ modalDayLabel }}</h3>
            <button type="button" class="text-text-placeholder" @click="modalDayKey = null">关闭</button>
          </div>
          <ul class="space-y-3">
            <li v-for="item in modalDayItems" :key="item.ev.id + item.occ.id">
              <NuxtLink
                :to="`/community/${communityId}/events/${item.ev.id}`"
                class="block rounded-xl border border-border p-3 hover:bg-input-bg"
                @click="modalDayKey = null"
              >
                <div class="flex gap-2 items-center">
                  <span
                    v-if="item.ev.tag"
                    class="px-2 py-0.5 rounded text-xs text-white shrink-0"
                    :style="{ backgroundColor: item.ev.tag.colorHex }"
                  >
                    {{ item.ev.tag.name }}
                  </span>
                  <span class="font-medium text-text-title truncate">{{ item.ev.title }}</span>
                </div>
                <p class="text-xs text-text-placeholder mt-1">{{ fmtOcc(item.occ) }}</p>
              </NuxtLink>
            </li>
          </ul>
          <p v-if="!modalDayItems.length" class="text-text-placeholder text-sm py-6 text-center">当日无活动场次</p>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { CalendarTag, CommunityEventListItem, CommunityEventOccurrence } from '~/utils/api'
import { useCommunityStore } from '~/stores/community'

definePageMeta({ layout: 'default', middleware: 'auth' })

const route = useRoute()
const router = useRouter()
const api = useApi()
const toast = useToast()
const communityStore = useCommunityStore()

const communityId = computed(() => route.params.id as string)
const isAdmin = computed(() => {
  const r = communityStore.currentCommunity?.myRole
  return r === 'super_admin' || r === 'sub_admin'
})

const viewMode = ref<'list' | 'calendar'>('list')
const calScale = ref<'month' | 'week' | 'day'>('month')
const calScaleOptions = [
  { v: 'month' as const, l: '月' },
  { v: 'week' as const, l: '周' },
  { v: 'day' as const, l: '日' }
]

const cursor = ref(new Date())
const calendarEvents = ref<CommunityEventListItem[]>([])
const calLoading = ref(false)

const tags = ref<CalendarTag[]>([])
const events = ref<CommunityEventListItem[]>([])
const total = ref(0)
const offset = ref(0)
const pageSize = 15
const loading = ref(true)
const loadingMore = ref(false)
const filterTagId = ref('')
const mineOnly = ref(false)

const modalDayKey = ref<string | null>(null)

const weekDayLabels = ['日', '一', '二', '三', '四', '五', '六']

function localDayKey(iso: string): string {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function rangeFromCursor(scale: 'month' | 'week' | 'day', d: Date): { from: string; to: string } {
  if (scale === 'month') {
    const y = d.getFullYear()
    const m = d.getMonth()
    const start = new Date(y, m, 1)
    const end = new Date(y, m + 1, 0, 23, 59, 59, 999)
    return { from: start.toISOString(), to: end.toISOString() }
  }
  if (scale === 'week') {
    const day = d.getDay()
    const start = new Date(d)
    start.setDate(d.getDate() - day)
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    end.setHours(23, 59, 59, 999)
    return { from: start.toISOString(), to: end.toISOString() }
  }
  const start = new Date(d)
  start.setHours(0, 0, 0, 0)
  const end = new Date(d)
  end.setHours(23, 59, 59, 999)
  return { from: start.toISOString(), to: end.toISOString() }
}

const calTitle = computed(() => {
  const d = cursor.value
  if (calScale.value === 'month') {
    return `${d.getFullYear()}年${d.getMonth() + 1}月`
  }
  if (calScale.value === 'week') {
    const { from, to } = rangeFromCursor('week', d)
    const a = new Date(from)
    const b = new Date(to)
    return `${a.getMonth() + 1}/${a.getDate()} – ${b.getMonth() + 1}/${b.getDate()}`
  }
  return d.toLocaleDateString('zh-CN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
})

const monthCells = computed(() => {
  const d = cursor.value
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  const first = new Date(y, m - 1, 1)
  const lastDay = new Date(y, m, 0).getDate()
  const pad = first.getDay()
  const cells: Array<{ dayKey: string | null; dayNum?: number }> = []
  for (let i = 0; i < pad; i++) cells.push({ dayKey: null })
  for (let day = 1; day <= lastDay; day++) {
    const key = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    cells.push({ dayKey: key, dayNum: day })
  }
  while (cells.length % 7 !== 0) cells.push({ dayKey: null })
  return cells
})

const weekStrip = computed(() => {
  const d = new Date(cursor.value)
  const day = d.getDay()
  const start = new Date(d)
  start.setDate(d.getDate() - day)
  start.setHours(12, 0, 0, 0)
  const out: { dayKey: string; label: string }[] = []
  for (let i = 0; i < 7; i++) {
    const x = new Date(start)
    x.setDate(start.getDate() + i)
    const key = localDayKey(x.toISOString())
    out.push({
      dayKey: key,
      label: `${weekDayLabels[x.getDay()]} ${x.getMonth() + 1}/${x.getDate()}`
    })
  }
  return out
})

function occOnDay(ev: CommunityEventListItem, dayKey: string): CommunityEventOccurrence[] {
  return ev.occurrences.filter((o) => localDayKey(o.activityStart) === dayKey)
}

function uniqueEventsForDay(dayKey: string): CommunityEventListItem[] {
  const seen = new Set<string>()
  const out: CommunityEventListItem[] = []
  for (const ev of calendarEvents.value) {
    if (occOnDay(ev, dayKey).length && !seen.has(ev.id)) {
      seen.add(ev.id)
      out.push(ev)
    }
  }
  return out
}

function dotsForDay(dayKey: string): { color: string }[] {
  const seen = new Set<string>()
  const dots: { color: string }[] = []
  for (const ev of calendarEvents.value) {
    if (!occOnDay(ev, dayKey).length) continue
    if (seen.has(ev.id)) continue
    seen.add(ev.id)
    dots.push({ color: ev.tag?.colorHex || '#64748b' })
  }
  return dots
}

const dayList = computed(() => {
  const dayKey = localDayKey(cursor.value.toISOString())
  const items: { ev: CommunityEventListItem; occ: CommunityEventOccurrence }[] = []
  for (const ev of calendarEvents.value) {
    for (const occ of occOnDay(ev, dayKey)) {
      items.push({ ev, occ })
    }
  }
  items.sort((a, b) => new Date(a.occ.activityStart).getTime() - new Date(b.occ.activityStart).getTime())
  return items
})

const modalDayLabel = computed(() => {
  if (!modalDayKey.value) return ''
  const [y, m, d] = modalDayKey.value.split('-').map(Number)
  return `${y}年${m}月${d}日`
})

const modalDayItems = computed(() => {
  if (!modalDayKey.value) return []
  const key = modalDayKey.value
  const items: { ev: CommunityEventListItem; occ: CommunityEventOccurrence }[] = []
  for (const ev of calendarEvents.value) {
    for (const occ of occOnDay(ev, key)) {
      items.push({ ev, occ })
    }
  }
  items.sort((a, b) => new Date(a.occ.activityStart).getTime() - new Date(b.occ.activityStart).getTime())
  return items
})

function fmtOcc(occ: CommunityEventOccurrence) {
  const s = new Date(occ.activityStart)
  const e = new Date(occ.activityEnd)
  return `${s.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} – ${e.toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
}

function openDayModal(dayKey: string) {
  modalDayKey.value = dayKey
}

function navCal(delta: number) {
  const d = new Date(cursor.value)
  if (calScale.value === 'month') {
    d.setMonth(d.getMonth() + delta)
    d.setDate(1)
  } else if (calScale.value === 'week') {
    d.setDate(d.getDate() + delta * 7)
  } else {
    d.setDate(d.getDate() + delta)
  }
  cursor.value = d
  loadCalendar()
}

function switchToCalendar() {
  viewMode.value = 'calendar'
  loadCalendar()
}

async function loadCalendar() {
  if (viewMode.value !== 'calendar') return
  calLoading.value = true
  try {
    const { from, to } = rangeFromCursor(calScale.value, cursor.value)
    const { events: rows } = await api.listCommunityEventsCalendar(communityId.value, {
      from,
      to,
      tagId: filterTagId.value || undefined,
      mine: mineOnly.value
    })
    calendarEvents.value = rows
  } catch (e: any) {
    toast.add({ title: e?.message || '日历加载失败', color: 'red' })
    calendarEvents.value = []
  } finally {
    calLoading.value = false
  }
}

function refreshData() {
  if (viewMode.value === 'list') load(true)
  else loadCalendar()
}

function isEnded(ev: CommunityEventListItem) {
  const ends = ev.occurrences.map((o) => new Date(o.activityEnd).getTime())
  if (!ends.length) return false
  const max = Math.max(...ends)
  return max < Date.now()
}

/** 列表卡片时间：活动包展示当前可报名/最近一场及总场次数 */
function fmtRange(ev: CommunityEventListItem) {
  if (!ev.occurrences.length) return ''
  const now = Date.now()
  const sorted = [...ev.occurrences].sort(
    (a, b) => new Date(a.activityStart).getTime() - new Date(b.activityStart).getTime()
  )
  if (ev.kind === 'pack' && sorted.length > 1) {
    const open = sorted.find((o) => new Date(o.activityEnd).getTime() >= now)
    const o = open || sorted[sorted.length - 1]
    const s = new Date(o.activityStart)
    const e = new Date(o.activityEnd)
    const span = `${s.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} – ${e.toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
    return `活动包 · ${span} · 共${sorted.length}场`
  }
  const o = sorted[0]
  const s = new Date(o.activityStart)
  const e = new Date(o.activityEnd)
  return `${s.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} – ${e.toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
}

function priceSummary(ev: CommunityEventListItem) {
  if (ev.kind === 'single') return ev.options[0]?.price ? `¥${ev.options[0].price}` : '免费'
  const ps = ev.options.map((o) => o.price).filter((p) => p > 0)
  if (!ps.length) return '多选项 · 免费'
  return `¥${Math.min(...ps)}起`
}

async function load(reset: boolean) {
  if (reset) {
    offset.value = 0
    events.value = []
  }
  loading.value = true
  try {
    const { events: rows, total: t } = await api.listCommunityEvents(communityId.value, {
      tagId: filterTagId.value || undefined,
      mine: mineOnly.value,
      limit: pageSize,
      offset: offset.value
    })
    if (reset) events.value = rows
    else events.value = [...events.value, ...rows]
    total.value = t
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

async function loadMore() {
  if (events.value.length >= total.value) return
  loadingMore.value = true
  offset.value = events.value.length
  try {
    const { events: rows, total: t } = await api.listCommunityEvents(communityId.value, {
      tagId: filterTagId.value || undefined,
      mine: mineOnly.value,
      limit: pageSize,
      offset: offset.value
    })
    events.value = [...events.value, ...rows]
    total.value = t
  } finally {
    loadingMore.value = false
  }
}

function onWindowScroll() {
  if (typeof window === 'undefined') return
  if (viewMode.value !== 'list') return
  const doc = document.documentElement
  if (window.innerHeight + window.scrollY >= doc.scrollHeight - 160) loadMore()
}

async function togglePin(ev: CommunityEventListItem) {
  try {
    await api.pinCommunityEvent(communityId.value, ev.id, !ev.isPinned)
    await load(true)
    if (viewMode.value === 'calendar') await loadCalendar()
  } catch (e: any) {
    toast.add({ title: e?.message || '操作失败', color: 'red' })
  }
}

watch([filterTagId, mineOnly], () => {
  if (viewMode.value === 'calendar') loadCalendar()
  else load(true)
})

watch(calScale, () => {
  if (viewMode.value === 'calendar') loadCalendar()
})

watch(viewMode, (v) => {
  if (v === 'calendar') loadCalendar()
})

onMounted(async () => {
  await communityStore.setCurrentCommunity(communityId.value)
  try {
    tags.value = await api.listCalendarTags(communityId.value)
  } catch {
    tags.value = []
  }
  await load(true)
  window.addEventListener('scroll', onWindowScroll, { passive: true })
})

onUnmounted(() => {
  window.removeEventListener('scroll', onWindowScroll)
})

watch(communityId, async () => {
  tags.value = await api.listCalendarTags(communityId.value)
  await load(true)
  if (viewMode.value === 'calendar') await loadCalendar()
})
</script>
