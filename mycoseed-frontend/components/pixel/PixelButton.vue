<template>
  <button
    :class="[
      'relative inline-flex items-center justify-center font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-2xl',
      variantClasses,
      sizeClasses,
      block ? 'w-full' : ''
    ]"
    :disabled="disabled"
    @click="$emit('click', $event)"
  >
    <slot />
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps({
  variant: {
    type: String,
    default: 'primary',
    validator: (value: string) => ['primary', 'secondary', 'success', 'warning', 'danger', 'ghost'].includes(value)
  },
  size: {
    type: String,
    default: 'md',
    validator: (value: string) => ['sm', 'md', 'lg'].includes(value)
  },
  block: {
    type: Boolean,
    default: false
  },
  disabled: {
    type: Boolean,
    default: false
  }
})

defineEmits(['click'])

const variantClasses = computed(() => {
  const variants: Record<string, string> = {
    primary: 'bg-primary text-white shadow-lg shadow-primary/30 hover:-translate-y-0.5 hover:shadow-primary/40',
    secondary: 'bg-white text-text-body border border-border hover:bg-gray-50',
    success: 'bg-success text-white shadow-soft hover:-translate-y-0.5',
    warning: 'bg-warning text-white shadow-soft hover:-translate-y-0.5',
    danger: 'bg-destructive text-white shadow-soft hover:-translate-y-0.5',
    ghost: 'bg-transparent text-text-body hover:bg-gray-100'
  }
  return variants[props.variant]
})

const sizeClasses = computed(() => {
  const sizes: Record<string, string> = {
    sm: 'text-sm px-4 py-2',
    md: 'text-base px-6 py-3',
    lg: 'text-base px-6 py-4'
  }
  return sizes[props.size]
})
</script>
