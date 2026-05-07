<template>
  <div class="min-h-screen bg-background pb-24">
    <!-- 顶部导航 -->
    <header class="sticky top-0 z-40 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
      <button
        class="p-2 -ml-2 rounded-xl hover:bg-input-bg text-text-title transition-colors"
        @click="router.back()"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <h1 class="text-lg font-bold text-text-title">设置</h1>
      <div class="w-9" />
    </header>

    <!-- 用户信息区 -->
    <div class="px-4 pt-6 pb-4 flex flex-col items-center">
      <PixelAvatar
        v-if="user?.avatar"
        :src="user.avatar"
        size="xl"
      />
      <PixelAvatar
        v-else
        :seed="user?.name || user?.id || 'user'"
        size="xl"
      />
      <h2 class="mt-3 text-xl font-bold text-text-title">{{ user?.name || '未设置昵称' }}</h2>
      <p class="mt-1 text-sm text-text-placeholder">u1 • {{ shortAddress }}</p>
    </div>

    <!-- 账号 -->
    <section class="px-4 mt-6">
      <h3 class="text-sm font-bold text-text-body mb-2">账号</h3>
      <div class="bg-card rounded-2xl shadow-soft overflow-hidden border border-border">
        <button
          type="button"
          class="w-full flex items-center gap-3 px-4 py-4 border-b border-border active:bg-input-bg transition-colors text-left"
          @click="openProfileModal"
        >
          <span class="w-10 h-10 rounded-xl bg-input-bg flex items-center justify-center text-xl">👤</span>
          <div class="flex-1">
            <div class="font-medium text-text-title">个人信息</div>
            <div class="text-sm text-text-placeholder">点击修改基本信息</div>
          </div>
          <svg class="w-5 h-5 text-text-placeholder" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
        <NuxtLink
          :to="walletLink"
          class="flex items-center gap-3 px-4 py-4 active:bg-input-bg transition-colors"
        >
          <span class="w-10 h-10 rounded-xl bg-input-bg flex items-center justify-center text-xl">👛</span>
          <div class="flex-1 text-left">
            <div class="font-medium text-text-title">数字钱包</div>
            <div class="text-sm text-text-placeholder">查看资产与交易记录</div>
          </div>
          <svg class="w-5 h-5 text-text-placeholder" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </NuxtLink>
      </div>
    </section>

    <!-- 社区管理（仅当前社区管理员可见） -->
    <section v-if="communityStore.currentCommunityId && isCommunityAdmin" class="px-4 mt-6">
      <h3 class="text-sm font-bold text-text-body mb-2">社区管理</h3>
      <div class="bg-card rounded-2xl shadow-soft overflow-hidden border border-border">
        <NuxtLink
          :to="`/community/${communityStore.currentCommunityId}/manage`"
          class="flex items-center gap-3 px-4 py-4 border-b border-border active:bg-input-bg transition-colors"
        >
          <span class="w-10 h-10 rounded-xl bg-input-bg flex items-center justify-center text-xl">👥</span>
          <div class="flex-1 text-left">
            <div class="font-medium text-text-title">成员管理</div>
            <div class="text-sm text-text-placeholder">{{ communityStore.currentCommunity?.name }} · 成员、审批、转让</div>
          </div>
          <svg class="w-5 h-5 text-text-placeholder" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </NuxtLink>
        <NuxtLink
          :to="`/community/${communityStore.currentCommunityId}/settings`"
          class="flex items-center gap-3 px-4 py-4 active:bg-input-bg transition-colors"
        >
          <span class="w-10 h-10 rounded-xl bg-input-bg flex items-center justify-center text-xl">⚙️</span>
          <div class="flex-1 text-left">
            <div class="font-medium text-text-title">社区功能设置</div>
            <div class="text-sm text-text-placeholder">社区公开可见性，社区标签管理，社区功能包管理</div>
          </div>
          <svg class="w-5 h-5 text-text-placeholder" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </NuxtLink>
      </div>
    </section>

    <!-- 通用 -->
    <section class="px-4 mt-6">
      <h3 class="text-sm font-bold text-text-body mb-2">通用</h3>
      <div class="bg-card rounded-2xl shadow-soft overflow-hidden border border-border">
        <NuxtLink
          to="/settings/notifications"
          class="flex items-center gap-3 px-4 py-4 border-b border-border active:bg-input-bg transition-colors"
        >
          <span class="w-10 h-10 rounded-xl bg-input-bg flex items-center justify-center text-xl">🔔</span>
          <div class="flex-1 text-left">
            <div class="font-medium text-text-title">消息通知</div>
            <div class="text-sm text-text-placeholder">管理推送消息</div>
          </div>
          <svg class="w-5 h-5 text-text-placeholder" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </NuxtLink>
        <div class="flex items-center gap-3 px-4 py-4 border-b border-border cursor-not-allowed opacity-70">
          <span class="w-10 h-10 rounded-xl bg-input-bg flex items-center justify-center text-xl">🌙</span>
          <div class="flex-1 text-left">
            <div class="font-medium text-text-title">外观设置</div>
            <div class="text-sm text-text-placeholder">切换深色模式</div>
          </div>
          <span class="text-sm text-text-placeholder">浅色</span>
          <svg class="w-5 h-5 text-text-placeholder" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </div>
        <div class="flex items-center gap-3 px-4 py-4 cursor-not-allowed opacity-70">
          <span class="w-10 h-10 rounded-xl bg-input-bg flex items-center justify-center text-xl">⚙️</span>
          <div class="flex-1 text-left">
            <div class="font-medium text-text-title">系统设置</div>
            <div class="text-sm text-text-placeholder">语言、缓存管理</div>
          </div>
          <svg class="w-5 h-5 text-text-placeholder" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </section>

    <!-- 其他 -->
    <section class="px-4 mt-6">
      <h3 class="text-sm font-bold text-text-body mb-2">其他</h3>
      <div class="bg-card rounded-2xl shadow-soft overflow-hidden border border-border">
        <NuxtLink
          to="/settings/help"
          class="flex items-center gap-3 px-4 py-4 active:bg-input-bg transition-colors"
        >
          <span class="w-10 h-10 rounded-xl bg-input-bg flex items-center justify-center text-xl">❓</span>
          <div class="flex-1 text-left">
            <div class="font-medium text-text-title">帮助与反馈</div>
            <div class="text-sm text-text-placeholder">FAQ、联系我们</div>
          </div>
          <svg class="w-5 h-5 text-text-placeholder" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </NuxtLink>
      </div>
    </section>

    <!-- 退出登录 -->
    <div class="px-4 mt-8">
      <button
        class="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-destructive text-white font-medium shadow-soft hover:opacity-90 transition-opacity"
        @click="showLogoutModal = true"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
        退出登录
      </button>
    </div>

    <!-- 个人信息弹窗（个人中心） -->
    <Transition name="modal">
      <div
        v-if="showProfileModal"
        class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        @click.self="closeProfileModal"
      >
        <div class="bg-card rounded-3xl shadow-soft-lg max-w-sm w-full max-h-[90vh] overflow-y-auto">
          <div class="p-6">
            <h3 class="text-xl font-bold text-text-title mb-4">个人中心</h3>

            <!-- 头像 -->
            <div class="flex flex-col items-center mb-4">
              <div class="relative">
                <div v-if="profilePreviewUrl || profileForm.avatar" class="w-24 h-24 rounded-2xl border border-border overflow-hidden bg-input-bg">
                  <img :src="profilePreviewUrl || profileForm.avatar" alt="头像" class="w-full h-full object-cover" />
                </div>
                <div v-else class="w-24 h-24 rounded-2xl border border-border bg-input-bg flex items-center justify-center">
                  <span class="text-3xl">👤</span>
                </div>
              </div>
              <input
                ref="profileAvatarInput"
                type="file"
                accept="image/*"
                class="hidden"
                @change="onProfileAvatarChange"
              />
              <div class="flex gap-2 mt-2">
                <PixelButton variant="secondary" size="sm" :disabled="profileUploading" @click="profileAvatarInput?.click()">
                  {{ profileUploading ? '上传中...' : '更换头像' }}
                </PixelButton>
                <PixelButton v-if="profilePreviewUrl || profileForm.avatar" variant="secondary" size="sm" @click="clearProfileAvatar">
                  清除
                </PixelButton>
              </div>
              <p v-if="profileUploadError" class="text-destructive text-xs mt-1">{{ profileUploadError }}</p>
            </div>

            <!-- 昵称 -->
            <div class="mb-4">
              <label class="block text-sm font-bold text-text-body mb-1">昵称 *</label>
              <input
                v-model="profileForm.name"
                type="text"
                placeholder="输入昵称"
                class="w-full h-11 px-3 bg-input-bg border border-border rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-primary/20"
                :disabled="profileSaving"
              />
            </div>

            <!-- 个人简介 -->
            <div class="mb-4">
              <label class="block text-sm font-bold text-text-body mb-1">个人简介</label>
              <textarea
                v-model="profileForm.bio"
                placeholder="介绍一下自己..."
                rows="3"
                class="w-full px-3 py-2 bg-input-bg border border-border rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                :disabled="profileSaving"
              />
            </div>

            <!-- 身份信息（只读） -->
            <div class="mb-4 p-3 bg-input-bg rounded-xl border border-border">
              <div class="text-sm font-bold text-text-body mb-2">身份信息</div>
              <div class="text-sm text-text-placeholder space-y-1">
                <div>用户 ID：<span class="text-text-body">{{ displayUserId }}</span></div>
                <div v-if="profileForm.userType">身份类型：<span class="text-text-body">{{ profileForm.userType === 'community' ? '社区' : '成员' }}</span></div>
              </div>
            </div>

            <p v-if="profileError" class="text-destructive text-sm mb-3">{{ profileError }}</p>

            <div class="flex gap-3">
              <PixelButton variant="secondary" block @click="closeProfileModal" :disabled="profileSaving">取消</PixelButton>
              <PixelButton variant="primary" block @click="saveProfile" :disabled="profileSaving || !profileForm.name?.trim() || profileUploading">
                {{ profileSaving ? '保存中...' : '确认' }}
              </PixelButton>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 登出确认弹窗 -->
    <Transition name="modal">
      <div
        v-if="showLogoutModal"
        class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
        @click.self="showLogoutModal = false"
      >
        <div class="bg-card rounded-3xl shadow-soft-lg p-6 max-w-sm w-full mx-4">
          <h3 class="text-xl font-bold text-text-title mb-4">确认登出</h3>
          <p class="text-text-body mb-6">确定要登出吗？登出后需要重新登录。</p>
          <div class="flex gap-3">
            <PixelButton variant="primary" block @click="confirmLogout">确认登出</PixelButton>
            <PixelButton variant="secondary" block @click="showLogoutModal = false">取消</PixelButton>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'default',
  middleware: 'auth'
})

const router = useRouter()
const userStore = useUserStore()
const communityStore = useCommunityStore()
const isCommunityAdmin = computed(() => {
  const r = communityStore.currentCommunity?.myRole
  return r === 'super_admin' || r === 'sub_admin'
})
const toast = useToast()
const { updateUserProfile, getMe } = useApi()
const {
  uploading: profileUploading,
  previewUrl: profilePreviewUrl,
  error: profileUploadError,
  uploadFile: profileUploadFile,
  clearPreview: clearProfilePreview
} = useFileUpload()

const showLogoutModal = ref(false)
const showProfileModal = ref(false)
const profileAvatarInput = ref<HTMLInputElement | null>(null)
const profileSaving = ref(false)
const profileError = ref<string | null>(null)

const profileForm = reactive({
  name: '',
  bio: '',
  avatar: '',
  userType: '' as '' | 'member' | 'community'
})

const user = computed(() => userStore.user)

const shortAddress = computed(() => {
  const id = user.value?.id
  if (!id || typeof id !== 'string') return '—'
  if (id.length <= 12) return id
  return `${id.slice(0, 6)}...${id.slice(-4)}`
})

const displayUserId = computed(() => shortAddress.value)

const walletLink = computed(() => {
  const id = user.value?.id
  if (!id) return '/'
  return `/member/${id}`
})

function openProfileModal() {
  const u = userStore.user
  if (!u) return
  profileForm.name = u.name || ''
  profileForm.bio = u.bio || ''
  profileForm.avatar = u.avatar || ''
  profileForm.userType = (u as any).userType || 'member'
  profilePreviewUrl.value = u.avatar || null
  profileError.value = null
  showProfileModal.value = true
}

function closeProfileModal() {
  showProfileModal.value = false
  profileError.value = null
  clearProfilePreview()
}

async function onProfileAvatarChange(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  const url = await profileUploadFile(file)
  if (url) profileForm.avatar = url
  target.value = ''
}

function clearProfileAvatar() {
  clearProfilePreview()
  profileForm.avatar = ''
}

async function saveProfile() {
  const name = profileForm.name?.trim()
  if (!name) {
    profileError.value = '请输入昵称'
    return
  }
  if (name.length > 50) {
    profileError.value = '昵称不能超过50个字符'
    return
  }
  const u = userStore.user
  if (!u?.id) {
    profileError.value = '用户信息获取失败，请重新登录'
    return
  }

  profileSaving.value = true
  profileError.value = null
  try {
    const result = await updateUserProfile(u.id, {
      name,
      bio: profileForm.bio?.trim() || undefined,
      avatar: profileForm.avatar || undefined
    })
    if (result.success) {
      const updatedUser = await getMe()
      userStore.setUser({
        ...updatedUser,
        userType: (updatedUser as any).userType || 'member'
      })
      toast.add({ title: '保存成功', description: '个人信息已更新' })
      closeProfileModal()
    } else {
      profileError.value = result.message || '保存失败，请重试'
    }
  } catch (err) {
    console.error('Save profile error:', err)
    profileError.value = '保存失败，请重试'
  } finally {
    profileSaving.value = false
  }
}

const confirmLogout = async () => {
  showLogoutModal.value = false
  await userStore.signout()
  if (typeof window !== 'undefined') {
    localStorage.clear()
    sessionStorage.clear()
  }
  await router.replace('/auth/login')
  if (typeof window !== 'undefined') {
    window.location.href = '/auth/login'
  }
}
</script>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-from > div,
.modal-leave-to > div {
  transform: scale(0.9);
}
</style>
