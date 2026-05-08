<template>
  <!-- 手机端：固定在底部 -->
  <div class="fixed bottom-0 left-0 w-full bg-card text-text-body border-t border-border z-50 md:hidden">
    <div class="flex justify-around items-center h-16">
      <div 
        v-for="item in navItems" 
        :key="item.path"
        class="flex flex-col items-center justify-center w-full h-full cursor-pointer active:bg-input-bg transition-colors"
        @click="navigateTo(item.path)"
      >
        <span class="text-xl mb-1">{{ item.icon }}</span>
        <span class="text-sm font-medium">{{ item.label }}</span>
      </div>
    </div>
  </div>
  
  <!-- 桌面端：固定在底部 -->
  <div class="hidden md:block fixed bottom-0 left-0 w-full bg-card text-text-body border-t border-border z-50">
    <div class="max-w-7xl mx-auto px-4">
      <div class="flex justify-around items-center h-16">
        <div 
          v-for="item in navItems" 
          :key="item.path"
          class="flex flex-col items-center justify-center w-full h-full cursor-pointer hover:bg-input-bg transition-colors"
          @click="navigateTo(item.path)"
        >
          <span class="text-xl mb-1">{{ item.icon }}</span>
          <span class="text-sm font-medium">{{ item.label }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const router = useRouter()
const userStore = useUserStore()
const communityStore = useCommunityStore()

const getMyProfilePath = () => {
  const user = userStore.user
  if (user?.id) {
    return `/member/${user.id}`
  }
  return '/member/1'
}

// 第一个入口：社区（当前所选社区首页），未选时仍进入首页由页面引导去社区广场
const communityPath = computed(() => '/')

const eventsPath = computed(() => {
  const id = communityStore.currentCommunityId
  if (!id) return '/communities'
  return `/community/${id}/events`
})

const navItems = computed(() => {
  return [
    { label: '社区', path: communityPath.value, icon: '🏠' },
    { label: '任务', path: '/tasks', icon: '📋' },
    // { label: '活动', path: eventsPath.value, icon: '📅' },
    { label: '我的', path: getMyProfilePath(), icon: '👤' }
  ]
})

const navigateTo = (path: string) => {
  router.push(path)
}
</script>
