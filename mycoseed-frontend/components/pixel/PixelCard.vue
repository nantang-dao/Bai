<template>
  <div 
    class="bg-card rounded-3xl shadow-soft relative"
    :class="[
      paddingClass,
      hover ? 'hover:-translate-y-1 hover:shadow-soft-lg transition-all duration-200 cursor-pointer' : ''
    ]"
  >
    <div class="relative">
      <div v-if="$slots.header" class="mb-4 border-b border-border pb-3 text-base font-bold text-text-title flex items-center flex-wrap gap-2">
        <slot name="header" />
      </div>
      
      <div class="text-text-body text-base">
        <slot />
      </div>

      <div v-if="$slots.footer" class="mt-4 pt-3 border-t border-border flex items-center justify-between">
        <slot name="footer" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps({
  noPadding: {
    type: Boolean,
    default: false
  },
  hover: {
    type: Boolean,
    default: false
  }
})

const paddingClass = computed(() => props.noPadding ? 'p-0' : 'p-4 md:p-6')
</script>
