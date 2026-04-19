<template>
  <div class="min-h-screen bg-background py-4 md:py-8">
    <div class="container mx-auto px-4 md:px-6 max-w-3xl pb-24">
      <div class="mb-6 text-center">
        <h1 class="text-2xl md:text-3xl font-bold text-text-title mb-2">编辑任务池</h1>
        <p class="text-sm text-text-body max-w-xl mx-auto">
          仅创建者可在未认领 Manager、未上链、子任务未定稿、无人领取时修改主信息。
        </p>
      </div>
      <div v-if="loadError" class="mb-4 text-sm text-destructive">{{ loadError }}</div>
      <div
        v-if="!communityStore.currentCommunityId && !loadError"
        class="mb-4 text-sm text-amber-700 dark:text-amber-300"
      >
        请先选择社区（需与任务池所属社区一致）。
      </div>
      <PixelCard>
        <div class="space-y-4">
          <div>
            <label class="block text-xs font-bold uppercase mb-1 text-text-title">任务名称 *</label>
            <input v-model="form.title" type="text" class="w-full h-12 px-4 bg-input-bg border border-border rounded-2xl" />
          </div>
          <div>
            <label class="block text-xs font-bold uppercase mb-1 text-text-title">任务说明 *</label>
            <textarea v-model="form.description" rows="4" class="w-full px-4 py-3 bg-input-bg border border-border rounded-2xl resize-none" />
          </div>
          <div>
            <label class="block text-xs font-bold uppercase mb-1 text-text-title">任务池总积分 *</label>
            <input v-model.number="form.plannedLockNt" type="number" min="1" step="1" placeholder="任务池总预算（NT）" class="w-full h-12 px-4 bg-input-bg border border-border rounded-2xl" />
            <p class="text-xs text-text-body/70 mt-1">
              子任务的奖励总和不得超过此值
            </p>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold uppercase mb-1 text-text-title">领取开始（可选）</label>
              <input v-model="form.startDate" type="datetime-local" :min="minStart" class="w-full h-12 px-4 bg-input-bg border border-border rounded-2xl" />
            </div>
            <div>
              <label class="block text-xs font-bold uppercase mb-1 text-text-title">领取截止 *</label>
              <input v-model="form.deadline" type="datetime-local" class="w-full h-12 px-4 bg-input-bg border border-border rounded-2xl" />
            </div>
          </div>
          <div>
            <label class="block text-xs font-bold uppercase mb-1 text-text-title">提交截止 *</label>
            <input v-model="form.submitDeadline" type="datetime-local" class="w-full h-12 px-4 bg-input-bg border border-border rounded-2xl" />
          </div>
          <p v-if="dateError" class="text-sm text-destructive">{{ dateError }}</p>
        </div>
      </PixelCard>
      <div class="mt-8 flex gap-3 justify-end">
        <PixelButton variant="secondary" @click="router.push(`/tasks/pool/${taskInfoId}/manage`)">取消</PixelButton>
        <PixelButton variant="success" :disabled="!canSubmit || submitting || loadingDraft" @click="submit">
          {{ submitting ? '保存中…' : '保存并回管理页' }}
        </PixelButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PixelCard from '~/components/pixel/PixelCard.vue'
import PixelButton from '~/components/pixel/PixelButton.vue'
import { getTaskPoolDraftForEdit, patchTaskPoolDraft, getApiBaseUrl } from '~/utils/api'
import { getCurrentBeijingTime } from '~/utils/time'
import { useToast } from '~/composables/useToast'
import { useCommunityStore } from '~/stores/community'

definePageMeta({ layout: 'default' })

const route = useRoute()
const router = useRouter()
const toast = useToast()
const communityStore = useCommunityStore()

const taskInfoId = computed(() => {
  const p = route.params.taskInfoId
  return (Array.isArray(p) ? p[0] : p) || ''
})

const minStart = ref('')
const dateError = ref('')
const submitting = ref(false)
const loadingDraft = ref(true)
const loadError = ref('')
const form = ref({
  title: '',
  description: '',
  plannedLockNt: '',
  startDate: '',
  deadline: '',
  submitDeadline: '',
})

function validateDates() {
  dateError.value = ''
  if (!form.value.deadline || !form.value.submitDeadline) {
    dateError.value = '请填写领取截止与提交截止'
    return false
  }
  const startStr = form.value.startDate || getCurrentBeijingTime()
  const start = new Date(startStr)
  const deadline = new Date(form.value.deadline)
  const submit = new Date(form.value.submitDeadline)
  if (isNaN(start.getTime()) || isNaN(deadline.getTime()) || isNaN(submit.getTime())) {
    dateError.value = '时间格式无效'
    return false
  }
  if (start >= deadline) {
    dateError.value = '领取开始须早于领取截止'
    return false
  }
  if (deadline >= submit) {
    dateError.value = '领取截止须早于提交截止'
    return false
  }
  return true
}

watch(
  () => [form.value.startDate, form.value.deadline, form.value.submitDeadline],
  () => validateDates()
)

const canSubmit = computed(() => {
  return !!(
    communityStore.currentCommunityId &&
    form.value.title.trim() &&
    form.value.description.trim() &&
    form.value.plannedLockNt &&
    Number(form.value.plannedLockNt) >= 1 &&
    form.value.deadline &&
    form.value.submitDeadline &&
    !dateError.value
  )
})

onMounted(async () => {
  minStart.value = new Date().toISOString().slice(0, 16)
  const id = taskInfoId.value
  if (!id) {
    loadError.value = '缺少 taskInfoId'
    loadingDraft.value = false
    return
  }
  try {
    const baseUrl = getApiBaseUrl()
    const { draft } = await getTaskPoolDraftForEdit(id, baseUrl)
    form.value.title = String(draft.title || '')
    form.value.description = String(draft.description || '')
    if (draft.plannedLockNt != null) form.value.plannedLockNt = String(draft.plannedLockNt)
    if (draft.startDate) form.value.startDate = String(draft.startDate)
    if (draft.deadline) form.value.deadline = String(draft.deadline)
    if (draft.submitDeadline) form.value.submitDeadline = String(draft.submitDeadline)
    const cid = draft.communityId ? String(draft.communityId) : ''
    if (cid && communityStore.currentCommunityId !== cid) {
      await communityStore.setCurrentCommunity(cid)
    }
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e)
  } finally {
    loadingDraft.value = false
  }
})

async function submit() {
  const id = taskInfoId.value
  if (!id || !communityStore.currentCommunityId) {
    toast.add({ title: '请先选择社区', color: 'red' })
    return
  }
  if (!validateDates() || !canSubmit.value) {
    toast.add({ title: '请检查表单', description: dateError.value || '必填未完成', color: 'red' })
    return
  }
  submitting.value = true
  try {
    const baseUrl = getApiBaseUrl()
    const startDate = form.value.startDate || getCurrentBeijingTime()
    await patchTaskPoolDraft(
      id,
      {
        title: form.value.title.trim(),
        description: form.value.description.trim(),
        plannedLockNt: parseFloat(form.value.plannedLockNt),
        startDate,
        deadline: form.value.deadline,
        submitDeadline: form.value.submitDeadline,
      },
      baseUrl
    )
    toast.add({ title: '已保存', color: 'green' })
    await router.push({ path: `/tasks/pool/${id}/manage`, query: { title: form.value.title.trim() } })
  } catch (e) {
    toast.add({ title: '保存失败', description: e instanceof Error ? e.message : String(e), color: 'red' })
  } finally {
    submitting.value = false
  }
}
</script>
