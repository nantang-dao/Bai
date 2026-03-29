<template>
  <div
    class="fixed bottom-0 left-0 w-full z-50 md:hidden
           bg-white/90 backdrop-blur-md border-t border-border"
    style="padding-bottom: env(safe-area-inset-bottom)"
  >
    <div class="flex justify-around items-center h-16">
      <NuxtLink
        v-for="item in navItems"
        :key="item.path"
        :to="item.path"
        class="flex flex-col items-center justify-center flex-1 h-full gap-1
               text-text-tertiary transition-snap"
        active-class="!text-accent"
      >
        <component :is="item.icon" class="w-5 h-5" />
        <span class="text-[10px] font-mono font-medium">{{ item.label }}</span>
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h } from 'vue'

const router = useRouter()
const userStore = useUserStore()
const communityStore = useCommunityStore()

const getMyProfilePath = () => {
  const user = userStore.user
  if (user?.id) return `/member/${user.id}`
  return '/member/1'
}

const communityPath = computed(() => '/')
const showActivitiesNav = false

// SVG icon components — inline, no emoji, no external dependencies
const HomeIcon = defineComponent({
  render: () =>
    h('svg', {
      width: 20, height: 20, viewBox: '0 0 24 24',
      fill: 'none', stroke: 'currentColor',
      'stroke-width': '1.75', 'stroke-linecap': 'round', 'stroke-linejoin': 'round'
    }, [
      h('path', { d: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' }),
      h('polyline', { points: '9 22 9 12 15 12 15 22' })
    ])
})

const TaskIcon = defineComponent({
  render: () =>
    h('svg', {
      width: 20, height: 20, viewBox: '0 0 24 24',
      fill: 'none', stroke: 'currentColor',
      'stroke-width': '1.75', 'stroke-linecap': 'round', 'stroke-linejoin': 'round'
    }, [
      h('rect', { x: 3, y: 4, width: 18, height: 18, rx: 2, ry: 2 }),
      h('line', { x1: 16, y1: 2, x2: 16, y2: 6 }),
      h('line', { x1: 8, y1: 2, x2: 8, y2: 6 }),
      h('line', { x1: 3, y1: 10, x2: 21, y2: 10 }),
      h('path', { d: 'M9 16l2 2 4-4' })
    ])
})

const ActivityIcon = defineComponent({
  render: () =>
    h('svg', {
      width: 20, height: 20, viewBox: '0 0 24 24',
      fill: 'none', stroke: 'currentColor',
      'stroke-width': '1.75', 'stroke-linecap': 'round', 'stroke-linejoin': 'round'
    }, [
      h('rect', { x: 3, y: 4, width: 18, height: 18, rx: 2, ry: 2 }),
      h('line', { x1: 16, y1: 2, x2: 16, y2: 6 }),
      h('line', { x1: 8, y1: 2, x2: 8, y2: 6 }),
      h('line', { x1: 3, y1: 10, x2: 21, y2: 10 })
    ])
})

const ProfileIcon = defineComponent({
  render: () =>
    h('svg', {
      width: 20, height: 20, viewBox: '0 0 24 24',
      fill: 'none', stroke: 'currentColor',
      'stroke-width': '1.75', 'stroke-linecap': 'round', 'stroke-linejoin': 'round'
    }, [
      h('path', { d: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2' }),
      h('circle', { cx: 12, cy: 7, r: 4 })
    ])
})

const navItems = computed(() => {
  const items = [
    { label: '社区', path: communityPath.value, icon: HomeIcon },
    { label: '任务', path: '/tasks', icon: TaskIcon },
    { label: '活动', path: '/activities-feed', icon: ActivityIcon },
    { label: '我的', path: getMyProfilePath(), icon: ProfileIcon }
  ]
  return showActivitiesNav ? items : items.filter(item => item.path !== '/activities-feed')
})

// No debug fetch — pure navigation only
const navigateTo = (path: string) => {
  router.push(path)
}
</script>
