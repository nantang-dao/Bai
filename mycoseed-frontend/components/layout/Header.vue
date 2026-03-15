<template>
  <header class="h-16 md:h-20 border-b border-border bg-card sticky top-0 z-50 flex-shrink-0">
    <div class="w-full md:max-w-7xl md:mx-auto px-2 md:px-4 h-full flex items-center justify-between">
      <!-- Community Switcher -->
      <div class="flex items-center gap-3">
        <div class="w-12 h-12 rounded-2xl flex items-center justify-center shadow-soft transition-transform overflow-hidden bg-primary">
          <img v-if="communityStore.currentCommunity?.avatarUrl" :src="communityStore.currentCommunity.avatarUrl" :alt="communityStore.currentCommunity?.name" class="w-full h-full object-cover" />
          <PixelAvatar v-else-if="communityStore.currentCommunity?.name" :seed="communityStore.currentCommunity.name" size="md" class="!w-12 !h-12 !rounded-2xl" />
          <img v-else src="/images/icons/myco-seed-logo.svg" alt="MycoSeed" class="w-8 h-8" />
        </div>
        <div class="hidden md:block text-left leading-tight">
          <h1 class="font-bold text-text-title text-sm md:text-base">
            {{ currentCommunityName || '未选择社区' }}
          </h1>
          <NuxtLink to="/communities" class="text-sm text-primary font-medium hover:underline">
            切换社区 &gt;
          </NuxtLink>
        </div>
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
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import PixelButton from '~/components/pixel/PixelButton.vue'
import PixelAvatar from '~/components/pixel/PixelAvatar.vue'
import { useCommunityStore } from '~/stores/community'
import { useUserStore } from '~/stores/user'

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

const currentCommunityName = computed(() => {
  return communityStore.currentCommunity?.name || null
})

onMounted(async () => {
  if (!userStore.user) {
    await userStore.getUser()
  }
  await communityStore.initialize()
})

const navigateTo = (page: string) => {
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
