<template>
  <div class="min-h-screen bg-background pb-24">
    <header class="sticky top-0 z-40 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
      <button type="button" class="p-2 -ml-2 rounded-xl hover:bg-input-bg" @click="router.back()">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7 7 7-7"/></svg>
      </button>
      <h1 class="text-lg font-bold text-text-title">成员管理</h1>
      <div class="w-9" />
    </header>
    <div class="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <p v-if="!community" class="text-text-placeholder">加载中...</p>
      <template v-else>
        <p v-if="!isAdmin" class="text-red-600">无权限</p>
        <template v-else>
          <!-- 总管理员：公开/私有、邀请码 -->
          <section v-if="community.myRole === 'super_admin'" class="bg-card rounded-2xl border border-border p-4 space-y-3">
            <h2 class="font-bold text-text-title">社区可见性</h2>
            <div class="flex items-center gap-2">
              <input id="isPublic" v-model="isPublic" type="checkbox" class="rounded" @change="updatePublic" />
              <label for="isPublic" class="text-sm text-text-body">公开（未勾选则需邀请码加入并审批）</label>
            </div>
            <div v-if="community.slug" class="flex items-center gap-2">
              <span class="text-sm text-text-body">邀请码：</span>
              <code class="flex-1 px-2 py-1 rounded bg-input-bg text-text-title">{{ community.slug }}</code>
              <button type="button" class="px-3 py-1 rounded-lg border border-border text-sm" @click="copySlug">复制</button>
            </div>
          </section>

          <!-- 总管理员：转让总管理员 -->
          <section v-if="community.myRole === 'super_admin'" class="bg-card rounded-2xl border border-border p-4 space-y-3">
            <h2 class="font-bold text-text-title">转让总管理员</h2>
            <p class="text-sm text-text-body">转让后您将降为普通成员或分管理员，且无法再设置公开/私有或任命分管理员。</p>
            <div class="flex gap-2 flex-wrap">
              <select v-model="transferTarget" class="flex-1 min-w-[120px] px-3 py-2 rounded-xl border border-border bg-input-bg text-text-body">
                <option value="">选择成员</option>
                <option v-for="m in members.filter(m => m.role !== 'super_admin' && m.userId !== userStore.user?.id)" :key="m.userId" :value="m.userId">{{ m.name || m.userId }}</option>
              </select>
              <select v-model="demoteTo" class="px-3 py-2 rounded-xl border border-border bg-input-bg text-text-body">
                <option value="member">转让后我变为：成员</option>
                <option value="sub_admin">转让后我变为：分管理员</option>
              </select>
              <button type="button" class="px-4 py-2 rounded-xl bg-primary text-white text-sm" :disabled="!transferTarget || transferring" @click="doTransfer">确认转让</button>
            </div>
          </section>

          <!-- 总管理员：任命/撤销分管理员（在成员列表中操作） -->

          <!-- 待审批入群申请 -->
          <section v-if="joinRequests.length > 0" class="bg-card rounded-2xl border border-border p-4 space-y-3">
            <h2 class="font-bold text-text-title">待审批申请</h2>
            <ul class="space-y-2">
              <li v-for="r in joinRequests" :key="r.id" class="flex items-center justify-between py-2 border-b border-border last:border-0">
                <span class="text-text-body">{{ r.name || r.userId }}</span>
                <div class="flex gap-2">
                  <button type="button" class="px-2 py-1 rounded bg-green-600 text-white text-sm" @click="approve(r.id)">通过</button>
                  <button type="button" class="px-2 py-1 rounded border border-border text-sm" @click="reject(r.id)">拒绝</button>
                </div>
              </li>
            </ul>
          </section>

          <!-- 添加成员 -->
          <section class="bg-card rounded-2xl border border-border p-4 space-y-3">
            <h2 class="font-bold text-text-title">添加成员</h2>
            <div class="relative">
              <input
                v-model="addMemberSearch"
                type="text"
                placeholder="搜索用户名、UUID、手机号或邮箱"
                class="w-full px-4 py-2 rounded-xl border border-border bg-input-bg text-text-body"
                @input="searchAddMember"
                @focus="showAddMemberDropdown = true"
              />
              <div
                v-if="showAddMemberDropdown && addMemberSearchResults.length > 0"
                class="absolute z-10 w-full mt-1 bg-card border border-border rounded-xl shadow-lg max-h-48 overflow-y-auto"
              >
                <button
                  v-for="u in addMemberSearchResults"
                  :key="u.id"
                  type="button"
                  class="w-full px-4 py-2 text-left hover:bg-input-bg text-text-body text-sm border-b border-border last:border-0"
                  @click="selectAddMember(u)"
                >
                  <div class="font-medium">{{ u.name || '未命名' }}</div>
                  <div class="text-xs text-text-placeholder font-mono">{{ u.id }}</div>
                </button>
              </div>
            </div>
            <div v-if="selectedAddMember" class="px-3 py-2 rounded-lg bg-input-bg text-sm flex items-center justify-between">
              <div>
                <span class="text-text-body">已选择：</span>
                <span class="font-medium text-text-title">{{ selectedAddMember.name || '未命名' }}</span>
              </div>
              <div class="flex gap-2">
                <select v-model="addMemberRole" class="px-2 py-1 rounded border border-border bg-card text-sm text-text-body">
                  <option value="member">成员</option>
                  <option v-if="community.myRole === 'super_admin'" value="sub_admin">分管理员</option>
                </select>
                <button type="button" class="px-3 py-1 rounded bg-primary text-white text-sm" @click="doAddMember">添加</button>
                <button type="button" class="px-2 py-1 rounded border border-border text-sm" @click="clearAddMember">取消</button>
              </div>
            </div>
          </section>

          <!-- 成员列表 -->
          <section class="bg-card rounded-2xl border border-border p-4 space-y-3">
            <h2 class="font-bold text-text-title">成员 ({{ members.length }})</h2>
            <ul class="space-y-2">
              <li v-for="m in members" :key="m.userId" class="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div class="flex items-center gap-2">
                  <PixelAvatar :seed="m.avatar || m.name || m.userId" size="sm" />
                  <span class="text-text-body">{{ m.name || m.userId }}</span>
                  <span class="text-xs text-text-placeholder">({{ roleLabel(m.role) }})</span>
                </div>
                <div v-if="canManageMember(m)" class="flex gap-2">
                  <template v-if="community.myRole === 'super_admin'">
                    <button v-if="m.role === 'member'" type="button" class="px-2 py-1 rounded border border-border text-xs" @click="setRole(m.userId, 'sub_admin')">设为分管理员</button>
                    <button v-if="m.role === 'sub_admin'" type="button" class="px-2 py-1 rounded border border-border text-xs" @click="setRole(m.userId, 'member')">撤销分管理员</button>
                  </template>
                  <button v-if="m.role !== 'super_admin' && m.userId !== userStore.user?.id" type="button" class="px-2 py-1 rounded text-red-600 border border-red-300 text-xs" @click="removeMember(m.userId)">移出</button>
                </div>
              </li>
            </ul>
          </section>
        </template>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '~/stores/user'
import PixelAvatar from '~/components/pixel/PixelAvatar.vue'
import {
  getCommunityById,
  getCommunityMembers,
  updateCommunity,
  transferSuperAdmin as apiTransfer,
  patchCommunityMember,
  addCommunityMember,
  getCommunityJoinRequests,
  approveJoinRequest,
  rejectJoinRequest,
  getAllUsers,
  getApiBaseUrl,
  type Community,
  type CommunityMemberItem,
  type JoinRequestItem,
  type UserListItem,
} from '~/utils/api'

definePageMeta({ layout: 'default' })

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const id = route.params.id as string
const community = ref<Community | null>(null)
const members = ref<(CommunityMemberItem & { id: string; avatarSeed?: string })[]>([])
const joinRequests = ref<JoinRequestItem[]>([])
const isPublic = ref(true)
const transferTarget = ref('')
const demoteTo = ref<'member' | 'sub_admin'>('member')
const transferring = ref(false)
const addMemberSearch = ref('')
const addMemberSearchResults = ref<UserListItem[]>([])
const selectedAddMember = ref<UserListItem | null>(null)
const addMemberRole = ref<'member' | 'sub_admin'>('member')
const showAddMemberDropdown = ref(false)
const allUsers = ref<UserListItem[]>([])
const addingMember = ref(false)

const isAdmin = computed(() => community.value?.myRole === 'super_admin' || community.value?.myRole === 'sub_admin')

function roleLabel(role: string) {
  return { super_admin: '总管理员', sub_admin: '分管理员', member: '成员' }[role] || role
}

function canManageMember(m: CommunityMemberItem) {
  if (community.value?.myRole === 'super_admin') return m.role !== 'super_admin'
  if (community.value?.myRole === 'sub_admin') return m.role === 'member'
  return false
}

async function loadUsers() {
  // 如果已经加载过，直接返回
  if (allUsers.value.length > 0) return
  try {
    allUsers.value = await getAllUsers(getApiBaseUrl())
  } catch (_) {
    allUsers.value = []
  }
}

async function searchAddMember() {
  const q = addMemberSearch.value.trim().toLowerCase()
  if (!q) {
    addMemberSearchResults.value = []
    return
  }
  // 延迟加载用户列表（只在用户开始搜索时加载）
  if (allUsers.value.length === 0) {
    await loadUsers()
  }
  // 过滤掉已经是成员的用户
  const memberIds = new Set(members.value.map(m => m.userId))
  addMemberSearchResults.value = allUsers.value
    .filter(u => !memberIds.has(u.id))
    .filter(u => 
      (u.name && u.name.toLowerCase().includes(q)) ||
      u.id.toLowerCase().includes(q) ||
      (u.phone && u.phone.includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q))
    )
    .slice(0, 10)
}

function selectAddMember(user: UserListItem) {
  selectedAddMember.value = user
  addMemberSearch.value = user.name || user.id
  showAddMemberDropdown.value = false
}

function clearAddMember() {
  selectedAddMember.value = null
  addMemberSearch.value = ''
  addMemberSearchResults.value = []
  addMemberRole.value = 'member'
}

async function doAddMember() {
  if (!selectedAddMember.value) return
  if (!confirm(`确定将 ${selectedAddMember.value.name || selectedAddMember.value.id} 添加为${addMemberRole.value === 'sub_admin' ? '分管理员' : '成员'}？`)) return
  addingMember.value = true
  try {
    await addCommunityMember(id, { userId: selectedAddMember.value.id, role: addMemberRole.value }, getApiBaseUrl())
    clearAddMember()
    await load()
  } catch (e: any) {
    alert(e.message || '添加失败')
  } finally {
    addingMember.value = false
  }
}

async function load() {
  try {
    // 并行加载社区信息和成员列表
    const [communityData, membersList] = await Promise.all([
      getCommunityById(id),
      getCommunityMembers(id, getApiBaseUrl())
    ])
    
    community.value = communityData
    if (!community.value) return
    isPublic.value = community.value.isPublic !== false
    members.value = membersList.map(m => ({ ...m, id: m.userId, avatarSeed: m.avatar || m.name || m.userId }))
    
    // 管理员相关数据延迟加载（提升初始加载速度）
    if (isAdmin.value) {
      // 并行加载入群申请和用户列表（用户列表只在需要时加载）
      Promise.all([
        getCommunityJoinRequests(id, getApiBaseUrl()).catch(() => []),
        // 用户列表延迟加载，只在用户点击添加成员时才加载
      ]).then(([requests]) => {
        joinRequests.value = requests
      })
    }
  } catch (_) {}
}

async function updatePublic() {
  if (!community.value) return
  try {
    await updateCommunity(id, { isPublic: isPublic.value }, getApiBaseUrl())
    community.value = { ...community.value, isPublic: isPublic.value }
  } catch (e: any) {
    alert(e.message || '更新失败')
  }
}

function copySlug() {
  if (!community.value?.slug) return
  navigator.clipboard.writeText(community.value.slug)
  alert('已复制邀请码')
}

async function doTransfer() {
  if (!transferTarget.value) return
  if (!confirm('确定将总管理员转让给该成员？')) return
  transferring.value = true
  try {
    await apiTransfer(id, { targetUserId: transferTarget.value, demoteTo: demoteTo.value }, getApiBaseUrl())
    await load()
    router.push('/')
  } catch (e: any) {
    alert(e.message || '转让失败')
  } finally {
    transferring.value = false
  }
}

async function setRole(userId: string, role: 'member' | 'sub_admin') {
  try {
    await patchCommunityMember(id, userId, { role }, getApiBaseUrl())
    await load()
  } catch (e: any) {
    alert(e.message || '操作失败')
  }
}

async function removeMember(userId: string) {
  if (!confirm('确定将该成员移出社区？')) return
  try {
    await patchCommunityMember(id, userId, { action: 'remove' }, getApiBaseUrl())
    await load()
  } catch (e: any) {
    alert(e.message || '操作失败')
  }
}

async function approve(requestId: string) {
  try {
    await approveJoinRequest(id, requestId, getApiBaseUrl())
    joinRequests.value = joinRequests.value.filter(r => r.id !== requestId)
    await load()
  } catch (e: any) {
    alert(e.message || '操作失败')
  }
}

async function reject(requestId: string) {
  try {
    await rejectJoinRequest(id, requestId, getApiBaseUrl())
    joinRequests.value = joinRequests.value.filter(r => r.id !== requestId)
  } catch (e: any) {
    alert(e.message || '操作失败')
  }
}

onMounted(load)
</script>
