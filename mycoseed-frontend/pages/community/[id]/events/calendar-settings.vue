<template>
  <div class="min-h-screen pb-24 px-4 py-6 max-w-lg mx-auto">
    <header class="flex items-center gap-3 mb-6">
      <button type="button" class="p-2 -ml-2 rounded-xl hover:bg-input-bg" @click="router.back()">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <h1 class="text-xl font-bold text-text-title">日历标签管理</h1>
    </header>

    <p v-if="!isSuperAdmin" class="text-destructive">仅总管理员可编辑</p>

    <template v-else>
      <ul class="space-y-3">
        <li
          v-for="t in tags"
          :key="t.id"
          class="p-4 rounded-2xl border border-border bg-card flex items-center justify-between gap-3"
        >
          <div class="flex items-center gap-2 min-w-0">
            <span class="w-4 h-4 rounded-full shrink-0" :style="{ backgroundColor: t.colorHex }" />
            <span class="font-medium text-text-title truncate">{{ t.name }}</span>
          </div>
          <button type="button" class="text-sm text-primary font-medium shrink-0" @click="openEdit(t)">修改</button>
        </li>
      </ul>

      <div class="mt-6 p-4 rounded-2xl border border-dashed border-border">
        <h2 class="font-bold text-text-title mb-3">新建标签</h2>
        <input v-model="newName" placeholder="名称" class="w-full h-10 px-3 rounded-xl border border-border bg-input-bg mb-2" />
        <div class="flex items-center gap-2 mb-3">
          <label class="text-sm text-text-body">颜色</label>
          <input v-model="newColor" type="color" class="h-10 w-16 rounded border border-border" />
        </div>
        <PixelButton variant="primary" :disabled="creating" @click="createTag">添加</PixelButton>
      </div>
    </template>

    <Teleport to="body">
      <div
        v-if="editing"
        class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        @click.self="editing = null"
      >
        <div class="bg-card rounded-3xl p-6 w-full max-w-sm space-y-3">
          <h3 class="font-bold text-lg">编辑标签</h3>
          <input v-model="editName" class="w-full h-10 px-3 rounded-xl border border-border bg-input-bg" />
          <div class="flex items-center gap-2">
            <label class="text-sm">颜色</label>
            <input v-model="editColor" type="color" class="h-10 w-16 rounded border border-border" />
          </div>
          <div class="flex gap-2 pt-2">
            <PixelButton variant="secondary" block @click="editing = null">取消</PixelButton>
            <PixelButton variant="primary" block :disabled="saving" @click="saveEdit">保存</PixelButton>
          </div>
          <button type="button" class="text-sm text-destructive w-full pt-2 border-t border-border" @click="removeTag">
            删除标签
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PixelButton from '~/components/pixel/PixelButton.vue'
import type { CalendarTag } from '~/utils/api'
import { useCommunityStore } from '~/stores/community'

definePageMeta({ layout: 'default', middleware: 'auth' })

const route = useRoute()
const router = useRouter()
const api = useApi()
const toast = useToast()
const communityStore = useCommunityStore()

const communityId = computed(() => route.params.id as string)
const isSuperAdmin = computed(() => communityStore.currentCommunity?.myRole === 'super_admin')

const tags = ref<CalendarTag[]>([])
const newName = ref('')
const newColor = ref('#22c55e')
const creating = ref(false)
const editing = ref<CalendarTag | null>(null)
const editName = ref('')
const editColor = ref('#000000')
const saving = ref(false)

function openEdit(t: CalendarTag) {
  editing.value = t
  editName.value = t.name
  editColor.value = t.colorHex
}

async function load() {
  tags.value = await api.listCalendarTags(communityId.value)
}

async function createTag() {
  if (!newName.value.trim()) return
  creating.value = true
  try {
    await api.createCalendarTag(communityId.value, { name: newName.value.trim(), colorHex: newColor.value })
    newName.value = ''
    toast.add({ title: '已添加', color: 'green' })
    await load()
  } catch (e: any) {
    toast.add({ title: e?.message || '失败', color: 'red' })
  } finally {
    creating.value = false
  }
}

async function saveEdit() {
  if (!editing.value) return
  saving.value = true
  try {
    await api.updateCalendarTag(communityId.value, editing.value.id, {
      name: editName.value.trim(),
      colorHex: editColor.value
    })
    toast.add({ title: '已保存', color: 'green' })
    editing.value = null
    await load()
  } catch (e: any) {
    toast.add({ title: e?.message || '失败', color: 'red' })
  } finally {
    saving.value = false
  }
}

async function removeTag() {
  if (!editing.value) return
  try {
    await api.deleteCalendarTag(communityId.value, editing.value.id)
    toast.add({ title: '已删除', color: 'green' })
    editing.value = null
    await load()
  } catch (e: any) {
    toast.add({ title: e?.message || '失败', color: 'red' })
  }
}

onMounted(async () => {
  await communityStore.setCurrentCommunity(communityId.value)
  if (communityStore.currentCommunity?.myRole !== 'super_admin') {
    router.replace(`/community/${communityId.value}/events`)
    return
  }
  await load()
})
</script>
