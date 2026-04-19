<template>
  <div class="min-h-screen bg-background py-8 px-4">
    <div class="container mx-auto max-w-lg">
      <PixelCard>
        <h1 class="text-xl font-bold text-text-title mb-2">Semi 预付结果</h1>
        <p v-if="loading" class="text-text-body text-sm">处理中…</p>
        <template v-else>
          <p v-if="serverSynced" class="text-xs text-green-600 dark:text-green-400 mb-3">已同步预付结果到服务端（intent）。</p>
          <p v-else-if="serverSyncError" class="text-xs text-amber-700 dark:text-amber-300 mb-3">
            未能写入服务端：{{ serverSyncError }}（若未登录，可登录后在管理页查看）
          </p>
          <p v-if="onchainError" class="text-xs text-amber-700 dark:text-amber-300 mb-3">
            链上确权未通过：{{ onchainError }}（可稍后从任务池管理页重试/刷新）
          </p>
          <p v-else-if="onchainWarning" class="text-xs text-amber-700 dark:text-amber-300 mb-3">
            链上确权提示：{{ onchainWarning }}
          </p>
          <div v-if="stateMismatch" class="text-destructive text-sm mb-4">
            安全校验失败：state 与发起时不一致。请从任务池管理页重新发起「用 Semi 预付」。
          </div>
          <div v-else>
            <div v-if="stateWarning" class="text-amber-700 dark:text-amber-300 text-sm mb-4">
              未在本地找到匹配的会话 state（可能换了浏览器或清除了缓存）。若此链接来自他人，请勿轻信页面上的成功提示。
            </div>
            <div v-if="parsed.status === 'success'" class="space-y-3 text-sm text-text-body">
              <p class="text-green-600 dark:text-green-400 font-medium">预付已提交（success）</p>
              <p v-if="parsed.pool_uuid" class="font-mono text-xs break-all">pool_uuid: {{ parsed.pool_uuid }}</p>
              <p v-if="parsed.user_op_hash" class="font-mono text-xs break-all">
                user_op_hash: {{ parsed.user_op_hash }}
              </p>
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
            </div>
            <div v-else-if="parsed.status === 'failed'" class="space-y-2 text-sm text-text-body">
              <p class="text-destructive font-medium">预付失败</p>
              <p v-if="parsed.error_code" class="font-mono text-xs">error_code: {{ parsed.error_code }}</p>
              <p v-if="parsed.error" class="break-words">{{ parsed.error }}</p>
            </div>
            <div v-else-if="parsed.status === 'cancelled'" class="text-sm text-text-body">
              已取消（cancelled）。可在任务池管理页重新打开 Semi 重试。
            </div>
            <div v-else class="text-sm text-text-placeholder">
              未识别回跳参数（可能关闭了 Semi、网络中断或链接不完整）。
            </div>
          </div>

          <p v-if="recoveryHint" class="text-xs text-text-body mt-4 mb-1">{{ recoveryHint }}</p>

          <div class="mt-6 pt-4 border-t border-border flex flex-wrap items-center gap-2">
            <PixelButton
              v-if="managePath"
              variant="primary"
              size="sm"
              @click="router.push(managePath)"
            >
              查看链上进度/下一步
            </PixelButton>
            <PixelButton
              v-if="publishDraftTaskId"
              variant="secondary"
              size="sm"
              @click="router.push(`/tasks/${encodeURIComponent(publishDraftTaskId)}`)"
            >
              回任务详情
            </PixelButton>
            <PixelButton variant="secondary" size="sm" @click="router.push('/tasks')">回任务列表</PixelButton>
            <NuxtLink
              to="/settings/help/faq"
              class="text-sm text-primary underline ml-1"
            >
              帮助中心
            </NuxtLink>
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
  taskpoolManagePath,
} from '~/utils/semiTaskpoolPrepay'
import { completeTaskpoolPrepayIntent, getApiBaseUrl, withdrawTask } from '~/utils/api'

definePageMeta({ layout: 'default' })

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const stateMismatch = ref(false)
const stateWarning = ref(false)
const serverSynced = ref(false)
const serverSyncError = ref('')
const onchainError = ref('')
const onchainWarning = ref('')
const parsed = ref<ReturnType<typeof parseSemiPrepayCallback>>(parseSemiPrepayCallback(''))

const managePath = computed(() => {
  const id = parsed.value.pool_uuid
  return id ? taskpoolManagePath(id) : ''
})

const SEMI_TASK_PUBLISH_DRAFT_KEY = 'semi_task_publish_draft'

const publishDraftTaskId = ref('')

const recoveryHint = computed(() => {
  const st = parsed.value.status
  if (!st) {
    return '若 Semi 窗口被关闭、网络失败或回跳链接丢失，请从任务列表进入对应任务池管理页，再次点击「用 Semi 预付」。'
  }
  if (st === 'failed' || st === 'cancelled') {
    return '可返回任务池管理页后重新发起预付；若多次失败请到帮助中心反馈或联系支持。'
  }
  return ''
})

onMounted(async () => {
  try {
    const search = window.location.search || ''
    parsed.value = parseSemiPrepayCallback(search)
    const saved = sessionStorage.getItem(SEMI_TASKPOOL_PREPAY_STATE_KEY)
    const received = parsed.value.state
    if (received && saved && saved !== received) {
      stateMismatch.value = true
      stateWarning.value = false
    } else if (received && saved && saved === received) {
      stateMismatch.value = false
      stateWarning.value = false
      sessionStorage.removeItem(SEMI_TASKPOOL_PREPAY_STATE_KEY)
    } else if (received && !saved) {
      stateMismatch.value = false
      stateWarning.value = true
    } else {
      stateMismatch.value = false
      stateWarning.value = false
    }

    const p = parsed.value
    const poolId = p.pool_uuid
    const st = p.status

    // 读取发布草稿：用于给回调页一个“下一步”入口（回任务详情/管理）
    try {
      const raw = sessionStorage.getItem(SEMI_TASK_PUBLISH_DRAFT_KEY)
      const draft = raw ? JSON.parse(raw) : null
      if (draft && typeof draft.taskId === 'string') {
        publishDraftTaskId.value = draft.taskId
      }
    } catch {
      // ignore
    }
    if (
      !stateMismatch.value &&
      poolId &&
      p.state &&
      st &&
      (st === 'success' || st === 'failed' || st === 'cancelled')
    ) {
      try {
        const r = await completeTaskpoolPrepayIntent(
          poolId,
          {
            state: p.state,
            status: st,
            user_op_hash: p.user_op_hash,
            tx_hash: p.tx_hash,
            error_code: p.error_code,
            error: p.error,
          },
          getApiBaseUrl()
        )
        serverSynced.value = true
        if (r?.onchain) {
          if (r.onchain.ok === false) {
            onchainError.value = String(r.onchain.error || '链上确权失败')
          }
          if (Array.isArray((r.onchain as any).warnings) && (r.onchain as any).warnings.length) {
            onchainWarning.value = String((r.onchain as any).warnings.join('; '))
          }
        }
      } catch (e) {
        serverSyncError.value = e instanceof Error ? e.message : String(e)
      }
    }

    // 若这是从“普通任务发布页”发起的 Semi 预付，且失败/取消：自动撤回已创建的任务，并给用户提示
    if (!stateMismatch.value && st && (st === 'failed' || st === 'cancelled')) {
      try {
        const raw = sessionStorage.getItem(SEMI_TASK_PUBLISH_DRAFT_KEY)
        const draft = raw ? JSON.parse(raw) : null
        if (draft && draft.state && draft.taskId && draft.state === p.state) {
          const baseUrl = getApiBaseUrl()
          await withdrawTask(String(draft.taskId), baseUrl)
          // 保留草稿用于返回继续编辑（沿用 tasks/create.vue 的恢复逻辑 key）
          sessionStorage.setItem('mycoseed_task_withdraw_draft', JSON.stringify(draft.draft || {}))
          sessionStorage.removeItem(SEMI_TASK_PUBLISH_DRAFT_KEY)
        }
      } catch {
        // ignore：撤回失败不阻塞回调页展示
      }
    }

    window.history.replaceState({}, document.title, route.path)
  } finally {
    loading.value = false
  }
})
</script>
