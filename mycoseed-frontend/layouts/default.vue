<template>
  <div class="min-h-screen flex flex-col bg-background">
    <!-- Desktop Header -->
    <LayoutHeader
      :current-page="currentPage"
      @navigate="handleNavigate"
      class="hidden md:flex"
    />

    <!-- Mobile Header -->
    <div class="md:hidden h-14 sticky top-0 z-50
                bg-white/90 backdrop-blur-md border-b border-border
                flex items-center justify-between px-4 gap-3">
      <div class="flex items-center gap-2 flex-1 min-w-0">
        <div class="w-8 h-8 rounded-tech-md overflow-hidden flex-shrink-0 bg-surface-raised flex items-center justify-center">
          <img
            v-if="mobileCommunityStore.currentCommunity?.avatarUrl"
            :src="mobileCommunityStore.currentCommunity.avatarUrl"
            :alt="mobileCommunityStore.currentCommunity?.name"
            class="w-full h-full object-cover"
          />
          <TechAvatar
            v-else-if="mobileCommunityStore.currentCommunity?.name"
            :seed="mobileCommunityStore.currentCommunity.name"
            size="sm"
          />
          <img v-else src="/images/icons/myco-seed-logo.svg" alt="MycoSeed" class="w-5 h-5" />
        </div>
        <div class="flex-1 min-w-0">
          <div class="font-semibold text-sm text-text-primary truncate">
            {{ mobileCurrentCommunityName || '未选择社区' }}
          </div>
          <NuxtLink :to="communitiesPathWithFrom" class="text-[11px] text-accent font-mono hover:underline">
            切换社区 →
          </NuxtLink>
        </div>
      </div>

      <!-- Settings button — SVG gear, no emoji -->
      <NuxtLink
        v-if="mobileUserStore.isAuthenticated"
        to="/settings"
        class="w-8 h-8 flex items-center justify-center rounded-tech-md
               border border-border text-text-secondary
               hover:bg-surface-raised transition-base flex-shrink-0"
        title="设置"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
      </NuxtLink>
    </div>

    <!-- Main content -->
    <main class="relative flex-grow w-full md:container md:mx-auto px-2 md:px-4 py-4 md:py-8 md:max-w-6xl pb-24">
      <NuxtPage />
    </main>

    <LayoutBottomNav />

    <footer class="h-14 w-full bg-surface border-t border-border mt-auto hidden md:flex items-center justify-center">
      <span class="text-xs font-mono text-text-tertiary tracking-wide">© 2024 MYCOSEED</span>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useCommunityStore } from '~/stores/community'
import { useUserStore } from '~/stores/user'

const route = useRoute()
const mobileCommunityStore = useCommunityStore()
const mobileUserStore = useUserStore()
const currentPage = ref('hub')

const mobileCurrentCommunityName = computed(() => {
  return mobileCommunityStore.currentCommunity?.name || null
})

const communitiesPathWithFrom = computed(() => {
  const from = route.fullPath && route.fullPath !== '/communities' ? encodeURIComponent(route.fullPath) : ''
  return from ? `/communities?from=${from}` : '/communities'
})

onMounted(async () => {
  await mobileCommunityStore.initialize()
})

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
