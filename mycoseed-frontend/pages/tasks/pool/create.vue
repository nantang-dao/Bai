<template>
  <div class="min-h-screen bg-background py-4 md:py-8">
    <div class="container mx-auto px-4 md:px-6 max-w-3xl pb-24">
      <div class="mb-6 text-center">
        <h1 class="text-2xl md:text-3xl font-bold text-text-title mb-2">发布任务池</h1>
        <p class="text-sm text-text-body max-w-xl mx-auto">
          创建主任务后，可在管理页维护子任务（草稿）；认领 Manager 后的写权限与阶段一后端规则一致。
        </p>
        <div class="w-24 h-1 bg-border mx-auto border border-border rounded-2xl mt-4"></div>
      </div>

      <div
        v-if="!communityStore.currentCommunityId"
        class="mb-4 px-4 py-3 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-800 dark:text-amber-200 text-sm"
      >
        请先通过社区广场或左上角选择社区，再发布任务池。
      </div>

      <PixelCard>
        <div class="space-y-4">
          <div>
            <label class="block font-bold text-xs uppercase mb-2 text-text-title">任务名称 *</label>
            <input
              v-model="form.title"
              type="text"
              placeholder="主任务 / 任务池名称"
              class="w-full h-12 px-4 bg-input-bg border border-border rounded-2xl shadow-soft text-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-card"
            />
          </div>
          <div>
            <label class="block font-bold text-xs uppercase mb-2 text-text-title">任务说明 *</label>
            <textarea
              v-model="form.description"
              rows="4"
              placeholder="描述整体目标与规则…"
              class="w-full px-4 py-3 bg-input-bg border border-border rounded-2xl shadow-soft text-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-card resize-none"
            ></textarea>
          </div>
          <div>
            <label class="block font-bold text-xs uppercase mb-2 text-text-title">任务池总积分 *</label>
            <input
              v-model="form.plannedLockNt"
              type="number"
              step="1"
              min="1"
              placeholder="将锁入合约 credit/lockedBalance 的总额（NT）"
              class="w-full h-12 px-4 bg-input-bg border border-border rounded-2xl shadow-soft text-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <p class="mt-2 text-xs text-text-body/80">
              提示：子任务的奖励/人数在管理页配置；本处仅填写任务池的总预算（链上锁定总额）。
            </p>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block font-bold text-xs uppercase mb-2 text-text-title">任务领取开始（可选）</label>
              <input
                v-model="form.startDate"
                type="datetime-local"
                :min="minStart"
                class="w-full h-12 px-4 bg-input-bg border border-border rounded-2xl shadow-soft text-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label class="block font-bold text-xs uppercase mb-2 text-text-title">领取截止时间 *</label>
              <input
                v-model="form.deadline"
                type="datetime-local"
                :min="form.startDate || minStart"
                class="w-full h-12 px-4 bg-input-bg border border-border rounded-2xl shadow-soft text-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
          <div>
            <label class="block font-bold text-xs uppercase mb-2 text-text-title">提交截止时间 *</label>
            <input
              v-model="form.submitDeadline"
              type="datetime-local"
              :min="form.deadline || form.startDate || minStart"
              class="w-full h-12 px-4 bg-input-bg border border-border rounded-2xl shadow-soft text-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <p v-if="dateError" class="text-sm text-destructive">{{ dateError }}</p>
        </div>
      </PixelCard>

      <div class="mt-8 flex flex-col sm:flex-row gap-3 justify-end">
        <PixelButton variant="secondary" class="sm:w-auto" @click="router.push('/tasks')">
          取消
        </PixelButton>
        <PixelButton
          variant="success"
          class="sm:flex-1"
          :disabled="!canSubmit || submitting"
          @click="submit"
        >
          {{ submitting ? '提交中…' : '创建并去管理页' }}
        </PixelButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import PixelCard from '~/components/pixel/PixelCard.vue'
import PixelButton from '~/components/pixel/PixelButton.vue'
import { createTask, getApiBaseUrl } from '~/utils/api'
import { getCurrentBeijingTime } from '~/utils/time'
import { useToast } from '~/composables/useToast'
import { useCommunityStore } from '~/stores/community'

definePageMeta({ layout: 'default' })

const router = useRouter()
const communityStore = useCommunityStore()
const toast = useToast()

const minStart = ref('')
const dateError = ref('')
const submitting = ref(false)

const TASKPOOL_DRAFT_KEY = 'mycoseed_taskpool_withdraw_draft'

const form = ref({
  title: '',
  description: '',
  plannedLockNt: '',
  startDate: '',
  deadline: '',
  submitDeadline: '',
})

const defaultProofConfig = {
  photo: { enabled: false, count: '1', requirements: '' },
  gps: { enabled: false, accuracy: 'high' },
  description: { enabled: false, minWords: 10, prompt: '' },
}

const validateDates = () => {
  dateError.value = ''
  if (!form.value.deadline || !form.value.submitDeadline) {
    dateError.value = '请填写领取截止时间与提交截止时间'
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

onMounted(() => {
  minStart.value = new Date().toISOString().slice(0, 16)
  // 如果是从“撤回任务池”进入，自动恢复草稿
  try {
    if (typeof window !== 'undefined') {
      const raw = sessionStorage.getItem(TASKPOOL_DRAFT_KEY)
      if (raw) {
        const draft = JSON.parse(raw || '{}') as any
        form.value.title = draft.title || form.value.title
        form.value.description = draft.description || form.value.description
        if (draft.plannedLockNt != null) form.value.plannedLockNt = String(draft.plannedLockNt)
        if (draft.startDate) form.value.startDate = draft.startDate
        if (draft.deadline) form.value.deadline = draft.deadline
        if (draft.submitDeadline) form.value.submitDeadline = draft.submitDeadline
        if (draft.communityId && !communityStore.currentCommunityId) {
          void communityStore.setCurrentCommunity(draft.communityId)
        }
        sessionStorage.removeItem(TASKPOOL_DRAFT_KEY)
        toast.add({ title: '已恢复草稿', description: '你可以继续修改后重新发布', color: 'green' })
      }
    }
  } catch {
    // 忽略草稿解析错误
  }
})

const submit = async () => {
  if (!communityStore.currentCommunityId) {
    toast.add({ title: '请先选择社区', color: 'red' })
    return
  }
  if (!validateDates() || !canSubmit.value) {
    toast.add({ title: '请检查表单', description: dateError.value || '必填项未完成', color: 'red' })
    return
  }
  submitting.value = true
  try {
    const baseUrl = getApiBaseUrl()
    const startDate = form.value.startDate || getCurrentBeijingTime()
    const task = await createTask(
      {
        title: form.value.title.trim(),
        description: form.value.description.trim(),
        // 任务池：链上语义以 plannedLockNt 为准；reward/participantLimit 仅用于兼容 tasks 行占位
        reward: 1,
        startDate,
        deadline: form.value.deadline,
        submitDeadline: form.value.submitDeadline,
        participantLimit: 1,
        rewardDistributionMode: 'per_person',
        submissionInstructions: '请按任务池要求完成子任务并提交凭证。',
        proofConfig: defaultProofConfig,
        communityId: communityStore.currentCommunityId || undefined,
        useTaskpool: true,
        allowSplit: true,
        plannedLockNt: Number(form.value.plannedLockNt),
      },
      baseUrl
    )
    const tid = task.taskInfoId
    if (!tid) {
      throw new Error('未返回 taskInfoId，无法打开管理页')
    }
    toast.add({ title: '任务池已创建', description: '正在进入管理页', color: 'green' })
    await router.push({
      path: `/tasks/pool/${tid}/manage`,
      query: { title: task.title || form.value.title },
    })
  } catch (e) {
    toast.add({
      title: '创建失败',
      description: e instanceof Error ? e.message : String(e),
      color: 'red',
    })
  } finally {
    submitting.value = false
  }
}
</script>
