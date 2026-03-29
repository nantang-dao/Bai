<template>
  <div
    class="relative rounded-full overflow-hidden flex items-center justify-center flex-shrink-0"
    :class="sizeClass"
  >
    <img
      v-if="effectiveSrc"
      :src="effectiveSrc"
      alt="Avatar"
      class="w-full h-full object-cover"
      @error="onImgError"
    />
    <div
      v-else
      class="w-full h-full flex items-center justify-center font-mono font-semibold text-white select-none"
      :class="textClass"
      :style="{ background: gradientStyle }"
    >
      {{ displayLabel }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

// Six curated gradient pairs — cold → warm progression, accent-system aligned
const GRADIENTS: [string, string][] = [
  ['#0066FF', '#00C6FF'],   // blue → cyan (accent axis)
  ['#7C3AED', '#C084FC'],   // purple → lavender
  ['#00875A', '#34D399'],   // green → mint
  ['#B45309', '#FCD34D'],   // amber → yellow
  ['#C41C1C', '#F87171'],   // red → rose
  ['#0891B2', '#67E8F9']    // teal → sky
]

const props = defineProps({
  src: { type: String, default: '' },
  seed: { type: String, default: 'user' },
  fallbackText: { type: String, default: '' },
  size: {
    type: String,
    default: 'md',
    validator: (v: string) => ['xs', 'sm', 'md', 'lg', 'xl'].includes(v)
  }
})

const imgError = ref(false)
const effectiveSrc = computed(() => (props.src && !imgError.value ? props.src : ''))

const onImgError = () => { imgError.value = true }
watch(() => props.src, () => { imgError.value = false })

const sizeClass = computed(() => {
  const map: Record<string, string> = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-20 h-20',
    xl: 'w-32 h-32'
  }
  return map[props.size]
})

const textClass = computed(() => {
  const map: Record<string, string> = {
    xs: 'text-[9px]',
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-lg',
    xl: 'text-2xl'
  }
  return map[props.size]
})

// charCode accumulation hash — picks gradient pair from GRADIENTS table
const gradientStyle = computed(() => {
  const s = props.seed || 'user'
  let n = 0
  for (let i = 0; i < s.length; i++) n += s.charCodeAt(i)
  const [from, to] = GRADIENTS[n % GRADIENTS.length]
  return `linear-gradient(135deg, ${from}, ${to})`
})

const displayLabel = computed(() => {
  if (props.fallbackText) return props.fallbackText
  const s = (props.seed || 'user').trim()
  if (!s) return '?'
  const first = s[0]
  if (/[\u4e00-\u9fa5]/.test(first)) return first
  return first.toUpperCase()
})
</script>
