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

        <div v-if="myOccIds.size" class="text-sm text-text-body space-y-1">
          <div class="font-bold">我的报名</div>
          <div v-for="oid in [...myOccIds]" :key="oid" class="flex items-center gap-2">
            <span class="text-xs text-text-placeholder">{{ occLabel(oid) }}</span>
            <button v-if="canCancelOcc(oid)" type="button" class="text-primary text-xs underline" @click="cancelOcc(oid)">取消报名</button>
            <span v-else class="text-xs text-text-placeholder">报名已截止</span>
          </div>
        </div>

        <section v-if="detail.event.kind === 'pack' && detail.event.occurrences.length > 1">
          <div class="flex items-center justify-between mb-3">
            <h2 class="font-bold text-text-title">参与矩阵（期次 × 成员）</h2>
            <PixelButton variant="secondary" size="sm" @click="downloadExcel">
              📥 下载Excel
            </PixelButton>
          </div>
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
                      <div class="flex flex-col items-center gap-1">
                        <span class="text-green-600 font-bold">✓</span>
                        <div class="text-[10px] text-text-placeholder text-center leading-tight">
                          {{ row.cells[o.id].optionTitle }}
                          <span v-if="row.cells[o.id].price > 0" class="text-primary font-medium">
                            (¥{{ row.cells[o.id].price }})
                          </span>
                        </div>
                        <div v-if="row.cells[o.id].remark" class="text-[10px] text-orange-500 leading-tight">
                          📝 {{ row.cells[o.id].remark }}
                        </div>
                        <template v-if="row.cells[o.id].price > 0 && row.user?.id">
                          <span
                            v-if="paymentMap[row.user.id]?.status === 'paid'"
                            class="text-[10px] text-green-600"
                          >
                            💰已付 {{ paymentMap[row.user.id]?.amount }}
                          </span>
                          <span
                            v-else-if="paymentMap[row.user.id]?.status === 'partial'"
                            class="text-[10px] text-orange-500"
                          >
                            💰{{ weiToToken(paymentMap[row.user.id]?.amount) }}/{{ row.cells[o.id].price }}
                          </span>
                          <span v-else class="text-[10px] text-orange-500">
                            💰待付 {{ row.cells[o.id].price }}
                          </span>
                          <button
                            v-if="row.user.id === userStore.user?.id && paymentMap[row.user.id]?.status !== 'paid'"
                            type="button"
                            class="text-[10px] px-1.5 py-0.5 rounded bg-primary text-white mt-0.5"
                            @click="retryPayment({ userId: row.user.id, optionTitle: row.cells[o.id].optionTitle })"
                          >
                            去付款
                          </button>
                        </template>
                      </div>
                    </template>
                    <span v-else class="text-text-placeholder">—</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

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
                <template v-if="detail.event.options?.some((o: any) => o.price > 0)">
                  <span
                    v-if="paymentMap[p.userId]?.status === 'paid'"
                    class="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700"
                  >
                    已付 {{ weiToToken(paymentMap[p.userId]?.amount) }} 积分
                  </span>
                  <span
                    v-else-if="paymentMap[p.userId]?.status === 'partial'"
                    class="text-xs px-1.5 py-0.5 rounded bg-orange-100 text-orange-700"
                  >
                    已付 {{ weiToToken(paymentMap[p.userId]?.amount) }} / 预期 {{ getMyExpectedPrice(p) }} 积分
                  </span>
                  <span
                    v-else
                    class="text-xs px-1.5 py-0.5 rounded bg-orange-100 text-orange-700"
                  >
                    待付 {{ getMyExpectedPrice(p) }} 积分
                  </span>
                  <button
                    v-if="p.userId === userStore.user?.id && paymentMap[p.userId]?.status !== 'paid'"
                    type="button"
                    class="text-xs px-2 py-0.5 rounded bg-primary text-white"
                    @click="retryPayment(p)"
                  >
                    去付款
                  </button>
                </template>
              </div>
              <p v-if="p.remark" class="mt-1 text-text-placeholder text-xs">备注：{{ p.remark }}</p>
              <p class="text-xs text-text-placeholder mt-1">{{ fmt(p.createdAt) }}</p>
              <p
                v-if="paymentMap[p.userId]?.txHash"
                class="text-xs text-primary mt-1"
              >
                <a
                  :href="`https://optimistic.etherscan.io/tx/${paymentMap[p.userId].txHash}`"
                  target="_blank"
                  rel="noopener"
                  class="underline"
                >
                  查看交易
                </a>
              </p>
            </li>
          </ul>
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
import PixelButton from '~/components/pixel/PixelButton.vue'
import PixelAvatar from '~/components/pixel/PixelAvatar.vue'
import { buildSemiTransferUrl } from '~/utils/api'
import { weiToToken } from '~/utils/display'
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
const eventTransactions = ref<any[]>([])
const userWalletCache = ref<Record<string, string>>({}) // userId -> wallet address

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

// 付款状态映射：userId -> { status, amount, txHash }
const paymentMap = computed(() => {
  const map: Record<string, { status: 'paid' | 'partial' | 'pending'; amount: string; txHash: string }> = {}
  if (!detail.value) return map

  const hasPaidOptions = detail.value.event.options?.some((o: any) => o.price > 0)
  if (!hasPaidOptions) return map

  // 构建 wallet -> userId 反向映射
  const walletToUser: Record<string, string> = {}
  for (const [uid, wallet] of Object.entries(userWalletCache.value)) {
    if (wallet) walletToUser[wallet.toLowerCase()] = uid
  }

  // 匹配交易到用户
  for (const tx of eventTransactions.value) {
    const sender = tx.sender_address?.toLowerCase()
    if (!sender) continue

    const userId = walletToUser[sender]
    if (!userId) continue

    const actualAmount = Number(tx.actual_amount || tx.amount || 0)
    const expectedAmount = Number(tx.expected_amount || 0)

    let status: 'paid' | 'partial' | 'pending' = 'paid'
    if (expectedAmount > 0 && actualAmount < expectedAmount) {
      status = 'partial'
    }

    map[userId] = {
      status,
      amount: String(actualAmount),
      txHash: tx.tx_hash,
    }
  }

  return map
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

function getExpectedPrice(optionTitle: string): number {
  if (!detail.value?.event?.options || !optionTitle) return 0
  const opt = detail.value.event.options.find((o: any) => o.title === optionTitle)
  return opt?.price || 0
}

function getMyExpectedPrice(p: any): number {
  return getExpectedPrice(p.optionTitle)
}

function retryPayment(p: any) {
  if (!detail.value) return
  const config = useRuntimeConfig()
  const semiAppUrl = String(config.public.semiAppUrl || '').trim()
  if (!semiAppUrl) {
    toast.add({ title: '未配置 Semi 钱包地址', color: 'orange' })
    return
  }
  const payTo = detail.value.event.paymentAddress
  if (!payTo) {
    toast.add({ title: '活动未配置收款地址', color: 'orange' })
    return
  }
  const price = getMyExpectedPrice(p)
  if (price <= 0) {
    toast.add({ title: '无法获取付款金额', color: 'orange' })
    return
  }
  const title = detail.value.event.title
  const memo = `活动：《${title}》`.slice(0, 32)
  const url = buildSemiTransferUrl(payTo, String(price), { semiAppUrl, memo, pool_uuid: detail.value.event.id })
  window.open(url, '_blank')
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
    // 加载活动付款记录
    try {
      eventTransactions.value = await api.getEventTransactions(eventId.value)
    } catch {
      eventTransactions.value = []
    }
    // 加载参与者钱包地址（用于匹配链上付款）
    if (detail.value?.participations?.length) {
      const userIds = [...new Set(detail.value.participations.map((p: any) => p.userId))]
      const walletMap: Record<string, string> = {}
      await Promise.all(
        userIds.map(async (uid: string) => {
          try {
            const addr = await api.getWalletAddressByUserId(uid)
            if (addr) walletMap[uid] = addr
          } catch { /* ignore */ }
        })
      )
      userWalletCache.value = walletMap
    }
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
      const url = buildSemiTransferUrl(payTo, String(price), { semiAppUrl, memo, pool_uuid: detail.value.event.id })
      newWindow.location.href = url
    }
    await load()
  } catch (e: any) {
    toast.add({ title: e?.message || '报名失败', color: 'red' })
  } finally {
    regLoading.value = false
  }
}

function canCancelOcc(occId: string): boolean {
  if (!detail.value) return false
  const ev = detail.value.event
  const occ = ev.occurrences.find(o => o.id === occId)
  if (!occ) return false
  const now = Date.now()
  if (occ.registrationStart && occ.registrationEnd) {
    return now <= new Date(occ.registrationEnd).getTime()
  }
  if (ev.kind === 'pack') {
    const occDate = new Date(occ.activityStart)
    const y = occDate.getFullYear()
    const m = occDate.getMonth()
    const d = occDate.getDate()
    const evRegEnd = new Date(ev.registrationEnd)
    const occRegEnd = new Date(y, m, d, evRegEnd.getHours(), evRegEnd.getMinutes(), evRegEnd.getSeconds())
    return now <= occRegEnd.getTime()
  }
  return now <= new Date(ev.registrationEnd).getTime()
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

async function downloadExcel() {
  if (!detail.value) return

  const XLSX = await import('xlsx').then(m => m.default || m)
  
  const users = detail.value.matrixUsers
  const occs = sortedOcc.value
  
  // Sheet1: 金额汇总表
  const sheet1Data: (string | number)[][] = []
  // Sheet1 header
  const sheet1Header = ['成员']
  occs.forEach(o => sheet1Header.push(`#${o.sequenceNo} ${shortDate(o.activityStart)}`))
  sheet1Header.push('合计')
  sheet1Data.push(sheet1Header)
  
  let totalColSum = 0
  users.forEach(user => {
    const row: (string | number)[] = [user.user?.name || '—']
    let rowSum = 0
    occs.forEach(o => {
      const cell = user.cells[o.id]
      const price = cell?.price || 0
      row.push(price)
      rowSum += price
    })
    row.push(rowSum)
    totalColSum += rowSum
    sheet1Data.push(row)
  })
  
  // 添加列合计行
  const colSumRow: (string | number)[] = ['合计']
  occs.forEach(o => {
    let colSum = 0
    users.forEach(user => {
      const cell = user.cells[o.id]
      colSum += cell?.price || 0
    })
    colSumRow.push(colSum)
  })
  colSumRow.push(totalColSum)
  sheet1Data.push(colSumRow)
  
  // Sheet2: 详细信息表
  const sheet2Data: string[][] = []
  // Sheet2 header
  const sheet2Header = ['成员']
  occs.forEach(o => sheet2Header.push(`#${o.sequenceNo} ${shortDate(o.activityStart)}`))
  sheet2Data.push(sheet2Header)
  
  users.forEach(user => {
    const row: string[] = [user.user?.name || '—']
    occs.forEach(o => {
      const cell = user.cells[o.id]
      if (cell) {
        const opt = cell.optionTitle || '-'
        const remark = cell.remark || '-'
        const price = cell.price
        row.push(`${opt}|${remark}|${price}`)
      } else {
        row.push('-')
      }
    })
    sheet2Data.push(row)
  })
  
  // 创建工作簿
  const workbook = XLSX.utils.book_new()
  const sheet1 = XLSX.utils.aoa_to_sheet(sheet1Data)
  const sheet2 = XLSX.utils.aoa_to_sheet(sheet2Data)
  
  XLSX.utils.book_append_sheet(workbook, sheet1, '金额汇总')
  XLSX.utils.book_append_sheet(workbook, sheet2, '详细信息')
  
  // 下载
  const fileName = `${detail.value.event.title}-参与矩阵.xlsx`
  XLSX.writeFile(workbook, fileName)
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

onMounted(async () => {
  await communityStore.setCurrentCommunity(communityId.value)
  await userStore.getUser()
  await load()
})
</script>
