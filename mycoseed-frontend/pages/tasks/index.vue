<template>
  <div class="min-h-screen bg-background py-8">
    <div class="container mx-auto px-6">
      <!-- 创建任务按钮 -->
      <div v-if="isAuthenticated" class="mb-6 flex justify-end flex-wrap gap-2">
        <PixelButton
          variant="secondary"
          @click="navigateTo('/tasks/pool')"
        >
          <span class="flex items-center gap-1.5 whitespace-nowrap">
            <span class="text-base">📋</span>
            <span>任务池</span>
          </span>
        </PixelButton>
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
                  <span class="text-xs text-text-placeholder mt-0.5">发布于 {{ formatTimeAgo(item.createdAt ?? item.deadline ?? '') }}</span>
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
import { getAllTasks, getApiBaseUrl, getTaskTransactions, type Task } from '~/utils/api'
import { parseBeijingTime, getCurrentBeijingDate } from '~/utils/time'
import { weiToToken } from '~/utils/display'

type TaskStatus = Task['status']

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
  _task?: Task // 原始任务对象，用于判断是否失效
}

// 检查任务是否已领取（通过 claimer_id 判断）
const isTaskClaimed = (task: Task): boolean => {
  // 如果 claimerId 不为 null，说明已领取
  return !!task.claimerId
}

// 检查任务是否已过期（过了领取截止日期）
// 对于多人任务：过了领取截止日期就不能再领取
// 对于单人任务：过了领取截止日期且未领取才算过期
// 统一使用 UTC+8 北京时间进行比较，不受机器时区影响
const isTaskExpired = (task: Task): boolean => {
  if (!task.deadline) {
    return false // 如果没有领取截止时间，认为未过期
  }
  
  // 使用统一的时间解析函数，将 YYYY-MM-DDTHH:mm 当作北京时间（UTC+8）处理
  const deadline = parseBeijingTime(task.deadline)
  if (!deadline) {
    console.warn('[isTaskExpired] deadline 解析失败，返回 false')
    return false
  }
  
  // 获取当前北京时间（UTC+8）
  const now = getCurrentBeijingDate()
  
  // 如果过了领取截止日期
  if (now.getTime() > deadline.getTime()) {
    // 多人任务：过了领取截止日期就不能再领取
    if (task.participantLimit && task.participantLimit > 1) {
      return true
    }
    // 单人任务：过了领取截止日期且未领取才算过期
    return !isTaskClaimed(task)
  }
  
  return false
}

// 检查任务是否已截止（过了提交截止日期且已领取但未提交）
// 逻辑与任务详情页保持一致
// 统一使用 UTC+8 北京时间进行比较，不受机器时区影响
const isTaskOverdue = (task: Task): boolean => {
  // 优先使用提交截止日期
  const submitDeadline = task.submitDeadline
  if (!submitDeadline) {
    // 如果没有提交截止时间，使用领取截止时间作为后备（向后兼容）
    if (!task.deadline) return false
    
    const deadline = parseBeijingTime(task.deadline)
    if (!deadline) {
      return false // 无效时间，认为未截止
    }
    
    const now = getCurrentBeijingDate()
    
    // 如果过了领取截止时间且已领取但未提交，也算已截止
    const isClaimed = !!task.claimerId
    const isNotSubmitted = task.status !== 'completed' && task.status !== 'submitted' && task.status !== 'under_review'
    return now.getTime() > deadline.getTime() && isClaimed && isNotSubmitted
  }
  
  const deadline = parseBeijingTime(submitDeadline)
  if (!deadline) {
    return false // 无效时间，认为未截止
  }
  
  const now = getCurrentBeijingDate()
  
  // 过了提交截止日期且已领取但未提交的任务才算已截止
  // 检查条件：已领取 && 状态不是已完成和审核中 && 过了提交截止日期
  const isClaimed = !!task.claimerId
  const isNotSubmitted = task.status !== 'completed' && task.status !== 'under_review'
  
  return now.getTime() > deadline.getTime() && isClaimed && isNotSubmitted
}

// 检查任务是否被终止（rejected）
// 通过检查时间线数组的最后一个状态是否为 'rejected' 来判断
const isTaskRejected = (task: Task): boolean => {
  // 如果时间线存在且不为空，检查最后一个状态
  if (task.timeline && Array.isArray(task.timeline) && task.timeline.length > 0) {
    const lastStatus = task.timeline[task.timeline.length - 1]
    return lastStatus.status === 'rejected'
  }
  // 如果没有时间线，使用旧逻辑（向后兼容）
  return task.status === 'rejected' && task.rejectOption === 'rejected'
}

// 从时间线获取最新状态（如果时间线存在）
const getLatestStatusFromTimeline = (task: Task): TaskStatus | 'resubmit' | 'reclaim' | null => {
  if (task.timeline && Array.isArray(task.timeline) && task.timeline.length > 0) {
    const lastStatus = task.timeline[task.timeline.length - 1]
    return lastStatus.status as TaskStatus | 'resubmit' | 'reclaim'
  }
  return null
}

// 检查任务是否已失效（过期、已截止或被终止）
const isTaskInvalid = (task: Task): boolean => {
  return isTaskExpired(task) || isTaskOverdue(task) || isTaskRejected(task)
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
    // 添加原始任务对象，用于判断是否失效
    _task: task
  }))
})

// 检查任务是否未领完（多人项目没领完的）
// 通过比较已领取的行数和任务设置的参与人数来判断
const isTaskNotFullyClaimed = (task: Task): boolean => {
  // 如果任务有参与人数限制
  if (task.participantLimit && task.participantLimit > 1) {
    // 检查当前已领取人数（通过 participantsList，检查 claimerId 和 claimedAt）
    const currentParticipants = task.participantsList?.filter(p => p.claimerId && p.claimedAt).length || 0
    
    // 未领完：已领取人数小于限制（包括0人领取的情况）
    return currentParticipants < task.participantLimit
  }
  return false
}

// 状态映射：将任务状态映射到筛选状态
// 优先使用时间线数组的最后一个状态来判断
const mapTaskStatusToFilter = (item: TaskItem): string => {
  // 首先检查是否已失效（过期、已截止或被终止）
  // 注意：这个检查必须在状态映射之前，确保已失效的任务不会被归类到正常状态
  if (item._task) {
      // 优先检查已截止（因为已截止的任务状态可能还是 claimed 或 unsubmit）
    if (isTaskOverdue(item._task)) {
      return 'expired'
    }
    // 再检查是否已过期
    if (isTaskExpired(item._task)) {
      return 'expired'
    }
    // 再检查是否被终止（通过时间线最后一个状态判断）
    if (isTaskRejected(item._task)) {
      return 'expired'
    }
    
    // 优先检查是否未领完（多人任务）- 应该在状态检查之前
    if (isTaskNotFullyClaimed(item._task)) {
      return 'pending' // 未领完的任务显示在"可领取"标签页
    }
    
    // 尝试从时间线获取最新状态
    const latestStatus = getLatestStatusFromTimeline(item._task)
    if (latestStatus) {
      // 根据时间线的最新状态映射
      if (latestStatus === 'unclaimed' || (latestStatus === 'reclaim')) {
        return 'pending'
      }
      if (latestStatus === 'claimed' || latestStatus === 'unsubmit' || latestStatus === 'submitted' || latestStatus === 'under_review' || latestStatus === 'resubmit') {
        return 'unsubmit'
      }
      if (latestStatus === 'completed') {
        return 'completed'
      }
      if (latestStatus === 'rejected') {
        return 'expired'
      }
    }
  }
  
  // 如果没有时间线，使用旧逻辑（向后兼容）
  // "可领取"：包含"未领取"（unclaimed）和"未领完"（未领完的多人任务）
  if (item.status === 'unclaimed' || (item._task && isTaskNotFullyClaimed(item._task))) {
    return 'pending'
  }
  // "待审核"：包含"待提交"（claimed/unsubmit）和"审核中"（submitted/under_review）
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
  
  // 状态筛选
  if (activeStatusTab.value !== 'all') {
    items = items.filter(item => {
      const filterStatus = mapTaskStatusToFilter(item)
      return filterStatus === activeStatusTab.value
    })
  }
  
  return items
})

// 任务状态文本（统一的状态文本映射）
const getTaskStatusText = (status: string, task?: Task) => {
  // 如果提供了任务对象，优先检查是否已失效（过期、已截止或被终止）
  if (task) {
    // 先检查是否已截止（优先级最高，因为已截止的任务状态可能还是 claimed 或 unsubmit）
    if (isTaskOverdue(task)) {
      return '已截止'
    }
    // 再检查是否已过期
    if (isTaskExpired(task)) {
      return '已过期'
    }
    // 再检查是否被终止（只有 rejectOption === 'rejected' 的才是真正的终止）
    if (isTaskRejected(task)) {
      return '已终止'
    }
    
    // 对于多人任务，检查是否所有参与者都已完成
    if (task.participantLimit && task.participantLimit > 1 && task.participantsList) {
      const allCompleted = task.participantsList.every(p => 
        p.status === 'completed' || p.status === 'rejected'
      )
      if (allCompleted && task.participantsList.length > 0) {
        // 如果所有参与者都已完成或被驳回，检查是否至少有一个完成
        const hasCompleted = task.participantsList.some(p => p.status === 'completed')
        return hasCompleted ? '已完成' : '已终止'
      }
    }
    
    // 检查是否未领完（多人项目）
    // 优先检查未领完状态（应该在过期检查之前）
    if (isTaskNotFullyClaimed(task)) {
      return '未领完'
    }
  }
  
  // 统一的状态文本映射
  const statusMap: Record<string, string> = {
    'unclaimed': '未领取',
    'claimed': '已领取',
    'unsubmit': '待提交',
    'submitted': '已提交',
    'under_review': '审核中',
    'completed': '已完成',
    'rejected': '已终止'  // 只有 rejectOption === 'rejected' 的才会显示这个
  }
  return statusMap[status] || '未知'
}

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




