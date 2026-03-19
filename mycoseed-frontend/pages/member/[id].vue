<template>
  <div class="min-h-screen pb-24">
    <!-- 顶部个人信息区域 -->
    <div class="mx-4 mt-4">
      <!-- 翻转卡片容器 -->
      <div 
        class="flip-card-container"
        :class="{ 'is-flipped': isFlipped }"
        @click="toggleFlip()"
      >
        <div class="flip-card-inner">
          <!-- 卡片正面 -->
          <div class="flip-card-face flip-card-front bg-white border border-border rounded-2xl shadow-soft p-6 pb-8 relative">
            <div class="flex flex-col items-center gap-4">
        <!-- 头像 -->
        <div class="relative">
          <PixelAvatar
            v-if="member?.avatar"
            :src="member.avatar"
            size="xl"
          />
          <PixelAvatar
            v-else
            :seed="member?.name || member?.avatarSeed || 'user'"
            size="xl"
          />
        </div>

        <!-- 姓名与简介 -->
        <div class="text-center w-full max-w-xs">
          <h1 class="font-bold text-2xl mb-1">{{ member?.name }}</h1>
          <div v-if="member?.bio" class="text-sm text-gray-600 mt-2 px-4 max-w-xs mx-auto">
            {{ member.bio }}
          </div>
          <div class="text-xs text-gray-400 mt-3 px-4">
            点击卡片查看数字身份
          </div>
        </div>
            </div>
          </div>

          <!-- 卡片背面：整面阻止点击冒泡，避免误触翻转；需点击「返回」才翻回正面 -->
          <div class="flip-card-face flip-card-back bg-white border border-border rounded-2xl shadow-soft p-6 pb-8 relative" @click.stop>
            <div class="flex flex-col gap-4">
              <!-- 钱包地址（含链标识） -->
              <div class="flex items-center gap-2 px-3 py-1.5 bg-gray-100 border border-border rounded-2xl shadow-soft-sm w-full min-w-0">
                <PixelAvatar :seed="walletAddress || 'user'" size="sm" :fallback-text="currentChain.shortName" class="flex-shrink-0" />
                <span class="text-base truncate flex-1">{{ truncatedAddress }}</span>
                <button 
                  @click.stop="copyAddress"
                  class="text-gray-400 hover:text-black transition-colors cursor-pointer flex-shrink-0"
                  title="复制地址"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>

              <!-- 二维码 -->
              <div class="flex flex-col items-center gap-4 mt-4">
                <div class="relative">
                  <div v-if="qrCodeUrl" class="w-32 h-32 bg-white border-4 border-black p-2">
                    <img :src="qrCodeUrl" alt="QR Code" class="w-full h-full image-pixelated" />
                  </div>
                  <div v-else class="w-32 h-32 bg-gray-100 border-4 border-black flex items-center justify-center">
                    <span class="text-gray-400  text-sm">加载中...</span>
                  </div>
                </div>

                <!-- 社区积分显示（替换原来的姓名位置） -->
                <div v-if="userCommunity" class="flex flex-col items-center gap-2 w-full max-w-xs">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-green-200 border border-border rounded-2xl flex items-center justify-center text-xl shadow-soft">
                      {{ userCommunity.pointName === '零废弃积分' ? '♻️' : '🌾' }}
                    </div>
                    <div class="text-center">
                      <div class="font-bold text-xs text-green-600">{{ userCommunity.pointName }}</div>
                      <div class=" text-2xl">{{ formatPoints(userCommunityPoints) }} {{ getPointAbbr(userCommunity.pointName) }}</div>
                    </div>
                  </div>
                </div>

                <!-- 返回正面 -->
                <button type="button" @click.stop="toggleFlip" class="text-xs text-gray-400 hover:text-black mt-2">
                  返回
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 下方 Tab 区域 -->
    <div class="mt-4 px-4">
      <!-- Tab 导航 -->
      <div class="flex items-center justify-between border-b-2 border-black mb-4 gap-4">
        <div class="flex overflow-x-auto scrollbar-hide flex-1">
          <button 
            v-for="tab in tabs" 
            :key="tab.id"
            @click="activeTab = tab.id"
            :class="[
              'px-4 py-2 font-bold text-sm whitespace-nowrap transition-colors',
              activeTab === tab.id ? 'bg-black text-white' : 'text-gray-500 hover:bg-gray-100'
            ]"
          >
            {{ tab.label }}
          </button>
        </div>
      </div>

      <!-- Tab 内容 -->
      <div class="min-h-[300px]">
        <!-- HISTORY TAB -->
        <div v-if="activeTab === 'HISTORY'" class="space-y-4">
          <!-- 加载状态 -->
          <div v-if="loadingTasks" class="text-center py-8 text-gray-500 ">
            加载中...
          </div>
          
          <!-- 任务列表 -->
          <div v-else-if="claimedTasks.length > 0">
            <div v-for="task in claimedTasks" :key="task.id" class="bg-white border border-border rounded-2xl p-4 shadow-soft-sm hover:shadow-soft transition-shadow cursor-pointer" @click="navigateTo(`/tasks/${task.id}`)">
              <div class="flex items-start gap-3">
                <div class="text-2xl">{{ getTaskIcon(task.status) }}</div>
                <div class="flex-1">
                  <div class="flex justify-between items-start mb-1">
                    <div class="font-bold  text-lg leading-tight">{{ task.title }}</div>
                    <div v-if="task.status === 'completed'" class="font-bold text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded">
                      +{{ task.reward }} {{ taskRewardSymbols[task.id] || '积分' }}
                    </div>
                  </div>
                  <div class="flex items-center gap-2 mb-2">
                    <span :class="getStatusBadgeClass(task.status)">
                      {{ getStatusText(task.status) }}
                    </span>
                    <span v-if="task.status === 'claimed' || task.status === 'unsubmit'" class="font-bold text-[10px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                      进行中
                    </span>
                  </div>
                  <div class="text-xs text-gray-500">
                    {{ formatTaskDate(task) }}
                  </div>
                  <div v-if="task.description" class="text-xs text-gray-600 mt-1 line-clamp-2">
                    {{ task.description }}
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- 空状态 -->
          <div v-else class="text-center py-12">
            <div class="text-4xl mb-4">📋</div>
            <div class=" text-gray-500">还没有领取任何任务</div>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '~/stores/user'
import PixelAvatar from '~/components/pixel/PixelAvatar.vue'
import { getMemberById, getCommunities, getMyTasks, getWalletAddressByMemberId, getUserCommunityPoints, getApiBaseUrl, type Task, type Community } from '~/utils/api'
import { getTaskRewardSymbol } from '~/utils/display'
import { useToast } from '~/composables/useToast'
import { useApi } from '~/composables/useApi'

definePageMeta({
  layout: 'default'
})

const route = useRoute()
const router = useRouter()
const memberId = route.params.id as string  // UUID是字符串，不需要parseInt
const activeTab = ref('HISTORY')
const isFlipped = ref(false)
const userStore = useUserStore()
const toast = useToast()

// 钱包相关状态
const walletAddress = ref('')

// 社区积分相关状态
const userCommunity = ref<Community | null>(null)
const userCommunityPoints = ref(0)
const currentChain = ref({
  id: 10,
  name: 'OP Mainnet',
  shortName: 'OP',
  nativeCurrency: {
    symbol: 'ETH'
  }
})

// 截断的钱包地址
const truncatedAddress = computed(() => {
  if (walletAddress.value.length <= 10) return walletAddress.value
  return `${walletAddress.value.slice(0, 6)}...${walletAddress.value.slice(-4)}`
})

// 二维码URL
const qrCodeUrl = computed(() => {
  if (!walletAddress.value) return ''
  return `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${walletAddress.value}`
})

// 判断是否是当前用户自己的页面
const isMyProfile = computed(() => {
  return userStore.user?.id === memberId
})

const tabs = [
  { id: 'HISTORY', label: '任务' }
]

// Mock Data
const member = ref<any>(null)
const history = ref<any[]>([])
const communities = ref<any[]>([])
const claimedTasks = ref<Task[]>([])
const loadingTasks = ref(false)
const taskRewardSymbols = ref<Record<number, string>>({}) // 存储每个任务对应的积分符号

const navigateTo = (path: string) => {
  router.push(path)
}

// 翻转卡片切换
const toggleFlip = () => {
  isFlipped.value = !isFlipped.value
}

// 复制地址
const copyAddress = async () => {
  const text = walletAddress.value
  
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text)
      toast.add({ title: '地址已复制到剪贴板', color: 'green' })
      return
    } catch (err) {
      console.error('Clipboard API 失败:', err)
    }
  }
  
  try {
    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.style.position = 'fixed'
    textArea.style.left = '-999999px'
    textArea.style.top = '-999999px'
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    
    const successful = document.execCommand('copy')
    document.body.removeChild(textArea)
    
    if (successful) {
      toast.add({ title: '地址已复制到剪贴板', color: 'green' })
    } else {
      throw new Error('execCommand 失败')
    }
  } catch (err) {
    console.error('复制失败:', err)
    toast.add({ title: `请手动复制: ${text}`, color: 'red' })
  }
}

// 社区积分相关函数
const formatPoints = (points: number): string => {
  return points.toLocaleString('zh-CN')
}

const getPointAbbr = (pointName: string | undefined): string => {
  if (!pointName) return 'PTS'
  if (pointName === '零废弃积分') return 'ZWP'
  if (pointName === '南塘豆') return 'NTD'
  return 'PTS'
}

const loadUserCommunity = async () => {
  try {
    // 获取成员信息（使用 memberId，因为这是查看其他成员的页面）
    const member = await getMemberById(memberId)
    
    if (!member) {
      console.log('未找到成员信息')
      return
    }
    
    if (member.communities.length === 0) {
      console.log('成员未加入任何社区')
      return
    }

    // 获取所有社区信息
    const allCommunities = await getCommunities()
    
    // 找到用户所属的第一个社区
    const community = allCommunities.find(c => member.communities.includes(c.id))
    
    if (community) {
      userCommunity.value = community
      
      // 从 API 获取真实的社区积分（使用 memberId）
      const points = await getUserCommunityPoints(memberId, community.id)
      userCommunityPoints.value = points
    }
  } catch (error) {
    console.error('Failed to load user community:', error)
  }
}

// 加载领取的任务列表
const loadClaimedTasks = async () => {
  loadingTasks.value = true
  try {
    const baseUrl = getApiBaseUrl()
    const tasks = await getMyTasks(baseUrl)
    // 排序：优先显示已完成的任务，然后按更新时间倒序
    claimedTasks.value = tasks.sort((a, b) => {
      // 优先显示已完成的任务
      if (a.status === 'completed' && b.status !== 'completed') {
        return -1
      }
      if (a.status !== 'completed' && b.status === 'completed') {
        return 1
      }
      // 对于相同优先级（都是已完成或都不是已完成），按更新时间倒序
      const timeA = new Date(b.updatedAt || b.completedAt || b.submittedAt || b.claimedAt || b.createdAt).getTime()
      const timeB = new Date(a.updatedAt || a.completedAt || a.submittedAt || a.claimedAt || a.createdAt).getTime()
      return timeA - timeB
    })
    
    // 为每个任务获取对应的积分符号
    const allCommunities = await getCommunities()
    for (const task of claimedTasks.value) {
      const symbol = await getTaskRewardSymbol(task, allCommunities)
      taskRewardSymbols.value[task.id] = symbol
    }
  } catch (error) {
    console.error('Failed to load claimed tasks:', error)
  } finally {
    loadingTasks.value = false
  }
}

// 获取任务状态文本
const getStatusText = (status: Task['status']): string => {
  const statusMap: Record<string, string> = {
    'unclaimed': '未领取',
    'claimed': '已领取',
    'unsubmit': '待提交',
    'under_review': '审核中',
    'completed': '已完成',
    'rejected': '已驳回'
  }
  return statusMap[status] || '未知'
}

// 获取任务状态图标
const getTaskIcon = (status: Task['status']): string => {
  const iconMap: Record<string, string> = {
    'unclaimed': '📋',
    'claimed': '✅',
    'unsubmit': '🔄',
    'under_review': '⏳',
    'completed': '✅',
    'rejected': '❌'
  }
  return iconMap[status] || '📋'
}

// 获取状态徽章样式
const getStatusBadgeClass = (status: Task['status']): string => {
  const classMap: Record<string, string> = {
    'unclaimed': 'font-bold text-[10px] px-2 py-0.5 rounded border border-yellow-600 text-yellow-600 bg-yellow-50',
    'claimed': 'font-bold text-[10px] px-2 py-0.5 rounded border border-blue-600 text-blue-600 bg-blue-50',
    'unsubmit': 'font-bold text-[10px] px-2 py-0.5 rounded border border-blue-600 text-blue-600 bg-blue-50',
    'under_review': 'font-bold text-[10px] px-2 py-0.5 rounded border border-orange-600 text-orange-600 bg-orange-50',
    'completed': 'font-bold text-[10px] px-2 py-0.5 rounded border border-green-600 text-green-600 bg-green-50',
    'rejected': 'font-bold text-[10px] px-2 py-0.5 rounded border border-red-600 text-red-600 bg-destructive-50'
  }
  return classMap[status] || 'font-bold text-[10px] px-2 py-0.5 rounded border border-gray-600 text-gray-600 bg-gray-50'
}

// 格式化任务日期
const formatTaskDate = (task: Task): string => {
  let dateStr = ''
  let action = ''
  
  if (task.completedAt) {
    dateStr = task.completedAt
    action = '完成于'
  } else if (task.submittedAt) {
    dateStr = task.submittedAt
    action = '提交于'
  } else if (task.claimedAt) {
    dateStr = task.claimedAt
    action = '领取于'
  } else {
    dateStr = task.createdAt
    action = '创建于'
  }
  
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor(diff / (1000 * 60))
  
  let timeStr = ''
  if (days > 0) {
    timeStr = `${days}天前`
  } else if (hours > 0) {
    timeStr = `${hours}小时前`
  } else if (minutes > 0) {
    timeStr = `${minutes}分钟前`
  } else {
    timeStr = '刚刚'
  }
  
  return `${action} ${timeStr}`
}

// 监听 activeTab，当切换到任务tab时刷新任务列表
watch(() => activeTab.value, (newTab) => {
  if (newTab === 'HISTORY') {
    loadClaimedTasks()
  }
})

onMounted(async () => {
  // 确保用户信息已加载
  await userStore.getUser()
  
  // 从 API 获取成员数据
  try {
    member.value = await getMemberById(memberId)
    
    // 获取钱包地址
    try {
      walletAddress.value = await getWalletAddressByMemberId(memberId)
    } catch (error) {
      console.error('Failed to load wallet address:', error)
    }
    
    // 加载社区积分信息
    await loadUserCommunity()
    
    if (member.value) {
      // 获取成员所属的社群信息
      const allCommunities = await getCommunities()
      communities.value = allCommunities
        .filter(c => member.value.communities.includes(c.id))
        .map(c => ({
          id: c.id,
          name: c.name,
          points: member.value.reputation, // 使用成员的声誉值作为在该社群的积分
          pointName: c.pointName // 添加社区积分名称
        }))
      
      // 生成历史记录（基于成员的贡献）
      history.value = [
        { 
          id: 1, 
          title: `完成了 ${member.value.completedTasks} 个任务`, 
          date: '最近', 
          community: communities.value[0]?.name || '社群', 
          points: member.value.totalReward * 100, 
          icon: '✅' 
        },
        { 
          id: 2, 
          title: `贡献了 ${member.value.totalContributions} 次`, 
          date: '最近', 
          community: communities.value[0]?.name || '社群', 
          points: member.value.totalContributions * 10, 
          icon: '🌟' 
        },
      ]
      
      // 如果当前是任务tab，加载任务列表
      if (activeTab.value === 'HISTORY') {
        loadClaimedTasks()
      }
    }
  } catch (error) {
    console.error('Failed to load member data:', error)
  }
})
</script>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
    display: none;
}
.scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
}

.image-pixelated {
  image-rendering: pixelated;
}

/* 翻转卡片样式 */
.flip-card-container {
  width: 100%;
  perspective: 1000px;
  cursor: pointer;
}

.flip-card-inner {
  position: relative;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
  transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

.flip-card-container.is-flipped .flip-card-inner {
  transform: rotateY(180deg);
}

.flip-card-face {
  position: relative;
  width: 100%;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}

.flip-card-back {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  transform: rotateY(180deg);
}
</style>
