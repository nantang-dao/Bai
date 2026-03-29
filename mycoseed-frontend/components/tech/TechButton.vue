<template>
  <button
    :class="[
      'inline-flex items-center justify-center font-medium rounded-tech-sm transition-snap',
      'active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed',
      'tracking-tight select-none',
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
    validator: (v: string) =>
      ['primary', 'secondary', 'ghost', 'success', 'warning', 'danger', 'destructive'].includes(v)
  },
  size: {
    type: String,
    default: 'md',
    validator: (v: string) => ['sm', 'md', 'lg'].includes(v)
  },
  block: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false }
})

defineEmits(['click'])

const variantClasses = computed(() => {
  const map: Record<string, string> = {
    primary:
      'bg-accent text-accent-foreground shadow-card hover:bg-accent-hover active:bg-accent-active',
    secondary:
      'bg-surface border border-border text-text-secondary hover:bg-surface-raised hover:border-border',
    ghost:
      'bg-transparent text-text-secondary hover:bg-surface-raised',
    success:
      'bg-success text-success-foreground hover:opacity-90 active:opacity-95',
    warning:
      'bg-warning text-warning-foreground hover:opacity-90 active:opacity-95',
    danger:
      'bg-destructive text-destructive-foreground hover:opacity-90 active:opacity-95',
    destructive:
      'bg-destructive text-destructive-foreground hover:opacity-90 active:opacity-95'
  }
  return map[props.variant]
})

const sizeClasses = computed(() => {
  const map: Record<string, string> = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-sm'
  }
  return map[props.size]
})
</script>
