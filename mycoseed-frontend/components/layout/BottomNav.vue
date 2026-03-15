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

// 是否在底部导航中显示「活动」入口（隐藏时仅不展示，相关页面与路由仍保留）
const showActivitiesNav = false

const navItems = computed(() => {
  const items = [
    { label: '社区', path: communityPath.value, icon: '🏠' },
    { label: '任务', path: '/tasks', icon: '📋' },
    { label: '活动', path: '/activities-feed', icon: '📅' },
    { label: '我的', path: getMyProfilePath(), icon: '👤' }
  ]
  return showActivitiesNav ? items : items.filter(item => item.path !== '/activities-feed')
})

const navigateTo = (path: string) => {
  try {
    fetch('http://127.0.0.1:7242/ingest/af348509-5d27-4b86-baea-9c27926471bf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'nav-structure',
        hypothesisId: 'H1',
        location: 'components/layout/BottomNav.vue:navigateTo',
        message: 'BottomNav navigateTo called',
        data: { path },
        timestamp: Date.now()
      })
    }).catch(() => {})
  } catch (error) {}
  router.push(path)
}
</script>
