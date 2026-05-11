<template>
  <div class="min-h-screen flex flex-col bg-background">
    <!-- 桌面端Header：包含登出按钮 -->
    <LayoutHeader 
      :current-page="currentPage" 
      @navigate="handleNavigate"
      class="hidden md:flex"
    />
    
    <!-- Mobile Header (Simplified) -->
    <div class="md:hidden h-14 bg-card border-b border-border flex items-center justify-between sticky top-0 z-50 px-4">
      <div class="flex items-center gap-2 flex-1 min-w-0">
        <div class="w-8 h-8 rounded-xl overflow-hidden flex-shrink-0 bg-primary flex items-center justify-center">
          <img v-if="mobileCommunityStore.currentCommunity?.avatarUrl" :src="mobileCommunityStore.currentCommunity.avatarUrl" :alt="mobileCommunityStore.currentCommunity?.name" class="w-full h-full object-cover" />
          <img v-else src="/images/icons/myco-seed-logo.svg" alt="MycoSeed" class="w-5 h-5" />
        </div>
        <div class="flex-1 min-w-0">
          <div class="font-medium text-text-title text-base truncate">
            {{ mobileCurrentCommunityName || '未选择社区' }}
          </div>
          <NuxtLink :to="communitiesPathWithFrom" class="text-sm text-primary font-medium">
            切换社区 &gt;
          </NuxtLink>
        </div>
      </div>
      
      <div class="flex items-center gap-2 shrink-0">
        <NuxtLink
          :to="mallPath"
          class="w-10 h-10 flex items-center justify-center rounded-xl bg-amber-500 text-white font-medium text-sm transition-all active:scale-95 shadow-soft"
          title="社区商城"
        >
          🛒
        </NuxtLink>
        <NuxtLink
          v-if="mobileUserStore.isAuthenticated"
          to="/messages"
          class="relative w-10 h-10 flex items-center justify-center rounded-xl bg-primary text-white transition-all hover:scale-105 flex-shrink-0 shadow-soft"
          title="消息"
        >
          🔔
          <span
            v-if="mobileHasUnread"
            class="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-red-500"
          />
        </NuxtLink>
        <div
          v-if="mobileUserStore.isAuthenticated"
          class="cursor-pointer hover:scale-105 transition-transform"
          @click="navigateToProfile"
          title="个人主页"
        >
          <PixelAvatar
            v-if="mobileUserStore.user?.avatar"
            :src="mobileUserStore.user.avatar"
            size="md"
          />
          <PixelAvatar
            v-else
            :seed="mobileUserStore.user?.name || mobileUserStore.user?.id || 'user'"
            size="md"
          />
        </div>
      </div>
    </div>
    
    <!-- 主内容区域 -->
    <main class="relative flex-grow w-full md:container md:mx-auto px-2 md:px-4 py-4 md:py-8 md:max-w-6xl pb-20">
      <NuxtPage />
    </main>

    <!-- 底部导航 -->
    <LayoutBottomNav />

    <!-- Footer (Desktop Only) -->
    <footer class="h-14 w-full bg-muted border-t border-border mt-auto hidden md:flex items-center justify-center">
      <span class="text-sm text-text-body">© 2024 MycoSeed</span>
    </footer>
    
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useCommunityStore } from '~/stores/community'
import { useUserStore } from '~/stores/user'
import { useApi } from '~/composables/useApi'
import PixelAvatar from '~/components/pixel/PixelAvatar.vue'

const route = useRoute()
const mobileCommunityStore = useCommunityStore()
const mobileUserStore = useUserStore()
const mobileApi = useApi()
const currentPage = ref('hub')
const mobileHasUnread = ref(false)

const mobileCurrentCommunityName = computed(() => {
  return mobileCommunityStore.currentCommunity?.name || null
})

/** 前往社区广场时带上当前路径，便于选完社区后返回（如从任务页来的则回任务页） */
const communitiesPathWithFrom = computed(() => {
  const from = route.fullPath && route.fullPath !== '/communities' ? encodeURIComponent(route.fullPath) : ''
  return from ? `/communities?from=${from}` : '/communities'
})

const mallPath = computed(() => {
  const id = mobileCommunityStore.currentCommunityId
  if (!id) return '/communities'
  return `/community/${id}/marketplace`
})

onMounted(async () => {
  await mobileCommunityStore.initialize()
  await refreshMobileUnread()
})

async function refreshMobileUnread() {
  if (!mobileUserStore.isAuthenticated) {
    mobileHasUnread.value = false
    return
  }
  try {
    const communityId = mobileCommunityStore.currentCommunityId
    const summary = await mobileApi.getNotificationSummary({ communityId })
    mobileHasUnread.value = !!summary.hasUnread
  } catch {}
}

function navigateToProfile() {
  const user = mobileUserStore.user
  if (user?.id) {
    navigateTo(`/member/${user.id}`)
  }
}

const handleNavigate = (page: string) => {
  currentPage.value = page
  const targetPath = page === 'hub' ? '/' : '/' + page
  navigateTo(targetPath)
}
</script>

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
