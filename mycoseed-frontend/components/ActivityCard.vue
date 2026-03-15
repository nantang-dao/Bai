<template>
  <div 
    class="activity-card group cursor-pointer rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 bg-card border border-border hover:border-primary/50 block"
    @click.stop="handleClick"
  >
    <!-- 活动封面图 -->
    <div class="relative h-48 overflow-hidden bg-gradient-to-br from-primary to-accent">
      <img 
        v-if="activity.image" 
        :src="activity.image" 
        :alt="activity.name"
        class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
      />
      
      <!-- 状态标签 -->
      <div class="absolute top-3 right-3">
        <span 
          class="px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-sm"
          :class="statusClass"
        >
          {{ statusText }}
        </span>
      </div>
    </div>

    <!-- 活动内容 -->
    <div class="p-4">
      <!-- 活动标题 -->
      <h3 class="text-lg font-bold text-foreground mb-2 line-clamp-1 group-hover:text-primary transition-colors">
        {{ activity.name }}
      </h3>

      <!-- 活动描述 -->
      <p class="text-sm text-muted-foreground mb-4 line-clamp-2">
        {{ activity.description }}
      </p>

      <!-- 活动信息 -->
      <div class="space-y-2 mb-4">
        <!-- 时间 -->
        <div class="flex items-center gap-2 text-sm text-foreground">
          <UIcon name="i-heroicons-clock" class="w-4 h-4 text-muted-foreground" />
          <span>{{ formatTimeRange }}</span>
        </div>

        <!-- 地点 -->
        <div class="flex items-center gap-2 text-sm text-foreground">
          <UIcon name="i-heroicons-map-pin" class="w-4 h-4 text-muted-foreground" />
          <span class="line-clamp-1">{{ activity.location }}</span>
        </div>

        <!-- 主办方 -->
        <div class="flex items-center gap-2 text-sm text-foreground">
          <UIcon name="i-heroicons-building-office" class="w-4 h-4 text-muted-foreground" />
          <span class="line-clamp-1">{{ activity.organizer }}</span>
        </div>
      </div>

      <!-- 底部信息：参与人数 & 标签 -->
      <div class="flex items-center justify-between pt-3 border-t border-border">
        <!-- 参与人数 -->
        <div class="flex items-center gap-2">
          <UIcon name="i-heroicons-users" class="w-4 h-4 text-primary" />
          <span class="text-sm font-medium text-foreground">
            {{ activity.participants }}/{{ activity.maxParticipants }}
          </span>
          <span 
            v-if="isFull" 
            class="text-xs text-destructive font-semibold"
          >
            已满
          </span>
        </div>

        <!-- 第一个标签 -->
        <div v-if="activity.tags.length > 0" class="flex gap-1">
          <span class="px-2 py-1 bg-primary/10 text-primary text-xs rounded-md font-medium">
            {{ activity.tags[0] }}
          </span>
          <span v-if="activity.tags.length > 1" class="px-2 py-1 bg-muted text-muted-foreground text-xs rounded-md">
            +{{ activity.tags.length - 1 }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Activity } from '~/utils/api'

// Props
interface Props {
  activity: Activity
}

const props = defineProps<Props>()
const router = useRouter()

// 点击处理
const handleClick = () => {
  router.push(`/activities/${props.activity.id}`)
}

// 计算属性：状态样式
const statusClass = computed(() => {
  switch (props.activity.status) {
    case 'upcoming':
      return 'bg-blue-500/90 text-white'
    case 'ongoing':
      return 'bg-green-500/90 text-white'
    case 'ended':
      return 'bg-gray-500/90 text-white'
    default:
      return 'bg-gray-500/90 text-white'
  }
})

// 计算属性：状态文本
const statusText = computed(() => {
  switch (props.activity.status) {
    case 'upcoming':
      return '即将开始'
    case 'ongoing':
      return '进行中'
    case 'ended':
      return '已结束'
    default:
      return '未知'
  }
})

// 计算属性：格式化时间范围
const formatTimeRange = computed(() => {
  const start = new Date(props.activity.startTime)
  const end = new Date(props.activity.endTime)
  
  const formatDate = (date: Date) => {
    const month = date.getMonth() + 1
    const day = date.getDate()
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    return `${month}月${day}日 ${hours}:${minutes}`
  }
  
  // 如果是同一天
  if (start.toDateString() === end.toDateString()) {
    const startTime = `${start.getHours().toString().padStart(2, '0')}:${start.getMinutes().toString().padStart(2, '0')}`
    const endTime = `${end.getHours().toString().padStart(2, '0')}:${end.getMinutes().toString().padStart(2, '0')}`
    return `${formatDate(start).split(' ')[0]} ${startTime}-${endTime}`
  }
  
  return `${formatDate(start)} - ${formatDate(end)}`
})

// 计算属性：是否已满
const isFull = computed(() => {
  return props.activity.participants >= props.activity.maxParticipants
})
</script>

<style scoped>
/* 文本截断 */
.line-clamp-1 {
  display: -webkit-box;
  -webkit-line-clamp: 1;
  line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>