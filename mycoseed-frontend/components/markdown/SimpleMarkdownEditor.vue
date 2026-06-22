<template>
  <div>
    <div class="flex items-center justify-between gap-2 mb-2">
      <label v-if="label" class="font-bold text-xs uppercase text-text-title">{{ label }}</label>
      <button
        type="button"
        class="shrink-0 px-3 py-1 text-xs font-bold border border-border rounded-xl bg-card hover:bg-input-bg transition-colors"
        @click="applyBold"
      >
        加粗
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
    <p class="text-xs text-text-placeholder mt-1">支持换行；选中文字后点「加粗」即可强调重点</p>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { applyBoldWrap } from '~/utils/markdown'

withDefaults(
  defineProps<{
    modelValue: string
    label?: string
    placeholder?: string
    rows?: number
  }>(),
  {
    label: '',
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

async function applyBold() {
  const el = textareaRef.value
  if (!el) return
  const { value, selectionStart, selectionEnd } = applyBoldWrap(
    el.value,
    el.selectionStart,
    el.selectionEnd
  )
  emit('update:modelValue', value)
  await nextTick()
  el.focus()
  el.setSelectionRange(selectionStart, selectionEnd)
}
</script>
