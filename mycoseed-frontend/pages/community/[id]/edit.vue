<template>
  <div class="min-h-screen bg-background pb-24">
    <header class="sticky top-0 z-40 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
      <button type="button" class="p-2 -ml-2 rounded-xl hover:bg-input-bg" @click="router.back()">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7 7 7-7"/></svg>
      </button>
      <h1 class="text-lg font-bold text-text-title">编辑社区</h1>
      <div class="w-9" />
    </header>
    <div class="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <div v-if="error" class="text-red-600 text-sm">{{ error }}</div>
      <!-- 社区头像：点击上传 -->
      <div class="space-y-2">
        <label class="text-sm font-medium text-text-title">社区头像（可选）</label>
        <div class="flex items-center gap-4">
          <div class="w-20 h-20 rounded-xl overflow-hidden border border-border bg-input-bg flex-shrink-0">
            <img v-if="avatarPreview" :src="avatarPreview" alt="头像预览" class="w-full h-full object-cover" />
            <div v-else class="w-full h-full flex items-center justify-center text-2xl">🏘️</div>
          </div>
          <div class="flex flex-col gap-2">
            <input ref="avatarInputRef" type="file" accept="image/*" class="hidden" @change="onAvatarFileChange" />
            <button
              type="button"
              class="px-3 py-1.5 rounded-xl border border-border text-text-body text-sm hover:bg-input-bg"
              :disabled="avatarUploading"
              @click="avatarInputRef?.click()"
            >
              {{ avatarUploading ? '上传中...' : '选择头像' }}
            </button>
            <button
              v-if="form.avatarUrl"
              type="button"
              class="px-3 py-1.5 rounded-xl border border-border text-text-body text-sm hover:bg-input-bg"
              @click="clearAvatar"
            >
              清除
            </button>
          </div>
        </div>
        <p v-if="avatarUploadError" class="text-red-500 text-xs">{{ avatarUploadError }}</p>
      </div>
      <!-- 背景图（最多三张）：点击上传 -->
      <div class="space-y-2">
        <label class="text-sm font-medium text-text-title">背景图（最多三张）</label>
        <div class="grid grid-cols-3 gap-2">
          <div v-for="(url, idx) in form.backgroundImages" :key="idx" class="space-y-1">
            <div class="aspect-video rounded-xl border border-border bg-input-bg overflow-hidden">
              <img v-if="url" :src="url" :alt="`背景图 ${idx + 1}`" class="w-full h-full object-cover" />
              <div v-else class="w-full h-full flex items-center justify-center text-lg text-text-placeholder">图 {{ idx + 1 }}</div>
            </div>
            <input :ref="(el) => setBgInputRef(el, idx)" type="file" accept="image/*" class="hidden" @change="(e) => onBgFileChange(e, idx)" />
            <div class="flex gap-1">
              <button
                type="button"
                class="flex-1 px-2 py-1 rounded-lg border border-border text-text-body text-xs hover:bg-input-bg"
                :disabled="bgUploading[idx]"
                @click="triggerBgInput(idx)"
              >
                {{ bgUploading[idx] ? '上传中' : '上传' }}
              </button>
              <button
                v-if="url"
                type="button"
                class="px-2 py-1 rounded-lg border border-border text-text-body text-xs hover:bg-input-bg"
                @click="form.backgroundImages[idx] = ''"
              >
                清除
              </button>
            </div>
          </div>
        </div>
      </div>
      <div class="space-y-2">
        <label class="text-sm font-medium text-text-title">社区名称</label>
        <input v-model="form.name" type="text" class="w-full px-4 py-2 rounded-xl border border-border bg-input-bg text-text-body" placeholder="名称" />
      </div>
      <div class="space-y-2">
        <label class="text-sm font-medium text-text-title">简介（短文）</label>
        <textarea v-model="form.description" rows="2" class="w-full px-4 py-2 rounded-xl border border-border bg-input-bg text-text-body" placeholder="简短描述" />
      </div>
      <div class="space-y-2">
        <label class="text-sm font-medium text-text-title">社区介绍（Markdown）</label>
        <textarea v-model="form.markdownIntro" rows="8" class="w-full px-4 py-2 rounded-xl border border-border bg-input-bg text-text-body text-sm" placeholder="多行文字，换行会保留显示" />
      </div>
      <div class="space-y-2">
        <label class="text-sm font-medium text-text-title">积分名称</label>
        <input v-model="form.pointName" type="text" class="w-full px-4 py-2 rounded-xl border border-border bg-input-bg text-text-body" placeholder="如：南塘豆" />
      </div>
      <div v-if="community?.myRole === 'super_admin'" class="flex items-center gap-2">
        <input id="isPublic" v-model="form.isPublic" type="checkbox" class="rounded" />
        <label for="isPublic" class="text-sm text-text-body">公开社区（未勾选则为私有，需邀请码加入）</label>
      </div>
      <button
        type="button"
        class="w-full py-3 rounded-xl bg-primary text-white font-medium"
        :disabled="saving"
        @click="save"
      >
        {{ saving ? '保存中...' : '保存' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getCommunityById, updateCommunity, getApiBaseUrl, type Community } from '~/utils/api'
import { useFileUpload } from '~/composables/useFileUpload'
import { useApi } from '~/composables/useApi'

definePageMeta({ layout: 'default' })

const route = useRoute()
const router = useRouter()
const id = route.params.id as string
const community = ref<Community | null>(null)
const error = ref('')
const saving = ref(false)
const form = reactive({ name: '', description: '', markdownIntro: '', pointName: '积分', isPublic: true, avatarUrl: '', backgroundImages: ['', '', ''] as string[] })

// 头像上传
const avatarInputRef = ref<HTMLInputElement | null>(null)
const { uploading: avatarUploading, previewUrl: avatarPreviewUrl, error: uploadError, uploadFile: uploadAvatarFile, clearPreview: clearAvatarPreview } = useFileUpload()
const avatarUploadError = ref<string | null>(null)
const avatarPreview = computed(() => form.avatarUrl || avatarPreviewUrl.value)

async function onAvatarFileChange(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  avatarUploadError.value = null
  const url = await uploadAvatarFile(file)
  if (url) form.avatarUrl = url
  else avatarUploadError.value = uploadError?.value ?? '上传失败'
  target.value = ''
}

function clearAvatar() {
  form.avatarUrl = ''
  clearAvatarPreview()
  avatarUploadError.value = null
  avatarInputRef.value && (avatarInputRef.value.value = '')
}

// 背景图上传（三张）
const bgInputRefs = ref<(HTMLInputElement | null)[]>([])
const bgUploading = ref([false, false, false])
const api = useApi()

function setBgInputRef(el: any, idx: number) {
  if (el) bgInputRefs.value[idx] = el as HTMLInputElement
}

function triggerBgInput(idx: number) {
  bgInputRefs.value[idx]?.click()
}

async function onBgFileChange(e: Event, idx: number) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) {
    error.value = '请选择图片文件'
    target.value = ''
    return
  }
  if (file.size > 5 * 1024 * 1024) {
    error.value = '图片大小不能超过5MB'
    target.value = ''
    return
  }
  bgUploading.value[idx] = true
  try {
    const result = await api.uploadAvatar(file)
    form.backgroundImages[idx] = result.url
  } catch (err: any) {
    error.value = err.message || '上传失败'
  } finally {
    bgUploading.value[idx] = false
    target.value = ''
  }
}

onMounted(async () => {
  try {
    community.value = await getCommunityById(id)
    if (community.value) {
      form.name = community.value.name
      form.description = community.value.description || ''
      form.markdownIntro = community.value.markdownIntro || ''
      form.pointName = community.value.pointName || '积分'
      form.isPublic = community.value.isPublic !== false
      form.avatarUrl = community.value.avatarUrl || ''
      const bg = community.value.backgroundImages || []
      form.backgroundImages = [bg[0] || '', bg[1] || '', bg[2] || '']
    }
  } catch (e: any) {
    error.value = e.message || '加载失败'
  }
})

async function save() {
  if (!community.value?.myRole || (community.value.myRole !== 'super_admin' && community.value.myRole !== 'sub_admin')) {
    error.value = '无编辑权限'
    return
  }
  saving.value = true
  error.value = ''
  try {
    await updateCommunity(id, {
      name: form.name,
      description: form.description,
      markdownIntro: form.markdownIntro,
      pointName: form.pointName,
      isPublic: form.isPublic,
      avatarUrl: form.avatarUrl || undefined,
      backgroundImages: form.backgroundImages.filter(u => (u || '').trim()).slice(0, 3),
    }, getApiBaseUrl())
    await getCommunityById(id).then(c => { if (c) community.value = c })
    router.push('/')
  } catch (e: any) {
    error.value = e.message || '保存失败'
  } finally {
    saving.value = false
  }
}
</script>
