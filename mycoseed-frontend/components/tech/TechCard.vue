<template>
  <div
    :class="[
      'surface-elevated rounded-tech-lg',
      hover ? 'transition-glide hover:-translate-y-[2px] hover:shadow-card-hover cursor-pointer' : '',
      variantClasses,
      paddingClass
    ]"
  >
    <div v-if="$slots.header" class="text-[11px] font-mono font-medium text-text-tertiary uppercase tracking-[0.08em] mb-4 pb-3 border-b border-border-subtle">
      <slot name="header" />
    </div>

    <slot />

    <div v-if="$slots.footer" class="mt-4 pt-3 border-t border-border-subtle">
      <slot name="footer" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps({
  noPadding: { type: Boolean, default: false },
  hover: { type: Boolean, default: false },
  variant: {
    type: String,
    default: 'default',
    validator: (v: string) => ['default', 'raised', 'ghost'].includes(v)
  }
})

const variantClasses = computed(() => {
  if (props.variant === 'raised') return 'shadow-card'
  if (props.variant === 'ghost') return '!bg-transparent !shadow-none border border-border-subtle'
  return ''
})

const paddingClass = computed(() => (props.noPadding ? 'p-0' : 'p-5 md:p-6'))
</script>
