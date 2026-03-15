<template>
  <div class="pointer-events-auto">
    <!-- Desktop Sidebar -->
    <div 
      v-show="isOpen"
      class="fixed top-32 left-4 z-40 w-64 bg-card rounded-3xl shadow-soft p-4 max-h-[calc(100vh-160px)] overflow-y-auto hidden md:block animate-fade-in border border-border"
    >
      <SidebarContent 
        :locations="locations"
        :selectedLocation="selectedLocation"
        :searchQuery="searchQuery"
        :communities="filteredCommunities"
        :activityLogs="activityLogs"
        @update:selectedLocation="updateSelectedLocation"
        @update:searchQuery="updateSearchQuery"
        @select-community="navigateToCommunity"
        @preview-community="handlePreviewCommunity"
        @clear-preview="handleClearPreview"
        @activity-click="handleActivityClick"
      />
    </div>

    <!-- Toggle Button (Shared for Mobile/Desktop) -->
    <button 
      @click="toggleSidebar"
      class="fixed top-20 left-4 z-50 bg-card rounded-2xl shadow-soft p-2 transition-all flex items-center justify-center w-10 h-10 hover:-translate-y-0.5 border border-border"
      :class="{ 'hidden': isOpen && isMobile, 'md:flex': true }"
    >
      <span class="text-xl leading-none">{{ isOpen ? '✕' : '🔍' }}</span>
    </button>

    <!-- Mobile Sidebar Drawer -->
    <div 
      v-if="isOpen" 
      class="fixed inset-0 z-50 md:hidden"
    >
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/30 backdrop-blur-sm" @click="toggleSidebar"></div>
      
      <!-- Drawer Content -->
      <div class="absolute top-0 left-0 bottom-0 w-1/2 max-w-sm bg-card shadow-soft-lg flex flex-col animate-slide-right border-r border-border">
        <!-- Mobile Header -->
        <div class="p-4 border-b border-border flex justify-between items-center bg-background">
          <h2 class="font-bold text-lg text-text-title">探索与发现</h2>
          <button @click="toggleSidebar" class="text-xl font-bold px-2 py-1 rounded-xl hover:bg-input-bg text-text-body transition-colors">
            ✕
          </button>
        </div>

        <!-- Scrollable Content -->
        <div class="flex-1 overflow-y-auto p-4">
          <SidebarContent 
            :locations="locations"
            :selectedLocation="selectedLocation"
            :searchQuery="searchQuery"
            :communities="filteredCommunities"
            :activityLogs="activityLogs"
            @update:selectedLocation="updateSelectedLocation"
            @update:searchQuery="updateSearchQuery"
            @select-community="handleMobileSelectCommunity"
            @preview-community="handlePreviewCommunity"
            @clear-preview="handleClearPreview"
            @activity-click="handleActivityClick"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, onUnmounted } from 'vue'
import { getCommunities, getActivityFeed, type Community, type ActivityLog } from '~/utils/api'
import SidebarContent from './SidebarContent.vue'

const emit = defineEmits(['filter', 'select-community', 'preview-community', 'clear-preview', 'activity-click'])

const isOpen = ref(false)
const isMobile = ref(false)
const locations = ['上海', '北京', '深圳', '杭州', '成都', '安徽']
const selectedLocation = ref('')
const searchQuery = ref('')
const communities = ref<Community[]>([])
const activityLogs = ref<ActivityLog[]>([])

const checkMobile = () => {
  if (typeof window !== 'undefined') {
    isMobile.value = window.innerWidth < 768
  }
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
})

const filteredCommunities = computed(() => {
  let result = [...communities.value]
  if (selectedLocation.value) {
    result = result.filter(c => c.location === selectedLocation.value)
  }
  if (searchQuery.value.trim() !== '') {
    const q = searchQuery.value.trim().toLowerCase()
    result = result.filter(c => c.name.toLowerCase().includes(q))
  }
  return result
})

const updateSelectedLocation = (val: string) => {
  selectedLocation.value = val
  emitFilter()
}

const updateSearchQuery = (val: string) => {
  searchQuery.value = val
  emitFilter()
}

const emitFilter = () => {
  emit('filter', {
    location: selectedLocation.value,
    query: searchQuery.value
  })
}

const navigateToCommunity = (id: number) => {
  emit('select-community', id)
}

const handleMobileSelectCommunity = (id: number) => {
  navigateToCommunity(id)
  toggleSidebar()
}

const handlePreviewCommunity = (id: number) => {
  emit('preview-community', id)
}

const handleClearPreview = () => {
  emit('clear-preview')
}

const handleActivityClick = (log: ActivityLog) => {
  emit('activity-click', log)
}

const toggleSidebar = () => {
  isOpen.value = !isOpen.value
}

onMounted(async () => {
  communities.value = await getCommunities()
  activityLogs.value = await getActivityFeed()
})
</script>

<style scoped>
.animate-slide-right {
  animation: slide-right 0.3s ease-out;
}

@keyframes slide-right {
  from { transform: translateX(-100%); }
  to { transform: translateX(0); }
}

.animate-fade-in {
  animation: fade-in 0.2s ease-out;
}

@keyframes fade-in {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
