<template>
  <div class="min-h-screen bg-background py-8">
    <div class="container mx-auto px-6 max-w-4xl">
      <div class="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 class="text-2xl md:text-3xl font-bold text-text-title">任务池</h1>
          <p class="text-sm text-text-body mt-1">
            这里展示所有已发布的任务池。创建者若尚未链上建池，可在卡片上使用「Semi
            预付」快捷入口（跳转管理页并定位 Semi 区块；实际仍在 Semi App 内完成入金）。
          </p>
        </div>
        <div v-if="isAuthenticated" class="flex gap-2">
          <PixelButton variant="primary" @click="router.push('/tasks/pool/create')">
            发布任务
          </PixelButton>
        </div>
      </div>

      <div v-if="loading" class="text-center py-12">
        <div class="text-xl text-text-body animate-pulse">加载中...</div>
      </div>

      <div v-else-if="error" class="text-center py-12">
        <div class="text-sm text-destructive">{{ error }}</div>
      </div>

      <div v-else-if="pools.length === 0" class="text-center py-12">
        <div class="text-xl text-text-body mb-2">暂无任务池</div>
        <div class="text-sm text-text-placeholder">你可以点击右上角“发布任务”创建第一个任务池。</div>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <PixelCard
          v-for="t in pools"
          :key="t.taskInfoId || t.id"
          hover
          class="cursor-pointer"
          @click="goManage(t)"
        >
          <template #header>
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="font-bold text-text-title line-clamp-1">{{ t.title }}</div>
                <div class="text-xs text-text-placeholder mt-1 font-mono break-all">
                  taskInfoId: {{ t.taskInfoId || '（未知）' }}
                </div>
              </div>
              <div class="shrink-0 text-xs bg-input-bg text-text-body px-2 py-1 rounded-xl border border-border">
                {{ t.taskpoolPhase || 'none' }}
              </div>
            </div>
          </template>

          <div class="text-sm text-text-body space-y-1">
            <div class="line-clamp-2">{{ t.description }}</div>
            <div class="text-xs text-text-placeholder pt-2">
              <span class="font-medium text-text-title">Manager(链下):</span>
              {{ t.managerUserId || '（未认领）' }}
            </div>
            <div v-if="t.taskpoolCreateTxHash" class="text-xs text-text-placeholder">
              <span class="font-medium text-text-title">txHash:</span>
              <span class="font-mono break-all">{{ t.taskpoolCreateTxHash }}</span>
            </div>
            <div
              v-if="showSemiPrepayShortcut(t)"
              class="pt-3 mt-3 border-t border-border flex flex-wrap items-center gap-2"
              @click.stop
            >
              <PixelButton
                variant="secondary"
                size="sm"
                data-testid="taskpool-list-semi-prepay"
                @click="goManageSemiPrepay(t)"
              >
                Semi 预付（入金 credit）
              </PixelButton>
              <span class="text-xs text-text-placeholder">跳转管理页并定位 Semi 区块（仍跳转 Semi App）</span>
            </div>
          </div>
        </PixelCard>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import PixelCard from '~/components/pixel/PixelCard.vue'
import PixelButton from '~/components/pixel/PixelButton.vue'
import { useUserStore } from '~/stores/user'
import { useCommunityStore } from '~/stores/community'
import { getAllTasks, getApiBaseUrl, type Task } from '~/utils/api'

definePageMeta({ layout: 'default' })

const router = useRouter()
const userStore = useUserStore()
const communityStore = useCommunityStore()

const isAuthenticated = computed(() => !!userStore.user)

const loading = ref(false)
const error = ref('')
const pools = ref<Task[]>([])

function goManage(t: Task) {
  const id = t.taskInfoId
  if (!id) return
  router.push({
    path: `/tasks/pool/${id}/manage`,
    query: { title: t.title || '' },
  })
}

/** 阶段 5.3：创建者、未建池、有计划锁仓金额时展示列表快捷入口 */
function showSemiPrepayShortcut(t: Task): boolean {
  const uid = userStore.user?.id
  if (!uid || !t.taskInfoId) return false
  if (t.creatorId !== uid) return false
  if (t.useTaskpool !== true) return false
  if (t.taskpoolCreateTxHash) return false
  const p = t.plannedLockNt
  return p != null && Number(p) > 0
}

function goManageSemiPrepay(t: Task) {
  const id = t.taskInfoId
  if (!id) return
  router.push({
    path: `/tasks/pool/${id}/manage`,
    query: { title: t.title || '', focus: 'semi-prepay' },
  })
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const baseUrl = getApiBaseUrl()
    const cid = communityStore.currentCommunityId || undefined
    const list = await getAllTasks(baseUrl, cid)
    pools.value = (list || []).filter((t) => t.useTaskpool === true)
  } catch (e) {
    pools.value = []
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

onMounted(() => load())
</script>

