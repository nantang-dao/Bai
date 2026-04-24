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
          <div>
            <label class="block font-bold text-xs uppercase mb-2 text-text-title">图片（可选，最多 9 张）</label>
            <input
              type="file"
              accept="image/*"
              multiple
              class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary/80 cursor-pointer"
              @change="onFileChange"
            />
            <p class="text-xs text-text-placeholder mt-1">
              {{ mode === 'claimer' ? '会自动带入凭证图片，你也可以额外上传；发布前都可删除。' : '可选，发布前都可删除。' }}
            </p>

            <div v-if="allPreviewUrls.length" class="grid grid-cols-3 gap-2 mt-4">
              <div
                v-for="(url, index) in allPreviewUrls"
                :key="`${url}-${index}`"
                class="relative aspect-square rounded-lg overflow-hidden border border-border"
              >
                <img :src="url" class="w-full h-full object-cover" alt="预览" />
                <button
                  type="button"
                  class="absolute top-1 right-1 w-6 h-6 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black/70"
                  @click="removeImage(index)"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
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
import { ref, watch, computed, onUnmounted } from 'vue'
import { createPost, POST_CONTENT_MAX_LENGTH, uploadPostImage } from '~/utils/api'
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
  /** 链上备注：claimer 用接包者备注；reviewer 用发包者备注 */
  onchainRemark?: string | null
}>()

const emit = defineEmits<{ close: [] }>()

const content = ref('')
/** 已有图片：默认来自凭证，可手动删除 */
const existingImages = ref<string[]>([])
/** 新选图片：本地预览 + 发布时上传 */
const selectedFiles = ref<File[]>([])
const previewUrls = ref<string[]>([])
const posting = ref(false)

const communityId = computed(() => props.task?.taskInfo?.communityId ?? null)
const allPreviewUrls = computed(() => [...existingImages.value, ...previewUrls.value])

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
    const safeTime = completedAt ? formatBeijingTime(completedAt) : ''
    const line1 = safeTime ? `我于${safeTime}完成了任务：《${title}》` : `我完成了任务：《${title}》`
    const remark = String(props.onchainRemark || receiverRemark || '').trim()
    const line2 = remark ? `\n链上备注：${remark}` : ''
    return (line1 + line2).slice(0, POST_CONTENT_MAX_LENGTH)
  }
  const line1 = `任务：《${title}》`
  const line2 = (props.senderRemark ?? '').trim() ? `\n备注：${(props.senderRemark ?? '').trim()}` : ''
  return (line1 + line2).slice(0, POST_CONTENT_MAX_LENGTH)
}

watch(
  () => [props.visible, props.task, props.mode, props.senderRemark, props.onchainRemark],
  () => {
    if (props.visible && props.task) {
      content.value = buildInitialContent()
      existingImages.value = props.mode === 'claimer' ? parseProofImages(props.task.proof) : []
      // 重置用户额外选择的图片
      previewUrls.value.forEach((u) => URL.revokeObjectURL(u))
      selectedFiles.value = []
      previewUrls.value = []
    }
  },
  { immediate: true }
)

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const files = input.files
  if (!files?.length) return

  const remaining = Math.max(0, 9 - existingImages.value.length)
  const list = Array.from(files).slice(0, remaining)
  previewUrls.value.forEach((u) => URL.revokeObjectURL(u))
  selectedFiles.value = list
  previewUrls.value = list.map((f) => URL.createObjectURL(f))
}

function removeImage(index: number) {
  // index 是合并后的 allPreviewUrls 索引：先 existingImages，再 previewUrls
  if (index < existingImages.value.length) {
    existingImages.value.splice(index, 1)
    return
  }
  const fileIndex = index - existingImages.value.length
  if (previewUrls.value[fileIndex]) URL.revokeObjectURL(previewUrls.value[fileIndex])
  selectedFiles.value.splice(fileIndex, 1)
  previewUrls.value.splice(fileIndex, 1)
  const input = document.querySelector('input[type="file"]') as HTMLInputElement
  if (input) input.value = ''
}

async function onPublish() {
  if (!props.task || !content.value.trim()) return
  const cid = communityId.value
  if (!cid) return
  posting.value = true
  try {
    const baseUrl = getApiBaseUrl()
    const text = content.value.trim()

    if (selectedFiles.value.length > 0) {
      const postId = crypto.randomUUID()
      const uploadRes = await uploadPostImage({
        postId,
        communityId: String(cid),
        files: selectedFiles.value,
        baseUrl,
      })
      const uploaded = (uploadRes.files || []).map((f) => f.url).filter(Boolean)
      const mergedImages = [...existingImages.value, ...uploaded].slice(0, 9)
      await createPost(
        {
          communityId: String(cid),
          content: text,
          taskId: props.task.taskInfo?.id ?? undefined,
          images: mergedImages,
          postId,
        },
        baseUrl
      )
    } else {
      await createPost(
        {
          communityId: String(cid),
          content: text,
          taskId: props.task.taskInfo?.id ?? undefined,
          images: existingImages.value.slice(0, 9),
        },
        baseUrl
      )
    }
    emit('close')
  } catch (e) {
    console.error(e)
  } finally {
    posting.value = false
  }
}

onUnmounted(() => {
  previewUrls.value.forEach((u) => URL.revokeObjectURL(u))
})
</script>
