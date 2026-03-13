<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      @click.self="$emit('close')"
    >
      <div class="bg-card border border-border rounded-2xl shadow-lg max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div class="p-4 border-b border-border">
          <h3 class="font-bold text-text-title">分享到社区圈</h3>
        </div>
        <div class="p-4 overflow-y-auto flex-1 space-y-4">
          <div>
            <label class="block font-bold text-xs uppercase mb-2 text-text-title">内容</label>
            <textarea
              v-model="content"
              rows="6"
              :maxlength="POST_CONTENT_MAX_LENGTH"
              class="w-full px-4 py-3 bg-input-bg border border-border rounded-2xl text-base focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
              placeholder="分享内容"
            />
            <p class="text-xs text-text-placeholder mt-1">{{ content.length }} / {{ POST_CONTENT_MAX_LENGTH }}，内容可修改，字数限制与动态圈一致</p>
          </div>
          <div v-if="mode === 'claimer' && imageUrls.length > 0">
            <label class="block font-bold text-xs uppercase mb-2 text-text-title">凭证图片（可删除）</label>
            <div class="flex flex-wrap gap-2">
              <div
                v-for="(url, idx) in imageUrls"
                :key="idx"
                class="relative w-20 h-20 rounded-lg overflow-hidden border border-border"
              >
                <img :src="url" class="w-full h-full object-cover" alt="" />
                <button
                  type="button"
                  class="absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 text-white rounded-full flex items-center justify-center text-xs"
                  @click="removeImage(idx)"
                >
                  ×
                </button>
              </div>
            </div>
          </div>
        </div>
        <div class="p-4 border-t border-border flex gap-3">
          <button
            type="button"
            class="flex-1 py-2.5 rounded-xl bg-primary text-white font-medium disabled:opacity-50"
            :disabled="!content.trim() || !communityId || posting"
            @click="onPublish"
          >
            {{ posting ? '发布中...' : '发布' }}
          </button>
          <button
            type="button"
            class="px-4 py-2.5 rounded-xl border border-border text-text-body"
            @click="$emit('close')"
          >
            暂不分享
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { createPost, POST_CONTENT_MAX_LENGTH } from '~/utils/api'
import { getApiBaseUrl } from '~/utils/api'
import { formatBeijingTime } from '~/utils/time'

const props = defineProps<{
  visible: boolean
  mode: 'claimer' | 'reviewer'
  task: {
    id: string
    title: string
    completedAt?: string
    proof?: string | null
    receiverRemark?: string | null
    taskInfo?: { id?: string; communityId?: string | null }
  } | null
  senderRemark?: string
}>()

const emit = defineEmits<{ close: [] }>()

const content = ref('')
const imageUrls = ref<string[]>([])
const posting = ref(false)

const communityId = computed(() => props.task?.taskInfo?.communityId ?? null)

function parseProofImages(proof: string | undefined | null): string[] {
  if (!proof || !proof.trim().startsWith('{')) return []
  try {
    const p = JSON.parse(proof)
    const files = p.files || []
    const imageExt = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp']
    return files
      .filter((f: { url?: string; name?: string }) => {
        const u = f?.url || f?.name || ''
        const ext = u.split('.').pop()?.toLowerCase() || ''
        return imageExt.includes(ext) && !!f?.url
      })
      .map((f: { url: string }) => f.url)
  } catch {
    return []
  }
}

function buildInitialContent() {
  if (!props.task) return ''
  const { title, completedAt, receiverRemark } = props.task
  if (props.mode === 'claimer') {
    const line1 = `我于${formatBeijingTime(completedAt)}完成了任务：《${title}》`
    const line2 = receiverRemark?.trim() ? `\n备注：${receiverRemark.trim()}` : ''
    return (line1 + line2).slice(0, POST_CONTENT_MAX_LENGTH)
  }
  const line1 = `任务：《${title}》`
  const line2 = (props.senderRemark ?? '').trim() ? `\n备注：${(props.senderRemark ?? '').trim()}` : ''
  return (line1 + line2).slice(0, POST_CONTENT_MAX_LENGTH)
}

watch(
  () => [props.visible, props.task, props.mode, props.senderRemark],
  () => {
    if (props.visible && props.task) {
      content.value = buildInitialContent()
      imageUrls.value = props.mode === 'claimer' ? parseProofImages(props.task.proof) : []
    }
  },
  { immediate: true }
)

function removeImage(idx: number) {
  imageUrls.value = imageUrls.value.filter((_, i) => i !== idx)
}

async function onPublish() {
  if (!props.task || !content.value.trim()) return
  const cid = communityId.value
  if (!cid) return
  posting.value = true
  try {
    const baseUrl = getApiBaseUrl()
    // 调试：发帖是否带 taskId（排查关联任务 / linkTaskId，排查完可删）
    console.log('[ShareToCommunityModal] createPost 参数 taskId:', props.task?.taskInfo?.id, 'communityId:', cid)
    await createPost(
      {
        communityId: String(cid),
        content: content.value.trim(),
        taskId: props.task.taskInfo?.id ?? undefined,
        images: props.mode === 'claimer' ? imageUrls.value : []
      },
      baseUrl
    )
    emit('close')
  } catch (e) {
    console.error(e)
  } finally {
    posting.value = false
  }
}
</script>
