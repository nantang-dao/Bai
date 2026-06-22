<template>
  <div class="task-markdown-body text-text-title leading-relaxed" v-html="html" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { renderTaskMarkdown } from '~/utils/markdown'

const props = defineProps<{
  content: string
}>()

const html = computed(() => renderTaskMarkdown(props.content || ''))
</script>

<style scoped>
.task-markdown-body :deep(p) {
  margin-bottom: 0.75em;
}
.task-markdown-body :deep(p:last-child) {
  margin-bottom: 0;
}
.task-markdown-body :deep(ul),
.task-markdown-body :deep(ol) {
  margin: 0.5em 0;
  padding-left: 1.5em;
}
.task-markdown-body :deep(li) {
  margin-bottom: 0.25em;
}
.task-markdown-body :deep(strong),
.task-markdown-body :deep(b) {
  font-weight: 700;
}
</style>
