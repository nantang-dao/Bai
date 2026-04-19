<template>
  <div class="min-h-screen bg-background py-8 px-4">
    <div class="container mx-auto max-w-lg">
      <PixelCard>
        <h1 class="text-xl font-bold text-text-title mb-2">Semi 终审结果</h1>
        <p v-if="loading" class="text-text-body text-sm">处理中…</p>
        <template v-else>
          <p v-if="serverOk" class="text-xs text-green-600 dark:text-green-400 mb-3">已同步终审结果到服务端。</p>
          <p v-else-if="serverError" class="text-xs text-amber-700 dark:text-amber-300 mb-3">
            未能写入服务端：{{ serverError }}
          </p>

          <div v-if="stateMismatch" class="text-destructive text-sm mb-4">
            安全校验失败：state 与发起时不一致。请从管理页重新发起。
          </div>

          <div v-else class="space-y-3 text-sm text-text-body">
            <div v-if="parsed.status === 'success'">
              <p class="text-green-600 dark:text-green-400 font-medium">终审已提交（success）</p>
              <p v-if="parsed.tx_hash" class="font-mono text-xs break-all">tx_hash: {{ parsed.tx_hash }}</p>
              <div v-if="parsed.tx_hash" class="pt-2">
                <a
                  :href="optimismTxExplorerUrl(parsed.tx_hash)"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-primary underline text-sm"
                >
                  在 Optimism 浏览器查看交易
                </a>
              </div>
              <p class="text-xs text-text-body mt-2">
                合约会进入约 24 小时公示期；公示结束前请勿反复点「结算」，链上可能回退（属正常）。
              </p>
            </div>
            <div v-else-if="parsed.status === 'failed'">
              <p class="text-destructive font-medium">终审失败</p>
              <p v-if="parsed.error" class="break-words">{{ parsed.error }}</p>
            </div>
            <div v-else-if="parsed.status === 'cancelled'">已取消（cancelled）。</div>
            <div v-else class="text-text-placeholder">未识别回跳参数。</div>
          </div>

          <p v-if="recoveryHint" class="text-xs text-text-body mt-4 mb-1">{{ recoveryHint }}</p>

          <div class="mt-6 pt-4 border-t border-border flex flex-wrap items-center gap-2">
            <PixelButton
              v-if="taskInfoId"
              variant="primary"
              size="sm"
              @click="router.push(`/tasks/pool/${encodeURIComponent(taskInfoId)}/manage`)"
            >
              查看链上进度/下一步
            </PixelButton>
            <PixelButton variant="secondary" size="sm" @click="router.push('/tasks')">回任务列表</PixelButton>
          </div>
        </template>
      </PixelCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import PixelCard from '~/components/pixel/PixelCard.vue'
import PixelButton from '~/components/pixel/PixelButton.vue'
import {
  parseSemiPrepayCallback,
  SEMI_TASKPOOL_PREPAY_STATE_KEY,
  optimismTxExplorerUrl,
} from '~/utils/semiTaskpoolPrepay'
import { completeTaskpoolFinalApprove, getApiBaseUrl } from '~/utils/api'

definePageMeta({ layout: 'default' })

const route = useRoute()
const router = useRouter()
const loading = ref(true)
const stateMismatch = ref(false)
const serverOk = ref(false)
const serverError = ref('')
const parsed = ref(parseSemiPrepayCallback(''))

const taskInfoId = computed(() => (typeof route.query.taskInfoId === 'string' ? route.query.taskInfoId : ''))

const recoveryHint = computed(() => {
  const st = parsed.value.status
  if (!st) {
    return '若 Semi 窗口被关闭或回跳不完整，请从任务池管理页重新发起「终审」。'
  }
  if (st === 'failed' || st === 'cancelled') {
    return '可返回任务池管理页后重试终审；多次失败请到帮助中心反馈。'
  }
  return ''
})

onMounted(async () => {
  try {
    parsed.value = parseSemiPrepayCallback(window.location.search || '')
    const saved = sessionStorage.getItem(SEMI_TASKPOOL_PREPAY_STATE_KEY)
    const received = parsed.value.state
    if (received && saved && saved !== received) stateMismatch.value = true
    else if (received && saved && saved === received) sessionStorage.removeItem(SEMI_TASKPOOL_PREPAY_STATE_KEY)

    const st = parsed.value.status
    if (!stateMismatch.value && taskInfoId.value && parsed.value.state && st) {
      try {
        await completeTaskpoolFinalApprove(
          taskInfoId.value,
          { state: parsed.value.state, status: st, tx_hash: parsed.value.tx_hash },
          getApiBaseUrl()
        )
        serverOk.value = true
      } catch (e) {
        serverError.value = e instanceof Error ? e.message : String(e)
      }
    }
    window.history.replaceState({}, document.title, route.path)
  } finally {
    loading.value = false
  }
})
</script>

