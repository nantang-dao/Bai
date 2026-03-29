<template>
  <div class="space-y-6 pb-24">
    <!-- 发起活动按钮 -->
    <div v-if="isAuthenticated" class="flex justify-end gap-2">
      <TechButton
        variant="primary"
        @click="navigateTo('/activities/create')"
      >
        <span class="flex items-center gap-1.5 whitespace-nowrap">
          <span class="text-base">📅</span>
          <span>发起活动（当前页面尚在开发中）</span>
        </span>
      </TechButton>
    </div>

    <!-- 页面标题 -->
    <div class="bg-card rounded-2xl shadow-soft p-4 border border-border">
      <h1 class="text-xl font-bold text-text-title">活动列表</h1>
      <p class="text-sm text-text-body mt-1">当前活动: {{ activeEventsCount }}</p>
    </div>

    <!-- 活动列表 -->
    <div v-if="events.length === 0" class="text-center py-12 bg-white border-2 border-black p-4">
      <p class="text-lg text-text-body">暂无活动</p>
    </div>
    
    <div v-else class="grid gap-4">
      <TechCard 
        v-for="event in sortedEvents" 
        :key="event.id"
        hover
        class="cursor-pointer"
        @click="navigateTo(`/activities/${event.id}`)"
      >
        <template #header>
          <div class="flex justify-between items-start">
            <span class="text-text-body text-xs">活动 #{{ event.id }}</span>
            <span class="text-xs text-text-placeholder">{{ formatTimeAgo(event.createdAt) }}</span>
          </div>
        </template>
        
        <div class="flex gap-4">
          <div class="w-20 h-20 bg-black/10 flex items-center justify-center text-4xl rounded-2xl border border-border flex-shrink-0 bg-input-bg">
            📅
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-xs font-bold text-primary mb-1">{{ event.date }}</div>
            <h3 class="font-bold text-xl mb-2">{{ event.title }}</h3>
            <p class="text-sm text-text-body mb-2 line-clamp-2">{{ event.description }}</p>
            <div class="flex gap-2 flex-wrap">
              <span class="text-xs bg-green-100 text-green-800 px-2 py-0.5 border border-green-600">
                {{ event.participants }} 人已报名
              </span>
              <span 
                :class="[
                  'text-xs px-2 py-0.5 border font-medium',
                  event.status === 'upcoming' ? 'bg-yellow-100 text-yellow-800 border-yellow-600' :
                  event.status === 'ongoing' ? 'bg-blue-100 text-blue-800 border-blue-600' :
                  'bg-gray-100 text-gray-800 border-gray-600'
                ]"
              >
                {{ getStatusLabel(event.status) }}
              </span>
            </div>
          </div>
          <div class="flex flex-col justify-center flex-shrink-0">
            <TechButton 
              size="sm" 
              variant="success"
              @click.stop="navigateTo(`/activities/${event.id}`)"
            >
              查看详情
            </TechButton>
          </div>
        </div>
      </TechCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '~/stores/user'

definePageMeta({
  layout: 'default'
})

const router = useRouter()
const userStore = useUserStore()

// 判断用户是否已登录
const isAuthenticated = computed(() => {
  return !!userStore.user
})

// 活动数据
const events = ref<any[]>([])

// 计算当前活动数量（即将开始和进行中的活动）
const activeEventsCount = computed(() => {
  return events.value.filter(event => 
    event.status === 'upcoming' || event.status === 'ongoing'
  ).length
})

// 按创建时间倒序排序的活动列表
const sortedEvents = computed(() => {
  return [...events.value].sort((a, b) => {
    const timeA = new Date(a.createdAt).getTime()
    const timeB = new Date(b.createdAt).getTime()
    return timeB - timeA
  })
})

// 格式化时间差
const formatTimeAgo = (dateString: string): string => {
  if (!dateString) return ''
  const now = new Date()
  const date = new Date(dateString)
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  
  if (diffMins < 60) {
    return `${diffMins}分钟前`
  } else if (diffHours < 24) {
    return `${diffHours}小时前`
  } else {
    return `${diffDays}天前`
  }
}

// 获取状态标签
const getStatusLabel = (status: string): string => {
  const statusMap: Record<string, string> = {
    'upcoming': '即将开始',
    'ongoing': '进行中',
    'ended': '已结束'
  }
  return statusMap[status] || '未知'
}

const navigateTo = (path: string) => {
  router.push(path)
}

// 加载活动数据
const loadEvents = async () => {
  // Mock events (可以后续从 API 获取)
  const now = new Date()
  events.value = [
    { 
      id: 1, 
      title: '每周管道检查', 
      date: '2024-11-30', 
      description: '检查所有绿色管道是否有食人花。', 
      participants: 12, 
      createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(), 
      status: 'upcoming' as const 
    },
    { 
      id: 2, 
      title: '卡丁车锦标赛', 
      date: '2024-12-05', 
      description: '彩虹之路聚会。自带香蕉皮。', 
      participants: 64, 
      createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(), 
      status: 'ongoing' as const 
    },
    { 
      id: 3, 
      title: '社区植树活动', 
      date: '2024-12-10', 
      description: '一起为社区增添绿色，种植新的树木。', 
      participants: 28, 
      createdAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(), 
      status: 'upcoming' as const 
    }
  ]
}

onMounted(async () => {
  // 确保用户信息已加载
  await userStore.getUser()
  await loadEvents()
})
</script>

<style scoped>
.create-activity-btn {
  /* 机械键盘按钮风格：白底黑框 */
  background: #ffffff;
  color: #000000;
  border: 3px solid #000000;
  
  /* 无阴影 */
  box-shadow: none;
  
  /* 轻微浮动动画（包含缩放） */
  animation: float-gentle 3s ease-in-out infinite;
  
  /* 过渡效果 */
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
  
  /* 像素风格 */
  image-rendering: pixelated;
  position: relative;
  overflow: visible;
}

/* 轻微浮动动画 */
@keyframes float-gentle {
  0%, 100% {
    transform: translateY(0px) scale(0.85);
  }
  50% {
    transform: translateY(-2px) scale(0.85);
  }
}

/* Hover 效果：放大、旋转、上浮 */
.create-activity-btn:hover {
  transform: translateY(-4px) rotate(2deg) scale(1);
  box-shadow: none;
  animation-play-state: paused;
}

/* Active 效果：点击放大到当前尺度 */
.create-activity-btn:active {
  transform: translateY(0px) rotate(0deg) scale(1);
  box-shadow: none;
  animation-play-state: paused;
}

/* 表情动画 */
.create-activity-btn .text-base {
  display: inline-block;
  animation: emoji-bounce 2s ease-in-out infinite;
}

@keyframes emoji-bounce {
  0%, 100% {
    transform: scale(1) rotate(0deg);
  }
  25% {
    transform: scale(1.1) rotate(-5deg);
  }
  75% {
    transform: scale(1.1) rotate(5deg);
  }
}
</style>

