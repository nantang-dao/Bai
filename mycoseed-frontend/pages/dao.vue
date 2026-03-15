<template>
  <div class="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- 页头 -->
      <div class="flex items-center gap-4 mb-8">
        <button
          @click="navigateTo('/')"
          class="p-2 rounded-lg hover:bg-white/80 transition-colors cursor-pointer"
        >
          <svg class="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <h1 class="text-3xl font-bold text-gray-900">DAO</h1>
      </div>

      <!-- 标签切换 -->
      <div class="mb-8 flex gap-4 border-b border-gray-200">
        <button
          @click="activeTab = 'management'"
          class="px-6 py-3 font-medium transition-colors"
          :class="activeTab === 'management' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600 hover:text-gray-900'"
        >
          任务管理
        </button>
        <button
          @click="activeTab = 'review'"
          class="px-6 py-3 font-medium transition-colors"
          :class="activeTab === 'review' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600 hover:text-gray-900'"
        >
          任务审核
        </button>
      </div>

      <!-- 任务管理标签 -->
      <div v-if="activeTab === 'management'" class="space-y-6">
        <div
          v-for="activity in activitiesWithTasks"
          :key="activity.id"
          class="bg-white rounded-2xl shadow-xl p-6"
        >
          <!-- 活动标题 -->
          <h2 class="text-2xl font-bold text-gray-900 mb-4">{{ activity.name }}</h2>

          <!-- 任务列表 -->
          <div v-if="activity.tasks.length === 0" class="text-gray-500 text-center py-4">
            该活动暂无任务
          </div>

          <div v-else class="space-y-3">
            <div
              v-for="task in activity.tasks"
              :key="task.id"
              class="border border-gray-200 rounded-lg p-4 flex items-center justify-between"
            >
              <div class="flex-1">
                <div class="flex items-center gap-3 mb-1">
                  <h3 class="text-lg font-semibold text-gray-900">{{ task.title }}</h3>
                  <span 
                    v-if="task.discount"
                    class="px-3 py-1 bg-orange-50 text-orange-700 rounded-full text-sm font-medium"
                  >
                    <span class="line-through opacity-60">{{ task.reward }}</span>
                    → {{ getFinalReward(task) }} {{ taskRewardSymbols[task.id] || '积分' }}
                  </span>
                  <span v-else class="px-3 py-1 bg-green-50 text-green-700 rounded-full text-sm font-medium">
                    {{ task.reward }} {{ taskRewardSymbols[task.id] || '积分' }}
                  </span>
                </div>
                <p class="text-gray-600 text-sm">{{ task.description }}</p>
              </div>
              
              <!-- 状态标签 -->
              <div class="ml-4">
                <span
                  v-if="task.status === 'completed'"
                  class="px-4 py-2 bg-green-100 text-green-700 rounded-lg text-sm font-medium whitespace-nowrap"
                >
                  ✓ 已完成
                </span>
                <span
                  v-else-if="task.status === 'under_review'"
                  class="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium whitespace-nowrap"
                >
                  审核中
                </span>
                <span
                  v-else-if="task.status === 'claimed' || task.status === 'unsubmit'"
                  class="px-4 py-2 bg-yellow-100 text-yellow-700 rounded-lg text-sm font-medium whitespace-nowrap"
                >
                  完成中
                </span>
                <span
                  v-else-if="task.status === 'rejected'"
                  class="px-4 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-medium whitespace-nowrap"
                >
                  已驳回
                </span>
                <span
                  v-else
                  class="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium whitespace-nowrap"
                >
                  未领取
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 任务审核标签 -->
      <div v-else-if="activeTab === 'review'" class="space-y-6">
        <div v-if="reviewTasks.length === 0" class="bg-white rounded-2xl shadow-xl p-12 text-center">
          <p class="text-gray-500 text-lg">暂无待审核任务</p>
        </div>

        <div v-else class="space-y-4">
          <div
            v-for="task in reviewTasks"
            :key="task.id"
            class="bg-white rounded-2xl shadow-xl p-6"
          >
            <div class="flex items-center gap-3 mb-2">
              <h3 class="text-xl font-bold text-gray-900">{{ task.title }}</h3>
              <span class="px-3 py-1 bg-green-50 text-green-700 rounded-full text-sm font-medium">
                奖金：{{ task.reward }} {{ taskRewardSymbols[task.id] || '积分' }}
              </span>
            </div>
            <p class="text-gray-600 mb-4">{{ task.description }}</p>
            <div class="bg-gray-50 rounded-lg p-4 mb-4">
              <div class="text-sm text-gray-500 mb-1">完成凭证：</div>
              <div class="text-gray-900">{{ task.proof }}</div>
            </div>

            <!-- 审核操作按钮 -->
            <div class="flex gap-3">
              <button
                @click="handleApprove(task.id)"
                class="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              >
                同意（发放 {{ task.reward }} {{ taskRewardSymbols[task.id] || '积分' }}）
              </button>
              <button
                @click="openRejectModal(task)"
                class="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                驳回
              </button>
              <button
                @click="openDiscountModal(task)"
                class="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
              >
                打折
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 驳回弹窗 -->
    <div
      v-if="showRejectModal"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      @click="showRejectModal = false"
    >
      <div
        class="bg-white rounded-2xl shadow-2xl p-8 max-w-lg w-full mx-4"
        @click.stop
      >
        <h2 class="text-2xl font-bold text-gray-900 mb-4">驳回任务</h2>
        <p class="text-gray-600 mb-4">任务：{{ selectedTask?.title }}</p>
        
        <textarea
          v-model="rejectReason"
          placeholder="请输入驳回理由..."
          class="w-full h-32 p-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 resize-none mb-4"
        ></textarea>
        
        <div class="flex gap-3">
          <button
            @click="handleReject"
            :disabled="!rejectReason.trim()"
            class="flex-1 px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            确认驳回
          </button>
          <button
            @click="showRejectModal = false"
            class="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            取消
          </button>
        </div>
      </div>
    </div>

    <!-- 打折弹窗 -->
    <div
      v-if="showDiscountModal"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      @click="showDiscountModal = false"
    >
      <div
        class="bg-white rounded-2xl shadow-2xl p-8 max-w-lg w-full mx-4"
        @click.stop
      >
        <h2 class="text-2xl font-bold text-gray-900 mb-4">打折审核</h2>
        <p class="text-gray-600 mb-2">任务：{{ selectedTask?.title }}</p>
        <p class="text-gray-600 mb-4">原始奖金：{{ selectedTask?.reward }} {{ selectedTask ? (taskRewardSymbols[selectedTask.id] || '积分') : '积分' }}</p>
        
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-2">打折百分数（%）</label>
          <input
            v-model.number="discountPercent"
            type="number"
            min="0"
            max="100"
            placeholder="输入0-100的数字"
            class="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
          />
          <div v-if="discountPercent && discountPercent > 0 && discountPercent <= 100 && selectedTask" class="mt-2 p-3 bg-orange-50 rounded-lg">
            <div class="text-sm text-orange-700">
              最终奖金：
              <span class="font-bold">{{ (selectedTask.reward * (discountPercent / 100)).toFixed(4) }} {{ taskRewardSymbols[selectedTask.id] || '积分' }}</span>
              <span class="text-xs ml-2">({{ discountPercent }}% 的 {{ selectedTask.reward }} {{ taskRewardSymbols[selectedTask.id] || '积分' }})</span>
            </div>
          </div>
        </div>
        
        <textarea
          v-model="discountReason"
          placeholder="请输入打折理由..."
          class="w-full h-32 p-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 resize-none mb-4"
        ></textarea>
        
        <div class="flex gap-3">
          <button
            @click="handleDiscount"
            :disabled="!discountReason.trim() || !discountPercent || discountPercent < 0 || discountPercent > 100"
            class="flex-1 px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            确认打折
          </button>
          <button
            @click="showDiscountModal = false"
            class="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { getActivities, getAllTasks, getReviewTasks, approveTask, rejectTask, discountTask, getFinalReward, getApiBaseUrl, type Activity, type Task } from '~/utils/api'
import { getTaskRewardSymbol } from '~/utils/display'

// 响应式数据
const activeTab = ref<'management' | 'review'>('management')
const activities = ref<Activity[]>([])
const tasks = ref<Task[]>([])
const reviewTasks = ref<Task[]>([])
const taskRewardSymbols = ref<Record<string, string>>({}) // 存储每个任务对应的积分符号（key是task.id，现在是string）

// 弹窗相关
const showRejectModal = ref(false)
const showDiscountModal = ref(false)
const selectedTask = ref<Task | null>(null)
const rejectReason = ref('')
const discountPercent = ref<number | null>(null)
const discountReason = ref('')

// 计算属性：按活动分组任务
const activitiesWithTasks = computed(() => {
  return activities.value.map(activity => ({
    ...activity,
    tasks: tasks.value.filter(task => task.activityId === activity.id)
  }))
})

// 同意审核
const handleApprove = async (taskId: string) => {
  const baseUrl = getApiBaseUrl()
  const result = await approveTask(taskId, baseUrl)
  alert(result.message)
  if (result.success) {
    await loadReviewTasks()
    await loadTasks()
  }
}

// 打开驳回弹窗
const openRejectModal = (task: Task) => {
  selectedTask.value = task
  rejectReason.value = ''
  showRejectModal.value = true
}

// 驳回任务
const handleReject = async () => {
  if (!selectedTask.value || !rejectReason.value.trim()) return
  
  const baseUrl = getApiBaseUrl()
  // 注意：后端不支持 'end' 选项，这里使用 'reclaim' 作为默认值
  const result = await rejectTask(selectedTask.value.id, rejectReason.value.trim(), baseUrl, 'reclaim')
  alert(result.message)
  if (result.success) {
    showRejectModal.value = false
    await loadReviewTasks()
    await loadTasks()
  }
}

// 打开打折弹窗
const openDiscountModal = (task: Task) => {
  selectedTask.value = task
  discountPercent.value = null
  discountReason.value = ''
  showDiscountModal.value = true
}

// 打折审核
const handleDiscount = async () => {
  if (!selectedTask.value || !discountPercent.value || !discountReason.value.trim()) return
  
  const result = await discountTask(selectedTask.value.id, discountPercent.value, discountReason.value.trim())
  alert(result.message)
  if (result.success) {
    showDiscountModal.value = false
    await loadReviewTasks()
    await loadTasks()
  }
}

// 加载任务数据
const loadTasks = async () => {
  const baseUrl = getApiBaseUrl()
  tasks.value = await getAllTasks(baseUrl)
  
  // 为每个任务获取对应的积分符号
  const allCommunities = await getActivities() // 这里应该获取社区列表，但为了性能，我们可以批量处理
  try {
    const { getCommunities } = await import('~/utils/api')
    const communities = await getCommunities()
    for (const task of tasks.value) {
      const symbol = await getTaskRewardSymbol(task, communities)
      taskRewardSymbols.value[task.id] = symbol
    }
  } catch (error) {
    console.error('Failed to load task reward symbols:', error)
  }
}

// 加载审核任务
const loadReviewTasks = async () => {
  const baseUrl = getApiBaseUrl()
  reviewTasks.value = await getReviewTasks(baseUrl)
  
  // 为每个审核任务获取对应的积分符号
  try {
    const { getCommunities } = await import('~/utils/api')
    const communities = await getCommunities()
    for (const task of reviewTasks.value) {
      const symbol = await getTaskRewardSymbol(task, communities)
      taskRewardSymbols.value[task.id] = symbol
    }
  } catch (error) {
    console.error('Failed to load review task reward symbols:', error)
  }
}

// 加载数据
onMounted(async () => {
  activities.value = await getActivities()
  await loadTasks()
  await loadReviewTasks()
})

// 监听标签切换，重新加载数据
watch(activeTab, async (newTab) => {
  if (newTab === 'review') {
    await loadReviewTasks()
  }
})
</script>

