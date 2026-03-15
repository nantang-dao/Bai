<template>
  <div 
    class="relative overflow-hidden rounded-full bg-input-bg shadow-soft flex items-center justify-center"
    :class="sizeClasses"
  >
    <img 
      v-if="effectiveSrc" 
      :src="effectiveSrc" 
      alt="Avatar"
      class="w-full h-full object-cover"
      @error="onImgError"
    />
    <!-- 无头像或加载失败时：显示 fallbackText（如链名）或首字圆形占位 -->
    <div
      v-else
      class="w-full h-full flex items-center justify-center rounded-full text-white font-bold select-none"
      :class="initialSizeClass"
      :style="{ backgroundColor: initialBgColor }"
    >
      {{ fallbackText || displayInitial }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = defineProps({
  src: {
    type: String,
    default: ''
  },
  seed: {
    type: String,
    default: 'user'
  },
  /** 可选：占位时显示的文字（如链名 OP/ETH），不传则显示 seed 首字 */
  fallbackText: {
    type: String,
    default: ''
  },
  size: {
    type: String,
    default: 'md',
    validator: (value: string) => ['sm', 'md', 'lg', 'xl'].includes(value)
  }
})

const imgError = ref(false)
const effectiveSrc = computed(() => (props.src && !imgError.value ? props.src : ''))

const onImgError = () => {
  imgError.value = true
}

watch(() => props.src, () => {
  imgError.value = false
})

const sizeClasses = computed(() => {
  const sizes: Record<string, string> = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-20 h-20',
    xl: 'w-32 h-32'
  }
  return sizes[props.size]
})

const initialSizeClass = computed(() => {
  const sizes: Record<string, string> = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-lg',
    xl: 'text-2xl'
  }
  return sizes[props.size]
})

const displayInitial = computed(() => {
  const s = (props.seed || 'user').trim()
  if (!s) return '?'
  const first = s[0]
  if (/[\u4e00-\u9fa5]/.test(first)) return first
  if (/[a-zA-Z0-9]/.test(first)) return first.toUpperCase()
  return s[0] || '?'
})

const initialBgColor = computed(() => {
  const colors = ['#00B3B3', '#2D8CFF', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#6366f1']
  let n = 0
  for (let i = 0; i < (props.seed || '').length; i++) n += (props.seed || '').charCodeAt(i)
  return colors[n % colors.length]
})
</script>
