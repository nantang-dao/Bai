<template>
  <div class="min-h-screen bg-background pb-24">
    <div class="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div class="flex justify-between items-center">
        <h1 class="text-xl font-bold text-text-title">社区广场</h1>
        <button
          v-if="userStore.isSystemAdmin"
          type="button"
          class="px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium"
          @click="showCreateModal = true"
        >
          + 创建社区
        </button>
      </div>

      <!-- 搜索 + 邀请码 -->
      <div class="flex flex-wrap gap-2 items-center">
        <input
          v-model="searchQ"
          type="text"
          placeholder="搜索社区名称或描述"
          class="flex-1 min-w-[160px] px-4 py-2 rounded-2xl border border-border bg-input-bg text-text-body placeholder-text-placeholder"
          @input="debouncedFetch()"
        />
        <button
          type="button"
          class="px-4 py-2 rounded-2xl border border-border bg-card text-text-body hover:bg-input-bg"
          @click="showInviteModal = true"
        >
          填写邀请码
        </button>
      </div>

      <!-- 公开社区列表 -->
      <div v-if="loading" class="text-center py-8 text-text-placeholder">加载中...</div>
      <div v-else-if="error" class="text-center py-8 text-red-600">{{ error }}</div>
      <div v-else class="space-y-4">
        <div
          v-for="c in publicList"
          :key="c.id"
          class="bg-card rounded-2xl border border-border p-4 shadow-soft"
        >
          <div class="flex justify-between items-start gap-2">
            <div class="w-14 h-14 rounded-2xl overflow-hidden flex-shrink-0 bg-input-bg">
              <img v-if="c.avatarUrl" :src="c.avatarUrl" :alt="c.name" class="w-full h-full object-cover" />
              <PixelAvatar v-else :seed="c.name" size="md" class="!w-14 !h-14 !rounded-2xl" />
            </div>
            <div class="flex-1 min-w-0">
              <h2 class="font-bold text-text-title">{{ c.name }}</h2>
              <p class="text-sm text-text-body mt-1 line-clamp-2">{{ c.description || '暂无简介' }}</p>
              <p class="text-xs text-text-placeholder mt-2">{{ c.memberCount }} 人</p>
            </div>
            <div class="flex flex-col gap-2 shrink-0">
              <template v-if="joinedIds.has(c.id)">
                <button
                  type="button"
                  class="px-3 py-1.5 rounded-xl bg-primary text-white text-sm text-center w-full"
                  @click="enterCommunity(c.id)"
                >
                  进入
                </button>
                <button
                  type="button"
                  class="px-3 py-1.5 rounded-xl border border-border text-text-body text-sm"
                  @click="leave(c.id)"
                >
                  退出
                </button>
              </template>
              <button
                v-else
                type="button"
                class="px-3 py-1.5 rounded-xl bg-primary text-white text-sm"
                :disabled="joinLoading === c.id"
                @click="join(c.id)"
              >
                {{ joinLoading === c.id ? '处理中' : '加入' }}
              </button>
            </div>
          </div>
        </div>
        <div v-if="publicList.length === 0" class="text-center py-8 text-text-placeholder">
          暂无公开社区；可尝试填写邀请码加入私有社区。
        </div>
      </div>
    </div>

    <!-- 邀请码弹窗 -->
    <Teleport to="body">
      <div
        v-if="showInviteModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        @click.self="showInviteModal = false"
      >
        <div class="bg-card rounded-2xl shadow-soft border border-border p-6 w-full max-w-sm">
          <h3 class="font-bold text-text-title mb-2">填写邀请码</h3>
          <p class="text-sm text-text-body mb-3">输入社区邀请码（英文/拼音）加入私有社区，提交后需管理员审批。</p>
          <input
            v-model="inviteCode"
            type="text"
            placeholder="例如 nantang"
            class="w-full px-4 py-2 rounded-xl border border-border bg-input-bg text-text-body mb-4"
          />
          <div class="flex gap-2 justify-end">
            <button
              type="button"
              class="px-4 py-2 rounded-xl border border-border"
              @click="showInviteModal = false"
            >
              取消
            </button>
            <button
              type="button"
              class="px-4 py-2 rounded-xl bg-primary text-white"
              :disabled="!inviteCode.trim() || joinByCodeLoading"
              @click="joinByInviteCode()"
            >
              {{ joinByCodeLoading ? '提交中' : '提交' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 创建社区弹窗 -->
    <Teleport to="body">
      <div
        v-if="showCreateModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        @click.self="showCreateModal = false"
      >
        <div class="bg-card rounded-2xl shadow-soft border border-border p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
          <h3 class="font-bold text-text-title mb-4">创建社区</h3>
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-text-title mb-1">社区名称 *</label>
              <input
                v-model="createForm.name"
                type="text"
                placeholder="例如：有种行动队"
                class="w-full px-4 py-2 rounded-xl border border-border bg-input-bg text-text-body"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-text-title mb-1">邀请码（英文/拼音）*</label>
              <input
                v-model="createForm.slug"
                type="text"
                placeholder="例如：youzhong"
                class="w-full px-4 py-2 rounded-xl border border-border bg-input-bg text-text-body font-mono text-sm"
              />
              <p class="text-xs text-text-placeholder mt-1">将自动转换为小写，空格转为横线</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-text-title mb-1">简介</label>
              <textarea
                v-model="createForm.description"
                rows="2"
                placeholder="简短描述"
                class="w-full px-4 py-2 rounded-xl border border-border bg-input-bg text-text-body"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-text-title mb-1">社区介绍（Markdown）</label>
              <textarea
                v-model="createForm.markdownIntro"
                rows="6"
                placeholder="支持 Markdown 格式"
                class="w-full px-4 py-2 rounded-xl border border-border bg-input-bg text-text-body font-mono text-sm"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-text-title mb-1">积分名称</label>
              <input
                v-model="createForm.pointName"
                type="text"
                placeholder="例如：行动积分"
                class="w-full px-4 py-2 rounded-xl border border-border bg-input-bg text-text-body"
              />
            </div>
            <div class="flex items-center gap-2">
              <input id="createIsPublic" v-model="createForm.isPublic" type="checkbox" class="rounded" />
              <label for="createIsPublic" class="text-sm text-text-body">公开社区（未勾选则为私有，需邀请码加入）</label>
            </div>
            <div>
              <label class="block text-sm font-medium text-text-title mb-1">指定总管理员（可选）</label>
              <div class="relative">
                <input
                  v-model="superAdminSearch"
                  type="text"
                  placeholder="搜索用户名或 UUID，留空则使用当前用户"
                  class="w-full px-4 py-2 rounded-xl border border-border bg-input-bg text-text-body"
                  @input="searchSuperAdmin"
                  @focus="showSuperAdminDropdown = true"
                />
                <div
                  v-if="showSuperAdminDropdown && superAdminSearchResults.length > 0"
                  class="absolute z-10 w-full mt-1 bg-card border border-border rounded-xl shadow-lg max-h-48 overflow-y-auto"
                >
                  <button
                    v-for="u in superAdminSearchResults"
                    :key="u.id"
                    type="button"
                    class="w-full px-4 py-2 text-left hover:bg-input-bg text-text-body text-sm border-b border-border last:border-0"
                    @click="selectSuperAdmin(u)"
                  >
                    <div class="font-medium">{{ u.name || '未命名' }}</div>
                    <div class="text-xs text-text-placeholder font-mono">{{ u.id }}</div>
                  </button>
                </div>
              </div>
              <div v-if="selectedSuperAdmin" class="mt-2 px-3 py-2 rounded-lg bg-input-bg text-sm">
                <span class="text-text-body">已选择：</span>
                <span class="font-medium text-text-title">{{ selectedSuperAdmin.name || '未命名' }}</span>
                <button type="button" class="ml-2 text-red-600 text-xs" @click="clearSuperAdmin">清除</button>
              </div>
            </div>
            <div v-if="createError" class="text-red-600 text-sm">{{ createError }}</div>
            <div class="flex gap-2 justify-end">
              <button
                type="button"
                class="px-4 py-2 rounded-xl border border-border"
                @click="showCreateModal = false"
              >
                取消
              </button>
              <button
                type="button"
                class="px-4 py-2 rounded-xl bg-primary text-white"
                :disabled="!createForm.name.trim() || !createForm.slug.trim() || createLoading"
                @click="doCreateCommunity"
              >
                {{ createLoading ? '创建中...' : '创建' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCommunityStore } from '~/stores/community'
import { useUserStore } from '~/stores/user'
import { getCommunities, joinCommunity, leaveCommunity, joinCommunityByInviteCode, createCommunity, getAllUsers, getApiBaseUrl, type Community, type UserListItem } from '~/utils/api'
import PixelAvatar from '~/components/pixel/PixelAvatar.vue'

definePageMeta({ layout: 'default' })

const route = useRoute()
const router = useRouter()
const communityStore = useCommunityStore()
const userStore = useUserStore()
const searchQ = ref('')
const publicList = ref<Community[]>([])
const myCommunities = ref<Community[]>([])
const loading = ref(true)
const error = ref('')
const joinLoading = ref<string | null>(null)
const joinByCodeLoading = ref(false)
const showInviteModal = ref(false)
const inviteCode = ref('')
const showCreateModal = ref(false)
const createLoading = ref(false)
const createError = ref('')
const createForm = ref({
  name: '',
  slug: '',
  description: '',
  markdownIntro: '',
  pointName: '积分',
  isPublic: true,
  superAdminId: '',
})
const superAdminSearch = ref('')
const superAdminSearchResults = ref<UserListItem[]>([])
const selectedSuperAdmin = ref<UserListItem | null>(null)
const showSuperAdminDropdown = ref(false)
const allUsers = ref<UserListItem[]>([])

const joinedIds = computed(() => new Set(myCommunities.value.map(c => c.id)))

let debounceTimer: ReturnType<typeof setTimeout> | null = null
function debouncedFetch() {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(fetchPublic, 300)
}

async function fetchPublic() {
  loading.value = true
  error.value = ''
  try {
    const baseUrl = getApiBaseUrl()
    publicList.value = await getCommunities({ q: searchQ.value.trim() || undefined }, baseUrl)
  } catch (e: any) {
    error.value = e.message || '加载失败'
    publicList.value = []
  } finally {
    loading.value = false
  }
}

async function fetchMine() {
  try {
    const baseUrl = getApiBaseUrl()
    myCommunities.value = await getCommunities({ mine: true }, baseUrl)
  } catch (_) {
    myCommunities.value = []
  }
}

async function join(communityId: string) {
  joinLoading.value = communityId
  try {
    await joinCommunity(communityId, getApiBaseUrl(), {})
    await fetchMine()
    await fetchPublic()
  } catch (e: any) {
    alert(e.message || '加入失败')
  } finally {
    joinLoading.value = null
  }
}

async function leave(communityId: string) {
  if (!confirm('确定退出该社区？')) return
  try {
    await leaveCommunity(communityId, getApiBaseUrl())
    await fetchMine()
    await fetchPublic()
    if (communityStore.currentCommunityId === communityId) {
      communityStore.currentCommunityId = null
      communityStore.currentCommunity = null
    }
  } catch (e: any) {
    alert(e.message || '退出失败')
  }
}

/** 进入已加入的社区：切换当前社区并跳转到来源页（若从任务/公告等来）或首页 */
async function enterCommunity(communityId: string) {
  await communityStore.setCurrentCommunity(communityId)
  const from = route.query.from as string | undefined
  const target = from && from.startsWith('/') && from !== '/communities' ? from : '/'
  await router.push(target)
}

async function joinByInviteCode() {
  const code = inviteCode.value.trim().toLowerCase().replace(/\s+/g, '-')
  if (!code) return
  joinByCodeLoading.value = true
  try {
    const baseUrl = getApiBaseUrl()
    const data = await joinCommunityByInviteCode(code, baseUrl)
    showInviteModal.value = false
    inviteCode.value = ''
    await fetchMine()
    await fetchPublic()
    alert(data.message || '操作成功')
  } catch (e: any) {
    alert(e.message || '提交失败')
  } finally {
    joinByCodeLoading.value = false
  }
}

function searchSuperAdmin() {
  const q = superAdminSearch.value.trim().toLowerCase()
  if (!q) {
    superAdminSearchResults.value = []
    return
  }
  superAdminSearchResults.value = allUsers.value.filter(u => 
    (u.name && u.name.toLowerCase().includes(q)) ||
    u.id.toLowerCase().includes(q) ||
    (u.phone && u.phone.includes(q)) ||
    (u.email && u.email.toLowerCase().includes(q))
  ).slice(0, 10)
}

function selectSuperAdmin(user: UserListItem) {
  selectedSuperAdmin.value = user
  createForm.value.superAdminId = user.id
  superAdminSearch.value = user.name || user.id
  showSuperAdminDropdown.value = false
}

function clearSuperAdmin() {
  selectedSuperAdmin.value = null
  createForm.value.superAdminId = ''
  superAdminSearch.value = ''
  superAdminSearchResults.value = []
}

async function loadUsers() {
  try {
    allUsers.value = await getAllUsers(getApiBaseUrl())
  } catch (_) {
    allUsers.value = []
  }
}

async function doCreateCommunity() {
  if (!createForm.value.name.trim() || !createForm.value.slug.trim()) {
    createError.value = '请填写社区名称和邀请码'
    return
  }
  createLoading.value = true
  createError.value = ''
  try {
    const baseUrl = getApiBaseUrl()
    const newCommunity = await createCommunity({
      name: createForm.value.name.trim(),
      slug: createForm.value.slug.trim(),
      description: createForm.value.description.trim() || undefined,
      markdownIntro: createForm.value.markdownIntro.trim() || undefined,
      pointName: createForm.value.pointName.trim() || '积分',
      isPublic: createForm.value.isPublic,
      superAdminId: selectedSuperAdmin.value?.id || createForm.value.superAdminId.trim() || undefined,
    }, baseUrl)
    showCreateModal.value = false
    createForm.value = { name: '', slug: '', description: '', markdownIntro: '', pointName: '积分', isPublic: true, superAdminId: '' }
    clearSuperAdmin()
    await fetchPublic()
    await fetchMine()
    alert('社区创建成功！')
  } catch (e: any) {
    createError.value = e.message || '创建失败'
  } finally {
    createLoading.value = false
  }
}

onMounted(() => {
  fetchPublic()
  fetchMine()
  if (userStore.isSystemAdmin) loadUsers()
})
watch(() => showCreateModal.value, (show) => {
  if (show && userStore.isSystemAdmin && allUsers.value.length === 0) loadUsers()
})
</script>
