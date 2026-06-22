<template>
  <div>
    <div class="flex gap-2 mb-2">
      <button
        type="button"
        title="加粗"
        class="w-9 h-9 font-bold text-sm border border-border rounded-xl bg-card hover:bg-input-bg transition-colors"
        @click="applyBold"
      >
        B
      </button>
      <button
        type="button"
        title="无序列表"
        class="h-9 px-3 text-sm border border-border rounded-xl bg-card hover:bg-input-bg transition-colors"
        @click="applyList"
      >
        列表
      </button>
    </div>
    <textarea
      ref="textareaRef"
      :value="modelValue"
      :rows="rows"
      :placeholder="placeholder"
      class="w-full px-4 py-3 bg-input-bg border border-border rounded-2xl shadow-soft text-base focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-card transition-all resize-y"
      @input="onInput"
    />
    <p class="text-xs text-text-placeholder mt-1">支持换行、加粗与列表，无需记忆语法</p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { wrapBold, insertList } from '~/utils/markdown'

withDefaults(
  defineProps<{
    modelValue: string
    placeholder?: string
    rows?: number
  }>(),
  {
    placeholder: '',
    rows: 6,
  }
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const textareaRef = ref<HTMLTextAreaElement | null>(null)

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLTextAreaElement).value)
}

function applyBold() {
  const el = textareaRef.value
  if (!el) return
  emit('update:modelValue', wrapBold(el))
}

function applyList() {
  const el = textareaRef.value
  if (!el) return
  emit('update:modelValue', insertList(el))
}
</script>
