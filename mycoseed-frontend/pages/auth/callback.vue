<template>
    <div class="w-full max-w-md mx-auto">
        <PixelCard>
            <template #header>
                <div class="text-center text-xl font-bold text-primary">登录中...</div>
            </template>

            <div class="flex flex-col gap-6 py-4 items-center">
                <div v-if="loading" class="text-center text-lg text-text-body">
                    正在处理登录...
                </div>
                <div v-if="error" class="text-center text-lg text-destructive">
                    {{ error }}
                </div>
            </div>
        </PixelCard>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
definePageMeta({
  layout: 'unauth',
  // 移除 ssr: false，确保路由在构建时被正确注册
  // 客户端逻辑在 onMounted 中处理，通过 typeof window 检查确保只在客户端执行
})

const router = useRouter()
const toast = useToast()
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  // 新登录方式：OAuth 回调由后端处理并写入 HttpOnly session cookie。
  // 这个页面保留仅用于兼容旧链接或用户误入：直接回首页。
  toast.add({ title: '登录完成', description: '正在跳转...', color: 'green' })
  await router.push('/')
})
</script>