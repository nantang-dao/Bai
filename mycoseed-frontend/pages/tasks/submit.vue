<template>
  <div class="min-h-screen bg-background py-4 md:py-8">
    <div class="container mx-auto px-4 md:px-6 max-w-4xl">
      <!-- 返回按钮 -->
      <div class="mb-6">
        <TechButton
          @click="navigateTo(`/tasks/${taskId}`)"
          variant="secondary"
          size="sm"
        >
          ← 返回任务详情
        </TechButton>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="text-center py-12">
        <div class="text-lg text-text-body animate-pulse">加载中...</div>
      </div>

      <!-- 提交表单 -->
      <div v-else>
        <TechCard>
          <template #header>
            提交任务
          </template>
          
          <p class=" text-lg text-text-title mb-6">
            <span v-if="requiresFileUpload">请上传您的任务完成证明和相关文件</span>
            <span v-else-if="requiresDescription">请填写任务完成说明</span>
            <span v-else>请提交任务</span>
          </p>
          
          <form @submit.prevent="submitForm" class="space-y-6">
            <!-- 任务信息 -->
            <div class="bg-card border border-border rounded-2xl shadow-soft p-4">
              <h3 class="font-bold text-xs uppercase text-text-title mb-2">{{ task.title }}</h3>
              <p class=" text-base text-text-title mb-3">{{ task.description }}</p>
              <div class="flex items-center gap-3 flex-wrap">
                <span class="px-3 py-1.5 bg-primary text-white border border-border rounded-2xl shadow-soft font-bold text-[10px] uppercase">
                  {{ task.reward }} {{ taskRewardSymbol }}
                </span>
                <div class="flex flex-col gap-1">
                  <span class=" text-sm text-text-title">领取截止: {{ formatDate(task.deadline) }}</span>
                  <span class=" text-sm text-text-title">提交截止: {{ formatDate(task.submitDeadline || task.deadline) }}</span>
                </div>
              </div>
            </div>

            <!-- 提交说明 -->
            <div class="pt-4 border-t border-border">
              <h3 class="font-bold text-xs uppercase text-text-title mb-2">提交说明</h3>
              <p class=" text-base text-text-title">{{ task.submissionInstructions || '请按照任务要求完成并提交相关凭证。' }}</p>
            </div>

            <!-- 任务感想（上链备注，最多32字，可修改） -->
            <div class="pt-4 border-t border-border">
              <label class="block font-bold text-xs uppercase text-text-title mb-2">
                任务感想（会随交易记录一起上链，最多32字，可修改）
              </label>
              <input
                v-model="receiverRemark"
                :maxlength="32"
                class="w-full px-4 py-3 bg-input-bg border border-border rounded-2xl shadow-soft text-base text-text-title focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                placeholder="写一句感想吧"
              />
              <p class="text-xs text-text-placeholder mt-1">{{ receiverRemark.length }} / 32</p>
            </div>

            <!-- 文件上传 -->
            <div v-if="requiresFileUpload" class="pt-4 border-t border-border">
              <h3 class="font-bold text-xs uppercase text-text-title mb-4">上传文件</h3>
              <div class="space-y-4">
                <!-- 主要证明文件 -->
                <div>
                  <label class="block font-bold text-[10px] uppercase text-text-title mb-2">
                    主要证明文件 <span class="text-destructive">*</span>
                  </label>
                  <div 
                    @click="triggerFileInput('main')"
                    class="border-2 border-dashed border-black bg-card p-6 md:p-8 text-center cursor-pointer hover:-translate-y-0.5 hover:shadow-soft transition-all"
                    :class="{ 'border-destructive shadow-soft': dragOver }"
                    @dragover.prevent="dragOver = true"
                    @dragleave="dragOver = false"
                    @drop.prevent="handleFileDrop($event, 'main')"
                  >
                    <div class="text-4xl mb-3">☁️</div>
                    <p class=" text-base text-text-title font-medium mb-1">点击上传或拖拽文件到此处</p>
                    <p class=" text-sm text-text-title/70">支持 {{ allowedFileTypesText }} 格式</p>
                    <p class=" text-xs text-text-title/60 mt-1">最大 10MB</p>
                  </div>
                  <input
                    ref="mainFileInput"
                    type="file"
                    class="hidden"
                    :accept="allowedFileTypes"
                    @change="handleFileSelect($event, 'main')"
                  />
                  
                  <!-- 已选择的文件 -->
                  <div v-if="selectedFiles.main" class="mt-3 p-3 bg-card border border-border rounded-2xl shadow-soft">
                    <div class="flex items-center gap-3">
                      <span class="text-2xl">📄</span>
                      <div class="flex-1">
                        <div class=" text-sm text-text-title font-medium">{{ selectedFiles.main.name }}</div>
                        <div class=" text-xs text-text-title/60">({{ formatFileSize(selectedFiles.main.size) }})</div>
                      </div>
                      <TechButton
                        @click="removeFile('main')"
                        variant="destructive"
                        size="sm"
                      >
                        移除
                      </TechButton>
                    </div>
                  </div>
                </div>

                <!-- 附加文件 -->
                <div>
                  <label class="block font-bold text-[10px] uppercase text-text-title mb-2">
                    附加文件 (可选)
                  </label>
                  <div 
                    @click="triggerFileInput('additional')"
                    class="border-2 border-dashed border-black bg-card p-4 md:p-6 text-center cursor-pointer hover:-translate-y-0.5 hover:shadow-soft transition-all"
                  >
                    <div class="text-2xl mb-2">➕</div>
                    <p class=" text-sm text-text-title">添加更多文件</p>
                  </div>
                  <input
                    ref="additionalFileInput"
                    type="file"
                    multiple
                    class="hidden"
                    :accept="allowedFileTypes"
                    @change="handleFileSelect($event, 'additional')"
                  />
                  
                  <!-- 已选择的附加文件 -->
                  <div v-if="selectedFiles.additional.length > 0" class="mt-3 space-y-2">
                    <div
                      v-for="(file, index) in selectedFiles.additional"
                      :key="index"
                      class="p-3 bg-card border border-border rounded-2xl shadow-soft"
                    >
                      <div class="flex items-center gap-3">
                        <span class="text-2xl">📄</span>
                        <div class="flex-1">
                          <div class=" text-sm text-text-title font-medium">{{ file.name }}</div>
                          <div class=" text-xs text-text-title/60">({{ formatFileSize(file.size) }})</div>
                        </div>
                        <TechButton
                          @click="removeFile('additional', index)"
                          variant="destructive"
                          size="sm"
                        >
                          移除
                        </TechButton>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 位置定位验证：暂未开放，已隐藏 -->
            <div v-if="false && requiresGPS" class="pt-4 border-t border-border">
              <h3 class="font-bold text-xs uppercase text-text-title mb-4">位置定位验证</h3>
              <div class="space-y-3">
                <div v-if="!gpsLocation.latitude" class="p-4 bg-card border border-border rounded-2xl shadow-soft">
                  <p class=" text-base text-text-title mb-3">请获取您当前的位置信息</p>
                  <TechButton
                    @click="getGPSLocation"
                    :disabled="isGettingLocation"
                    variant="primary"
                    size="md"
                    class="w-full"
                  >
                    {{ isGettingLocation ? '获取位置中...' : '📍 获取位置' }}
                  </TechButton>
                  <p v-if="locationError" class="mt-2  text-sm text-destructive">
                    {{ locationError }}
                  </p>
                </div>
                <div v-else class="p-4 bg-green-50 border-2 border-green-600 shadow-soft">
                  <div class="flex items-center gap-2 mb-2">
                    <span class="text-2xl">✅</span>
                    <span class="font-bold text-xs uppercase text-green-800">位置已验证</span>
                  </div>
                  <div class=" text-sm text-text-title space-y-1">
                    <div>纬度: {{ gpsLocation.latitude?.toFixed(6) }}</div>
                    <div>经度: {{ gpsLocation.longitude?.toFixed(6) }}</div>
                    <div v-if="gpsLocation.accuracy">精度: ±{{ Math.round(gpsLocation.accuracy) }}米</div>
                  </div>
                  <TechButton
                    @click="getGPSLocation"
                    :disabled="isGettingLocation"
                    variant="secondary"
                    size="sm"
                    class="mt-3"
                  >
                    {{ isGettingLocation ? '重新获取中...' : '重新获取位置' }}
                  </TechButton>
                </div>
              </div>
            </div>

            <!-- 提交说明输入 -->
            <div v-if="requiresDescription" class="pt-4 border-t border-border">
              <label class="block font-bold text-xs uppercase text-text-title mb-2">
                提交说明 <span class="text-destructive">*</span>
              </label>
              <textarea
                v-model="submissionDescription"
                :placeholder="task.proofConfig?.description?.prompt || '请详细描述您完成的任务内容，包括主要工作、技术实现、遇到的问题和解决方案等...'"
                rows="6"
                class="w-full px-4 py-3 bg-input-bg border border-border rounded-2xl shadow-soft text-base text-text-title focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-card transition-all resize-none"
              />
              <p v-if="task.proofConfig?.description?.minWords" class="mt-2  text-xs" :class="isValidDescription ? 'text-text-title/60' : 'text-destructive'">
                最少字数: {{ task.proofConfig.description.minWords }} 字
                <span v-if="submissionDescription.trim().length > 0">
                  (当前: {{ submissionDescription.trim().length }} 字)
                </span>
                <span v-if="!isValidDescription" class="block mt-1">
                  ⚠️ 字数不足，请至少输入 {{ task.proofConfig.description.minWords }} 字
                </span>
              </p>
            </div>

            <!-- 提交按钮 -->
            <div class="flex gap-4 pt-6 border-t border-border">
              <TechButton
                @click="navigateTo(`/tasks/${taskId}`)"
                variant="secondary"
                size="lg"
                :block="false"
              >
                取消
              </TechButton>
              <TechButton
                type="submit"
                variant="primary"
                size="lg"
                :block="false"
                :disabled="!canSubmit || isSubmitting"
              >
                {{ isSubmitting ? '提交中...' : '提交任务' }}
              </TechButton>
            </div>
          </form>
        </TechCard>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getTaskById, getApiBaseUrl, submitProof, uploadProofFile, type ProofData } from '~/utils/api'
import { useToast } from '~/composables/useToast'
import { getTaskRewardSymbol } from '~/utils/display'
import type { Task } from '~/utils/api'
import { formatBeijingTime, parseBeijingTime } from '~/utils/time'

// 高德地图类型声明
declare global {
  interface Window {
    AMap: any
    initAmap?: () => void
  }
}

// 获取路由参数
const route = useRoute()
const router = useRouter()
const taskId = (route.query.id || route.params.id) as string  // UUID是字符串，不需要parseInt
const toast = useToast()
const loading = ref(true)

// 响应式数据
const selectedFiles = ref<{
  main: File | null
  additional: File[]
}>({
  main: null,
  additional: []
})
const submissionDescription = ref('')
const receiverRemark = ref('')
const isSubmitting = ref(false)
const dragOver = ref(false)
const taskRewardSymbol = ref('积分') // 任务奖励的积分符号

// 文件输入引用
const mainFileInput = ref<HTMLInputElement | null>(null)
const additionalFileInput = ref<HTMLInputElement | null>(null)

// 任务数据
const task = ref<{
  id: number
  title: string
  description: string
  reward: number
  deadline: string
  submitDeadline?: string
  submissionInstructions: string
  proofConfig?: any
}>({
  id: taskId,
  title: '',
  description: '',
  reward: 0,
  deadline: '',
  submitDeadline: '',
  submissionInstructions: '请按照任务要求完成并提交相关凭证。',
  proofConfig: null
})

// 加载任务详情
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
      title: taskData.title,
      description: taskData.description,
      reward: taskData.reward,
      deadline: taskData.deadline || taskData.createdAt, // 领取截止日期
      submitDeadline: taskData.submitDeadline || taskData.deadline || taskData.createdAt, // 提交截止日期
      submissionInstructions: taskData.submissionInstructions || '请按照任务要求完成并提交相关凭证。',
      proofConfig: taskData.proofConfig || null // 保存证明配置用于动态设置文件类型
    }
    
    // 获取任务奖励的积分符号
    taskRewardSymbol.value = await getTaskRewardSymbol(taskData)
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

// 默认生成「任务感想」（不带 task_id，短时间格式），用户可编辑覆盖
watch(
  () => task.value?.title,
  (title) => {
    if (!title) return
    if (receiverRemark.value.trim()) return

    const now = new Date()
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const dd = String(now.getDate()).padStart(2, '0')
    const hh = String(now.getHours()).padStart(2, '0')
    const mi = String(now.getMinutes()).padStart(2, '0')
    const shortTime = `${mm}${dd}-${hh}:${mi}`
    receiverRemark.value = `完成任务：《${title}》${shortTime}`.slice(0, 32)
  },
  { immediate: true }
)

// 判断是否需要文件上传
const requiresFileUpload = computed(() => {
  const config = task.value.proofConfig
  if (!config) return false
  
  // 如果启用了照片证据，需要文件上传
  if (config.photo?.enabled) return true
  
  return false
})

// 判断是否需要GPS定位验证
const requiresGPS = computed(() => {
  const config = task.value.proofConfig
  if (!config) return false
  
  // 如果启用了GPS定位，需要位置验证
  return config.gps?.enabled === true
})

// 判断是否需要文字描述
const requiresDescription = computed(() => {
  const config = task.value.proofConfig
  if (!config) return false
  
  // 如果启用了文字描述，需要填写说明
  return config.description?.enabled === true
})

// GPS位置数据
const gpsLocation = ref<{
  latitude: number | null
  longitude: number | null
  accuracy: number | null
  timestamp: number | null
}>({
  latitude: null,
  longitude: null,
  accuracy: null,
  timestamp: null
})

const isGettingLocation = ref(false)
const locationError = ref('')

// 加载高德地图API
const loadAmapScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    // 检查是否已经加载
    if (window.AMap) {
      resolve()
      return
    }

    const config = useRuntimeConfig()
    const apiKey = config.public.amapApiKey || 'YOUR_AMAP_API_KEY_HERE'
    const script = document.createElement('script')
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${apiKey}&callback=initAmap`
    script.async = true
    script.defer = true

    // 设置全局回调
    ;(window as any).initAmap = () => {
      resolve()
      delete (window as any).initAmap
    }

    script.onerror = () => {
      reject(new Error('加载高德地图API失败'))
    }

    document.head.appendChild(script)
  })
}

// 获取GPS位置（使用高德地图API）
const getGPSLocation = async () => {
  isGettingLocation.value = true
  locationError.value = ''

  try {
    // 加载高德地图API
    await loadAmapScript()

    // 使用高德地图定位
    const geolocation = new (window as any).AMap.Geolocation({
      enableHighAccuracy: task.value.proofConfig?.gps?.accuracy === 'high',
      timeout: 10000,
      maximumAge: 0,
      convert: true, // 自动偏移坐标，偏移后的坐标为高德坐标
      showButton: false, // 不显示定位按钮
      buttonDom: '', // 定位按钮的停靠位置
      showMarker: false, // 不显示定位标记
      showCircle: false, // 不显示定位精度圆圈
      panToLocation: false, // 定位成功后将定位到的位置作为地图中心点
      zoomToAccuracy: false // 定位成功后调整地图视野范围使定位位置及精度范围视野内可见
    })

    // 获取当前位置
    const position = await new Promise<any>((resolve, reject) => {
      geolocation.getCurrentPosition((status: string, result: any) => {
        if (status === 'complete') {
          resolve(result)
        } else {
          reject(new Error(result.message || '定位失败'))
        }
      })
    })

    // 保存位置信息
    gpsLocation.value = {
      latitude: position.position.lat,
      longitude: position.position.lng,
      accuracy: position.accuracy || null,
      timestamp: Date.now()
    }
  } catch (error: any) {
    console.error('获取位置失败:', error)
    locationError.value = error.message || '无法获取您的位置，请检查位置权限设置'
  } finally {
    isGettingLocation.value = false
  }
}

// 验证文字描述是否符合最小字数要求
const isValidDescription = computed(() => {
  if (!requiresDescription.value) return true
  
  const minWords = task.value.proofConfig?.description?.minWords || 0
  const currentLength = submissionDescription.value.trim().length
  
  return currentLength >= minWords
})

// 计算属性
const canSubmit = computed(() => {
  // 如果需要文件上传，则必须上传文件
  if (requiresFileUpload.value) {
    const hasFile = selectedFiles.value.main !== null
    const hasGPS = requiresGPS.value ? (gpsLocation.value.latitude !== null && gpsLocation.value.longitude !== null) : true
    const hasDescription = requiresDescription.value ? isValidDescription.value : true
    return hasFile && hasGPS && hasDescription
  }
  
  // 如果需要GPS定位，必须获取位置
  if (requiresGPS.value) {
    return gpsLocation.value.latitude !== null && gpsLocation.value.longitude !== null
  }
  
  // 如果需要文字描述，必须填写说明并满足最小字数
  if (requiresDescription.value) {
    return isValidDescription.value
  }
  
  // 如果没有任何要求，可以直接提交
  return true
})

// 根据 proofConfig 动态生成允许的文件类型
const allowedFileTypes = computed(() => {
  const types: string[] = []
  
  // 始终允许文档格式
  types.push('.pdf', '.doc', '.docx', '.txt')
  
  // 如果启用了照片要求，添加图片格式
  if (task.value.proofConfig?.photo?.enabled) {
    types.push('.png', '.jpg', '.jpeg', '.gif', '.webp')
  }
  
  // 如果只有文字描述要求，也允许文档格式（已经在上面添加了）
  
  return types.join(',')
})

// 生成文件类型提示文本
const allowedFileTypesText = computed(() => {
  const parts: string[] = []
  
  // 文档格式
  const docFormats = ['PDF', 'DOC', 'DOCX', 'TXT']
  parts.push(docFormats.join(', '))
  
  // 如果启用了照片要求，添加图片格式
  if (task.value.proofConfig?.photo?.enabled) {
    const imageFormats = ['PNG', 'JPG', 'JPEG']
    parts.push(imageFormats.join(', '))
  }
  
  return parts.join(', ')
})

// 触发文件输入
const triggerFileInput = (type: 'main' | 'additional') => {
  if (type === 'main') {
    mainFileInput.value?.click()
  } else {
    additionalFileInput.value?.click()
  }
}

// 处理文件选择
const handleFileSelect = (event: Event, type: 'main' | 'additional') => {
  const target = event.target as HTMLInputElement
  const files = Array.from(target.files || [])
  if (type === 'main') {
    selectedFiles.value.main = files[0] || null
  } else {
    selectedFiles.value.additional = [...selectedFiles.value.additional, ...files]
  }
}

// 处理文件拖拽
const handleFileDrop = (event: DragEvent, type: 'main' | 'additional') => {
  dragOver.value = false
  const files = Array.from(event.dataTransfer?.files || [])
  if (type === 'main') {
    selectedFiles.value.main = files[0] || null
  } else {
    selectedFiles.value.additional = [...selectedFiles.value.additional, ...files]
  }
}

// 移除文件
const removeFile = (type: 'main' | 'additional', index?: number) => {
  if (type === 'main') {
    selectedFiles.value.main = null
  } else if (index !== undefined) {
    selectedFiles.value.additional.splice(index, 1)
  }
}

// 格式化文件大小
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

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

// 提交表单
const submitForm = async () => {
  if (isSubmitting.value) return
  if (!canSubmit.value) return

  isSubmitting.value = true
  
  try {
    // 创建FormData
    const formData = new FormData()
    formData.append('taskId', taskId)
    
    // 添加文字描述（如果需要）
    if (requiresDescription.value) {
      formData.append('description', submissionDescription.value)
    }
    
    // 添加文件（如果需要）
    if (requiresFileUpload.value && selectedFiles.value.main) {
      formData.append('mainFile', selectedFiles.value.main)
    }
    
    selectedFiles.value.additional.forEach((file, index) => {
      formData.append(`additionalFile${index}`, file)
    })
    
    // 添加GPS位置（如果需要）
    if (requiresGPS.value && gpsLocation.value.latitude && gpsLocation.value.longitude) {
      formData.append('gps', JSON.stringify({
        latitude: gpsLocation.value.latitude,
        longitude: gpsLocation.value.longitude,
        accuracy: gpsLocation.value.accuracy,
        timestamp: gpsLocation.value.timestamp
      }))
    }
    
    // 模拟API调用
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // 构建提交内容
    // 如果有GPS位置，优先保存GPS位置信息（JSON格式）
    let proofContent = ''
    
    if (requiresGPS.value && gpsLocation.value.latitude && gpsLocation.value.longitude) {
      // 如果有GPS位置，保存为JSON格式
      proofContent = JSON.stringify({
        latitude: gpsLocation.value.latitude,
        longitude: gpsLocation.value.longitude,
        accuracy: gpsLocation.value.accuracy,
        timestamp: gpsLocation.value.timestamp
      })
      
      // 如果有文字描述，追加到JSON中（作为description字段）
      if (requiresDescription.value && submissionDescription.value.trim()) {
        const gpsData = JSON.parse(proofContent)
        gpsData.description = submissionDescription.value.trim()
        proofContent = JSON.stringify(gpsData)
      }
    } else if (requiresDescription.value) {
      // 如果只有文字描述，直接使用描述内容
      proofContent = submissionDescription.value.trim()
    } else {
      // 如果没有任何要求，使用默认内容
      proofContent = '任务完成'
    }
    
    console.log('提交任务:', {
      taskId,
      description: requiresDescription.value ? submissionDescription.value : undefined,
      files: requiresFileUpload.value ? {
        main: selectedFiles.value.main?.name,
        additional: selectedFiles.value.additional.map(f => f.name)
      } : undefined,
      gps: requiresGPS.value ? gpsLocation.value : undefined,
      proofContent
    })
    
    // 调用API提交凭证
    const baseUrl = getApiBaseUrl()
    
    // 解析 proofContent 字符串为 ProofData 对象
    let proofData: ProofData
    try {
      // 尝试解析为 JSON（可能包含 GPS 数据）
      const parsed = JSON.parse(proofContent)
      proofData = {
        description: parsed.description || proofContent, // 如果没有 description 字段，使用原始内容
        files: [], // 文件需要先上传，这里暂时为空
        gps: parsed.latitude && parsed.longitude ? {
          latitude: parsed.latitude,
          longitude: parsed.longitude,
          accuracy: parsed.accuracy,
          timestamp: parsed.timestamp ? new Date(parsed.timestamp).toISOString() : new Date().toISOString()
        } : undefined,
        submittedAt: new Date().toISOString()
      }
    } catch (e) {
      // 如果不是 JSON，就是纯文本描述
      proofData = {
        description: proofContent,
        files: [],
        submittedAt: new Date().toISOString()
      }
    }
    
    // 如果有文件，先上传文件
    if (requiresFileUpload.value && (selectedFiles.value.main || selectedFiles.value.additional.length > 0)) {
      try {
        const files: File[] = []
        if (selectedFiles.value.main) files.push(selectedFiles.value.main)
        files.push(...selectedFiles.value.additional)
        
        // 上传文件
        const uploadedFiles = await uploadProofFile(files, String(taskId), baseUrl)
        proofData.files = uploadedFiles.map(f => ({
          url: f.url,
          hash: f.hash,
          name: f.name,
          size: f.size,
          type: f.type
        }))
      } catch (e) {
        console.error('文件上传失败:', e)
        // 继续执行，但 files 为空
      }
    }
    
    const result = await submitProof(taskId, proofData, baseUrl, receiverRemark.value)
    
    if (result.success) {
      toast.add({
        title: '提交成功',
        description: result.message || '任务提交成功，等待审核',
        color: 'green'
      })
      // 提交成功后跳转到任务详情页，并更新任务状态
      // 对于多人任务，使用当前任务行ID（task.value.id），否则使用taskId
      const redirectTaskId = task.value.id || taskId
      router.push(`/tasks/${redirectTaskId}?submitted=true`)
    } else {
      toast.add({
        title: '提交失败',
        description: result.message || '任务提交失败，请稍后重试',
        color: 'red'
      })
    }
    
  } catch (error) {
    console.error('提交失败:', error)
    toast.add({
      title: '提交失败',
      description: '网络错误，请稍后重试',
      color: 'red'
    })
  } finally {
    isSubmitting.value = false
  }
}

// 导航函数
const navigateTo = (path: string) => {
  router.push(path)
}

// 组件挂载时加载任务
onMounted(() => {
  loadTask()
})
</script>

