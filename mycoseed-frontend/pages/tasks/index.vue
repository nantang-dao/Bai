<template>
  <div class="min-h-screen bg-background py-8">
    <div class="container mx-auto px-6">
      <!-- 创建任务按钮 -->
      <div v-if="isAuthenticated" class="mb-6 flex justify-end gap-2">
        <PixelButton
          variant="primary"
          @click="navigateTo('/tasks/create')"
        >
          <span class="flex items-center gap-1.5 whitespace-nowrap">
            <span class="text-base">🎯</span>
            <span>创建任务</span>
          </span>
        </PixelButton>
      </div>

      <!-- 操作栏 -->
      <div class="mb-6 flex flex-col sm:flex-row justify-start items-center gap-4">
        <div class="flex gap-2">
          <button
            v-for="tab in statusTabs"
            :key="tab.id"
            @click="activeStatusTab = tab.id"
            :class="[
              'px-4 py-2 rounded-2xl text-sm font-medium transition-all',
              activeStatusTab === tab.id
                ? 'bg-primary text-white shadow-soft'
                : 'bg-card text-text-body hover:bg-input-bg border border-border'
            ]"
          >
            {{ tab.label }}
          </button>
        </div>
      </div>

      <!-- 搜索、排序、标签筛选 -->
      <div class="mb-6 space-y-3">
        <div class="flex gap-3 items-center">
          <!-- 搜索框 -->
          <div class="flex-1 relative">
            <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-placeholder" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
            </svg>
            <input
              v-model="searchQuery"
              type="text"
              placeholder="搜索任务..."
              class="w-full h-10 pl-9 pr-4 bg-card border border-border rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <!-- 排序下拉 -->
          <select
            v-model="sortBy"
            class="h-10 px-3 bg-card border border-border rounded-2xl text-sm text-text-body focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="createdAt">最新发布</option>
            <option value="deadline">即将截止</option>
            <option value="reward">积分最高</option>
          </select>
        </div>
        <!-- 标签筛选 -->
        <div v-if="availableTags.length > 0" class="flex gap-2 flex-wrap">
          <button
            @click="activeTagId = ''"
            :class="[
              'px-3 py-1.5 rounded-xl text-xs font-medium transition-all border',
              !activeTagId
                ? 'bg-primary text-white border-primary'
                : 'bg-card text-text-body border-border hover:bg-input-bg'
            ]"
          >
            全部标签
          </button>
          <button
            v-for="tag in availableTags"
            :key="tag.id"
            @click="activeTagId = activeTagId === tag.id ? '' : tag.id"
            :class="[
              'px-3 py-1.5 rounded-xl text-xs font-medium transition-all border',
              activeTagId === tag.id
                ? 'text-white border-transparent'
                : 'bg-card text-text-body border-border hover:bg-input-bg'
            ]"
            :style="activeTagId === tag.id ? { backgroundColor: tag.colorHex, borderColor: tag.colorHex } : {}"
          >
            {{ tag.name }}
          </button>
        </div>
      </div>

      <!-- 加载状态 -->
      <div v-if="loading" class="text-center py-12">
        <div class="text-xl text-text-body animate-pulse">加载中...</div>
      </div>

      <!-- 空状态 -->
      <div v-else-if="filteredItems.length === 0" class="text-center py-12">
        <div class="text-xl text-text-body mb-4">暂无内容</div>
      </div>

      <!-- 内容列表 -->
      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <!-- 任务卡片 -->
        <PixelCard
          v-for="item in filteredItems"
          :key="`task-${item.id}`"
          hover
          class="cursor-pointer task-card-container"
          @click="navigateTo(`/tasks/${item.id}`)"
        >
          <template #header>
            <div class="flex justify-between items-center gap-2">
              <!-- 左侧：头像 + 名字在上，发布时间在下 -->
              <div class="flex items-start gap-2 min-w-0 flex-1">
                <div class="flex-shrink-0">
                  <PixelAvatar
                    v-if="item.creatorAvatar"
                    :src="item.creatorAvatar"
                    size="sm"
                    class="rounded-full"
                  />
                  <PixelAvatar
                    v-else
                    :seed="item.creator || '系统'"
                    size="sm"
                    class="rounded-full"
                  />
                </div>
                <div class="flex flex-col min-w-0">
                  <span class="text-text-body text-sm font-medium truncate">{{ item.creator || '系统' }}</span>
                  <span class="text-xs text-text-placeholder mt-0.5">发布于 {{ formatTimeAgo(item.createdAt || item.deadline) }}</span>
                </div>
              </div>
              <!-- 右侧：状态标签 -->
              <div class="flex-shrink-0">
                <span
                  v-if="item.status === 'completed' && taskChainMap[item.id]?.length"
                  class="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-xl font-medium"
                >
                  已转账 {{ weiToToken(taskChainMap[item.id][0]?.actual_amount || taskChainMap[item.id][0]?.amount) || item.reward || 0 }} 积分
                </span>
                <span
                  v-else-if="item.status === 'completed' && item._task?.transferredAt"
                  class="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-xl font-medium"
                >
                  已标记转账 {{ item.reward || 0 }} 积分
                </span>
                <span
                  v-else-if="item.status === 'completed'"
                  class="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-xl font-medium"
                >
                  待转账 {{ item.reward || 0 }} 积分
                </span>
                <span v-else class="text-xs bg-input-bg text-text-body px-2 py-1 rounded-xl font-medium">
                  {{ getTaskStatusText(item.status, item._task) }}
                </span>
              </div>
            </div>
          </template>
          
          <div class="task-card-content">
            <h3 class="font-bold text-lg text-text-title line-clamp-1">{{ item.title }}</h3>
            <p class="text-text-body text-sm line-clamp-2 mt-1">{{ item.description }}</p>
            <!-- 标签 -->
            <div v-if="item.tags && item.tags.length > 0" class="mt-2 flex gap-1.5 flex-wrap">
              <span
                v-for="tag in item.tags"
                :key="tag.id"
                class="text-[10px] px-2 py-0.5 rounded-lg text-white font-medium"
                :style="{ backgroundColor: tag.colorHex }"
              >{{ tag.name }}</span>
            </div>
            <!-- 多人任务标签 -->
            <div v-if="Number(item._task?.participantLimit) > 1" class="mt-2 flex gap-2">
              <span class="text-xs bg-gray-100 text-text-body px-2 py-1 rounded-lg border border-border">多人任务</span>
            </div>
          </div>

          <template #footer>
            <div class="flex items-center justify-between w-full">
              <!-- 左侧：积分 -->
              <div class="text-primary font-bold flex items-center gap-1">
                <div class="w-3 h-3 bg-primary rounded-full"></div>
                {{ item.reward || 0 }} 积分
              </div>
              <!-- 右侧：倒计时 + 右箭头按钮（固定在右下角） -->
              <div class="flex items-center gap-2 flex-shrink-0">
                <div v-if="item.deadline" class="flex items-center gap-1 text-xs text-text-body">
                  <!-- 灰色极简时钟图标 -->
                  <svg class="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke-width="1.5" stroke="currentColor" fill="none"/>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6v6l4 2" stroke="currentColor"/>
                  </svg>
                  <span>{{ formatDeadlineCountdown(item.deadline || '') }}</span>
                </div>
                <button
                  class="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center hover:bg-primary/80 transition-colors flex-shrink-0"
                  @click.stop="navigateTo(`/tasks/${item.id}`)"
                  aria-label="查看详情"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                  </svg>
                </button>
              </div>
            </div>
          </template>
        </PixelCard>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import PixelCard from '~/components/pixel/PixelCard.vue'
import PixelButton from '~/components/pixel/PixelButton.vue'
import PixelAvatar from '~/components/pixel/PixelAvatar.vue'
import { useUserStore } from '~/stores/user'
import { useCommunityStore } from '~/stores/community'
import { getAllTasks, getApiBaseUrl, getTaskTransactions, type Task, type TaskTag } from '~/utils/api'
import { parseBeijingTime, getCurrentBeijingDate } from '~/utils/time'
import { weiToToken } from '~/utils/display'
import { getTaskStatusText, mapPublishedTaskToFilter } from '~/utils/taskStatus'

definePageMeta({
  layout: 'default'
})

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const communityStore = useCommunityStore()

// 判断用户是否已登录
const isAuthenticated = computed(() => {
  return !!userStore.user
})

const navigateTo = (path: string) => {
  router.push(path)
}

// 状态筛选标签
const activeStatusTab = ref('all')
const statusTabs = [
  { id: 'all', label: '全部' },
  { id: 'pending', label: '可领取' }, // 包含"未领取"和"未领完"（多人项目没领完的）
  { id: 'unsubmit', label: '待审核' }, // 包含"待提交"（claimed/unsubmit）和"审核中"（submitted/under_review）
  { id: 'completed', label: '已完成' },
  { id: 'expired', label: '已失效' }
]

// 搜索、排序、标签筛选
const searchQuery = ref('')
const sortBy = ref<'createdAt' | 'deadline' | 'reward'>('createdAt')
const activeTagId = ref('')
const availableTags = ref<TaskTag[]>([])

// 加载状态
const loading = ref(false)

// 任务列表
const tasks = ref<Task[]>([])

// 链上交易记录：taskId -> transactions[]
const taskChainMap = ref<Record<string, any[]>>({})

// 从 API 加载数据（按当前社区过滤）
const loadData = async () => {
  loading.value = true
  try {
    const baseUrl = getApiBaseUrl()
    const communityId = communityStore.currentCommunityId || undefined
    const apiTasks = await getAllTasks(baseUrl, communityId)
    tasks.value = apiTasks

    // 加载标签
    if (communityId) {
      try {
        const api = useApi()
        availableTags.value = await api.listTaskTags(communityId)
      } catch { /* ignore */ }
    }

    // 对已完成的任务，查询链上交易记录
    const completedTasks = apiTasks.filter(t => t.status === 'completed')
    if (completedTasks.length > 0) {
      const chainMap: Record<string, any[]> = {}
      await Promise.all(
        completedTasks.map(async (t) => {
          try {
            const txs = await getTaskTransactions(t.id, baseUrl)
            if (txs && txs.length > 0) {
              chainMap[t.id] = txs
            }
          } catch { /* ignore */ }
        })
      )
      taskChainMap.value = chainMap
    }
  } catch (error) {
    console.error('加载数据失败:', error)
  } finally {
    loading.value = false
  }
}

// 任务数据项类型
interface TaskItem {
  id: string | number
  title: string
  description: string
  status: string
  reward?: number
  deadline?: string
  submitDeadline?: string
  createdAt?: string
  creator?: string
  creatorId?: string
  creatorAvatar?: string
  tags?: { id: string; name: string; colorHex: string }[]
  _task?: Task // 原始任务对象，用于判断是否失效
}

// 任务列表
const taskItems = computed<TaskItem[]>(() => {
  return tasks.value.map(task => ({
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    reward: task.reward,
    deadline: task.deadline || task.completedAt || task.updatedAt || task.createdAt || '',
    submitDeadline: task.submitDeadline || '',
    createdAt: task.createdAt,
    creator: task.creatorName || '系统',
    creatorId: task.creatorId,
    creatorAvatar: task.creatorAvatar,
    tags: task.tags || [],
    // 添加原始任务对象，用于判断是否失效
    _task: task
  }))
})

const mapTaskStatusToFilter = (item: TaskItem): string => {
  if (item._task) return mapPublishedTaskToFilter(item._task)
  if (item.status === 'unclaimed') return 'pending'
  if (item.status === 'claimed' || item.status === 'unsubmit' || item.status === 'submitted' || item.status === 'under_review') {
    return 'unsubmit'
  }
  if (item.status === 'completed') return 'completed'
  if (item.status === 'rejected') return 'expired'
  return item.status
}

// 过滤后的任务列表
const filteredItems = computed(() => {
  let items = taskItems.value
  
  // 搜索筛选
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase()
    items = items.filter(item =>
      item.title.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      (item.creator || '').toLowerCase().includes(q)
    )
  }

  // 标签筛选
  if (activeTagId.value) {
    items = items.filter(item =>
      item.tags?.some(tag => tag.id === activeTagId.value)
    )
  }
  
  // 状态筛选
  if (activeStatusTab.value !== 'all') {
    items = items.filter(item => {
      const filterStatus = mapTaskStatusToFilter(item)
      return filterStatus === activeStatusTab.value
    })
  }

  // 排序
  items = [...items].sort((a, b) => {
    if (sortBy.value === 'deadline') {
      const da = a.submitDeadline || a.deadline || ''
      const db = b.submitDeadline || b.deadline || ''
      if (!da) return 1
      if (!db) return -1
      return da.localeCompare(db)
    }
    if (sortBy.value === 'reward') {
      return (b.reward || 0) - (a.reward || 0)
    }
    // 默认按创建时间降序
    return (b.createdAt || '').localeCompare(a.createdAt || '')
  })
  
  return items
})

// 格式化时间差（统一使用 UTC+8 北京时间，不受机器时区影响）
const formatTimeAgo = (dateString: string): string => {
  if (!dateString) return ''
  
  // 使用统一的时间解析函数，将 YYYY-MM-DDTHH:mm 当作北京时间（UTC+8）处理
  const date = parseBeijingTime(dateString)
  if (!date) {
    console.warn(`[formatTimeAgo] 无法解析时间格式: ${dateString}`)
    return ''
  }
  
  // 获取当前北京时间（UTC+8）
  const now = getCurrentBeijingDate()
  
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  
  if (diffMins < 60) {
    return `${Math.max(0, diffMins)}分钟前`
  } else if (diffHours < 24) {
    return `${diffHours}小时前`
  } else {
    return `${diffDays}天前`
  }
}

// 格式化提交截止时间（用于卡片展示，显示为北京时间）
const formatSubmitDeadline = (dateString: string): string => {
  if (!dateString) return ''
  const date = parseBeijingTime(dateString)
  if (!date || isNaN(date.getTime())) return ''
  const beijing = new Date(date.getTime() + 8 * 60 * 60 * 1000)
  const month = beijing.getUTCMonth() + 1
  const day = beijing.getUTCDate()
  const hour = beijing.getUTCHours()
  const minute = beijing.getUTCMinutes()
  return `${month}月${day}日 ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

// 格式化领取截止时间倒计时（显示为"X年后"、"X天后"、"X小时后"）
const formatDeadlineCountdown = (deadlineString: string): string => {
  if (!deadlineString) return ''
  
  const deadline = parseBeijingTime(deadlineString)
  if (!deadline) return ''
  
  const now = getCurrentBeijingDate()
  const diffMs = deadline.getTime() - now.getTime()
  
  if (diffMs <= 0) {
    return '已截止'
  }
  
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  const diffYears = Math.floor(diffMs / (365.25 * 86400000))
  
  if (diffYears > 0) {
    return `${diffYears}年后`
  } else if (diffDays > 0) {
    return `${diffDays}天后`
  } else if (diffHours > 0) {
    return `${diffHours}小时后`
  } else {
    return diffMins > 0 ? `${diffMins}分钟后` : '即将截止'
  }
}

// 组件挂载时加载数据
onMounted(async () => {
  // 确保用户信息已加载
  await userStore.getUser()
  loadData()
})

// 监听路由变化，当从创建页面返回时重新加载
watch(() => communityStore.currentCommunityId, () => {
  if (route.path === '/tasks') loadData()
})
watch(() => route.fullPath, () => {
  if (route.path === '/tasks') {
    loadData()
  }
}, { immediate: false })
</script>

<style scoped>
/* 任务卡片容器：使用flex布局，header在顶部，footer在底部 */
.task-card-container {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.task-card-container :deep(.relative) {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.task-card-container :deep([class*="border-b"]) {
  flex-shrink: 0;
}

.task-card-content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.task-card-container :deep([class*="border-t"]) {
  flex-shrink: 0;
  margin-top: auto;
}

.line-clamp-1 {
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-clamp: 1;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-clamp: 2;
}
</style>




