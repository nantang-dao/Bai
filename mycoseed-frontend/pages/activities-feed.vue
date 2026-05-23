<template>
  <div class="min-h-screen flex items-center justify-center p-8">
    <p class="text-text-placeholder text-sm">正在跳转…</p>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })

const router = useRouter()
const communityStore = useCommunityStore()

onMounted(async () => {
  await communityStore.initialize()
  const id = communityStore.currentCommunityId
  if (id) await router.replace(`/community/${id}/events`)
  else await router.replace('/communities')
})
</script>
