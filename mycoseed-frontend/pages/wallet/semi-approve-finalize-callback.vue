<template>
  <div class="min-h-screen bg-background py-8 px-4">
    <div class="container mx-auto max-w-lg">
      <PixelCard>
        <h1 class="text-xl font-bold text-text-title mb-2">Semi 审核并终审结果</h1>
        <p v-if="loading" class="text-text-body text-sm">处理中…</p>
        <template v-else>
          <p v-if="serverOk" class="text-xs text-green-600 dark:text-green-400 mb-3">已同步链上审核与终审到服务端。</p>
          <p v-else-if="serverError" class="text-xs text-amber-700 dark:text-amber-300 mb-3">
            未能写入服务端：{{ serverError }}
          </p>

          <div v-if="stateMismatch" class="text-destructive text-sm mb-4">
            安全校验失败：state 与发起时不一致。请从审核页重新发起。
          </div>

          <div v-else class="space-y-3 text-sm text-text-body">
            <div v-if="parsed.status === 'success'">
              <p class="text-green-600 dark:text-green-400 font-medium">链上流程已完成（success）</p>
              <p v-if="parsed.approve_tx_hash" class="font-mono text-xs break-all">
                approve_tx: {{ parsed.approve_tx_hash }}
              </p>
              <p v-if="parsed.final_tx_hash" class="font-mono text-xs break-all">
                final_tx: {{ parsed.final_tx_hash }}
              </p>
              <p v-else-if="parsed.tx_hash" class="font-mono text-xs break-all">tx_hash: {{ parsed.tx_hash }}</p>
              <div v-if="parsed.final_tx_hash || parsed.tx_hash" class="pt-2">
                <a
                  :href="optimismTxExplorerUrl(parsed.final_tx_hash || parsed.tx_hash || '')"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-primary underline text-sm"
                >
                  在 Optimism 浏览器查看终审交易
                </a>
              </div>
            </div>
            <div v-else-if="parsed.status === 'failed'">
              <p class="text-destructive font-medium">链上失败</p>
              <p v-if="parsed.error" class="break-words">{{ parsed.error }}</p>
              <p v-if="parsed.approve_tx_hash" class="text-xs text-text-placeholder mt-2">
                若回跳里仍有 approve_tx 字段，多为旧版两笔流；V4 通常仅一笔终局交易。
              </p>
            </div>
            <div v-else-if="parsed.status === 'cancelled'">已取消（cancelled）。</div>
            <div v-else class="text-text-placeholder">未识别回跳参数。</div>
          </div>

          <p v-if="nextStepHint" class="text-xs text-text-body mt-4 mb-1">{{ nextStepHint }}</p>

          <div class="mt-6 pt-4 border-t border-border flex flex-wrap items-center gap-2">
            <PixelButton
              v-if="taskInfoId"
              variant="primary"
              size="sm"
              @click="router.push(`/tasks/pool/${encodeURIComponent(taskInfoId)}/manage`)"
            >
              查看链上进度
            </PixelButton>
            <PixelButton
              v-if="taskId"
              variant="secondary"
              size="sm"
              @click="router.push(`/tasks/${encodeURIComponent(taskId)}`)"
            >
              回任务详情
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
  semiTaskpoolStateStorageKey,
  optimismTxExplorerUrl,
} from '~/utils/semiTaskpoolPrepay'
import { completeTaskpoolApproveAndFinalize, getApiBaseUrl } from '~/utils/api'

definePageMeta({ layout: 'default' })

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const stateMismatch = ref(false)
const serverOk = ref(false)
const serverError = ref('')
const parsed = ref(parseSemiPrepayCallback(''))

const taskId = computed(() => (typeof route.query.taskId === 'string' ? route.query.taskId : ''))
const taskInfoId = computed(() => (typeof route.query.taskInfoId === 'string' ? route.query.taskInfoId : ''))
const comments = computed(() => (typeof route.query.comments === 'string' ? route.query.comments : ''))

const nextStepHint = computed(() => {
  if (parsed.value.status === 'success') {
    return '公示窗口由链上合约配置（测试环境可能仅约 1 分钟）；结束后领取者可在任务详情发起结算。'
  }
  if (parsed.value.status === 'failed' || parsed.value.status === 'cancelled') {
    return '未完成时请从审核页重试；需要查看任务池总进度时请打开任务池管理。'
  }
  return ''
})

onMounted(async () => {
  try {
    parsed.value = parseSemiPrepayCallback(window.location.search || '')
    const key = semiTaskpoolStateStorageKey('approve_finalize', taskId.value || undefined)
    const saved = sessionStorage.getItem(key) ?? sessionStorage.getItem(SEMI_TASKPOOL_PREPAY_STATE_KEY)
    const received = parsed.value.state
    if (received && saved && saved !== received) {
      stateMismatch.value = true
    } else if (received && saved && saved === received) {
      sessionStorage.removeItem(key)
      sessionStorage.removeItem(SEMI_TASKPOOL_PREPAY_STATE_KEY)
    }

    const st = parsed.value.status
    if (!stateMismatch.value && taskId.value && parsed.value.state && st) {
      try {
        await completeTaskpoolApproveAndFinalize(taskId.value, {
          state: parsed.value.state,
          status: st,
          approve_tx_hash: parsed.value.approve_tx_hash,
          final_tx_hash: parsed.value.final_tx_hash || parsed.value.tx_hash,
          tx_hash: parsed.value.tx_hash,
          comments: comments.value || null,
        }, getApiBaseUrl())
        serverOk.value = true
      } catch (e) {
        serverError.value = e instanceof Error ? e.message : String(e)
      }
    }
    // 与 distribute / final-approve 一致：链上成功且已同步服务端后自动回任务详情，并直接触发 reviewer 分享弹窗（tasks/[id].vue）
    if (!stateMismatch.value && parsed.value.status === 'success' && serverOk.value && taskId.value) {
      await nextTick()
      const txRaw = String(parsed.value.final_tx_hash || parsed.value.tx_hash || '').trim()
      const txOk = txRaw.startsWith('0x') && txRaw.length === 66
      const poolTx = txOk ? `&pool_final_tx=${encodeURIComponent(txRaw)}` : ''
      // share=reviewer：详情页弹分享；pool_final_tx：Semi 回跳带的终审 tx，避免依赖 RPC 扫日志
      router.replace(
        `/tasks/${encodeURIComponent(taskId.value)}?share=reviewer&reviewed=true${poolTx}`
      )
      return
    }
    window.history.replaceState({}, document.title, route.path)
  } finally {
    loading.value = false
  }
})
</script>
