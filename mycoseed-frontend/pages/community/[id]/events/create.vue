<template>
  <div class="min-h-screen pb-24 px-4 py-6 max-w-lg mx-auto">
    <header class="flex items-center gap-3 mb-6">
      <button type="button" class="p-2 -ml-2 rounded-xl hover:bg-input-bg" @click="router.back()">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <h1 class="text-xl font-bold text-text-title">发布活动</h1>
    </header>

    <div class="space-y-4">
      <div>
        <label class="text-sm font-bold text-text-body">类型</label>
        <div class="flex flex-wrap gap-2 mt-1">
          <button
            v-for="k in kinds"
            :key="k.v"
            type="button"
            class="px-3 py-1.5 rounded-xl text-sm border-2"
            :class="kind === k.v ? 'border-primary bg-primary/10' : 'border-border'"
            @click="kind = k.v as any"
          >
            {{ k.l }}
          </button>
        </div>
      </div>

      <div>
        <label class="text-sm font-bold text-text-body">标题 *</label>
        <input v-model="title" class="w-full h-11 px-3 rounded-xl border border-border bg-input-bg mt-1" />
      </div>
      <div>
        <label class="text-sm font-bold text-text-body">简介</label>
        <textarea v-model="description" rows="3" class="w-full px-3 py-2 rounded-xl border border-border bg-input-bg mt-1 resize-none" />
      </div>

      <div>
        <label class="text-sm font-bold text-text-body">日历标签（单选）</label>
        <select v-model="tagId" class="w-full h-11 px-3 rounded-xl border border-border bg-input-bg mt-1">
          <option value="">不选</option>
          <option v-for="t in tags" :key="t.id" :value="t.id">{{ t.name }}</option>
        </select>
      </div>

      <div class="flex items-center gap-2">
        <input id="ne" v-model="noteEnabled" type="checkbox" class="rounded" />
        <label for="ne" class="text-sm">报名需填写备注</label>
      </div>

      <div>
        <label class="text-sm font-bold text-text-body">收款地址（Semi）</label>
        <p class="text-xs text-text-placeholder mt-0.5">
          存在付费选项时必填。报名人付款将转入此地址（可为社区公共地址），不会使用发布人个人钱包。
        </p>
        <input
          v-model="paymentAddress"
          placeholder="链上收款地址"
          autocomplete="off"
          class="w-full h-11 px-3 rounded-xl border border-border bg-input-bg mt-1 font-mono text-sm"
        />
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <label class="text-sm font-bold">报名开始</label>
          <input v-model="registrationStart" type="datetime-local" class="w-full h-10 px-2 rounded-xl border border-border bg-input-bg mt-1" />
        </div>
        <div>
          <label class="text-sm font-bold">报名结束</label>
          <input v-model="registrationEnd" type="datetime-local" class="w-full h-10 px-2 rounded-xl border border-border bg-input-bg mt-1" />
        </div>
      </div>

      <template v-if="kind === 'single'">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label class="text-sm font-bold">活动开始</label>
            <input v-model="actStart" type="datetime-local" class="w-full h-10 px-2 rounded-xl border border-border bg-input-bg mt-1" />
          </div>
          <div>
            <label class="text-sm font-bold">活动结束</label>
            <input v-model="actEnd" type="datetime-local" class="w-full h-10 px-2 rounded-xl border border-border bg-input-bg mt-1" />
          </div>
        </div>
        <div>
          <label class="text-sm font-bold">金额（可为 0）</label>
          <input v-model.number="singlePrice" type="number" min="0" step="0.01" class="w-full h-11 px-3 rounded-xl border border-border bg-input-bg mt-1" />
        </div>
      </template>

      <template v-if="kind === 'composite'">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label class="text-sm font-bold">活动开始</label>
            <input v-model="actStart" type="datetime-local" class="w-full h-10 px-2 rounded-xl border border-border bg-input-bg mt-1" />
          </div>
          <div>
            <label class="text-sm font-bold">活动结束</label>
            <input v-model="actEnd" type="datetime-local" class="w-full h-10 px-2 rounded-xl border border-border bg-input-bg mt-1" />
          </div>
        </div>
        <div class="space-y-2">
          <div class="flex justify-between items-center">
            <label class="text-sm font-bold">子选项</label>
            <button type="button" class="text-primary text-sm" @click="subOptions.push({ title: '', price: 0 })">+ 添加</button>
          </div>
          <div v-for="(o, i) in subOptions" :key="i" class="flex gap-2 items-center">
            <input v-model="o.title" placeholder="名称" class="flex-1 h-10 px-2 rounded-xl border border-border bg-input-bg" />
            <input v-model.number="o.price" type="number" min="0" step="0.01" class="w-24 h-10 px-2 rounded-xl border border-border bg-input-bg" />
            <button type="button" class="text-red-500" @click="subOptions.splice(i, 1)">×</button>
          </div>
        </div>
      </template>

      <template v-if="kind === 'pack'">
        <div>
          <label class="text-sm font-bold">重复</label>
          <select v-model="packFrequency" class="w-full h-11 px-3 rounded-xl border border-border bg-input-bg mt-1">
            <option value="daily">每天</option>
            <option value="weekly">每周（勾选星期）</option>
            <option value="custom">自定义（勾选星期）</option>
          </select>
        </div>
        <div v-if="packFrequency === 'weekly' || packFrequency === 'custom'" class="flex flex-wrap gap-2">
          <label v-for="(d, i) in weekLabels" :key="i" class="flex items-center gap-1 text-sm">
            <input v-model="weekPick[i]" type="checkbox" />
            {{ d }}
          </label>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="text-sm font-bold">日期范围起</label>
            <input v-model="packRangeStart" type="date" class="w-full h-10 px-2 rounded-xl border border-border bg-input-bg mt-1" />
          </div>
          <div>
            <label class="text-sm font-bold">日期范围止</label>
            <input v-model="packRangeEnd" type="date" class="w-full h-10 px-2 rounded-xl border border-border bg-input-bg mt-1" />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="text-sm font-bold">每场开始时刻</label>
            <input v-model="slotTimeStart" type="time" class="w-full h-10 px-2 rounded-xl border border-border bg-input-bg mt-1" />
          </div>
          <div>
            <label class="text-sm font-bold">每场结束时刻</label>
            <input v-model="slotTimeEnd" type="time" class="w-full h-10 px-2 rounded-xl border border-border bg-input-bg mt-1" />
          </div>
        </div>
        <p class="text-xs text-text-placeholder">将生成 {{ generatedOccurrences.length }} 个期次（预览）：每期需单独报名。</p>
        <div class="space-y-2">
          <label class="text-sm font-bold">活动包选项（与子活动金额）</label>
          <button type="button" class="text-primary text-sm" @click="packOptions.push({ title: '', price: 0 })">+ 添加选项</button>
          <div v-for="(o, i) in packOptions" :key="i" class="flex gap-2 items-center">
            <input v-model="o.title" placeholder="名称" class="flex-1 h-10 px-2 rounded-xl border border-border bg-input-bg" />
            <input v-model.number="o.price" type="number" min="0" step="0.01" class="w-24 h-10 px-2 rounded-xl border border-border bg-input-bg" />
            <button type="button" class="text-red-500" @click="packOptions.splice(i, 1)">×</button>
          </div>
        </div>
      </template>

      <p v-if="err" class="text-destructive text-sm">{{ err }}</p>
      <PixelButton variant="primary" block :disabled="saving" @click="submit">{{ saving ? '提交中…' : '发布' }}</PixelButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PixelButton from '~/components/pixel/PixelButton.vue'
import type { CalendarTag } from '~/utils/api'
import { useCommunityStore } from '~/stores/community'

definePageMeta({ layout: 'default', middleware: 'auth' })

const EVENT_DELETE_DRAFT_KEY = 'mycoseed_community_event_delete_draft'

const kinds = [
  { v: 'single', l: '单一活动' },
  { v: 'composite', l: '复合活动' },
  { v: 'pack', l: '活动包' }
]

const route = useRoute()
const router = useRouter()
const api = useApi()
const toast = useToast()
const communityStore = useCommunityStore()

const communityId = computed(() => route.params.id as string)

const kind = ref<'single' | 'composite' | 'pack'>('single')
const title = ref('')
const description = ref('')
const tagId = ref('')
const noteEnabled = ref(false)
const paymentAddress = ref('')
const registrationStart = ref('')
const registrationEnd = ref('')
const actStart = ref('')
const actEnd = ref('')
const singlePrice = ref(0)
const subOptions = ref<{ title: string; price: number }[]>([{ title: '', price: 0 }])
const packFrequency = ref<'daily' | 'weekly' | 'custom'>('daily')
const packRangeStart = ref('')
const packRangeEnd = ref('')
const slotTimeStart = ref('09:00')
const slotTimeEnd = ref('11:00')
const weekPick = ref([false, false, false, false, false, false, false])
const weekLabels = ['日', '一', '二', '三', '四', '五', '六']
const packOptions = ref<{ title: string; price: number }[]>([{ title: '', price: 0 }])

const tags = ref<CalendarTag[]>([])
const saving = ref(false)
const err = ref('')

function padLocal(dt: Date) {
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, '0')
  const d = String(dt.getDate()).padStart(2, '0')
  const h = String(dt.getHours()).padStart(2, '0')
  const mi = String(dt.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${d}T${h}:${mi}`
}

function isoToDatetimeLocal(iso: string): string {
  if (!iso) return ''
  const dt = new Date(iso)
  if (Number.isNaN(dt.getTime())) return ''
  return padLocal(dt)
}

function timeFromIso(iso: string): string {
  if (!iso) return '09:00'
  const dt = new Date(iso)
  if (Number.isNaN(dt.getTime())) return '09:00'
  const h = String(dt.getHours()).padStart(2, '0')
  const mi = String(dt.getMinutes()).padStart(2, '0')
  return `${h}:${mi}`
}

function applyDeleteDraft(raw: Record<string, unknown>) {
  const cid = raw.communityId
  if (typeof cid === 'string' && cid) communityStore.setCurrentCommunity(cid)

  kind.value =
    raw.kind === 'composite' || raw.kind === 'pack' ? raw.kind : 'single'

  title.value = typeof raw.title === 'string' ? raw.title : ''
  description.value = typeof raw.description === 'string' ? raw.description : ''
  tagId.value = typeof raw.tagId === 'string' ? raw.tagId : ''
  noteEnabled.value = !!raw.noteEnabled
  if (typeof raw.paymentAddress === 'string') paymentAddress.value = raw.paymentAddress

  if (typeof raw.registrationStart === 'string')
    registrationStart.value = isoToDatetimeLocal(raw.registrationStart)
  if (typeof raw.registrationEnd === 'string')
    registrationEnd.value = isoToDatetimeLocal(raw.registrationEnd)

  if (kind.value === 'single') {
    if (typeof raw.actStart === 'string') actStart.value = isoToDatetimeLocal(raw.actStart)
    if (typeof raw.actEnd === 'string') actEnd.value = isoToDatetimeLocal(raw.actEnd)
    const sp = raw.singlePrice
    singlePrice.value = typeof sp === 'number' ? sp : Number(sp) || 0
  } else if (kind.value === 'composite') {
    if (typeof raw.actStart === 'string') actStart.value = isoToDatetimeLocal(raw.actStart)
    if (typeof raw.actEnd === 'string') actEnd.value = isoToDatetimeLocal(raw.actEnd)
    const subs = raw.subOptions
    if (Array.isArray(subs) && subs.length) {
      subOptions.value = subs.map((o: any) => ({
        title: typeof o.title === 'string' ? o.title : '',
        price: Math.max(0, Number(o.price) || 0)
      }))
    } else {
      subOptions.value = [{ title: '', price: 0 }]
    }
  } else {
    const freq = raw.packFrequency
    if (freq === 'custom') {
      packFrequency.value = 'custom'
    } else if (freq === 'weekly') {
      packFrequency.value = 'weekly'
    } else {
      packFrequency.value = 'daily'
    }
    if (typeof raw.packRangeStart === 'string') packRangeStart.value = raw.packRangeStart.slice(0, 10)
    if (typeof raw.packRangeEnd === 'string') packRangeEnd.value = raw.packRangeEnd.slice(0, 10)
    const pco = raw.packCustomWeekdays
    const week = [false, false, false, false, false, false, false]
    if (Array.isArray(pco)) {
      for (const d of pco) {
        const n = Number(d)
        if (!Number.isNaN(n) && n >= 0 && n < 7) week[n] = true
      }
    }
    weekPick.value = week
    const po = raw.packOptions
    if (Array.isArray(po) && po.length) {
      packOptions.value = po.map((o: any) => ({
        title: typeof o.title === 'string' ? o.title : '',
        price: Math.max(0, Number(o.price) || 0)
      }))
    } else {
      packOptions.value = [{ title: '', price: 0 }]
    }
    const fo = raw.firstOccurrence as { activityStart?: string; activityEnd?: string } | undefined
    if (fo && typeof fo.activityStart === 'string' && typeof fo.activityEnd === 'string') {
      slotTimeStart.value = timeFromIso(fo.activityStart)
      slotTimeEnd.value = timeFromIso(fo.activityEnd)
    }
  }
}

const generatedOccurrences = computed(() => {
  if (kind.value !== 'pack' || !packRangeStart.value || !packRangeEnd.value || !slotTimeStart.value || !slotTimeEnd.value)
    return []
  const start = new Date(packRangeStart.value + 'T00:00:00')
  const end = new Date(packRangeEnd.value + 'T23:59:59')
  const out: { activityStart: string; activityEnd: string }[] = []
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const copy = new Date(d)
    const day = copy.getDay()
    if (
      packFrequency.value === 'daily' ||
      ((packFrequency.value === 'weekly' || packFrequency.value === 'custom') && weekPick.value[day])
    ) {
      const ds = copy.toISOString().slice(0, 10)
      const s = new Date(`${ds}T${slotTimeStart.value}:00`)
      const e = new Date(`${ds}T${slotTimeEnd.value}:00`)
      if (e <= s) e.setDate(e.getDate() + 1)
      out.push({ activityStart: s.toISOString(), activityEnd: e.toISOString() })
    }
  }
  return out
})

async function submit() {
  err.value = ''
  if (!title.value.trim()) {
    err.value = '请填写标题'
    return
  }
  if (!registrationStart.value || !registrationEnd.value) {
    err.value = '请填写报名时间段'
    return
  }

  let options: { title: string; price: number }[] = []
  let occurrences: { activityStart: string; activityEnd: string }[] = []

  if (kind.value === 'single') {
    if (!actStart.value || !actEnd.value) {
      err.value = '请填写活动时间'
      return
    }
    options = [{ title: '默认', price: Math.max(0, Number(singlePrice.value) || 0) }]
    occurrences = [{ activityStart: new Date(actStart.value).toISOString(), activityEnd: new Date(actEnd.value).toISOString() }]
  } else if (kind.value === 'composite') {
    if (!actStart.value || !actEnd.value) {
      err.value = '请填写活动时间'
      return
    }
    options = subOptions.value.filter((o) => o.title.trim()).map((o) => ({ title: o.title.trim(), price: Math.max(0, Number(o.price) || 0) }))
    if (!options.length) {
      err.value = '请至少填写一个子选项'
      return
    }
    occurrences = [{ activityStart: new Date(actStart.value).toISOString(), activityEnd: new Date(actEnd.value).toISOString() }]
  } else {
    options = packOptions.value.filter((o) => o.title.trim()).map((o) => ({ title: o.title.trim(), price: Math.max(0, Number(o.price) || 0) }))
    if (!options.length) {
      err.value = '活动包至少一个选项'
      return
    }
    occurrences = generatedOccurrences.value
    if (!occurrences.length) {
      err.value = '未能生成期次，请检查日期范围与每周勾选'
      return
    }
    if (
      (packFrequency.value === 'weekly' || packFrequency.value === 'custom') &&
      !weekPick.value.some(Boolean)
    ) {
      err.value = '每周/自定义模式请至少勾选一天'
      return
    }
  }

  const maxOptPrice = Math.max(0, ...options.map((o) => Number(o.price) || 0))
  if (maxOptPrice > 0 && !paymentAddress.value.trim()) {
    err.value = '存在付费选项时请填写收款地址'
    return
  }

  saving.value = true
  try {
    await api.createCommunityEvent(communityId.value, {
      kind: kind.value,
      title: title.value.trim(),
      description: description.value,
      tagId: tagId.value || null,
      noteEnabled: noteEnabled.value,
      paymentAddress: paymentAddress.value.trim(),
      registrationStart: new Date(registrationStart.value).toISOString(),
      registrationEnd: new Date(registrationEnd.value).toISOString(),
      options,
      occurrences,
      packFrequency: kind.value === 'pack' ? packFrequency.value : null,
      packRangeStart: kind.value === 'pack' ? packRangeStart.value : null,
      packRangeEnd: kind.value === 'pack' ? packRangeEnd.value : null,
      packCustomWeekdays:
        kind.value === 'pack' && (packFrequency.value === 'weekly' || packFrequency.value === 'custom')
          ? weekPick.value.map((x, i) => (x ? i : -1)).filter((i) => i >= 0)
          : null
    })
    toast.add({ title: '发布成功', color: 'green' })
    router.push(`/community/${communityId.value}/events`)
  } catch (e: any) {
    err.value = e?.message || '发布失败'
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  await communityStore.setCurrentCommunity(communityId.value)
  const r = communityStore.currentCommunity?.myRole
  if (r !== 'super_admin' && r !== 'sub_admin') {
    router.replace(`/community/${communityId.value}/events`)
    return
  }
  tags.value = await api.listCalendarTags(communityId.value)

  let restored = false
  try {
    if (typeof window !== 'undefined') {
      const raw = sessionStorage.getItem(EVENT_DELETE_DRAFT_KEY)
      if (raw) {
        const draft = JSON.parse(raw || '{}') as Record<string, unknown>
        applyDeleteDraft(draft)
        sessionStorage.removeItem(EVENT_DELETE_DRAFT_KEY)
        restored = true
        toast.add({
          title: '已恢复草稿',
          description: '你可以继续修改并重新发布',
          color: 'green'
        })
      }
    }
  } catch {
    // ignore
  }

  if (!restored) {
    const now = new Date()
    registrationStart.value = padLocal(now)
    const w = new Date(now.getTime() + 86400000 * 7)
    registrationEnd.value = padLocal(w)
    actStart.value = padLocal(now)
    actEnd.value = padLocal(new Date(now.getTime() + 3600000 * 2))
  }
})
</script>
