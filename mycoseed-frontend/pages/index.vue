<template>
  <div class="space-y-8">
    <!-- 如果没有选择社区，显示提示 -->
    <div v-if="!communityStore.currentCommunityId" class="text-center py-12 bg-card rounded-3xl shadow-soft p-6">
      <p class="text-lg text-text-body mb-4">请先选择或加入一个社区</p>
      <p class="text-sm text-text-placeholder mb-4">点击底部「社区广场」浏览并加入社区，或点击顶部切换已加入的社区</p>
      <NuxtLink to="/communities" class="text-primary font-medium">前往社区广场</NuxtLink>
    </div>

    <!-- 社区面板内容 -->
    <div v-else>
      <!-- 社区卡片：背景图轮播 + 底部名称与简介 -->
      <div class="rounded-3xl shadow-soft overflow-hidden bg-card border border-border">
        <div class="relative h-48 md:h-64 w-full overflow-hidden">
          <!-- 背景图轮播（最多三张自动切换） -->
          <template v-if="bannerImages.length">
            <div
              v-for="(url, i) in bannerImages"
              :key="url"
              class="absolute inset-0 bg-cover bg-center transition-opacity duration-1000"
              :style="{ backgroundImage: `url(${url})` }"
              :class="currentBannerIndex === i ? 'opacity-100 z-10' : 'opacity-0 z-0'"
            />
          </template>
          <div v-else class="absolute inset-0 bg-gradient-to-br from-primary to-accent" />
        </div>
        <div class="px-4 py-3 border-t border-border bg-card">
          <h2 class="font-bold text-text-title text-lg truncate">{{ community?.name || '正在加载...' }}</h2>
          <p class="text-sm text-text-placeholder truncate mt-0.5">{{ community?.description || '菌丝网络中的一个和平村庄。' }}</p>
        </div>
      </div>

      <!-- Village Content Grid -->
      <div class="space-y-6">
        
        <!-- Main Content (Tabs) -->
        <div class="space-y-6">
          
          <!-- Tab Navigation -->
          <div class="flex border-b border-border gap-2">
            <button 
              v-for="tab in tabs" 
              :key="tab.id"
              @click="activeTab = tab.id"
              :class="[
                'px-4 py-2 rounded-t-2xl text-sm font-medium transition-all -mb-px',
                activeTab === tab.id ? 'bg-primary text-white' : 'bg-input-bg text-text-body hover:bg-muted'
              ]"
            >
              {{ tab.label }}
            </button>
          </div>

          <!-- INTRO TAB -->
          <div v-if="activeTab === 'INTRO'" class="space-y-6">
            <!-- Town Hall (Governance & Members) -->
            <!-- 公告 -->
            <PixelCard v-if="announcements.length > 0" class="mb-6">
              <template #header>
                <span>公告</span>
                <NuxtLink v-if="isCommunityAdmin && community?.id" :to="`/community/${community.id}/manage`" class="text-sm ml-2">管理</NuxtLink>
              </template>
              <ul class="space-y-2 text-left text-sm text-text-body">
                <li v-for="a in announcements" :key="a.id" class="flex items-start gap-2">
                  <span v-if="a.isPinned" class="text-primary shrink-0">📌</span>
                  <span class="font-medium text-text-title">{{ a.title }}</span>
                  <span class="text-text-placeholder">{{ a.content ? ' · ' + (a.content.slice(0, 60) + (a.content.length > 60 ? '…' : '')) : '' }}</span>
                </li>
              </ul>
            </PixelCard>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <PixelCard>
                <template #header>
                  <span>关于我们</span>
                  <NuxtLink v-if="isCommunityAdmin && community?.id" :to="`/community/${community.id}/edit`" class="inline-flex items-center justify-center w-7 h-7 rounded-lg ml-2 text-text-body hover:bg-input-bg" title="编辑">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                  </NuxtLink>
                </template>
                <div class="space-y-4 text-center">
                  <!-- 积分/南塘豆行：算法未定，先隐藏 -->
                  <div class="hidden text-sm text-text-body">
                    {{ community?.pointName || '积分' }}: <span class="text-primary">{{ community?.totalPoints ?? 0 }}</span>
                  </div>
                  <div class="w-full min-h-24 rounded-2xl border border-border p-4 text-left">
                    <div class="text-sm text-text-body whitespace-pre-wrap font-mono">{{ community?.markdownIntro || '暂无介绍' }}</div>
                  </div>
                </div>
              </PixelCard>

              <PixelCard>
                <template #header>成员 ({{ community?.memberCount || 0 }})</template>
                <div class="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  <button
                    v-for="member in members.slice(0, 12)"
                    :key="member.id"
                    type="button"
                    class="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-input-bg transition-colors text-left min-w-0"
                    @click="navigateTo(`/member/${member.id}`)"
                  >
                    <div class="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 ring-2 ring-border">
                      <PixelAvatar
                        v-if="member.avatar"
                        :src="member.avatar"
                        :seed="member.name || member.id"
                        size="md"
                        class="!w-12 !h-12"
                      />
                      <PixelAvatar
                        v-else
                        :seed="member.name || member.id"
                        size="md"
                        class="!w-12 !h-12"
                      />
                    </div>
                    <span class="text-xs font-medium text-text-title truncate w-full text-center" :title="member.name || '未命名'">
                      {{ member.name || '未命名' }}
                    </span>
                  </button>
                </div>
                <div v-if="members.length > 12" class="text-sm text-text-placeholder mt-2 text-center">
                  还有 {{ members.length - 12 }} 位成员...
                </div>
              </PixelCard>
            </div>
          </div>

          <!-- COMMUNITY TAB (社区圈) -->
          <div v-else-if="activeTab === 'COMMUNITY'" class="space-y-6">
            <div v-if="!communityStore.currentCommunityId && !userCommunity" class="text-center py-12 bg-card rounded-3xl shadow-soft p-6">
              <p class="text-lg text-text-body mb-2">请先选择一个社区</p>
              <p class="text-sm text-text-placeholder">点击顶部按钮切换社区频道</p>
            </div>

            <div v-else class="space-y-4">
              <div class="flex items-center justify-between border-b-2 border-black pb-2">
                <h3 class="font-bold text-sm uppercase">社区动态（帖子）</h3>
                <PixelButton v-if="userStore.user" @click="navigateTo('/post/create')">发动态</PixelButton>
              </div>

              <div v-if="postsLoading && posts.length === 0" class="text-center py-8 text-gray-500">
                加载中...
              </div>
              <p v-else-if="postsError" class="text-red-600 text-sm py-4">{{ postsError }}</p>
              <div v-else-if="posts.length === 0" class="text-center py-8 text-gray-500">
                暂无动态，来发一条吧
              </div>
              <div v-else class="grid gap-4">
                <PixelCard
                  v-for="post in posts"
                  :key="post.id"
                >
                  <template #header>
                    <div class="flex justify-between items-center">
                      <div class="flex items-center gap-2">
                        <PixelAvatar
                          v-if="post.author?.avatar"
                          :src="post.author?.avatar"
                          :seed="post.author?.name || post.authorId"
                          size="sm"
                        />
                        <span class="text-sm font-medium">{{ post.author?.name || '用户' }}</span>
                      </div>
                      <span class="text-xs text-gray-500">{{ formatTimeAgo(post.createdAt) }}</span>
                    </div>
                  </template>
                  <div class="text-gray-800 whitespace-pre-wrap">
                    <p
                      :class="needsTextExpand(post.content) && !isTextExpanded(post.id) ? 'line-clamp-10' : ''"
                    >
                      {{ post.content }}
                    </p>
                    <button
                      v-if="needsTextExpand(post.content)"
                      type="button"
                      class="text-primary text-sm mt-1 hover:underline"
                      @click.stop="toggleTextExpand(post.id)"
                    >
                      {{ isTextExpanded(post.id) ? '收起' : '展开' }}
                    </button>
                  </div>
                  <div v-if="post.images?.length" :class="['mt-2', getImageGridClass(post.images)]">
                    <img
                      v-for="(url, i) in post.images"
                      :key="i"
                      :src="url"
                      :class="getImageSizeClass(post.images)"
                      alt=""
                      @click.stop="openImagePreview(url, i, post.images)"
                    />
                  </div>

                  <!-- 朋友圈式：点赞名单 + 评论列表（在 footer 上方，自动加载并显示） -->
                  <div v-if="(postLikesMap.get(post.id)?.length ?? 0) > 0 || (postCommentsMap.get(post.id)?.length ?? 0) > 0" class="mt-3 px-3 py-2 bg-gray-100 rounded-lg text-sm space-y-1.5">
                    <div v-if="(postLikesMap.get(post.id)?.length ?? 0) > 0" class="text-gray-700">
                      <span class="text-primary font-medium">赞 </span>
                      {{ formatLikesNames(postLikesMap.get(post.id) ?? []) }}
                    </div>
                    <div
                      v-for="c in (postCommentsMap.get(post.id) ?? [])"
                      :key="c.id"
                      class="text-gray-700 flex items-baseline gap-1 flex-wrap cursor-pointer rounded px-1 -mx-1 hover:bg-gray-200/60"
                      @click.stop="onReplyComment(post.id, c)"
                    >
                      <span v-if="c.replyTo" class="text-gray-700">
                        <span class="font-medium">{{ c.author?.name || '用户' }}</span>
                        回复
                        <span class="font-medium">{{ c.replyTo.name || '用户' }}</span>：
                        {{ c.content }}
                      </span>
                      <span v-else class="text-gray-700">
                        <span class="font-medium">{{ c.author?.name || '用户' }}</span>：{{ c.content }}
                      </span>
                    </div>
                  </div>

                  <!-- 评论输入（仅当前帖展示） -->
                  <div v-if="commentInputPostId === post.id" class="mt-2 flex flex-col gap-1">
                    <span v-if="replyTarget && replyTarget.postId === post.id" class="text-xs text-gray-500">
                      回复 {{ replyTarget.userName || '用户' }}
                    </span>
                    <div class="flex gap-2">
                      <input
                        v-model="commentInputText"
                        type="text"
                        class="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 placeholder-gray-500"
                        :placeholder="replyTarget?.postId === post.id ? '写回复...' : '写评论...'"
                        @keydown.enter.prevent="submitComment(post.id)"
                      />
                      <button
                        type="button"
                        class="px-3 py-2 bg-primary text-white rounded-lg text-sm"
                        @click="submitComment(post.id)"
                      >
                        发送
                      </button>
                    </div>
                  </div>

                  <template #footer>
                    <div class="flex items-center gap-3">
                      <!-- 赞按钮 -->
                      <button
                        type="button"
                        class="flex items-center gap-1.5 p-1.5 text-gray-500 hover:text-gray-700 rounded transition-colors"
                        :class="post.isLiked ? 'text-red-500' : ''"
                        aria-label="赞"
                        @click.stop="handleLike(post)"
                      >
                        <svg class="w-5 h-5" :class="post.isLiked ? 'fill-current' : 'fill-none'" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path v-if="post.isLiked" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                          <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                        </svg>
                      </button>
                      <!-- 评论按钮 -->
                      <button
                        type="button"
                        class="p-1.5 text-gray-500 hover:text-gray-700 rounded transition-colors"
                        aria-label="评论"
                        @click.stop="onPopoverComment(post.id)"
                      >
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                        </svg>
                      </button>
                    </div>
                  </template>
                </PixelCard>
              </div>

              <div v-if="postsHasMore && !postsLoading" class="flex justify-center pt-4">
                <PixelButton size="sm" variant="secondary" @click="loadPosts()">
                  加载更多
                </PixelButton>
              </div>

              <!-- 图片预览层 -->
              <Teleport to="body">
                <Transition name="fade">
                  <div
                    v-if="previewImage"
                    class="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
                    @click="closeImagePreview"
                  >
                    <!-- 关闭按钮 -->
                    <button
                      type="button"
                      class="absolute top-4 right-4 text-white hover:text-gray-300 z-10"
                      @click.stop="closeImagePreview"
                    >
                      <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                      </svg>
                    </button>

                    <!-- 上一张按钮 -->
                    <button
                      v-if="previewImage.allImages.length > 1"
                      type="button"
                      class="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 z-10"
                      @click.stop="prevImage"
                    >
                      <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
                      </svg>
                    </button>

                    <!-- 下一张按钮 -->
                    <button
                      v-if="previewImage.allImages.length > 1"
                      type="button"
                      class="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 z-10"
                      @click.stop="nextImage"
                    >
                      <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                      </svg>
                    </button>

                    <!-- 图片 -->
                    <img
                      :src="previewImage.url"
                      class="max-w-full max-h-full object-contain"
                      alt="预览"
                      @click.stop
                    />

                    <!-- 图片索引提示 -->
                    <div
                      v-if="previewImage.allImages.length > 1"
                      class="absolute bottom-4 left-1/2 -translate-x-1/2 text-white bg-black/50 px-3 py-1 rounded text-sm"
                    >
                      {{ previewImage.index + 1 }} / {{ previewImage.allImages.length }}
                    </div>
                  </div>
                </Transition>
              </Teleport>
            </div>
          </div>

        </div>

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '~/stores/user'
import { useCommunityStore } from '~/stores/community'
import PixelCard from '~/components/pixel/PixelCard.vue'
import PixelAvatar from '~/components/pixel/PixelAvatar.vue'
import PixelButton from '~/components/pixel/PixelButton.vue'
import { useApi } from '~/composables/useApi'
import { getCommunityById, getCommunityMembers, getCommunityAnnouncements, getCommunities, DEFAULT_COMMUNITY_UUID, type Community, type Announcement } from '~/utils/api'
import type { Post, Comment, Like } from '~/utils/api'

// Use definePageMeta to ensure layout is applied
definePageMeta({
  layout: 'default',
  middleware: 'auth'
})

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const communityStore = useCommunityStore()
const api = useApi()
const activeTab = ref('COMMUNITY')

// 背景图轮播：取社区背景图（最多 3 张）
const bannerImages = computed(() => {
  const raw = (community.value as Community | null)?.backgroundImages
  const list = Array.isArray(raw) ? raw.filter((u: string) => (u || '').trim()) : []
  return list.slice(0, 3)
})
const currentBannerIndex = ref(0)
let bannerTimer: ReturnType<typeof setInterval> | null = null

const tabs = [
  { id: 'COMMUNITY', label: '社区圈' },
  { id: 'INTRO', label: '简介' }
]

// Data
const community = ref<Community | null>(null)
const members = ref<any[]>([])
const announcements = ref<Announcement[]>([])
const isCommunityAdmin = computed(() => {
  const r = community.value?.myRole
  return r === 'super_admin' || r === 'sub_admin'
})

// 用户社区相关数据
const userCommunity = ref<Community | null>(null)

// ---------- 帖子列表状态 ----------
const posts = ref<Post[]>([])
const postsTotal = ref(0)
const postsPage = ref(1)
const postsHasMore = ref(true)
const postsLoading = ref(false)
const postsError = ref('')
const postsLimit = 20

// 朋友圈式：按需加载的点赞/评论
const postLikesMap = ref<Map<string, Like[]>>(new Map())
const postCommentsMap = ref<Map<string, Comment[]>>(new Map())
const commentInputPostId = ref<string | null>(null)
const commentInputText = ref('')
/** 当前回复目标（点击某条评论的「回复」时设置） */
const replyTarget = ref<{ postId: string; userId: string; userName: string } | null>(null)
// 文字展开状态
const expandedPosts = ref<Set<string>>(new Set())
// 图片预览状态
const previewImage = ref<{ url: string; index: number; allImages: string[] } | null>(null)

// 获取当前社区ID（只使用用户选择的社区，不设置默认值）
const getCurrentCommunityId = (): string | null => {
  return communityStore.currentCommunityId
}

// ---------- 加载帖子（分页：reset 为 true 表示从第一页重新拉） ----------
async function loadPosts(reset = false) {
  if (postsLoading.value) return
  const currentCommunityId = getCurrentCommunityId()
  if (!currentCommunityId) {
    posts.value = []
    return
  }
  
  if (reset) {
    postsPage.value = 1
    posts.value = []
    postsHasMore.value = true
  }
  postsLoading.value = true
  postsError.value = ''
  try {
    const res = await api.getCommunityPosts({
      communityId: currentCommunityId,
      page: postsPage.value,
      limit: postsLimit,
    })
    if (reset) {
      posts.value = res.posts
    } else {
      posts.value.push(...res.posts)
    }
    postsTotal.value = res.total
    postsHasMore.value = res.hasMore
    postsPage.value = res.page
    
    // 懒加载点赞和评论数据（只加载可见的帖子，提升初始加载速度）
    const newPosts = reset ? res.posts : res.posts
    // 使用 requestIdleCallback 或 setTimeout 延迟加载，优先显示内容
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        Promise.all(newPosts.slice(0, 5).map((post: Post) => ensurePostLikesAndComments(post.id)))
      }, 100)
      // 剩余帖子在用户滚动时再加载
      if (newPosts.length > 5) {
        setTimeout(() => {
          Promise.all(newPosts.slice(5).map((post: Post) => ensurePostLikesAndComments(post.id)))
        }, 500)
      }
    }
  } catch (e: any) {
    postsError.value = e?.message || '加载动态失败'
  } finally {
    postsLoading.value = false
  }
}

// ---------- 点赞/取消点赞（只更新本地状态，不重新拉列表） ----------
async function togglePostLike(postId: string) {
  const idx = posts.value.findIndex((p) => p.id === postId)
  if (idx === -1) return
  try {
    const res = await api.togglePostLike(postId)
    const p = posts.value[idx]
    const nowLiked = !!res.liked
    // 通过替换数组项触发 Vue 响应式，点赞状态和数量会正确更新
    posts.value[idx] = {
      ...p,
      isLiked: nowLiked,
      likesCount: Math.max(0, (p.likesCount ?? 0) + (nowLiked ? 1 : -1))
    }
  } catch (e: any) {
    console.error('点赞/取消点赞失败:', e?.message)
  }
}

// 处理点赞（直接调用，无需弹窗）
async function handleLike(post: Post) {
  await togglePostLike(post.id)
  // 强制刷新该帖的点赞列表，使「赞 xxx」显示正确
  try {
    const { likes } = await api.getPostLikes(post.id)
    postLikesMap.value = new Map(postLikesMap.value).set(post.id, likes)
  } catch {
    // 忽略
  }
}

async function ensurePostLikesAndComments(postId: string) {
  if (!postLikesMap.value.has(postId)) {
    try {
      const { likes } = await api.getPostLikes(postId)
      postLikesMap.value = new Map(postLikesMap.value).set(postId, likes)
    } catch {
      postLikesMap.value = new Map(postLikesMap.value).set(postId, [])
    }
  }
  if (!postCommentsMap.value.has(postId)) {
    try {
      const { comments } = await api.getPostComments(postId)
      postCommentsMap.value = new Map(postCommentsMap.value).set(postId, comments)
    } catch {
      postCommentsMap.value = new Map(postCommentsMap.value).set(postId, [])
    }
  }
}

function formatLikesNames(likes: Like[]): string {
  const names = likes.map((l) => l.user?.name || '用户').filter(Boolean)
  return names.join('、')
}

async function onPopoverComment(postId: string) {
  await ensurePostLikesAndComments(postId)
  commentInputPostId.value = postId
  commentInputText.value = ''
  replyTarget.value = null
  nextTick(() => {
    const input = document.querySelector('input[placeholder="写评论..."], input[placeholder="写回复..."]') as HTMLInputElement | null
    input?.focus()
  })
}

function onReplyComment(postId: string, comment: Comment) {
  commentInputPostId.value = postId
  commentInputText.value = ''
  replyTarget.value = {
    postId,
    userId: comment.authorId,
    userName: comment.author?.name || '用户'
  }
  nextTick(() => {
    const input = document.querySelector('input[placeholder="写评论..."], input[placeholder="写回复..."]') as HTMLInputElement | null
    input?.focus()
  })
}

async function submitComment(postId: string) {
  const content = commentInputText.value.trim()
  if (!content) return
  const currentReply = replyTarget.value?.postId === postId ? replyTarget.value : null
  try {
    await api.createComment({
      postId,
      content,
      ...(currentReply ? { replyToUserId: currentReply.userId } : {})
    })
    commentInputText.value = ''
    commentInputPostId.value = null
    replyTarget.value = null
    const post = posts.value.find((p) => p.id === postId)
    if (post) post.commentsCount = (post.commentsCount ?? 0) + 1
    const { comments } = await api.getPostComments(postId)
    postCommentsMap.value = new Map(postCommentsMap.value).set(postId, comments)
  } catch (e: any) {
    console.error('评论失败:', e?.message)
  }
}

// 判断文字是否需要展开（超过10行，约500字符）
function needsTextExpand(text: string): boolean {
  return text.length > 500
}

// 切换文字展开状态
function toggleTextExpand(postId: string) {
  if (expandedPosts.value.has(postId)) {
    expandedPosts.value.delete(postId)
  } else {
    expandedPosts.value.add(postId)
  }
}

// 判断文字是否已展开
function isTextExpanded(postId: string): boolean {
  return expandedPosts.value.has(postId)
}

// 获取图片网格布局类
function getImageGridClass(images: string[]): string {
  const count = images.length
  if (count === 1) return 'grid grid-cols-1'
  if (count <= 4) return 'grid grid-cols-2 gap-1'
  return 'grid grid-cols-3 gap-1'
}

// 获取单张图片的样式类
function getImageSizeClass(images: string[]): string {
  const count = images.length
  if (count === 1) return 'w-full max-w-md h-auto rounded-lg cursor-pointer hover:opacity-90 transition-opacity'
  return 'w-full aspect-square object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity'
}

// 打开图片预览
function openImagePreview(url: string, index: number, allImages: string[]) {
  previewImage.value = { url, index, allImages }
  document.body.style.overflow = 'hidden' // 禁止背景滚动
}

// 关闭图片预览
function closeImagePreview() {
  previewImage.value = null
  document.body.style.overflow = '' // 恢复滚动
}

// 切换到上一张图片
function prevImage() {
  if (!previewImage.value) return
  const { index, allImages } = previewImage.value
  const newIndex = index > 0 ? index - 1 : allImages.length - 1
  previewImage.value = { url: allImages[newIndex], index: newIndex, allImages }
}

// 切换到下一张图片
function nextImage() {
  if (!previewImage.value) return
  const { index, allImages } = previewImage.value
  const newIndex = index < allImages.length - 1 ? index + 1 : 0
  previewImage.value = { url: allImages[newIndex], index: newIndex, allImages }
}

// 处理键盘事件（ESC关闭，左右箭头切换）
function handleKeydown(e: KeyboardEvent) {
  if (!previewImage.value) return
  if (e.key === 'Escape') {
    closeImagePreview()
  } else if (e.key === 'ArrowLeft') {
    prevImage()
  } else if (e.key === 'ArrowRight') {
    nextImage()
  }
}

// 格式化时间差
const formatTimeAgo = (dateString: string): string => {
  if (!dateString) return ''
  const now = new Date()
  const date = new Date(dateString)
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  
  if (diffMins < 60) {
    return `${diffMins}分钟前`
  } else if (diffHours < 24) {
    return `${diffHours}小时前`
  } else {
    return `${diffDays}天前`
  }
}

const navigateTo = (path: string) => {
  router.push(path)
}

// 加载社区数据（并行加载，提升速度）
const loadCommunityData = async (communityId: string) => {
  try {
    // 并行加载社区信息、成员列表和公告
    const [communityData, membersList, announcementsList] = await Promise.all([
      getCommunityById(communityId),
      getCommunityMembers(communityId).catch(() => []),
      getCommunityAnnouncements(communityId).catch(() => [])
    ])
    community.value = communityData
    members.value = membersList
    announcements.value = announcementsList
  } catch (error) {
    console.error('Failed to load community data:', error)
  }
}

// 获取用户所属社区（仅用于显示，不自动设置）
const loadUserCommunity = async () => {
  try {
    const user = await userStore.getUser()
    if (!user?.id) {
      router.push('/auth/login')
      return
    }
    const list = await getCommunities({ mine: true })
    if (list.length > 0) {
      userCommunity.value = list[0]
      // 如果用户还没有选择社区，且只有一个社区，自动设置为该社区
      if (!communityStore.currentCommunityId && list.length === 1) {
        await communityStore.setCurrentCommunity(list[0].id)
      }
    }
  } catch (error) {
    console.error('Failed to load user community:', error)
    if (!userStore.isAuthenticated) router.push('/auth/login')
  }
}


// 监听社区变化
watch(() => communityStore.currentCommunityId, async (newId) => {
  if (newId) {
    await loadCommunityData(newId)
    // 如果当前在社区圈标签，重新加载帖子列表
    if (activeTab.value === 'COMMUNITY') {
      await loadPosts(true)
    }
  } else {
    community.value = null
    members.value = []
  }
}, { immediate: true })

// 监听 store 中的社区详情变化
watch(() => communityStore.currentCommunity, (newCommunity) => {
  if (newCommunity) {
    community.value = newCommunity
  }
}, { immediate: true })

// 监听 userCommunity 变化
watch(() => userCommunity.value?.id, (newId) => {
  console.log('userCommunity ID变化:', newId)
  if (activeTab.value === 'COMMUNITY' && newId) {
    loadPosts(true)
  }
})

// 监听标签切换
watch(activeTab, (newTab) => {
  if (newTab === 'COMMUNITY') {
    loadPosts(true)
  }
})

// 监听路由 query 参数，如果 tab=COMMUNITY 则切换到社区圈并刷新列表
watch(
  () => route.query.tab,
  (tab) => {
    if (tab === 'COMMUNITY') {
      activeTab.value = 'COMMUNITY'
      loadPosts(true)
      // 移除 query 参数，避免刷新页面时仍被强制切换
      router.replace({ path: route.path, query: {} })
    }
  },
  { immediate: true }
)

// 从发帖页返回首页时刷新列表，以便看到新发的帖子
watch(
  () => route.fullPath,
  (newPath, oldPath) => {
    if (oldPath === '/post/create' && newPath === '/' && activeTab.value === 'COMMUNITY') {
      loadPosts(true)
    }
  }
)

// 背景图轮播：多张时每 4 秒切换
watch(
  () => bannerImages.value.length,
  (len) => {
    if (bannerTimer) {
      clearInterval(bannerTimer)
      bannerTimer = null
    }
    currentBannerIndex.value = 0
    if (len > 1) {
      bannerTimer = setInterval(() => {
        currentBannerIndex.value = (currentBannerIndex.value + 1) % len
      }, 4000)
    }
  },
  { immediate: true }
)

onMounted(async () => {
  // 监听键盘事件（用于图片预览）
  window.addEventListener('keydown', handleKeydown)
  
  // 确保用户信息已加载
  await userStore.getUser()
  
  // 初始化社区 store
  await communityStore.initialize()
  
  // 加载用户社区信息（这会确保 communityStore 有社区ID）
  await loadUserCommunity()
  
  // 如果有当前社区，加载数据
  if (communityStore.currentCommunityId) {
    await loadCommunityData(communityStore.currentCommunityId)
  }
  
  // 检查 query 参数，如果 tab=COMMUNITY 则切换到社区圈
  if (route.query.tab === 'COMMUNITY') {
    activeTab.value = 'COMMUNITY'
    await loadPosts(true)
    // 移除 query 参数，避免刷新页面时仍被强制切换
    router.replace({ path: route.path, query: {} })
  } else if (activeTab.value === 'COMMUNITY') {
    // 如果当前在社区圈标签，加载帖子列表
    await loadPosts(true)
  }
})

onUnmounted(() => {
  if (bannerTimer) {
    clearInterval(bannerTimer)
    bannerTimer = null
  }
  window.removeEventListener('keydown', handleKeydown)
  if (previewImage.value) previewImage.value = null
})
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
