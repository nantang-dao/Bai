<template>
  <div class="min-h-screen bg-background py-4 md:py-8">
    <div class="container mx-auto px-4 md:px-6 max-w-4xl pb-32 md:pb-24">
      <!-- 页面标题 -->
      <div class="mb-6 md:mb-8 text-center">
        <h1 class="text-2xl md:text-4xl font-bold text-text-title mb-2 md:mb-4">发起活动</h1>
        <div class="w-24 md:w-32 h-1 bg-input-bg mx-auto border border-border rounded-2xl"></div>
      </div>

      <!-- 活动创建表单 -->
      <TechCard>
        <div class="space-y-4 md:space-y-6">
          <!-- 基本信息 -->
          <div class="space-y-4">
            <div>
              <label class="block font-bold text-xs uppercase mb-2 text-text-title">活动名称 *</label>
              <input 
                v-model="activityForm.name" 
                type="text"
                placeholder="输入活动名称"
                class="w-full h-12 px-4 bg-input-bg border border-border rounded-2xl shadow-soft  text-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-card transition-all"
              />
            </div>

            <div>
              <label class="block font-bold text-xs uppercase mb-2 text-text-title">活动描述 *</label>
              <textarea 
                v-model="activityForm.description" 
                placeholder="描述活动的具体内容、目标、流程等信息..."
                rows="4"
                class="w-full px-4 py-3 bg-input-bg border border-border rounded-2xl shadow-soft  text-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-card transition-all resize-none"
              ></textarea>
            </div>

            <div>
              <label class="block font-bold text-xs uppercase mb-2 text-text-title">活动地点（可选）</label>
              <input 
                v-model="activityForm.location" 
                type="text"
                placeholder="输入活动地点"
                class="w-full h-12 px-4 bg-input-bg border border-border rounded-2xl shadow-soft  text-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-card transition-all"
              />
            </div>

            <!-- 移动端单列，桌面端双列 -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block font-bold text-xs uppercase mb-2 text-text-title">开始时间 *</label>
                <div class="relative">
                  <input 
                    v-model="activityForm.startTime" 
                    type="datetime-local"
                    :min="minStart"
                    ref="startTimeInput"
                    class="w-full h-12 px-4 pr-12 bg-input-bg border border-border rounded-2xl shadow-soft  text-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-card transition-all"
                  />
                  <div 
                    class="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer z-10"
                    @click.stop="openStartTimePicker"
                  >
                    <Icon name="heroicons:calendar" class="w-6 h-6 text-text-title" />
                  </div>
                </div>
              </div>

              <div>
                <label class="block font-bold text-xs uppercase mb-2 text-text-title">结束时间 *</label>
                <div class="relative">
                  <input 
                    v-model="activityForm.endTime" 
                    type="datetime-local"
                    :min="activityForm.startTime || minStart"
                    ref="endTimeInput"
                    class="w-full h-12 px-4 pr-12 bg-input-bg border border-border rounded-2xl shadow-soft  text-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-card transition-all"
                  />
                  <div 
                    class="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer z-10"
                    @click.stop="openEndTimePicker"
                  >
                    <Icon name="heroicons:calendar" class="w-6 h-6 text-text-title" />
                  </div>
                </div>
              </div>
            </div>
            <p v-if="dateError" class="mt-1  text-xs text-destructive">
              {{ dateError }}
            </p>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block font-bold text-xs uppercase mb-2 text-text-title">奖励积分（可选）</label>
                <input 
                  v-model="activityForm.reward" 
                  type="number"
                  step="1"
                  min="0"
                  placeholder="0"
                  class="w-full h-12 px-4 bg-input-bg border border-border rounded-2xl shadow-soft  text-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-card transition-all"
                />
              </div>

              <div>
                <label class="block font-bold text-xs uppercase mb-2 text-text-title">最大参与人数（可选）</label>
                <input 
                  v-model="activityForm.maxParticipants" 
                  type="number"
                  step="1"
                  min="1"
                  placeholder="不限制"
                  class="w-full h-12 px-4 bg-input-bg border border-border rounded-2xl shadow-soft  text-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-card transition-all"
                />
              </div>
            </div>

            <div>
              <label class="block font-bold text-xs uppercase mb-2 text-text-title">主办方（可选）</label>
              <input 
                v-model="activityForm.organizer" 
                type="text"
                placeholder="输入主办方名称"
                class="w-full h-12 px-4 bg-input-bg border border-border rounded-2xl shadow-soft  text-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-card transition-all"
              />
            </div>

            <!-- 活动标签 -->
            <div>
              <label class="block font-bold text-xs uppercase mb-2 text-text-title">活动标签（可选）</label>
              <div class="flex flex-wrap gap-2 mb-2">
                <span
                  v-for="(tag, index) in activityForm.tags"
                  :key="index"
                  class="bg-success text-white border border-border rounded-2xl px-3 py-1 text-xs font-bold flex items-center gap-1"
                >
                  {{ tag }}
                  <button
                    @click="removeTag(index)"
                    class="hover:text-red-300"
                  >
                    ×
                  </button>
                </span>
              </div>
              <div class="flex gap-2">
                <input
                  v-model="newTag"
                  type="text"
                  @keyup.enter="addTag"
                  class="flex-1 h-10 px-3 bg-input-bg border border-border rounded-2xl shadow-soft  text-base focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-card transition-all"
                  placeholder="输入标签后按回车"
                />
                <TechButton
                  @click="addTag"
                  variant="secondary"
                  size="sm"
                >
                  添加
                </TechButton>
              </div>
            </div>
          </div>

          <!-- 底部固定操作栏占位符，防止内容被遮挡 -->
          <div class="h-20 md:h-16"></div>
        </div>
      </TechCard>
    </div>

    <!-- 底部固定操作栏 -->
    <div class="fixed bottom-16 left-0 right-0 p-4 bg-input-bg border-t-2 border-black z-[60] flex gap-3 shadow-[0_-4px_0_rgba(0,0,0,0.05)] md:bottom-0 md:border-t-2" style="padding-bottom: calc(1rem + env(safe-area-inset-bottom));">
      <TechButton 
        @click="navigateTo('/tasks')"
        variant="secondary"
        size="lg"
        class="w-24"
      >
        取消
      </TechButton>
      <TechButton 
        @click="publishActivity"
        :disabled="!canPublish || isPublishing"
        variant="success"
        size="lg"
        class="flex-1 flex items-center justify-center gap-2"
      >
        <span v-if="isPublishing" class="animate-spin">⚙️</span>
        <span v-else>📅</span>
        {{ isPublishing ? '发布中...' : '发布活动' }}
      </TechButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import PixelCard from '~/components/pixel/PixelCard.vue'
import PixelButton from '~/components/pixel/PixelButton.vue'
import { createActivity, type CreateActivityParams } from '~/utils/api'
import { useToast } from '~/composables/useToast'

definePageMeta({
  layout: 'default'
})

const router = useRouter()
const navigateTo = (path: string) => router.push(path)

// 时间输入框引用
const startTimeInput = ref<HTMLInputElement | null>(null)
const endTimeInput = ref<HTMLInputElement | null>(null)

// 打开日期选择器的方法
const openStartTimePicker = () => {
  if (startTimeInput.value) {
    startTimeInput.value.focus()
    if (typeof startTimeInput.value.showPicker === 'function') {
      startTimeInput.value.showPicker()
    } else {
      startTimeInput.value.click()
    }
  }
}

const openEndTimePicker = () => {
  if (endTimeInput.value) {
    endTimeInput.value.focus()
    if (typeof endTimeInput.value.showPicker === 'function') {
      endTimeInput.value.showPicker()
    } else {
      endTimeInput.value.click()
    }
  }
}

// 活动表单数据
const activityForm = ref({
  name: '',
  description: '',
  location: '',
  startTime: '',
  endTime: '',
  reward: '',
  maxParticipants: '',
  organizer: '',
  tags: [] as string[]
})

// 新标签输入
const newTag = ref('')

// 加载状态
const isPublishing = ref(false)

// 日期校验相关
const minStart = ref('')
const dateError = ref('')

// 计算属性
const canPublish = computed(() => {
  return activityForm.value.name && 
         activityForm.value.description && 
         activityForm.value.startTime && 
         activityForm.value.endTime &&
         !dateError.value
})

// 日期校验：开始时间不得早于当前时间，结束时间不得早于开始时间
const validateDates = () => {
  dateError.value = ''
  if (!activityForm.value.startTime || !activityForm.value.endTime) {
    return true
  }

  const now = new Date()
  const start = new Date(activityForm.value.startTime)
  const end = new Date(activityForm.value.endTime)

  if (start < now) {
    dateError.value = '开始时间不能早于当前时间'
    return false
  }

  if (end < start) {
    dateError.value = '结束时间不能早于开始时间'
    return false
  }

  return true
}

// 监听字段变化做实时校验
watch(() => [activityForm.value.startTime, activityForm.value.endTime], () => {
  validateDates()
})

// 添加标签
const addTag = () => {
  if (newTag.value.trim() && !activityForm.value.tags.includes(newTag.value.trim())) {
    activityForm.value.tags.push(newTag.value.trim())
    newTag.value = ''
  }
}

// 移除标签
const removeTag = (index: number) => {
  activityForm.value.tags.splice(index, 1)
}

// 发布活动
const publishActivity = async () => {
  // 最终前再做一轮校验
  const datesOK = validateDates()

  if (!datesOK || !canPublish.value) {
    const toast = useToast()
    const description = dateError.value || '请确保所有必填项和时间字段填写正确'
    toast.add({
      title: '请检查表单信息',
      description,
      color: 'red'
    })
    return
  }

  isPublishing.value = true
  
  try {
    // 模拟网络延迟
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // 创建活动参数
    const params: CreateActivityParams = {
      name: activityForm.value.name,
      description: activityForm.value.description,
      startTime: activityForm.value.startTime,
      endTime: activityForm.value.endTime,
      location: activityForm.value.location || undefined,
      reward: activityForm.value.reward ? parseFloat(activityForm.value.reward) : undefined,
      maxParticipants: activityForm.value.maxParticipants ? parseInt(activityForm.value.maxParticipants) : undefined,
      organizer: activityForm.value.organizer || undefined,
      tags: activityForm.value.tags.length > 0 ? activityForm.value.tags : undefined
    }
    
    // 创建活动
    const newActivity = await createActivity(params)
    
    // 显示成功消息
    const toast = useToast()
    toast.add({
      title: '活动发布成功！',
      description: '活动已成功发布',
      color: 'green'
    })
    
    // 跳转到动态页面
    await navigateTo('/tasks')
  } catch (error) {
    console.error('发布活动失败:', error)
    const toast = useToast()
    toast.add({
      title: '发布失败',
      description: error instanceof Error ? error.message : '请稍后重试',
      color: 'red'
    })
  } finally {
    isPublishing.value = false
  }
}

// 初始化最小开始时间
onMounted(() => {
  const now = new Date()
  now.setSeconds(0, 0)
  // datetime-local 需要到分钟的字符串：YYYY-MM-DDTHH:MM
  minStart.value = now.toISOString().slice(0, 16)
})
</script>





