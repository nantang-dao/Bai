<template>
  <header class="h-16 md:h-20 border-b border-border bg-card sticky top-0 z-50 flex-shrink-0">
    <div class="w-full md:max-w-7xl md:mx-auto px-2 md:px-4 h-full flex items-center justify-between">
      <!-- Community Switcher（点击展开下拉，选择后不跳转，留在当前页） -->
      <div class="relative flex items-center gap-3" ref="switcherRef">
        <div class="w-12 h-12 rounded-2xl flex items-center justify-center shadow-soft transition-transform overflow-hidden bg-primary flex-shrink-0">
          <img v-if="communityStore.currentCommunity?.avatarUrl" :src="communityStore.currentCommunity.avatarUrl" :alt="communityStore.currentCommunity?.name" class="w-full h-full object-cover" />
          <PixelAvatar v-else-if="communityStore.currentCommunity?.name" :seed="communityStore.currentCommunity.name" size="md" class="!w-12 !h-12 !rounded-2xl" />
          <img v-else src="/images/icons/myco-seed-logo.svg" alt="MycoSeed" class="w-8 h-8" />
        </div>
        <button
          type="button"
          class="hidden md:flex text-left leading-tight flex-col items-start gap-0 min-w-0"
          @click="toggleCommunityDropdown"
        >
          <h1 class="font-bold text-text-title text-sm md:text-base truncate max-w-[180px]">
            {{ currentCommunityName || '未选择社区' }}
          </h1>
          <span class="text-sm text-primary font-medium hover:underline">切换社区 &gt;</span>
        </button>
        <NuxtLink to="/communities" class="md:hidden text-sm text-primary font-medium hover:underline shrink-0">
          切换社区 &gt;
        </NuxtLink>
        <Transition name="dropdown">
          <div
            v-if="showCommunityDropdown"
            class="absolute left-0 top-full mt-1 z-50 min-w-[200px] max-h-64 overflow-y-auto bg-card border border-border rounded-xl shadow-lg py-1"
          >
            <div v-if="myCommunitiesLoading" class="px-4 py-3 text-sm text-text-placeholder">加载中...</div>
            <template v-else-if="myCommunities.length">
              <button
                v-for="c in myCommunities"
                :key="c.id"
                type="button"
                class="w-full px-4 py-2.5 text-left text-sm hover:bg-input-bg flex items-center gap-2"
                :class="{ 'bg-input-bg': communityStore.currentCommunityId === c.id }"
                @click="selectCommunity(c.id)"
              >
                <div class="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 bg-input-bg">
                  <img v-if="c.avatarUrl" :src="c.avatarUrl" :alt="c.name" class="w-full h-full object-cover" />
                  <PixelAvatar v-else :seed="c.name" size="sm" class="!w-8 !h-8 !rounded-lg" />
                </div>
                <span class="truncate font-medium text-text-title">{{ c.name }}</span>
              </button>
            </template>
            <div v-else class="px-4 py-3 text-sm text-text-placeholder">暂无已加入社区</div>
            <div class="border-t border-border mt-1 pt-1">
              <NuxtLink :to="communitiesPathWithFrom" class="block px-4 py-2.5 text-sm text-primary font-medium hover:bg-input-bg" @click="showCommunityDropdown = false">
                前往社区广场
              </NuxtLink>
            </div>
          </div>
        </Transition>
      </div>

      <!-- Navigation -->
      <nav class="flex items-center gap-4">
        <NuxtLink
          v-if="false"
          :to="mallPath"
          class="inline-flex items-center justify-center px-3 py-1.5 rounded-xl bg-amber-500 text-white text-sm font-bold shadow-soft hover:opacity-95 transition-opacity"
          title="社区商城"
        >
          🛒 商城
        </NuxtLink>

        <NuxtLink
          v-if="userStore.isAuthenticated"
          to="/messages"
          class="relative w-10 h-10 flex items-center justify-center rounded-xl bg-input-bg border border-border text-text-title transition-all hover:scale-105 flex-shrink-0 shadow-soft"
          title="消息"
        >
          🔔
          <span
            v-if="hasUnread"
            class="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-red-500"
          />
        </NuxtLink>

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
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import PixelButton from '~/components/pixel/PixelButton.vue'
import PixelAvatar from '~/components/pixel/PixelAvatar.vue'
import { useCommunityStore } from '~/stores/community'
import { useUserStore } from '~/stores/user'
import type { Community } from '~/utils/api'
import { useApi } from '~/composables/useApi'

interface Props {
  currentPage?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  navigate: [page: string]
}>()

const router = useRouter()
const route = useRoute()
const communityStore = useCommunityStore()
const userStore = useUserStore()
const api = useApi()

const hasUnread = ref(false)

async function refreshUnread() {
  if (!userStore.isAuthenticated) {
    hasUnread.value = false
    return
  }
  try {
    const communityId = communityStore.currentCommunityId
    const summary = await api.getNotificationSummary({ communityId })
    hasUnread.value = !!summary.hasUnread
  } catch {
    // 忽略错误，避免影响 header
  }
}

const switcherRef = ref<HTMLElement | null>(null)
const showCommunityDropdown = ref(false)
const myCommunities = ref<Community[]>([])
const myCommunitiesLoading = ref(false)

const currentCommunityName = computed(() => {
  return communityStore.currentCommunity?.name || null
})

const communitiesPathWithFrom = computed(() => {
  const from = route.fullPath && route.fullPath !== '/communities' ? encodeURIComponent(route.fullPath) : ''
  return from ? `/communities?from=${from}` : '/communities'
})

/** 商城与当前所选社区绑定；未选社区时进入广场引导选择 */
const mallPath = computed(() => {
  const id = communityStore.currentCommunityId
  if (!id) return '/communities'
  return `/community/${id}/marketplace`
})

function toggleCommunityDropdown() {
  showCommunityDropdown.value = !showCommunityDropdown.value
}

async function loadMyCommunities() {
  myCommunitiesLoading.value = true
  try {
    myCommunities.value = await communityStore.getAllCommunities()
  } catch {
    myCommunities.value = []
  } finally {
    myCommunitiesLoading.value = false
  }
}

async function selectCommunity(id: string) {
  await communityStore.setCurrentCommunity(id)
  showCommunityDropdown.value = false
  // 不跳转，留在当前页；任务/公告等页会通过 watch currentCommunityId 自动刷新
}

// 点击外部关闭下拉
function onDocumentClick(e: MouseEvent) {
  if (showCommunityDropdown.value && switcherRef.value && !switcherRef.value.contains(e.target as Node)) {
    showCommunityDropdown.value = false
  }
}

onMounted(async () => {
  if (!userStore.user) {
    await userStore.getUser()
  }
  await communityStore.initialize()
  await refreshUnread()
  if (typeof document !== 'undefined') {
    document.addEventListener('click', onDocumentClick)
  }
})

onBeforeUnmount(() => {
  if (typeof document !== 'undefined') {
    document.removeEventListener('click', onDocumentClick)
  }
})

watch(showCommunityDropdown, (open) => {
  if (open) loadMyCommunities()
})

watch(
  () => [communityStore.currentCommunityId, userStore.isAuthenticated],
  () => refreshUnread()
)

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
