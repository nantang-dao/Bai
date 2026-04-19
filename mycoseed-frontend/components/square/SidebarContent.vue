<template>
  <div class="flex flex-col gap-6">
    <!-- Search Section -->
    <div>
      <label class="block text-base font-bold text-text-body mb-2">
        <span class="mr-2">🔍</span> 筛选社区
      </label>
      <input 
        :value="searchQuery"
        @input="$emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
        type="text" 
        placeholder="搜索社区名称..." 
        class="w-full px-6 py-4 bg-input-bg rounded-2xl text-base font-medium text-text-title placeholder-text-placeholder focus:outline-none focus:bg-card focus:ring-2 focus:ring-primary/20 transition-all"
      />
    </div>

    <!-- Community List Section -->
    <div>
      <h3 class="text-base font-bold text-text-body mb-3 flex items-center border-b border-border pb-2">
        <span class="mr-2">🗺</span> 按地域推荐社区
      </h3>
      <div class="mb-3">
        <select 
          :value="selectedLocation" 
          @change="$emit('update:selectedLocation', ($event.target as HTMLSelectElement).value)"
          class="w-full px-6 py-4 bg-input-bg rounded-2xl text-base font-medium text-text-title focus:outline-none focus:bg-card focus:ring-2 focus:ring-primary/20 border-0"
        >
          <option value="">🌍 全部地区</option>
          <option v-for="loc in locations" :key="loc" :value="loc">{{ loc }}</option>
        </select>
      </div>
      <div v-if="communities.length" class="space-y-2">
        <div
          v-for="comm in communities"
          :key="comm.id"
          class="flex items-center justify-between p-3 bg-card rounded-2xl shadow-soft cursor-pointer hover:shadow-soft-lg hover:-translate-y-0.5 transition-all"
          tabindex="0"
          @click="$emit('select-community', comm.id)"
          @mouseenter="$emit('preview-community', comm.id)"
          @mouseleave="$emit('clear-preview')"
          @focus="$emit('preview-community', comm.id)"
          @blur="$emit('clear-preview')"
        >
          <div class="flex flex-col gap-0.5 max-w-[140px]">
            <span class="font-bold text-text-title truncate">{{ comm.name }}</span>
            <span class="text-sm text-text-placeholder truncate">
              {{ comm.location || '位置待补充' }}
            </span>
          </div>
          <div class="text-right text-sm text-text-body leading-tight">
            <div>{{ formatNumber(comm.memberCount) }} 人</div>
            <div>{{ formatNumber(comm.totalPoints) }} pts</div>
          </div>
        </div>
      </div>
      <div v-else class="text-sm text-text-placeholder bg-input-bg rounded-2xl p-4 border border-dashed border-border">
        暂无符合条件的社区
      </div>
    </div>

    <!-- Live Feed Section -->
    <div>
      <h3 class="text-base font-bold text-text-body mb-3 flex items-center border-b border-border pb-2">
        <span class="mr-2">⚡</span> 实时动态
      </h3>
      <div class="h-48 overflow-hidden relative bg-input-bg rounded-2xl p-4">
        <div class="space-y-2">
          <div 
            v-for="log in activityLogs" 
            :key="log.id" 
            class="text-sm flex flex-col border-b border-border pb-2 mb-1 last:border-0 cursor-pointer hover:bg-card/50 rounded-lg px-2 py-1 transition-colors"
            @click="$emit('activity-click', log)"
          >
            <div class="flex items-center gap-1 mb-1 justify-between">
              <div class="flex items-center gap-1 flex-wrap">
                <span class="font-bold text-primary">{{ log.userName || '有人' }}</span>
                <span class="text-text-body">{{ getActionText(log.type) }}</span>
              </div>
              <span class="text-text-placeholder text-xs">{{ formatTime(log.timestamp) }}</span>
            </div>
            <div class="text-text-title truncate pl-2 border-l-2 border-primary/30 bg-primary/5 rounded px-2 py-1">
              {{ log.targetName }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Community, ActivityLog } from '~/utils/api'

defineProps<{
  locations: string[]
  selectedLocation: string
  searchQuery: string
  communities: Community[]
  activityLogs: ActivityLog[]
}>()

defineEmits(['update:selectedLocation', 'update:searchQuery', 'select-community', 'preview-community', 'clear-preview', 'activity-click'])

const getActionText = (type: string) => {
  const map: Record<string, string> = {
    'join': '加入了',
    'complete_task': '完成了任务',
    'create_proposal': '发起了提案',
    'new_community': '新社区成立'
  }
  return map[type] || '进行了操作'
}

const formatNumber = (num: number | undefined) => {
  const n = Number(num ?? 0)
  if (n >= 10000) {
    return (n / 10000).toFixed(1) + 'w'
  }
  return n
}

const formatTime = (isoString: string) => {
  const date = new Date(isoString)
  const now = new Date()
  const diff = (now.getTime() - date.getTime()) / 1000 / 60
  
  if (diff < 1) return '刚刚'
  if (diff < 60) return `${Math.floor(diff)}m`
  if (diff < 60 * 24) return `${Math.floor(diff / 60)}h`
  return `${Math.floor(diff / 60 / 24)}d`
}
</script>
