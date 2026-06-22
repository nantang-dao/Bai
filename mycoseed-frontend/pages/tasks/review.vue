<template>
  <div class="min-h-screen bg-background py-4 md:py-8">
    <div class="container mx-auto px-4 md:px-6 max-w-4xl">
      <!-- 返回按钮 -->
      <div class="mb-6">
        <PixelButton
          @click="navigateTo(`/tasks/${taskId}`)"
          variant="secondary"
          size="sm"
        >
          ← 返回任务详情
        </PixelButton>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="text-center py-12">
        <div class="text-lg text-text-body animate-pulse">加载中...</div>
      </div>

      <!-- 审核表单 -->
      <div v-else>
        <PixelCard>
          <template #header>
            审核任务
          </template>
          
          <p v-if="canReview" class=" text-lg text-black mb-6">请仔细审核任务完成情况，并给出审核结果</p>
          
          <!-- 只读模式提示 -->
          <div v-if="!canReview" class="bg-warning/20 border-2 border-warning shadow-soft p-4 mb-6">
            <p class=" text-base text-black">
              <span class="font-bold text-xs">⚠️</span> 您不是任务创建者，无法进行审核操作
            </p>
          </div>
          
          <form @submit.prevent="submitReview" class="space-y-6">
            <!-- 任务信息 -->
            <div class="bg-card border border-border rounded-2xl shadow-soft p-4">
              <h3 class="font-bold text-xs uppercase text-black mb-2">{{ task.title }}</h3>
              <div class="mb-3 text-black whitespace-pre-wrap leading-relaxed">{{ task.description }}</div>
              <div v-if="task.submissionInstructions?.trim()" class="pt-3 border-t border-border mb-3">
                <h4 class="font-bold text-[10px] uppercase text-black mb-2">提交说明</h4>
                <div class="text-black whitespace-pre-wrap leading-relaxed">{{ task.submissionInstructions }}</div>
              </div>
              <div class="flex items-center gap-3 flex-wrap">
                <span class="px-3 py-1.5 bg-primary text-white border border-border rounded-2xl shadow-soft font-bold text-[10px] uppercase">
                  {{ task.reward }} {{ taskRewardSymbol }}
                </span>
                <div class="flex flex-col gap-1">
                  <span class=" text-sm text-black">领取截止: {{ formatDate(task.deadline) }}</span>
                  <span class=" text-sm text-black">提交截止: {{ formatDate(task.submitDeadline || task.deadline) }}</span>
                </div>
              </div>
            </div>

            <!-- 提交者信息 -->
            <div class="pt-4 border-t border-border">
              <h3 class="font-bold text-xs uppercase text-black mb-4">提交者信息</h3>
              <div class="bg-card border border-border rounded-2xl shadow-soft p-4">
                <div class="flex items-center gap-3 mb-3">
                  <div class="w-12 h-12 bg-destructive border border-border rounded-2xl flex items-center justify-center font-bold text-lg text-white">
                    {{ submission.submitter.name.charAt(0).toUpperCase() }}
                  </div>
                  <div>
                    <h4 class="font-bold text-xs uppercase text-black">{{ submission.submitter.name.toUpperCase() }}</h4>
                    <p class=" text-sm text-black/70">{{ submission.submitter.role }}</p>
                  </div>
                </div>
                <div class=" text-sm text-black space-y-1 pt-3 border-t border-border">
                  <p><span class="font-medium">提交时间:</span> {{ formatDate(submission.timestamp) }}</p>
                </div>
              </div>
            </div>

            <!-- 提交内容（按顺序：图片 → 位置信息 → 文字说明） -->
            <div class="pt-4 border-t border-border">
              <h3 class="font-bold text-xs uppercase text-black mb-4">提交内容</h3>
              
              <!-- 1. 图片文件（优先显示）- 响应式设计：手机端2列，平板3列，电脑端4列 -->
              <div v-if="submission.files && submission.files.length > 0" class="mb-4">
                <h4 class="font-bold text-[10px] uppercase text-black mb-3">提交图片</h4>
                <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    <div
                    v-for="(file, index) in submission.files"
                      :key="index"
                    class="bg-card border border-border rounded-2xl shadow-soft p-3 relative group"
                    >
                    <!-- 图片预览 -->
                    <div class="aspect-square bg-gray-100 border border-border mb-2 overflow-hidden">
                      <img 
                        :src="file.url" 
                        :alt="file.name"
                        class="w-full h-full object-cover cursor-pointer hover:scale-110 transition-transform"
                        @click="previewFile(file)"
                      />
                        </div>
                    <!-- 文件信息 - 名称显示已关闭 -->
                    <!-- <div class=" text-xs text-black mb-2">
                      <div class="font-medium truncate">{{ file.name }}</div>
                      <div class="text-black/60">({{ formatFileSize(file.size) }})</div>
                        </div> -->
                    <!-- 操作按钮 -->
                        <div class="flex gap-2">
                          <PixelButton
                            @click="previewFile(file)"
                            variant="secondary"
                            size="sm"
                        :block="true"
                          >
                            预览
                          </PixelButton>
                          <PixelButton
                            @click="downloadFile(file)"
                        variant="primary"
                            size="sm"
                        :block="true"
                          >
                            下载
                          </PixelButton>
                  </div>
                </div>
              </div>
            </div>

              <!-- 2. 位置信息（经纬度） -->
              <div v-if="submission.gpsLocation" class="mb-4">
                <h4 class="font-bold text-[10px] uppercase text-black mb-3">位置信息</h4>
                <div class="bg-card border border-border rounded-2xl shadow-soft p-4">
                <div class="flex items-center gap-2 mb-3">
                  <span class="text-2xl">📍</span>
                    <span class="font-bold text-xs uppercase text-black">GPS定位</span>
                </div>
                <div class=" text-sm text-black space-y-1">
                    <div><span class="font-medium">纬度:</span> {{ submission.gpsLocation.latitude.toFixed(6) }}</div>
                    <div><span class="font-medium">经度:</span> {{ submission.gpsLocation.longitude.toFixed(6) }}</div>
                    <div v-if="submission.gpsLocation.accuracy" class="text-black/60">
                      <span class="font-medium">精度:</span> ±{{ Math.round(submission.gpsLocation.accuracy) }}米
                    </div>
                  <div v-if="submission.gpsLocation.timestamp" class="text-black/60 mt-2">
                      <span class="font-medium">获取时间:</span> {{ formatDate(submission.gpsLocation.timestamp ? (typeof submission.gpsLocation.timestamp === 'number' ? new Date(submission.gpsLocation.timestamp).toISOString() : String(submission.gpsLocation.timestamp)) : undefined) }}
                  </div>
                </div>
              </div>
              </div>

              <!-- 3. 文字说明 -->
              <div v-if="submission.description && submission.description.trim()">
                <h4 class="font-bold text-[10px] uppercase text-black mb-3">文字说明</h4>
                <div class="bg-card border border-border rounded-2xl shadow-soft p-4">
                  <p class=" text-base text-black whitespace-pre-wrap">{{ submission.description }}</p>
                </div>
              </div>

              <!-- 空状态 -->
              <div v-if="!submission.files?.length && !submission.gpsLocation && !submission.description" class="bg-gray-50 border border-dashed border-border p-4 text-center">
                <p class=" text-sm text-black/60">未提交任何内容</p>
              </div>
            </div>

            <!-- 审核结果 -->
            <div class="pt-4 border-t border-border">
              <h3 class="font-bold text-xs uppercase text-black mb-4">审核结果</h3>
              <div class="space-y-4">
                <div>
                  <label class="block font-bold text-[10px] uppercase text-black mb-2">
                    审核决定 <span class="text-destructive">*</span>
                  </label>
                  <div class="flex gap-4">
                    <label class="flex items-center gap-2 cursor-pointer">
                      <input
                        v-model="reviewResult.decision"
                        type="radio"
                        value="approved"
                        class="w-4 h-4 border border-border rounded-2xl accent-primary"
                        :disabled="!canReview"
                      />
                      <span class=" text-base text-black">通过</span>
                    </label>
                    <label class="flex items-center gap-2 cursor-pointer">
                      <input
                        v-model="reviewResult.decision"
                        type="radio"
                        value="rejected"
                        class="w-4 h-4 border border-border rounded-2xl accent-destructive"
                        :disabled="!canReview"
                      />
                      <span class=" text-base text-black">拒绝</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label class="block font-bold text-xs uppercase text-black mb-2">
                    审核意见 <span class="text-destructive">*</span>
                  </label>
                  <textarea
                    v-model="reviewResult.comments"
                    placeholder="请详细说明审核意见，包括优点、不足和改进建议..."
                    rows="6"
                    class="w-full px-4 py-3 bg-card border border-border rounded-2xl shadow-soft  text-base text-black focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none"
                    :disabled="!canReview"
                    :readonly="!canReview"
                  />
                </div>
              </div>
            </div>

            <!-- 提交按钮 -->
            <div v-if="canReview && (!currentSubmission || currentSubmission.status !== 'completed')" class="flex gap-4 pt-6 border-t border-border">
              <PixelButton
                @click="navigateTo(`/tasks/${taskId}`)"
                variant="secondary"
                size="lg"
                :block="false"
              >
                取消
              </PixelButton>
              <PixelButton
                type="submit"
                variant="primary"
                size="lg"
                :block="false"
                :disabled="!canSubmit || isSubmitting"
              >
                {{ isSubmitting ? '提交中...' : '提交审核' }}
              </PixelButton>
            </div>
            
            <!-- 审核成功后的转账按钮 -->
            <div v-if="canReview && currentSubmission && currentSubmission.status === 'completed'" class="pt-6 border-t border-border">
              <div class="bg-success/20 border border-success shadow-soft p-4 mb-4">
                <p class=" text-base text-black mb-2">
                  <span class="font-bold text-xs">✅</span> 审核已通过！
                </p>
                <p class=" text-sm text-black/70 mb-2">
                  奖励金额：{{ transferData?.reward || 0 }} {{ taskRewardSymbol }}
                </p>
                <!-- 转账状态显示 -->
                <p v-if="(currentSubmission as any).transferredAt" class=" text-sm text-primary">
                  <span class="font-bold text-xs">✓</span> 已转账（{{ formatBeijingTime((currentSubmission as any).transferredAt) }}）
                </p>
                <p v-else class=" text-sm text-warning">
                  <span class="font-bold text-xs">⚠</span> 待转账
                </p>
              </div>
              <!-- 如果未转账，显示转账按钮和标记按钮 -->
              <template v-if="!(currentSubmission as any).transferredAt">
                <PixelButton
                  @click="handleTransferToSemi"
                  variant="primary"
                  size="lg"
                  :block="true"
                  :disabled="isTransferring"
                  class="mb-3"
                >
                  {{ isTransferring ? '处理中...' : '跳转到Semi转账' }}
                </PixelButton>
                <PixelButton
                  @click="handleMarkTransferCompleted"
                  variant="secondary"
                  size="lg"
                  :block="true"
                  :disabled="isMarkingTransfer"
                >
                  {{ isMarkingTransfer ? '标记中...' : '标记为已转账' }}
                </PixelButton>
              </template>
              <!-- 如果已转账，显示已完成转账按钮（可点击取消标记） -->
              <PixelButton
                v-else
                @click="handleUnmarkTransfer"
                variant="success"
                size="lg"
                :block="true"
                :disabled="isMarkingTransfer"
              >
                {{ isMarkingTransfer ? '处理中...' : '已完成转账' }}
              </PixelButton>
            </div>
            
            <!-- 只读模式返回按钮 -->
            <div v-else class="flex gap-4 pt-6 border-t border-border">
              <PixelButton
                @click="navigateTo(`/tasks/${taskId}`)"
                variant="secondary"
                size="lg"
                :block="true"
              >
                返回任务详情
              </PixelButton>
            </div>
          </form>
        </PixelCard>
      </div>
    </div>

    <!-- 拒绝选项弹窗 -->
    <div
      v-if="showRejectModal"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      @click="showRejectModal = false"
    >
      <div
        class="bg-card border border-border rounded-2xl shadow-soft-lg max-w-lg w-full"
        @click.stop
      >
        <div class="p-6">
          <h3 class="font-bold text-sm uppercase text-black mb-4">选择拒绝选项</h3>
          
          <div class="space-y-4 mb-6">
            <!-- 重新提交证明 -->
            <label class="block p-4 bg-gray-50 border border-border rounded-2xl shadow-soft cursor-pointer hover:bg-gray-100 transition-colors" :class="{ 'bg-primary/20 border-primary': rejectOption === 'resubmit' }">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <span class="text-xl">🔄</span>
                  <span class=" text-base text-black">重新提交证明</span>
                </div>
                <div class="relative inline-flex items-center">
                  <input 
                    type="radio" 
                    v-model="rejectOption"
                    value="resubmit"
                    class="w-4 h-4 border border-border rounded-2xl accent-primary"
                  />
                </div>
              </div>
            </label>

            <!-- 重新发布任务 -->
            <label class="block p-4 bg-gray-50 border border-border rounded-2xl shadow-soft cursor-pointer hover:bg-gray-100 transition-colors" :class="{ 'bg-primary/20 border-primary': rejectOption === 'reclaim' }">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <span class="text-xl">📋</span>
                  <span class=" text-base text-black">重新发布任务</span>
                </div>
                <div class="relative inline-flex items-center">
                  <input 
                    type="radio" 
                    v-model="rejectOption"
                    value="reclaim"
                    class="w-4 h-4 border border-border rounded-2xl accent-primary"
                  />
                </div>
              </div>
            </label>

            <!-- 结束任务 -->
            <label class="block p-4 bg-gray-50 border border-border rounded-2xl shadow-soft cursor-pointer hover:bg-gray-100 transition-colors" :class="{ 'bg-destructive/20 border-destructive': rejectOption === 'end' }">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <span class="text-xl">❌</span>
                  <span class=" text-base text-black">结束任务</span>
                </div>
                <div class="relative inline-flex items-center">
                  <input 
                    type="radio" 
                    v-model="rejectOption"
                    value="end"
                    class="w-4 h-4 border border-border rounded-2xl accent-destructive"
                  />
                </div>
              </div>
            </label>
          </div>

          <div class="mb-6">
            <label class="block font-bold text-xs uppercase text-black mb-2">
              审核意见 <span class="text-destructive">*</span>
            </label>
            <textarea
              v-model="reviewResult.comments"
              placeholder="请详细说明审核意见..."
              rows="4"
              class="w-full px-4 py-3 bg-card border border-border rounded-2xl shadow-soft  text-base text-black focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none"
            />
          </div>

          <div class="flex gap-4">
            <PixelButton
              @click="showRejectModal = false"
              variant="secondary"
              size="lg"
              :block="false"
            >
              取消
            </PixelButton>
            <PixelButton
              @click="confirmReject"
              variant="danger"
              size="lg"
              :block="false"
              :disabled="!rejectOption || !reviewResult.comments.trim() || isSubmitting"
            >
              {{ isSubmitting ? '提交中...' : '确认拒绝' }}
            </PixelButton>
          </div>
        </div>
      </div>
    </div>

    <!-- 凭证图片预览弹层 -->
    <Teleport to="body">
      <div
        v-if="previewImageUrl"
        class="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
        @click.self="previewImageUrl = null"
      >
        <div class="relative max-w-[90vw] max-h-[90vh] bg-card rounded-2xl shadow-soft overflow-hidden">
          <img
            v-if="previewImageUrl"
            :src="previewImageUrl"
            alt="预览"
            class="max-w-full max-h-[85vh] w-auto h-auto object-contain"
            @click.stop
          />
          <button
            type="button"
            class="absolute top-2 right-2 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70"
            aria-label="关闭"
            @click="previewImageUrl = null"
          >
            ✕
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { getTaskById, approveTask, rejectTask, getApiBaseUrl, buildSemiTransferUrl, getWalletAddressByUserId, markTransferCompleted } from '~/utils/api'
import { useToast } from '~/composables/useToast'
import { useUserStore } from '~/stores/user'
import PixelCard from '~/components/pixel/PixelCard.vue'
import PixelButton from '~/components/pixel/PixelButton.vue'
import { getTaskRewardSymbol } from '~/utils/display'
import type { Task } from '~/utils/api'
import { formatBeijingTime, parseBeijingTime } from '~/utils/time'
import { watch } from 'vue'


// 获取路由参数
const route = useRoute()
const router = useRouter()
const taskId = (route.query.id || route.params.id) as string  // UUID是字符串，不需要parseInt
const toast = useToast()
const loading = ref(true)
const userStore = useUserStore()

// 响应式数据
const reviewResult = ref<{
  decision: string
  comments: string
}>({
  decision: '',
  comments: ''
})
const isSubmitting = ref(false)
const taskRewardSymbol = ref('积分') // 任务奖励的积分符号

// 拒绝选项弹窗相关状态
const showRejectModal = ref(false)
const rejectOption = ref<'resubmit' | 'reclaim' | 'end' | ''>('')

// 转账相关状态
const transferData = ref<{
  claimerId: string
  reward: number
  creatorId: string
} | null>(null)
const isTransferring = ref(false)
const previewImageUrl = ref<string | null>(null)

// 标记转账相关状态
const isMarkingTransfer = ref(false)

// 任务数据
const task = ref<{
  id: string
  title: string
  description: string
  submissionInstructions?: string
  reward: number
  deadline: string
  submitDeadline?: string
  creatorId: string
  proofConfig?: any
  participantLimit?: number | null
  participantsList?: Array<{
    id: string
    name: string
    claimedAt?: string
    submittedAt?: string
    proof?: string
    status?: string
  }>
}>({
  id: taskId,
  title: '',
  description: '',
  submissionInstructions: '',
  reward: 0,
  deadline: '',
  submitDeadline: '',
  creatorId: '',
  proofConfig: null,
  participantLimit: null,
  participantsList: []
})

// 权限检查：判断当前用户是否是任务创建者
const canReview = computed(() => {
  const result = userStore.user?.id === task.value.creatorId
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/12fcd2f2-6fd8-4340-8068-b1f6eb08d647',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'review.vue:455',message:'canReview computed',data:{userId:userStore.user?.id,creatorId:task.value.creatorId,result,currentSubmissionStatus:currentSubmission.value?.status},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  // #endregion
  return result
})

// 所有参与者的提交数据（多人任务）
const allSubmissions = ref<Array<{
  taskId: string
  submitter: {
    id: string
    name: string
    role: string
  }
  timestamp: string
  description: string
  files: Array<{
    name: string
    size: number
    url: string
    type?: string
  }>
  gpsLocation?: {
    latitude: number
    longitude: number
    accuracy?: number
    timestamp?: number
  } | null
  status: string
  reward?: number
  transferredAt?: string
}>>([])

// 当前选中的提交（用于审核）
const currentSubmissionIndex = ref(0)
const currentSubmission = computed(() => allSubmissions.value[currentSubmissionIndex.value] || null)

// 监听当前参与者的变化，自动更新转账数据
watch(
  [currentSubmission, canReview],
  ([newSubmission, canReviewVal]) => {
    if (newSubmission && newSubmission.status === 'completed' && canReviewVal) {
      transferData.value = {
        claimerId: newSubmission.submitter.id,
        reward: newSubmission.reward || task.value.reward,
        creatorId: task.value.creatorId
      }
    } else {
      transferData.value = null
    }
  },
  { immediate: true }
)

// 向后兼容：单个提交数据（用于单人任务）
const submission = computed(() => {
  if (allSubmissions.value.length === 0) {
    return {
  submitter: {
    name: '',
    role: '参与者'
  },
  timestamp: '',
  description: '',
      files: [],
  gpsLocation: null
    }
  }
  const sub = allSubmissions.value[currentSubmissionIndex.value]
  return {
    submitter: sub.submitter,
    timestamp: sub.timestamp,
    description: sub.description,
    files: sub.files,
    gpsLocation: sub.gpsLocation
  }
})

// 判断是否需要显示文件上传部分
const requiresFileUpload = computed(() => {
  const config = task.value.proofConfig
  if (!config) return false
  return config.photo?.enabled === true
})

// 判断是否需要显示GPS定位信息
const requiresGPS = computed(() => {
  const config = task.value.proofConfig
  if (!config) return false
  return config.gps?.enabled === true
})

// 判断是否需要显示文字描述
const requiresDescription = computed(() => {
  const config = task.value.proofConfig
  if (!config) return false
  return config.description?.enabled === true
})

// 计算属性
const canSubmit = computed(() => {
  return reviewResult.value.decision && reviewResult.value.comments.trim().length > 0
})

// 格式化日期
// 统一使用 UTC+8 北京时间显示，不受机器时区影响
const formatDate = (dateString: string | undefined): string => {
  if (!dateString) return '未设置'
  
  // 使用统一的时间格式化函数
  const beijingTimeStr = formatBeijingTime(dateString)
  if (!beijingTimeStr) return '未设置'
  
  // 解析为 Date 对象用于格式化显示
  const date = parseBeijingTime(beijingTimeStr)
  if (!date || isNaN(date.getTime())) {
    return '未设置'
  }
  
  // 加上 8 小时得到北京时间用于显示
  const beijingDate = new Date(date.getTime() + 8 * 60 * 60 * 1000)
  
  // 使用 UTC 方法读取（因为已经手动偏移了 8 小时）
  const year = beijingDate.getUTCFullYear()
  const month = beijingDate.getUTCMonth()
  const day = beijingDate.getUTCDate()
  const hour = beijingDate.getUTCHours()
  const minute = beijingDate.getUTCMinutes()
  
  // 格式化显示
  const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
  return `${year}年${monthNames[month]}${day}日 ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

// 格式化文件大小
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// 下载文件
const downloadFile = async (file: { name: string; url: string }) => {
  if (!file.url) {
    toast.add({
      title: '无法下载',
      description: '文件URL不存在',
      color: 'red'
    })
    return
  }
  
  try {
    // 对于 data URL，直接下载
    if (file.url.startsWith('data:')) {
      const link = document.createElement('a')
      link.href = file.url
      link.download = file.name
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      return
    }
    
    // 对于 HTTP/HTTPS URL，先获取文件内容再下载
    const response = await fetch(file.url)
    if (!response.ok) {
      throw new Error('下载失败')
    }
    
    const blob = await response.blob()
    const blobUrl = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = blobUrl
    link.download = file.name
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(blobUrl)
    
    toast.add({
      title: '下载成功',
      description: `已下载 ${file.name}`,
      color: 'green'
    })
  } catch (error) {
    console.error('下载文件失败:', error)
    toast.add({
      title: '下载失败',
      description: '无法下载文件，请稍后重试',
      color: 'red'
    })
  }
}

// 预览文件
const previewFile = (file: { name: string; url: string }) => {
  if (!file.url) {
    toast.add({
      title: '无法预览',
      description: '文件URL不存在',
      color: 'red'
    })
    return
  }
  
  const extension = file.name.split('.').pop()?.toLowerCase() || ''
  
  if (['txt', 'text'].includes(extension)) {
    // 文本文件预览：在新窗口打开
    window.open(file.url, '_blank')
  } else if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(extension)) {
    // 图片预览：在页面内弹层大图预览
    previewImageUrl.value = file.url
  } else if (extension === 'pdf') {
    // PDF预览：在新窗口打开
    window.open(file.url, '_blank')
  } else if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(extension)) {
    // Office文档：提示下载或使用在线预览服务
    toast.add({
      title: '预览提示',
      description: 'Office文档需要下载后查看，或使用在线预览服务',
      color: 'blue'
    })
    downloadFile(file)
  } else {
    // 其他文件类型：提示下载
    toast.add({
      title: '预览提示',
      description: '该文件类型不支持预览，请下载后查看',
      color: 'blue'
    })
    downloadFile(file)
  }
}

// 加载任务数据和提交信息
const loadTask = async () => {
  loading.value = true
  try {
    const baseUrl = getApiBaseUrl()
    const taskData = await getTaskById(taskId, baseUrl)
    if (!taskData) {
      toast.add({
        title: '任务不存在',
        description: '无法找到该任务',
        color: 'red'
      })
      router.push('/tasks')
      return
    }
    
    // 转换API数据为页面需要的格式
    task.value = {
      id: taskData.id,
      // scheme A: task_info_id 作为 pool_uuid（semi 侧派生 uint256 poolId）
      taskInfoId: (taskData as any).taskInfoId || (taskData as any).taskInfo?.id,
      title: taskData.title,
      description: taskData.description,
      submissionInstructions: taskData.submissionInstructions || '',
      reward: taskData.reward,
      deadline: taskData.deadline || taskData.createdAt || '', // 领取截止日期
      submitDeadline: taskData.submitDeadline || taskData.deadline || taskData.createdAt || '', // 提交截止日期
      creatorId: taskData.creatorId || '',
      proofConfig: taskData.proofConfig || null,
      participantLimit: taskData.participantLimit || null,
      participantsList: taskData.participantsList || []
    }
    
    // 获取任务奖励的积分符号
    taskRewardSymbol.value = await getTaskRewardSymbol(taskData)
    
    // 处理多人任务：获取所有参与者的提交（包括未领取和未提交的）
    if (taskData.participantsList && Array.isArray(taskData.participantsList) && taskData.participantsList.length > 0) {
      // 获取所有参与者，包括未领取的
      const allParticipants = taskData.participantsList
      
      // 为每个参与者创建提交数据
      allSubmissions.value = allParticipants.map((p: any) => {
          // 解析提交内容
          let proofContent = p.proof || ''
          let files: Array<{ name: string; size: number; url: string; type?: string }> = []
          let gpsLocation: { latitude: number; longitude: number; accuracy?: number; timestamp?: number } | null = null
          let description = ''
          
          try {
            if (proofContent.trim().startsWith('{')) {
              const parsed = JSON.parse(proofContent)
              
              if (parsed.files && Array.isArray(parsed.files)) {
                files = parsed.files.map((file: any) => ({
                  name: file.name || '未命名文件',
                  size: file.size || 0,
                  url: file.url || '',
                  type: file.type || ''
                }))
              }
              
              if (parsed.gps) {
                gpsLocation = {
                  latitude: parsed.gps.latitude || parsed.gps.lat || 0,
                  longitude: parsed.gps.longitude || parsed.gps.lng || 0,
                  accuracy: parsed.gps.accuracy,
                  timestamp: parsed.gps.timestamp
                }
              } else if (parsed.latitude && parsed.longitude) {
                gpsLocation = {
                  latitude: parsed.latitude,
                  longitude: parsed.longitude,
                  accuracy: parsed.accuracy,
                  timestamp: parsed.timestamp
                }
              }
              
              description = parsed.description || ''
            } else if (proofContent.startsWith('位置:')) {
              const match = proofContent.match(/位置:\s*([\d.]+),\s*([\d.]+)/)
              if (match) {
                gpsLocation = {
                  latitude: parseFloat(match[1]),
                  longitude: parseFloat(match[2])
                }
              } else {
                description = proofContent
              }
            } else {
              description = proofContent
            }
          } catch (e) {
            description = proofContent
          }
          
          return {
            taskId: p.id || taskData.id,
            submitter: {
              id: p.claimerId || '',
              name: p.name || '未领取',
              role: '参与者'
            },
            timestamp: p.submittedAt || p.claimedAt || '',
            description: description,
            files: files,
            gpsLocation: gpsLocation,
            status: p.status || (p.claimedAt ? (p.submittedAt ? 'submitted' : 'claimed') : 'unclaimed'),
            receiverRemark: (p.receiver_remark || p.receiverRemark || '').trim().slice(0, 32),
            reward: p.reward || taskData.reward, // 优先使用每个参与者的实际奖励，如果没有则回退到任务基础奖励
            transferredAt: p.transferredAt // ✅ 新增：从后端数据中读取转账状态
          }
        })
      
      // 排序：未审核的（submitted, under_review）、未领取的（unclaimed, claimed, unsubmit）、已审核的（completed, rejected）
      allSubmissions.value.sort((a, b) => {
        const getStatusPriority = (status: string) => {
          // 未审核的：优先级 1
          if (status === 'submitted' || status === 'under_review') return 1
          // 未领取的：优先级 2
          if (status === 'unclaimed' || status === 'claimed' || status === 'unsubmit') return 2
          // 已审核的：优先级 3
          if (status === 'completed' || status === 'rejected') return 3
          return 4
        }
        
        const priorityA = getStatusPriority(a.status)
        const priorityB = getStatusPriority(b.status)
        
        if (priorityA !== priorityB) {
          return priorityA - priorityB
        }
        
        // 相同优先级内，按时间排序（最新的在前）
        return new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
      })
      
      // 如果有多个提交，首先根据URL参数中的taskId找到对应的参与者
      const targetSubmissionIndex = allSubmissions.value.findIndex(
        s => s.taskId === taskId // taskId 是 URL 参数中的任务行ID
      )

      if (targetSubmissionIndex !== -1) {
        // 找到了 URL 参数指定的参与者，直接显示它
        currentSubmissionIndex.value = targetSubmissionIndex
      } else {
        // 如果找不到（可能是旧链接或者数据不一致），使用优先级逻辑
        const firstUnreviewedIndex = allSubmissions.value.findIndex(
          s => s.status === 'submitted' || s.status === 'under_review'
        )
        if (firstUnreviewedIndex !== -1) {
          currentSubmissionIndex.value = firstUnreviewedIndex
        } else {
          // 如果没有未审核的，优先显示第一个已完成的（用于转账）
          const firstCompletedIndex = allSubmissions.value.findIndex(
            s => s.status === 'completed'
          )
          if (firstCompletedIndex !== -1) {
            currentSubmissionIndex.value = firstCompletedIndex
          } else if (allSubmissions.value.length > 0) {
            // 如果也没有已完成的，显示第一个
            currentSubmissionIndex.value = 0
          }
        }
      }
      
    } else if (taskData.claimerName && taskData.submittedAt) {
      // 单人任务：向后兼容
      // 解析提交内容（JSON格式：{description, files, gps, submittedAt}）
      let proofContent = taskData.proof || ''
      let files: Array<{ name: string; size: number; url: string; type?: string }> = []
      let gpsLocation: { latitude: number; longitude: number; accuracy?: number; timestamp?: number } | null = null
      let description = ''
      
      // 尝试解析JSON格式的提交内容
      try {
        if (proofContent.trim().startsWith('{')) {
          const parsed = JSON.parse(proofContent)
          
          // 解析文件列表
          if (parsed.files && Array.isArray(parsed.files)) {
            files = parsed.files.map((file: any) => ({
              name: file.name || '未命名文件',
              size: file.size || 0,
              url: file.url || '',
              type: file.type || ''
            }))
          }
          
          // 解析GPS位置信息
          if (parsed.gps) {
            gpsLocation = {
              latitude: parsed.gps.latitude || parsed.gps.lat || 0,
              longitude: parsed.gps.longitude || parsed.gps.lng || 0,
              accuracy: parsed.gps.accuracy,
              timestamp: parsed.gps.timestamp
            }
          } else if (parsed.latitude && parsed.longitude) {
            // 向后兼容：直接在根级别有经纬度
            gpsLocation = {
              latitude: parsed.latitude,
              longitude: parsed.longitude,
              accuracy: parsed.accuracy,
              timestamp: parsed.timestamp
            }
          }
          
          // 解析文字描述
          description = parsed.description || ''
        } else if (proofContent.startsWith('位置:')) {
          // 处理 "位置: lat, lng" 格式（向后兼容）
          const match = proofContent.match(/位置:\s*([\d.]+),\s*([\d.]+)/)
          if (match) {
            gpsLocation = {
              latitude: parseFloat(match[1]),
              longitude: parseFloat(match[2])
            }
            description = ''
          } else {
            description = proofContent
          }
        } else {
          // 纯文本格式，作为描述
          description = proofContent
        }
      } catch (e) {
        // 如果不是JSON格式，保持原样作为文字描述
        description = proofContent
      }
      
      // 单人任务：添加到提交列表
      allSubmissions.value = [{
        taskId: taskData.id,
        submitter: {
          id: taskData.claimerId || '',
          name: taskData.claimerName,
          role: '参与者'
        },
        timestamp: taskData.submittedAt,
        description: description,
        files: files,
        gpsLocation: gpsLocation,
        status: taskData.status || 'submitted',
        receiverRemark: ((taskData as any).receiverRemark || (taskData as any).receiver_remark || '').trim().slice(0, 32),
        reward: taskData.reward,
        transferredAt: taskData.transferredAt // ✅ 新增：从后端数据中读取转账状态
      }]
      currentSubmissionIndex.value = 0
    }
    
      // 如果没有提交信息，显示提示
    if (allSubmissions.value.length === 0) {
      toast.add({
        title: '提示',
        description: '该任务尚未有参与者提交凭证',
        color: 'yellow'
      })
    }
  } catch (error) {
    console.error('加载任务失败:', error)
    toast.add({
      title: '加载失败',
      description: '无法加载任务详情，请稍后重试',
      color: 'red'
    })
  } finally {
    loading.value = false
  }
}

// 提交审核
const submitReview = async () => {
  if (isSubmitting.value) return
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/12fcd2f2-6fd8-4340-8068-b1f6eb08d647',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'review.vue:917',message:'submitReview called',data:{canSubmit:canSubmit.value,decision:reviewResult.value.decision,canReview:canReview.value},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion

  if (!canSubmit.value) return
  
  // 如果选择拒绝，显示拒绝选项弹窗
  if (reviewResult.value.decision === 'rejected') {
    showRejectModal.value = true
    return
  }
  
  // 审核通过，直接提交
  isSubmitting.value = true
  
  try {
    const baseUrl = getApiBaseUrl()
    // 使用当前选中提交的任务ID
    const targetTaskId = currentSubmission.value?.taskId || taskId
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/12fcd2f2-6fd8-4340-8068-b1f6eb08d647',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'review.vue:933',message:'Before approveTask call',data:{targetTaskId,baseUrl},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    const result = await approveTask(targetTaskId, baseUrl, reviewResult.value.comments)
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/12fcd2f2-6fd8-4340-8068-b1f6eb08d647',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'review.vue:936',message:'After approveTask call',data:{success:result.success,hasData:!!result.data,data:result.data,message:result.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    // 添加调试日志
    console.log('=== 审核结果 ===')
    console.log('result:', JSON.stringify(result, null, 2))
    console.log('result.data:', result.data)
    console.log('result.success:', result.success)
    
    if (result.success) {
      // 更新当前提交的状态，watch会自动更新转账数据
      // 注意：需要直接修改源数组，而不是computed属性
      const currentIndex = currentSubmissionIndex.value
      if (currentIndex >= 0 && currentIndex < allSubmissions.value.length) {
        allSubmissions.value[currentIndex].status = reviewResult.value.decision === 'approved' ? 'completed' : 'rejected'
        // 如果后端返回了奖励金额，更新它
        if (result.data?.reward) {
          allSubmissions.value[currentIndex].reward = result.data.reward
        }
      }
      
      toast.add({
        title: '审核成功',
        description: result.message,
        color: 'green'
      })
      
      // 审核成功后，重新加载任务数据以确保数据完整
      // 这样 allSubmissions 会包含最新的 reward、status 和 transferredAt 等字段
      // transferData 会通过 watch 自动更新，转账按钮会在数据刷新完成后自动显示
      await loadTask()
    } else {
      toast.add({
        title: '审核失败',
        description: result.message,
        color: 'red'
      })
    }
    
  } catch (error) {
    console.error('审核提交失败:', error)
    toast.add({
      title: '审核失败',
      description: '网络错误，请稍后重试',
      color: 'red'
    })
  } finally {
    isSubmitting.value = false
  }
}

// 确认拒绝
const confirmReject = async () => {
  if (isSubmitting.value) return
  if (!rejectOption.value || !reviewResult.value.comments.trim()) return

  // 保存拒绝选项，因为后面会重置
  const selectedOption = rejectOption.value
  isSubmitting.value = true
  
  try {
    const baseUrl = getApiBaseUrl()
    
    // 处理不同的拒绝选项
    let finalOption: 'resubmit' | 'reclaim' | 'rejected' | undefined
    if (selectedOption === 'end') {
      // 结束任务：使用 'rejected' 选项，任务状态变为 rejected，任务关闭并放入已失效
      finalOption = 'rejected'
    } else {
      finalOption = selectedOption as 'resubmit' | 'reclaim'
    }
    
    console.log('[FRONTEND] 审核驳回 - 选项:', selectedOption, '最终选项:', finalOption)
    console.log('[FRONTEND] 审核驳回 - 理由:', reviewResult.value.comments)
    
    // 必须使用当前选中提交对应的任务行 ID，多人任务下禁止用路由 taskId（可能是代表任务 id，会误伤其他人）
    const targetTaskId = currentSubmission.value?.taskId || (task.value.participantLimit && task.value.participantLimit > 1 ? '' : taskId)
    if (!targetTaskId) {
      toast.add({
        title: '无法驳回',
        description: '请先选择要驳回的提交（当前选中的参与者）',
        color: 'red'
      })
      isSubmitting.value = false
      return
    }
    const result = await rejectTask(targetTaskId, reviewResult.value.comments, baseUrl, finalOption)
    
    console.log('[FRONTEND] 审核驳回 - 结果:', result)
    
    if (result.success) {
      console.log('[FRONTEND] 审核驳回成功，准备关闭弹窗并跳转')
      
      toast.add({
        title: '审核成功',
        description: result.message,
        color: 'green'
      })
      
      // 关闭弹窗（必须在跳转前关闭）
      showRejectModal.value = false
      rejectOption.value = ''
      reviewResult.value.comments = '' // 清空审核意见
      
      console.log('[FRONTEND] 弹窗已关闭，准备跳转')
      
      // 如果选择结束任务，确保任务状态更新为 rejected
      // 提交成功后跳转到任务详情页，并刷新数据
      if (selectedOption === 'end') {
        console.log('[FRONTEND] 选择了结束任务，延迟500ms后跳转')
        // 延迟一下，确保后端状态已更新
        await new Promise(resolve => setTimeout(resolve, 500))
      }
      
      const redirectPath = `/tasks/${taskId}?reviewed=true&rejected=${selectedOption === 'end' ? 'true' : 'false'}`
      console.log('[FRONTEND] 跳转到:', redirectPath)
      await router.push(redirectPath)
    } else {
      console.error('[FRONTEND] 审核驳回失败:', result.message)
      toast.add({
        title: '审核失败',
        description: result.message,
        color: 'red'
      })
    }
    
  } catch (error) {
    console.error('审核提交失败:', error)
    toast.add({
      title: '审核失败',
      description: '网络错误，请稍后重试',
      color: 'red'
    })
  } finally {
    isSubmitting.value = false
  }
}

// 跳转到Semi转账页面
const handleTransferToSemi = async () => {
  if (!transferData.value) {
    console.error('转账数据不存在')
    toast.add({
      title: '无法转账',
      description: '转账数据不存在，请重新审核',
      color: 'red'
    })
    return
  }

  isTransferring.value = true
  
  // 先同步打开空白页，避免异步后 window.open 被拦截
  const newWindow = window.open('about:blank', '_blank')
  if (!newWindow) {
    console.error('浏览器阻止了弹窗')
    toast.add({
      title: '无法打开转账页面',
      description: '浏览器阻止了弹窗，请允许弹窗后重试',
      color: 'orange'
    })
    isTransferring.value = false
    return
  }

  try {
    // 给空白页一个轻提示，减少“白屏感”
    newWindow.document.title = '正在跳转…'
    newWindow.document.body.innerHTML = `
      <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; padding: 24px; color: #111;">
        <div style="font-size: 16px; font-weight: 600; margin-bottom: 8px;">正在跳转到 Semi…</div>
        <div style="font-size: 13px; color: #555;">请稍候，如果没有自动跳转请返回重试。</div>
      </div>
    `
  } catch (e) {
    // 某些浏览器策略下可能不允许操作新窗口 document，忽略即可
  }

  try {
    const config = useRuntimeConfig()
    const semiAppUrl = config.public.semiAppUrl as string
    const baseUrl = getApiBaseUrl()
    const { claimerId, reward, creatorId } = transferData.value
    
    console.log('=== 开始处理转账跳转 ===')
    console.log('claimerId:', claimerId, 'reward:', reward, 'creatorId:', creatorId)

    // 并行获取创建者/参与者钱包地址（更快，也更不容易被弹窗策略影响）
    const [creatorAddress, claimerAddress] = await Promise.all([
      getWalletAddressByUserId(creatorId, baseUrl),
      getWalletAddressByUserId(claimerId, baseUrl),
    ])
    console.log('创建者钱包地址:', creatorAddress)
    console.log('参与者钱包地址:', claimerAddress)

    // 检查钱包地址
    if (!creatorAddress) {
      console.warn('创建者未绑定钱包')
      toast.add({
        title:'无法转账',
        description: '创建者未绑定钱包，无法转账',
        color: 'orange'
      })
      try { newWindow.close() } catch (e) {}
      return
    }
    
    if (!claimerAddress) {
      console.warn('参与者未绑定钱包')
      toast.add({
        title: '无法转账',
        description: '参与者未绑定钱包，无法转账',
        color: 'orange'
      })
      try { newWindow.close() } catch (e) {}
      return
    }

    // 生成默认 memo（公开上链，最多 32 字，可修改）
    const now = new Date()
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const dd = String(now.getDate()).padStart(2, '0')
    const hh = String(now.getHours()).padStart(2, '0')
    const mi = String(now.getMinutes()).padStart(2, '0')
    const shortTime = `${mm}${dd}-${hh}:${mi}`
    const defaultMemo = `任务：《${task.value.title || ''}》${shortTime}`.slice(0, 32)
    // 不再弹窗；直接带默认 memo 到 semi，再由用户在 semi 页面修改
    const memo = defaultMemo.trim().slice(0, 32)

    const targetTaskId = currentSubmission.value?.taskId || taskId
    let receiverRemark = (currentSubmission.value as any)?.receiverRemark?.trim().slice(0, 32) || ''
    if (!receiverRemark) {
      const latestTask = await getTaskById(targetTaskId, baseUrl)
      const rootRemark = (((latestTask as any)?.receiverRemark ?? (latestTask as any)?.receiver_remark ?? '') as string).trim().slice(0, 32)
      if (rootRemark) {
        receiverRemark = rootRemark
      } else {
        const matchedParticipant = Array.isArray((latestTask as any)?.participantsList)
          ? (latestTask as any).participantsList.find((p: any) => String(p?.id || p?.taskId || '') === String(targetTaskId))
          : null
        receiverRemark = (((matchedParticipant?.receiverRemark ?? matchedParticipant?.receiver_remark ?? '') as string).trim().slice(0, 32))
      }
    }
    const poolUuid = ((task.value as any)?.taskInfoId || '').toString()

    // 构造并跳转到semi转账页面
    const transferUrl = buildSemiTransferUrl(
      claimerAddress, // 接收方：参与者的钱包地址
      reward.toString(), // 转账金额
      {
        semiAppUrl,
        // scheme A: semi 用 pool_uuid/task_uuid 来派生 uint256 poolId/taskId
        pool_uuid: poolUuid || undefined,
        task_uuid: targetTaskId,
        // backward compat: 保留旧参数（不依赖，但不破坏旧逻辑）
        task_id: targetTaskId,
        memo,
        receiver_remark: receiverRemark,
      }
    )
    console.log('转账URL:', transferUrl)
    
    // 使用已打开的窗口跳转到 semi
    try {
      newWindow.location.href = transferUrl
    } catch (e) {
      // 兜底：如果被浏览器限制，尝试直接打开
      window.open(transferUrl, '_blank')
    }
    console.log('✅ 已打开转账页面')
    toast.add({
      title: '已打开转账页面',
      description: '请在 Semi 页面完成转账后，返回标记为已转账',
      color: 'green'
    })
  } catch (error) {
    console.error('获取钱包地址失败：', error)
    toast.add({
      title:'无法转账',
      description: '获取钱包地址失败，请稍后重试',
      color: 'orange'
    })
    try { newWindow.close() } catch (e) {}
  } finally {
    isTransferring.value = false
  }
}

// 标记转账完成
const handleMarkTransferCompleted = async () => {
  if (!currentSubmission.value) {
    console.error('当前参与者不存在')
    return
  }

  console.log('=== 标记转账调试 ===')
  console.log('1. 更新前 currentSubmission:', currentSubmission.value)
  console.log('2. 更新前 transferredAt:', (currentSubmission.value as any).transferredAt)
  console.log('3. currentIndex:', currentSubmissionIndex.value)
  console.log('4. allSubmissions.length:', allSubmissions.value.length)

  isMarkingTransfer.value = true
  
  try {
    const baseUrl = getApiBaseUrl()
    const targetTaskId = currentSubmission.value.taskId || taskId
    
    console.log('5. 调用API，taskId:', targetTaskId, 'baseUrl:', baseUrl)
    const result = await markTransferCompleted(targetTaskId, baseUrl)
    
    console.log('6. API返回结果:', result)
    console.log('7. result.success:', result.success)
    console.log('8. result.data:', result.data)
    console.log('9. result.data?.transferredAt:', result.data?.transferredAt)
    
    if (result.success) {
      toast.add({
        title: '标记成功',
        description: result.message,
        color: 'green'
      })
      
      // 自动跳转到任务详情页面，页面会自动刷新显示已转账状态
      router.push(`/tasks/${targetTaskId}?reviewed=true`)
    } else {
      console.error('❌ 标记失败:', result.message)
      toast.add({
        title: '标记失败',
        description: result.message,
        color: 'red'
      })
    }
  } catch (error) {
    console.error('❌ 标记转账完成失败：', error)
    toast.add({
      title: '标记失败',
      description: '网络错误，请稍后重试',
      color: 'red'
    })
  } finally {
    isMarkingTransfer.value = false
  }
}

// 取消标记转账（将transferredAt设为null）
const handleUnmarkTransfer = async () => {
  if (!currentSubmission.value) {
    console.error('当前参与者不存在')
    return
  }

  console.log('=== 取消标记转账调试 ===')
  console.log('1. 取消前 currentSubmission:', currentSubmission.value)
  console.log('2. 取消前 transferredAt:', (currentSubmission.value as any).transferredAt)
  console.log('3. currentIndex:', currentSubmissionIndex.value)

  isMarkingTransfer.value = true
  
  try {
    // 获取当前提交的 taskId
    const targetTaskId = currentSubmission.value.taskId || taskId
    
    // 使用 taskId 查找对应的提交，而不是使用索引
    // 这样可以避免 loadTask() 重新创建数组后索引不匹配的问题
    const targetSubmissionIndex = allSubmissions.value.findIndex(
      s => s.taskId === targetTaskId
    )
    console.log('4. 准备取消标记，targetTaskId:', targetTaskId, 'targetSubmissionIndex:', targetSubmissionIndex)
    
    if (targetSubmissionIndex >= 0) {
      (allSubmissions.value[targetSubmissionIndex] as any).transferredAt = undefined
      
      // 确保 currentSubmissionIndex 指向正确的索引，这样 UI 才会更新
      if (targetSubmissionIndex !== currentSubmissionIndex.value) {
        currentSubmissionIndex.value = targetSubmissionIndex
      }
      
      console.log('5. 取消后的 submission taskId:', allSubmissions.value[targetSubmissionIndex]?.taskId, 'transferredAt:', (allSubmissions.value[targetSubmissionIndex] as any)?.transferredAt)
      console.log('6. 取消后的 currentSubmission taskId:', currentSubmission.value?.taskId, 'transferredAt:', (currentSubmission.value as any)?.transferredAt)
    } else {
      console.error('❌ 找不到对应的提交，targetTaskId:', targetTaskId)
    }
    
    toast.add({
      title: '已取消标记',
      description: '转账标记已取消',
      color: 'green'
    })
  } catch (error) {
    console.error('❌ 取消标记转账失败：', error)
    toast.add({
      title: '取消标记失败',
      description: '网络错误，请稍后重试',
      color: 'red'
    })
  } finally {
    isMarkingTransfer.value = false
  }
}

// 导航函数
const navigateTo = (path: string) => {
  router.push(path)
}


// 组件挂载时加载任务数据
onMounted(async () => {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/12fcd2f2-6fd8-4340-8068-b1f6eb08d647',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'review.vue:1197',message:'Component mounted',data:{currentSubmissionStatus:currentSubmission.value?.status,transferData:transferData.value},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
  // #endregion
  
  // 确保用户信息已加载
  await userStore.getUser()
  await loadTask()
  
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/12fcd2f2-6fd8-4340-8068-b1f6eb08d647',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'review.vue:1205',message:'After loadTask',data:{currentSubmissionStatus:currentSubmission.value?.status,transferData:transferData.value,taskCreatorId:task.value.creatorId,userId:userStore.user?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
  // #endregion
})
</script>

