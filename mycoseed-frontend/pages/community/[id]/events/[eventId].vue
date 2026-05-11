<template>
  <div class="min-h-screen pb-32">
    <header class="sticky top-0 z-40 bg-card border-b border-border px-4 py-3 flex items-center gap-3">
      <button type="button" class="p-2 -ml-2 rounded-xl hover:bg-input-bg" @click="router.back()">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <h1 class="text-lg font-bold flex-1 truncate">{{ detail?.event.title }}</h1>
      <button
        v-if="isAdmin && detail?.event.participantCount === 0"
        type="button"
        class="text-sm text-destructive"
        @click="doDelete"
      >
        删除
      </button>
      <button
        v-if="isAdmin && detail?.participations.length"
        type="button"
        class="text-sm text-primary"
        @click="exportExcel"
      >
        导出Excel
      </button>
    </header>

    <div v-if="loading" class="p-8 text-center text-text-placeholder">加载中…</div>
    <template v-else-if="detail">
      <div class="max-w-3xl mx-auto px-4 py-4 space-y-6" :class="{ 'opacity-60': allEnded }">
        <div>
          <span
            v-if="detail.event.tag"
            class="inline-block px-2 py-0.5 rounded text-xs text-white mb-2"
            :style="{ backgroundColor: detail.event.tag.colorHex }"
          >
            {{ detail.event.tag.name }}
          </span>
          <p class="text-sm text-text-placeholder whitespace-pre-wrap">{{ detail.event.description }}</p>
          <p class="text-xs text-text-placeholder mt-2">
            报名：{{ fmt(detail.event.registrationStart) }} – {{ fmt(detail.event.registrationEnd) }}
          </p>
          <p class="text-xs text-text-placeholder">
            类型：{{ kindLabel(detail.event.kind) }}
          </p>
          <p v-if="detail.event.paymentAddress" class="text-xs text-text-body mt-2 break-all">
            <span class="text-text-placeholder">收款地址：</span>
            <span class="font-mono">{{ detail.event.paymentAddress }}</span>
          </p>
        </div>

        <div v-if="detail.event.kind === 'pack' && targetOcc" class="p-4 rounded-2xl bg-input-bg border border-border">
          <div class="text-sm font-bold text-text-title">当前报名期次</div>
          <p class="text-sm mt-1">{{ fmt(targetOcc.activityStart) }} – {{ fmt(targetOcc.activityEnd) }}</p>
        </div>
        <div v-else-if="detail.event.occurrences[0]" class="text-sm">
          <span class="font-bold">活动时间：</span>
          {{ fmt(detail.event.occurrences[0].activityStart) }} – {{ fmt(detail.event.occurrences[0].activityEnd) }}
        </div>

        <div v-if="canRegister && registerOccId" class="space-y-3">
          <PixelButton variant="warning" block @click="openRegisterModal">
            {{ needsOption ? '选择子选项并报名' : '报名' }}
          </PixelButton>
        </div>

        <div v-if="myOccIds.size && detail.registrationOpen" class="text-sm text-text-body space-y-1">
          <div class="font-bold">我的报名（可取消）</div>
          <div v-for="oid in [...myOccIds]" :key="oid" class="flex items-center gap-2">
            <span class="text-xs text-text-placeholder">{{ occLabel(oid) }}</span>
            <button type="button" class="text-primary text-xs underline" @click="cancelOcc(oid)">取消报名</button>
          </div>
        </div>

        <section>
          <h2 class="font-bold text-text-title mb-3">报名列表</h2>
          <ul class="space-y-2">
            <li
              v-for="p in detail.participations"
              :key="p.id"
              class="p-3 rounded-xl bg-card border border-border text-sm"
            >
              <div class="flex items-center gap-2">
                <PixelAvatar :src="p.user?.avatar || undefined" :seed="p.user?.name || 'u'" size="sm" />
                <span class="font-medium">{{ p.user?.name || '用户' }}</span>
                <span v-if="p.optionTitle" class="text-xs px-1.5 py-0.5 rounded bg-input-bg">{{ p.optionTitle }}</span>
              </div>
              <p v-if="p.remark" class="mt-1 text-text-placeholder text-xs">备注：{{ p.remark }}</p>
              <p class="text-xs text-text-placeholder mt-1">{{ fmt(p.createdAt) }}</p>
            </li>
          </ul>
        </section>

        <section v-if="detail.event.kind === 'pack' && detail.event.occurrences.length > 1">
          <h2 class="font-bold text-text-title mb-3">参与矩阵（期次 × 成员）</h2>
          <div class="overflow-x-auto border border-border rounded-xl">
            <table class="min-w-full text-xs text-left">
              <thead>
                <tr>
                  <th class="p-2 border-b border-border bg-input-bg sticky left-0">成员</th>
                  <th
                    v-for="o in sortedOcc"
                    :key="o.id"
                    class="p-2 border-b border-border bg-input-bg whitespace-nowrap"
                  >
                    #{{ o.sequenceNo }}<br />
                    <span class="font-normal text-text-placeholder">{{ shortDate(o.activityStart) }}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in detail.matrixUsers" :key="row.user?.id">
                  <td class="p-2 border-b border-border sticky left-0 bg-card font-medium">
                    {{ row.user?.name || '—' }}
                  </td>
                  <td
                    v-for="o in sortedOcc"
                    :key="o.id"
                    class="p-2 border-b border-border text-center align-top"
                  >
                    <template v-if="row.cells[o.id]">
                      <span class="text-green-600">✓</span>
                      <div class="text-[10px] text-text-placeholder">{{ row.cells[o.id].optionTitle }}</div>
                    </template>
                    <span v-else class="text-text-placeholder">—</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </template>

    <Teleport to="body">
      <div
        v-if="confirmReg"
        class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        @click.self="confirmReg = false"
      >
        <div class="bg-card rounded-3xl p-6 max-w-sm w-full">
          <p class="text-text-body mb-4">
            确认报名后将打开 Semi 钱包付款（金额为 0 时跳过）。款项转入活动公示的收款地址，而非发布人个人钱包。
          </p>
          <div class="flex gap-2">
            <PixelButton variant="secondary" block @click="confirmReg = false">取消</PixelButton>
            <PixelButton variant="primary" block :disabled="regLoading" @click="doRegister">确认</PixelButton>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="pickOptOpen"
        class="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4"
        @click.self="pickOptOpen = false"
      >
        <div class="bg-card rounded-3xl p-6 max-w-sm w-full space-y-3">
          <div class="font-bold">{{ needsOption ? '选择子选项' : '填写备注' }}</div>
          <template v-if="needsOption">
            <button
              v-for="o in detail?.event.options"
              :key="o.id"
              type="button"
              class="w-full py-3 rounded-xl border text-left px-3"
              :class="selectedOpt === o.id ? 'border-primary bg-primary/10' : 'border-border'"
              @click="selectedOpt = o.id"
            >
              {{ o.title }} · {{ o.price ? `¥${o.price}` : '免费' }}
            </button>
          </template>
          <textarea
            v-if="detail?.event.noteEnabled"
            v-model="remarkInput"
            placeholder="备注"
            class="w-full rounded-xl border border-border px-3 py-2 text-sm"
            rows="2"
          />
          <PixelButton variant="primary" block @click="afterPickOption">下一步</PixelButton>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import * as XLSX from 'xlsx'
import PixelButton from '~/components/pixel/PixelButton.vue'
import PixelAvatar from '~/components/pixel/PixelAvatar.vue'
import { buildSemiTransferUrl } from '~/utils/api'
import { useCommunityStore } from '~/stores/community'

definePageMeta({ layout: 'default', middleware: 'auth' })

const EVENT_DELETE_DRAFT_KEY = 'mycoseed_community_event_delete_draft'

const route = useRoute()
const router = useRouter()
const api = useApi()
const toast = useToast()
const userStore = useUserStore()
const communityStore = useCommunityStore()

const communityId = computed(() => route.params.id as string)
const eventId = computed(() => route.params.eventId as string)

const loading = ref(true)
const detail = ref<any>(null)

const confirmReg = ref(false)
const pickOptOpen = ref(false)
const selectedOpt = ref('')
const remarkInput = ref('')
const regLoading = ref(false)

const isAdmin = computed(() => {
  const r = communityStore.currentCommunity?.myRole
  return r === 'super_admin' || r === 'sub_admin'
})

const sortedOcc = computed(() => {
  if (!detail.value) return []
  return [...detail.value.event.occurrences].sort((a, b) => a.sequenceNo - b.sequenceNo)
})

const targetOcc = computed(() => {
  if (!detail.value) return null
  const id = detail.value.currentOccurrenceId
  return detail.value.event.occurrences.find((o) => o.id === id) || detail.value.event.occurrences[0] || null
})

const registerOccId = computed(() => {
  if (!detail.value) return ''
  if (detail.value.event.kind === 'pack') return detail.value.currentOccurrenceId || ''
  return detail.value.event.occurrences[0]?.id || ''
})

const needsOption = computed(() => {
  const k = detail.value?.event.kind
  return k === 'composite' || k === 'pack'
})

const allEnded = computed(() => {
  if (!detail.value?.event.occurrences.length) return false
  const t = Math.max(...detail.value.event.occurrences.map((o) => new Date(o.activityEnd).getTime()))
  return t < Date.now()
})

const canRegister = computed(() => {
  if (!detail.value?.registrationOpen || allEnded.value) return false
  const uid = userStore.user?.id
  if (!uid || !registerOccId.value) return false
  return !myOccIds.value.has(registerOccId.value)
})

const myOccIds = computed(() => {
  const uid = userStore.user?.id
  if (!uid || !detail.value) return new Set<string>()
  const s = new Set<string>()
  for (const p of detail.value.participations) {
    if (p.userId === uid) s.add(p.occurrenceId)
  }
  return s
})

function fmt(iso: string) {
  return new Date(iso).toLocaleString('zh-CN')
}

function shortDate(iso: string) {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function kindLabel(k: string) {
  return { single: '单一', composite: '复合', pack: '活动包' }[k] || k
}

function occLabel(occurrenceId: string) {
  const o = detail.value?.event.occurrences.find((x: any) => x.id === occurrenceId)
  if (!o) return occurrenceId.slice(0, 8)
  return `#${o.sequenceNo} ${shortDate(o.activityStart)}`
}

async function load() {
  loading.value = true
  try {
    detail.value = await api.getCommunityEvent(communityId.value, eventId.value)
  } catch (e: any) {
    toast.add({ title: e?.message || '加载失败', color: 'red' })
    detail.value = null
  } finally {
    loading.value = false
  }
}

function openRegisterModal() {
  selectedOpt.value = ''
  remarkInput.value = ''
  if (needsOption.value || detail.value?.event.noteEnabled) {
    pickOptOpen.value = true
    return
  }
  confirmReg.value = true
}

function afterPickOption() {
  if (needsOption.value && !selectedOpt.value) {
    toast.add({ title: '请选择子选项', color: 'orange' })
    return
  }
  if (detail.value?.event.noteEnabled && !remarkInput.value.trim()) {
    toast.add({ title: '请填写备注', color: 'orange' })
    return
  }
  pickOptOpen.value = false
  confirmReg.value = true
}

async function doRegister() {
  if (!detail.value || !registerOccId.value) return
  regLoading.value = true
  try {
    const res = await api.registerCommunityEvent(communityId.value, eventId.value, {
      occurrenceId: registerOccId.value,
      optionId: selectedOpt.value || undefined,
      remark: remarkInput.value.trim() || undefined
    })
    confirmReg.value = false
    toast.add({ title: '报名成功', color: 'green' })

    const price = Number(res.price || 0)
    if (price > 0) {
      const newWindow = window.open('about:blank', '_blank')
      if (!newWindow) {
        toast.add({ title: '请允许弹窗以打开 Semi 付款', color: 'orange' })
        await load()
        return
      }
      const config = useRuntimeConfig()
      const semiAppUrl = String(config.public.semiAppUrl || '').trim()
      if (!semiAppUrl) {
        newWindow.close()
        toast.add({ title: '未配置 NUXT_PUBLIC_SEMI_APP_URL', color: 'orange' })
        await load()
        return
      }
      const payTo = String(res.paymentAddress || detail.value.event.paymentAddress || '').trim()
      if (!payTo) {
        newWindow.close()
        toast.add({ title: '活动未配置收款地址，无法拉起付款', color: 'orange' })
        await load()
        return
      }
      const title = detail.value.event.title
      const now = new Date()
      const mo = String(now.getMonth() + 1).padStart(2, '0')
      const da = String(now.getDate()).padStart(2, '0')
      const hh = String(now.getHours()).padStart(2, '0')
      const mi = String(now.getMinutes()).padStart(2, '0')
      const memo = `活动：《${title}》${mo}${da}-${hh}:${mi}`.slice(0, 32)
      const url = buildSemiTransferUrl(payTo, String(price), { semiAppUrl, memo })
      newWindow.location.href = url
    }
    await load()
  } catch (e: any) {
    toast.add({ title: e?.message || '报名失败', color: 'red' })
  } finally {
    regLoading.value = false
  }
}

async function cancelOcc(occurrenceId: string) {
  try {
    await api.cancelCommunityEventRegistration(communityId.value, eventId.value, occurrenceId)
    toast.add({ title: '已取消', color: 'green' })
    await load()
  } catch (e: any) {
    toast.add({ title: e?.message || '取消失败', color: 'red' })
  }
}

async function doDelete() {
  if (!detail.value || detail.value.event.participantCount > 0) return
  const ok = window.confirm('确认删除？删除后将回到发布页，并保留你之前填写的内容（无人报名时可用）。')
  if (!ok) return
  try {
    const res = await api.deleteCommunityEvent(communityId.value, eventId.value)
    if (typeof window !== 'undefined' && res.draft) {
      sessionStorage.setItem(EVENT_DELETE_DRAFT_KEY, JSON.stringify(res.draft))
    }
    toast.add({ title: '已删除', description: '已为你保留草稿，可继续修改后重新发布', color: 'green' })
    router.replace(`/community/${communityId.value}/events/create?from=delete`)
  } catch (e: any) {
    toast.add({ title: e?.message || '删除失败', color: 'red' })
  }
}

function exportExcel() {
  if (!detail.value) return
  const ev = detail.value.event
  const occMap = new Map(detail.value.event.occurrences.map((o: any) => [o.id, o]))
  const isPack = ev.kind === 'pack'

  const rows: { userName: string; occurrences: string; options: string; remark: string; registeredAt: string }[] = []
  for (const p of detail.value.participations) {
    const occ = occMap.get(p.occurrenceId)
    const dateStr = occ
      ? `${new Date(occ.activityStart).toLocaleDateString('zh-CN')} ${new Date(occ.activityStart).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} - ${new Date(occ.activityEnd).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
      : p.occurrenceId
    rows.push({
      userName: p.user?.name || '—',
      occurrences: isPack ? (occ ? `#${occ.sequenceNo} ${shortDate(occ.activityStart)}` : '—') : dateStr,
      options: p.optionTitle || '—',
      remark: p.remark || '—',
      registeredAt: fmt(p.createdAt)
    })
  }

  const wsData = [
    ['姓名', '活动时间', '子选项', '备注', '报名时间'],
    ...rows.map((r) => [r.userName, r.occurrences, r.options, r.remark, r.registeredAt])
  ]
  const ws = XLSX.utils.aoa_to_sheet(wsData)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '报名列表')
  const evTitle = ev.title.replace(/[\\/:*?"<>|]/g, '_').slice(0, 30)
  const dateStr = new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')
  XLSX.writeFile(wb, `${evTitle}_报名列表_${dateStr}.xlsx`)
}

onMounted(async () => {
  await communityStore.setCurrentCommunity(communityId.value)
  await userStore.getUser()
  await load()
})
</script>
