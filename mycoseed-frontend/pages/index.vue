<template>
  <div class="space-y-8">
    <!-- 如果没有选择社区，显示提示 -->
    <div v-if="!communityStore.currentCommunityId" class="text-center py-12">
      <TechCard class="border border-dashed border-border rounded-xl">
        <div class="text-center">
          <p class="font-mono text-text-tertiary text-sm mb-4">请先选择或加入一个社区</p>
          <p class="font-mono text-text-tertiary text-xs mb-4">点击底部「社区广场」浏览并加入社区，或点击顶部切换已加入的社区</p>
          <NuxtLink to="/communities" class="text-accent font-medium font-mono text-sm">前往社区广场</NuxtLink>
        </div>
      </TechCard>
    </div>

    <!-- 社区面板内容 -->
    <div v-else>
      <!-- 社区卡片：背景图轮播 + 底部名称与简介 -->
      <div class="rounded-xl overflow-hidden surface-elevated">
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
          <div v-else class="absolute inset-0 bg-gradient-to-br from-accent to-accent-muted" />
        </div>
        <div class="px-5 py-3 border-t border-border bg-white/90 backdrop-blur-sm">
          <h2 class="font-semibold text-text-primary text-sm truncate">{{ community?.name || '正在加载...' }}</h2>
          <p class="font-mono text-xs text-text-tertiary truncate mt-0.5">{{ community?.memberCount || 0 }} members</p>
          <p class="text-xs text-text-secondary truncate mt-1">{{ community?.description || '菌丝网络中的一个和平村庄。' }}</p>
        </div>
      </div>

      <!-- Village Content Grid -->
      <div class="space-y-6">
        
        <!-- Main Content (Tabs) -->
        <div class="space-y-6">
          
          <!-- Tab Navigation -->
          <div class="flex border-b border-border gap-0">
            <button 
              v-for="tab in tabs" 
              :key="tab.id"
              @click="activeTab = tab.id"
              :class="[
                'px-4 py-2.5 text-sm font-medium transition-base',
                activeTab === tab.id ? 'text-text-primary border-b-2 border-accent -mb-px' : 'text-text-secondary hover:text-text-primary'
              ]"
            >
              {{ tab.label }}
            </button>
          </div>

          <!-- INTRO TAB -->
          <div v-if="activeTab === 'INTRO'" class="space-y-6">
            <!-- 公告 -->
            <TechCard v-if="announcements.length > 0" class="mb-6">
              <template #header>
                <span class="font-mono text-xs text-text-tertiary uppercase tracking-widest">ANNOUNCEMENTS</span>
                <NuxtLink v-if="isCommunityAdmin && community?.id" :to="`/community/${community.id}/manage`" class="font-mono text-xs text-accent ml-2 hover:underline">管理</NuxtLink>
              </template>
              <ul class="space-y-2 text-left">
                <li v-for="a in announcements" :key="a.id" class="flex items-start gap-3">
                  <svg v-if="a.isPinned" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-accent shrink-0 mt-0.5">
                    <path d="M12 2v8"/>
                    <path d="M8 14h8"/>
                    <path d="M9 6h6"/>
                    <path d="M12 14v8"/>
                  </svg>
                  <div class="min-w-0">
                    <span class="font-medium text-sm text-text-primary">{{ a.title }}</span>
                    <span class="font-mono text-xs text-text-secondary block mt-0.5">{{ a.content ? a.content.slice(0, 60) + (a.content.length > 60 ? '…' : '') : '' }}</span>
                  </div>
                </li>
              </ul>
            </TechCard>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <TechCard>
                <template #header>
                  <span class="font-mono text-xs text-text-tertiary uppercase tracking-widest">ABOUT US</span>
                  <NuxtLink v-if="isCommunityAdmin && community?.id" :to="`/community/${community.id}/edit`" class="inline-flex items-center justify-center w-6 h-6 rounded-tech-sm ml-2 text-text-secondary hover:bg-surface-raised transition-base" title="编辑">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
                    </svg>
                  </NuxtLink>
                </template>
                <div class="space-y-4 text-center">
                  <!-- 积分/南塘豆行：算法未定，先隐藏 -->
                  <div class="hidden text-sm text-text-body">
                    {{ community?.pointName || '积分' }}: <span class="text-accent">{{ community?.totalPoints ?? 0 }}</span>
                  </div>
                  <div class="w-full min-h-24 rounded-tech-lg border border-border p-4 text-left">
                    <div class="text-sm text-text-primary whitespace-pre-wrap font-mono">{{ community?.markdownIntro || '暂无介绍' }}</div>
                  </div>
                </div>
              </TechCard>

              <TechCard>
                <template #header>
                  <span class="font-mono text-xs text-text-tertiary uppercase tracking-widest">MEMBERS ({{ community?.memberCount || 0 }})</span>
                </template>
                <div class="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  <button
                    v-for="member in members.slice(0, 12)"
                    :key="member.id"
                    type="button"
                    class="flex flex-col items-center gap-1.5 p-2 rounded-tech-md hover:bg-surface-raised transition-base text-left min-w-0"
                    @click="navigateTo(`/member/${member.id}`)"
                  >
                    <div class="w-12 h-12 rounded-tech-md overflow-hidden flex-shrink-0">
                      <TechAvatar
                        v-if="member.avatar"
                        :src="member.avatar"
                        :seed="member.name || member.id"
                        size="md"
                        class="!w-12 !h-12"
                      />
                      <TechAvatar
                        v-else
                        :seed="member.name || member.id"
                        size="md"
                        class="!w-12 !h-12"
                      />
                    </div>
                    <span class="text-sm font-medium text-text-primary truncate w-full text-center" :title="member.name || '未命名'">
                      {{ member.name || '未命名' }}
                    </span>
                    <span v-if="member.role" class="font-mono text-[10px] text-text-tertiary bg-surface-raised px-1.5 py-0.5 rounded-sm">
                      {{ member.role }}
                    </span>
                  </button>
                </div>
                <div v-if="members.length > 12" class="font-mono text-xs text-text-tertiary mt-2 text-center">
                  +{{ members.length - 12 }} more...
                </div>
              </TechCard>
            </div>
          </div>

          <!-- COMMUNITY TAB (社区圈) -->
          <div v-else-if="activeTab === 'COMMUNITY'" class="space-y-6">
            <div v-if="!communityStore.currentCommunityId && !userCommunity" class="text-center py-12">
              <TechCard class="border border-dashed border-border rounded-xl">
                <div class="text-center">
                  <p class="font-mono text-text-tertiary text-sm mb-2">请先选择一个社区</p>
                  <p class="font-mono text-text-tertiary text-xs">点击顶部按钮切换社区频道</p>
                </div>
              </TechCard>
            </div>

            <div v-else class="space-y-4">
              <div class="flex items-center justify-between">
                <h3 class="font-mono text-xs text-text-tertiary uppercase tracking-widest">COMMUNITY FEED</h3>
                <TechButton v-if="userStore.user" @click="navigateTo('/post/create')" size="sm">发动态</TechButton>
              </div>

              <div v-if="postsLoading && posts.length === 0" class="text-center py-8">
                <p class="font-mono text-text-tertiary text-sm">加载中...</p>
              </div>
              <p v-else-if="postsError" class="font-mono text-destructive text-sm py-4">{{ postsError }}</p>
              <div v-else-if="posts.length === 0" class="text-center py-8">
                <p class="font-mono text-text-tertiary text-sm">暂无动态，来发一条吧</p>
              </div>
              <div v-else class="space-y-4">
                <div
                  v-for="(post, index) in posts"
                  :key="post.id"
                  class="border-b border-border py-4 cursor-pointer transition-base hover:bg-surface-raised/30"
                  @click="navigateTo(`/post/${post.id}`)"
                  :style="{ animationDelay: `${index * 50}ms` }"
                >
                  <!-- 作者 + 时间行 -->
                  <div class="flex justify-between items-center mb-2">
                    <div class="flex items-center gap-2 min-w-0">
                      <div class="w-8 h-8 rounded-tech-sm overflow-hidden flex-shrink-0">
                        <TechAvatar
                          v-if="post.author?.avatar"
                          :src="post.author?.avatar"
                          :seed="post.author?.name || post.authorId"
                          size="sm"
                          class="!w-8 !h-8"
                        />
                        <TechAvatar
                          v-else
                          :seed="post.author?.name || post.authorId"
                          size="sm"
                          class="!w-8 !h-8"
                        />
                      </div>
                      <span class="font-medium text-sm text-text-primary truncate">{{ post.author?.name || '用户' }}</span>
                    </div>
                    <span class="font-mono text-xs text-text-tertiary">{{ formatTimeAgo(post.createdAt) }}</span>
                  </div>

                  <!-- 内容 -->
                  <div class="text-text-primary leading-relaxed mb-2">
                    <p
                      :class="needsTextExpand(post.content) && !isTextExpanded(post.id) ? 'line-clamp-10' : ''"
                    >
                      {{ post.content }}
                    </p>
                    <button
                      v-if="needsTextExpand(post.content)"
                      type="button"
                      class="font-mono text-xs text-accent mt-1 hover:underline"
                      @click.stop="toggleTextExpand(post.id)"
                    >
                      {{ isTextExpanded(post.id) ? '收起' : '展开' }}
                    </button>
                  </div>

                  <!-- 图片 -->
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

                  <!-- 互动统计 -->
                  <div class="flex items-center gap-4 mt-3 font-mono text-xs text-text-tertiary">
                    <span>👍 {{ post.likesCount || 0 }}</span>
                    <span>💬 {{ post.commentsCount || 0 }}</span>
                  </div>
                </div>
              </div>

              <div v-if="postsHasMore && !postsLoading" class="text-center mt-6">
                <TechButton size="sm" variant="secondary" @click="loadPosts()">
                  加载更多
                </TechButton>
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

              <Teleport to="body">
                <div
                  v-if="tipModalOpen"
                  class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                  @click.self="closeTipModal"
                >
                  <div
                    class="bg-card rounded-2xl shadow-soft border border-border p-6 w-full max-w-sm text-center"
                    @click.stop
                  >
                    <button
                      type="button"
                      class="w-full px-6 py-3 rounded-xl bg-primary text-white font-medium"
                      @click="confirmTip"
                    >
                      打赏
                    </button>
                  </div>
                </div>
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
import { definePageMeta, useRuntimeConfig } from '#imports'
import { useUserStore } from '~/stores/user'
import { useCommunityStore } from '~/stores/community'
import { useApi } from '~/composables/useApi'
import { getCommunityById, getCommunityMembers, getCommunityAnnouncements, getCommunities, DEFAULT_COMMUNITY_UUID, getApiBaseUrl, openTipToSemi, type Community, type Announcement } from '~/utils/api'
import type { Post, Comment, Like } from '~/utils/api'
import { useToast } from '~/composables/useToast'

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
const toast = useToast()
const runtimeConfig = useRuntimeConfig()
const activeTab = ref('COMMUNITY')

const LONG_PRESS_MS = 400
let longPressTimer: ReturnType<typeof setTimeout> | null = null
const tipModalOpen = ref(false)
const tipTarget = ref<{ type: 'post' | 'comment'; authorId: string } | null>(null)
const longPressHandled = ref(false)

function startLongPress(type: 'post' | 'comment', authorId: string) {
  if (longPressTimer) return
  longPressTimer = setTimeout(() => {
    longPressTimer = null
    longPressHandled.value = true
    tipTarget.value = { type, authorId }
    tipModalOpen.value = true
  }, LONG_PRESS_MS)
}

function cancelLongPress() {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
}

function closeTipModal() {
  tipModalOpen.value = false
  tipTarget.value = null
}

async function confirmTip() {
  if (!tipTarget.value) {
    closeTipModal()
    return
  }
  if (!userStore.user) {
    toast.add({ title: '请先登录', description: '登录后可打赏', color: 'orange' })
    closeTipModal()
    return
  }
  const baseUrl = getApiBaseUrl()
  const semiAppUrl = (runtimeConfig.public as any).semiAppUrl as string | undefined
  const opened = await openTipToSemi(tipTarget.value.authorId, () => baseUrl, semiAppUrl)
  closeTipModal()
  if (!opened) {
    toast.add({
      title: '无法打赏',
      description: '该用户未绑定钱包，无法打赏',
      color: 'orange',
    })
    return
  }
  toast.add({
    title: '已打开转账页面',
    description: '可在 Semi 内修改金额后完成转账',
    color: 'green',
  })
}

function onCommentClick(postId: string, comment: Comment, e: MouseEvent) {
  if (longPressHandled.value) {
    e.preventDefault()
    e.stopPropagation()
    longPressHandled.value = false
    return
  }
  onReplyComment(postId, comment)
}

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

/* 帖子列表 stagger slide-in 动效 */
@keyframes slideInUp {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

div[style*="animationDelay"] {
  animation: slideInUp 0.3s var(--ease-glide) forwards;
}
</style>
