<template>
  <header class="h-16 md:h-20 border-b border-border bg-card sticky top-0 z-50 flex-shrink-0">
    <div class="w-full md:max-w-7xl md:mx-auto px-2 md:px-4 h-full flex items-center justify-between">
      <!-- Community Switcher -->
      <div class="relative">
        <button
          class="flex items-center gap-3 cursor-pointer group"
          @click="toggleDropdown"
          @blur="handleBlur"
        >
          <div class="w-12 h-12 rounded-2xl flex items-center justify-center shadow-soft group-hover:-translate-y-0.5 transition-transform overflow-hidden bg-primary">
            <img v-if="communityStore.currentCommunity?.avatarUrl" :src="communityStore.currentCommunity.avatarUrl" :alt="communityStore.currentCommunity?.name" class="w-full h-full object-cover" />
            <PixelAvatar v-else-if="communityStore.currentCommunity?.name" :seed="communityStore.currentCommunity.name" size="md" class="!w-12 !h-12 !rounded-2xl" />
            <img v-else src="/images/icons/myco-seed-logo.svg" alt="MycoSeed" class="w-8 h-8" />
          </div>
          <div class="hidden md:block text-left">
            <h1 class="font-bold text-text-title text-sm md:text-base leading-tight">
              {{ currentCommunityName || '选择社区' }}
            </h1>
            <p class="text-text-body text-sm">切换频道</p>
          </div>
          <div class="ml-2 text-text-body">
            <svg 
              class="w-4 h-4 transition-transform"
              :class="{ 'rotate-180': isDropdownOpen }"
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
            </svg>
          </div>
        </button>
        
        <!-- Dropdown Menu -->
        <Transition name="dropdown">
          <div 
            v-if="isDropdownOpen" 
            class="absolute top-full left-0 mt-2 w-64 bg-card rounded-2xl shadow-soft-lg z-50 border border-border"
          >
            <div class="p-2 space-y-1 max-h-96 overflow-y-auto">
              <div 
                v-for="community in communities" 
                :key="community.id"
                class="p-3 rounded-xl cursor-pointer hover:bg-input-bg transition-all flex items-center gap-3"
                :class="{ 'bg-primary/10': community.id === communityStore.currentCommunityId }"
                @click="selectCommunity(community.id)"
              >
                <div class="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 bg-input-bg">
                  <img v-if="community.avatarUrl" :src="community.avatarUrl" :alt="community.name" class="w-full h-full object-cover" />
                  <PixelAvatar v-else :seed="community.name" size="sm" class="!w-10 !h-10 !rounded-xl" />
                </div>
                <div class="min-w-0 flex-1">
                  <div class="font-bold text-sm text-text-title">{{ community.name }}</div>
                  <div class="text-xs text-text-body mt-0.5 line-clamp-1">{{ community.description }}</div>
                  <div class="text-xs text-text-placeholder mt-0.5">{{ community.pointName || '积分' }}</div>
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </div>

      <!-- Navigation -->
      <nav class="flex items-center gap-4">
        <PixelButton variant="warning" size="sm" @click="navigateTo('tasks')">🛒 商城</PixelButton>

        <div class="flex items-center gap-2">
          <div 
            v-if="userStore.isAuthenticated"
            class="cursor-pointer hover:scale-105 transition-transform"
            @click="navigateTo('profile')"
            title="个人主页"
          >
            <PixelAvatar 
              v-if="userStore.user?.avatar" 
              :src="userStore.user.avatar" 
              size="md" 
            />
            <PixelAvatar 
              v-else 
              :seed="userStore.user?.name || userStore.user?.id || 'user'" 
              size="md" 
            />
          </div>
          
          <NuxtLink
            v-if="userStore.isAuthenticated"
            to="/settings"
            class="w-10 h-10 flex items-center justify-center rounded-xl bg-primary text-white font-medium text-sm transition-all hover:scale-105 flex-shrink-0 shadow-soft"
            title="设置"
          >
            ⚙️
          </NuxtLink>
          
          <PixelButton
            v-else
            variant="primary"
            size="sm"
            @click="router.push('/auth/login')"
          >
            登录
          </PixelButton>
        </div>
      </nav>
      
    </div>
  </header>
</template>

<style scoped>
.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.2s ease;
}

.dropdown-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}

.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from > div,
.modal-leave-to > div {
  transform: scale(0.9);
}
</style>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import PixelButton from '~/components/pixel/PixelButton.vue'
import PixelAvatar from '~/components/pixel/PixelAvatar.vue'
import { useCommunityStore } from '~/stores/community'
import { useUserStore } from '~/stores/user'
import type { Community } from '~/utils/api'

interface Props {
  currentPage?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  navigate: [page: string]
}>()

const router = useRouter()
const communityStore = useCommunityStore()
const userStore = useUserStore()
const isDropdownOpen = ref(false)
const communities = ref<Community[]>([])

const currentCommunityName = computed(() => {
  return communityStore.currentCommunity?.name || null
})

const toggleDropdown = () => {
  isDropdownOpen.value = !isDropdownOpen.value
}

const handleBlur = (e: FocusEvent) => {
  setTimeout(() => {
    const target = e.relatedTarget as HTMLElement | null
    const currentTarget = e.currentTarget as HTMLElement | null
    if (!target || (currentTarget && !currentTarget.contains(target))) {
      isDropdownOpen.value = false
    }
  }, 200)
}

const selectCommunity = async (id: string) => {
  await communityStore.setCurrentCommunity(id)
  isDropdownOpen.value = false
  // 如果当前在首页，刷新数据；否则跳转到首页
  if (router.currentRoute.value.path === '/') {
    // 触发社区切换监听，自动刷新数据
  } else {
    router.push('/')
  }
}

const loadCommunities = async () => {
  try {
    communities.value = await communityStore.getAllCommunities()
  } catch (error) {
    console.error('Failed to load communities:', error)
  }
}

watch(() => communityStore.currentCommunityId, () => {})

onMounted(async () => {
  await communityStore.initialize()
  await loadCommunities()
  if (!userStore.user) {
    await userStore.getUser()
  }
})

const navigateTo = (page: string) => {
  try {
    fetch('http://127.0.0.1:7242/ingest/af348509-5d27-4b86-baea-9c27926471bf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'nav-structure',
        hypothesisId: 'H1',
        location: 'components/layout/Header.vue:navigateTo',
        message: 'Header navigateTo called',
        data: { page, currentPage: props.currentPage },
        timestamp: Date.now()
      })
    }).catch(() => {})
  } catch (error) {}
  if (page === 'profile') {
    const user = userStore.user
    if (user?.id) {
      emit('navigate', `member/${user.id}`)
    } else {
      router.push('/auth/login')
    }
  } else {
    emit('navigate', page)
  }
}

</script>
