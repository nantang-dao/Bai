<template>
  <div class="min-h-screen bg-background py-4 md:py-8">
    <div class="container mx-auto px-4 md:px-6 max-w-7xl">
      <!-- 返回按钮 -->
      <div class="mb-6">
        <PixelButton
          @click="navigateTo('/tasks')"
          variant="secondary"
          size="sm"
        >
          ← 返回市集
        </PixelButton>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="text-center py-12">
        <div class="text-lg text-text-body animate-pulse">加载中...</div>
      </div>

      <!-- 任务详情 -->
      <div v-else class="space-y-4 md:space-y-6">
        <!-- 任务介绍 -->
        <PixelCard>
          <template #header>
            任务介绍
          </template>
          <div class="space-y-4">
            <div class="flex items-start justify-between gap-4 flex-wrap">
              <h1 class="font-bold text-xl md:text-2xl text-text-title leading-tight flex-1 min-w-0">
                {{ task.title || '加载中...' }}
              </h1>
              <div class="flex items-center gap-3 flex-wrap">
                <span class="px-3 py-1.5 bg-primary text-white border border-border rounded-2xl shadow-soft-sm font-bold text-[10px] uppercase">
                  {{ task.reward }} {{ taskRewardSymbol }}
                </span>
                <span 
                  class="px-3 py-1.5 border border-border rounded-2xl shadow-soft-sm font-bold text-[10px] uppercase"
                  :class="getStatusBadgeClass(task.status)"
                >
                  {{ getStatusText(task.status) }}
                </span>
              </div>
            </div>
            
            <div class="pt-4 border-t-2 border-black/20">
              <h3 class="font-bold text-xs uppercase text-text-title mb-2">任务描述</h3>
              <p class=" text-lg text-text-title leading-relaxed">{{ task.description }}</p>
            </div>
            
            <div v-if="task.proofConfig" class="pt-4 border-t-2 border-black/20">
              <h3 class="font-bold text-xs uppercase text-text-title mb-4">提交要求</h3>
              <div class="space-y-3">
                <!-- 照片证据 -->
                <div v-if="task.proofConfig.photo?.enabled" class="p-3 bg-gray-50 border border-border rounded-2xl shadow-soft-sm">
                  <div class="flex items-center gap-2 mb-2">
                    <span class="text-xl">📷</span>
                    <h4 class="font-bold text-xs uppercase text-text-title">照片证据</h4>
                  </div>
                  <div class=" text-base text-text-title space-y-1">
                    <div>数量要求：{{ task.proofConfig.photo.count }}张</div>
                    <div v-if="task.proofConfig.photo.requirements" class="mt-2">
                      <span class="font-bold text-[10px] uppercase text-text-body">要求说明：</span>
                      <p class="mt-1">{{ task.proofConfig.photo.requirements }}</p>
                    </div>
                  </div>
                </div>

                <!-- 位置定位 -->
                <div v-if="task.proofConfig.gps?.enabled" class="p-3 bg-gray-50 border border-border rounded-2xl shadow-soft-sm">
                  <div class="flex items-center gap-2 mb-2">
                    <span class="text-xl">📍</span>
                    <h4 class="font-bold text-xs uppercase text-text-title">位置定位</h4>
                  </div>
                </div>

                <!-- 文字描述 -->
                <div v-if="task.proofConfig.description?.enabled" class="p-3 bg-gray-50 border border-border rounded-2xl shadow-soft-sm">
                  <div class="flex items-center gap-2 mb-2">
                    <span class="text-xl">📝</span>
                    <h4 class="font-bold text-xs uppercase text-text-title">文字描述</h4>
                  </div>
                  <div class=" text-base text-text-title space-y-1">
                    <div>最少字数：{{ task.proofConfig.description.minWords || 10 }}字</div>
                    <div v-if="task.proofConfig.description.prompt" class="mt-2">
                      <span class="font-bold text-[10px] uppercase text-text-body">提示语：</span>
                      <p class="mt-1">{{ task.proofConfig.description.prompt }}</p>
                    </div>
                  </div>
                </div>

                <!-- 如果没有配置任何提交要求 -->
                <div v-if="!hasAnyProofConfig(task.proofConfig)" class=" text-base text-text-title/60">
                  未设置提交要求
                </div>
              </div>
            </div>
            
            <div class="pt-4 border-t-2 border-black/20">
              <div class="space-y-3  text-base">
                <!-- 第一行：发布者 -->
                <div class="flex justify-between items-center pb-2 border-b border-black/10">
                  <span class="text-text-body">发布者:</span>
                  <span class="text-text-title font-medium">{{ task.creator }}</span>
                </div>
                
                <!-- 预留用户列表（如果指定了用户） -->
                <div v-if="task.assignedUserIds && task.assignedUserIds.length > 0" class="flex flex-wrap items-center gap-2 pb-2 border-b border-black/10">
                  <span class="text-text-body">预留用户:</span>
                  <span
                    v-for="(assignedUserId, index) in task.assignedUserIds"
                    :key="assignedUserId"
                    class="font-medium text-text-title"
                  >
                    {{ getUserName(assignedUserId) || '未知用户' }}<span v-if="index < task.assignedUserIds.length - 1">、</span>
                  </span>
                </div>
                
                <!-- 领取者信息 -->
                <div v-if="task.claimerName" class="flex justify-between items-center pb-2 border-b border-black/10">
                  <span class="text-text-body">领取者:</span>
                  <span class="text-text-title font-medium">{{ task.claimerName }}</span>
                </div>
                
                <!-- 时间信息：手机端三行，电脑端一行 -->
                <div class="flex flex-col md:flex-row md:justify-between md:items-center pb-2 border-b border-black/10 gap-2 md:gap-4">
                  <!-- 任务开始时间 -->
                  <div class="flex justify-between md:justify-start md:items-center md:gap-2">
                    <span class="text-xs md:text-base text-text-body">任务开始时间:</span>
                    <span class="text-xs md:text-base text-text-title font-medium">
                      {{ task.startDate ? formatDate(task.startDate) : '未设置' }}
                    </span>
                  </div>
                  <!-- 领取截止时间 -->
                  <div class="flex justify-between md:justify-start md:items-center md:gap-2">
                    <span class="text-xs md:text-base text-text-body">领取截止时间:</span>
                    <span class="text-xs md:text-base text-text-title font-medium">{{ task.deadline ? formatDate(task.deadline) : '未设置' }}</span>
                  </div>
                  <!-- 提交截止时间 -->
                  <div class="flex justify-between md:justify-start md:items-center md:gap-2">
                    <span class="text-xs md:text-base text-text-body">提交截止时间:</span>
                    <span class="text-xs md:text-base text-text-title font-medium">{{ task.submitDeadline ? formatDate(task.submitDeadline) : (task.deadline ? formatDate(task.deadline) : '未设置') }}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div v-if="task.submissionInstructions && task.submissionInstructions.trim()" class="pt-4 border-t-2 border-black/20">
              <h3 class="font-bold text-xs uppercase text-text-title mb-2">提交说明</h3>
              <p class=" text-lg text-text-title leading-relaxed">
                {{ task.submissionInstructions }}
              </p>
            </div>
          </div>
        </PixelCard>

        <!-- 多人任务：参与者切换栏（所有人可见，可查看并切换各参与者的提交内容） -->
        <PixelCard 
          v-if="task.participantLimit && task.participantLimit > 1 && task.participantsList && task.participantsList.length > 0"
          class="mb-4"
        >
          <template #header>
            参与者列表 ({{ claimedParticipantsCount }}/{{ task.participantLimit }})
          </template>
          <div class="flex gap-2 overflow-x-auto pb-2">
            <button
              v-for="(participant, index) in task.participantsList"
              :key="participant.id || index"
              @click="switchParticipant(participant.id || task.id)"
              class="flex-shrink-0 px-4 py-2 border border-border rounded-2xl shadow-soft-sm font-bold text-xs uppercase transition-all"
              :class="{
                'bg-primary text-white': currentParticipantId === (participant.id || task.id),
                'border-warning': participant.claimerId === task.creatorId, // 创建者自己的任务行特殊标记
                'bg-white text-text-title hover:bg-primary/10': currentParticipantId !== (participant.id || task.id),
                'text-gray-400': !participant.claimerId && isAssignedUserUnclaimed(participant.claimerId, index) // 指定用户未领取时灰色
              }"
            >
              {{ getParticipantDisplayName(participant, index) }}
              <span v-if="participant.claimerId === task.creatorId" class="ml-1">👑</span>
              <span v-if="participant.status === 'completed'" class="ml-1">✓</span>
              <span v-else-if="participant.status === 'rejected'" class="ml-1">✗</span>
              <span v-else-if="participant.submittedAt" class="ml-1">📤</span>
              <span v-else-if="participant.claimedAt" class="ml-1">📋</span>
            </button>
          </div>
        </PixelCard>

        <!-- 提交凭证（所有人可见；有人领取即显示本区块，当前参与者的凭证与审核者所见一致） -->
        <PixelCard 
          v-if="task.claimerId && (task.status === 'claimed' || task.status === 'unsubmit' || task.status === 'submitted' || task.status === 'under_review' || task.status === 'completed' || task.status === 'rejected')"
          class="mb-4"
        >
          <template #header>
            提交凭证 - {{ task.claimerName || '参与者' }}
          </template>
          <div class="space-y-4">
            <!-- 已提交：显示提交者提交的全部内容（文字、文件、位置等） -->
            <template v-if="task.proof">
              <div class="text-base text-text-title">
                <template v-if="typeof task.proof === 'string' && task.proof.trim().startsWith('{')">
                  <!-- JSON 凭证：只显示真实填写内容，不把默认「任务完成」当描述展示 -->
                  <template v-if="parsedProofContent(task.proof).hasRealContent">
                    <div v-if="parsedProofContent(task.proof).description" class="p-3 bg-input-bg border border-border rounded-2xl shadow-soft-sm">
                      <div class="font-bold text-xs uppercase text-text-title mb-2">文字描述</div>
                      <p class="whitespace-pre-wrap">{{ parsedProofContent(task.proof).description }}</p>
                    </div>
                    <div v-if="parsedProofContent(task.proof).files && parsedProofContent(task.proof).files!.length > 0" class="p-3 bg-input-bg border border-border rounded-2xl shadow-soft-sm">
                      <div class="font-bold text-xs uppercase text-text-title mb-2">提交文件</div>
                      <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <template v-for="(file, index) in parsedProofContent(task.proof).files" :key="index">
                          <!-- 图片：缩略图 + 点击预览 -->
                          <div
                            v-if="isImageFile(file)"
                            class="rounded-xl border border-border overflow-hidden bg-card cursor-pointer hover:shadow-soft transition-all"
                            @click="openProofPreview(file)"
                          >
                            <div class="aspect-square bg-input-bg flex items-center justify-center overflow-hidden">
                              <img :src="file.url" :alt="file.name" class="w-full h-full object-cover" />
                            </div>
                            <div class="p-2 text-xs text-text-body truncate">{{ file.name || '图片' }}</div>
                          </div>
                          <!-- 非图片：链接 + 预览按钮 -->
                          <a
                            v-else
                            :href="file.url"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="flex items-center gap-2 p-3 bg-card border border-border rounded-xl hover:bg-primary/10 transition-colors"
                          >
                            <span class="text-lg">📎</span>
                            <span class="text-sm text-text-title truncate flex-1">{{ file.name || '未命名文件' }}</span>
                          </a>
                        </template>
                      </div>
                    </div>
                    <div v-if="parsedProofContent(task.proof).gps" class="p-3 bg-input-bg border border-border rounded-2xl shadow-soft-sm">
                      <div class="font-bold text-xs uppercase text-text-title mb-2">位置信息</div>
                      <p>纬度: {{ parsedProofContent(task.proof).gps!.latitude || (parsedProofContent(task.proof).gps as any).lat }}</p>
                      <p>经度: {{ parsedProofContent(task.proof).gps!.longitude || (parsedProofContent(task.proof).gps as any).lng }}</p>
                    </div>
                  </template>
                  <div v-else class="p-3 bg-input-bg border border-border rounded-2xl text-text-placeholder text-sm">
                    暂无详细描述或附件
                  </div>
                </template>
                <div v-else class="p-3 bg-input-bg border border-border rounded-2xl shadow-soft-sm">
                  <!-- 纯文本凭证：直接显示提交者写的文字 -->
                  <p class="whitespace-pre-wrap">{{ task.proof }}</p>
                </div>
              </div>
            </template>
            <!-- 已领取但尚未提交 -->
            <div v-else class="p-4 text-center text-text-placeholder text-sm">
              暂无提交内容，等待提交
            </div>
          </div>
        </PixelCard>

        <!-- 任务进度 -->
        <PixelCard v-if="task.updates && task.updates.length > 0">
          <template #header>
            任务进度
          </template>
          <div class="space-y-4">
            <div
              v-for="(update, index) in task.updates"
              :key="update.id"
              class="relative pl-8"
            >
              <!-- 时间线连接线 -->
              <div 
                v-if="Number(index) < task.updates.length - 1"
                class="absolute left-3 top-6 w-0.5 h-8 bg-primary"
              ></div>
              
              <!-- 时间线节点 -->
              <div class="flex items-start gap-3">
                <div class="flex-shrink-0 w-6 h-6 bg-primary border border-border rounded-2xl shadow-soft-sm flex items-center justify-center -ml-8">
                  <div class="w-2 h-2 bg-card border border-border"></div>
                </div>
                
                <div class="flex-1">
                  <div class="flex items-center gap-2 mb-1 flex-wrap">
                    <span class="font-bold text-[10px] uppercase text-text-title">{{ update.title }}</span>
                    <span class=" text-sm text-text-title/60">{{ formatDate(update.timestamp) }}</span>
                    <span 
                      v-if="update.status"
                      class="px-2 py-0.5 border border-border font-bold text-[8px] uppercase"
                      :class="getStatusBadgeClass(update.status)"
                    >
                      {{ getStatusText(update.status, task) }}
                    </span>
                  </div>
                  <p class=" text-base text-text-title">{{ update.description }}</p>
                  
                  <!-- 显示实时状态 -->
                  <div v-if="update.isRealTime" class="mt-2 flex items-center gap-2">
                    <div class="w-2 h-2 bg-primary border border-border animate-pulse"></div>
                    <span class=" text-sm text-primary">实时更新中...</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </PixelCard>
        
        <!-- 操作按钮 -->
        <PixelCard>
          <template #header>
            操作
          </template>
          <div class="space-y-3">
            <!-- 未领取状态 - 显示领取按钮或满员提示 -->
            <!-- 对于多人任务，即使当前行已领取，如果还有其他未领取的位置，也应该显示领取按钮 -->
            <PixelButton
              v-if="canClaim"
              @click="handleClaimTask"
              variant="primary"
              size="lg"
              :block="true"
              :disabled="loading || !canClaim"
            >
              {{ loading ? '领取中...' : '领取任务' }}
            </PixelButton>
            
            <!-- 领取错误提示 -->
            <div
              v-if="claimError"
              class="text-center py-4 bg-red-50 border-2 border-red-300 rounded"
            >
              <p class=" text-base text-red-600">
                {{ claimError }}
              </p>
            </div>
            
            <!-- 任务未开始提示 -->
            <div
              v-if="!isTaskStarted && !canClaim"
              class="text-center py-4"
            >
              <p class=" text-base text-text-title/60">
                任务未开始
              </p>
            </div>
            
            <!-- 任务已过期提示（领取截止日期） -->
            <div
              v-else-if="isTaskExpired && !canClaim"
              class="text-center py-4"
            >
              <p class=" text-base text-text-title/60">
                领取已截止
              </p>
            </div>
            
            <!-- 任务已截止提示（提交截止日期） -->
            <div
              v-else-if="isTaskOverdue && !canClaim"
              class="text-center py-4"
            >
              <p class=" text-base text-text-title/60">
                任务已截止
              </p>
            </div>
            
            <!-- 任务已指定给其他用户提示 -->
            <div
              v-else-if="shouldShowAssignedToOthersMessage && !claimError"
              class="text-center py-4"
            >
              <p class=" text-base text-text-title/60">
                此任务已指定给其他用户，您无法领取
              </p>
            </div>
            
            <!-- 多人任务提示 -->
            <div
              v-else-if="!canClaim && task.participantLimit && task.participantLimit > 1"
              class="text-center py-4"
            >
              <p class=" text-base text-text-title/60">
                {{ task.participantsList && task.participantsList.filter((p: any) => p.claimerId && p.claimedAt).length >= task.participantLimit 
                  ? '任务参与人数已满' 
                  : '您已经领取过这个任务' }}
              </p>
            </div>
            
            <!-- 单人任务已被领取提示 -->
            <div
              v-else-if="!canClaim && (!task.participantLimit || task.participantLimit === 1)"
              class="text-center py-4"
            >
              <p class=" text-base text-text-title/60">
                该任务已被{{ task.claimerName || '其他用户' }}领取
              </p>
            </div>
            
            <!-- 已领取状态（新状态）- 只有领取者可以提交 -->
            <PixelButton
              v-if="task.status === 'claimed' && isClaimer"
              @click="submitTask"
              variant="success"
              size="lg"
              :block="true"
            >
              提交任务
            </PixelButton>
            
            <!-- 已领取但未提交状态（新状态）- 只有领取者可以提交 -->
            <PixelButton
              v-if="task.status === 'unsubmit' && isClaimer"
              @click="submitTask"
              variant="success"
              size="lg"
              :block="true"
              :disabled="isTaskSubmissionOverdue"
            >
              {{ isTaskSubmissionOverdue ? '已截止' : '提交任务' }}
            </PixelButton>
            
            <!-- 已领取但非领取者查看 - 显示提示 -->
            <div
              v-if="(task.status === 'claimed' || task.status === 'unsubmit') && !isClaimer && task.claimerId"
              class="text-center py-4"
            >
              <p class=" text-base text-text-title/60">
                此任务已被{{ task.claimerName || '其他用户' }}领取
              </p>
            </div>
            
            
            <!-- 已提交状态（新状态） -->
            <PixelButton
              v-if="task.status === 'submitted' && canReview"
              @click="reviewTask"
              variant="warning"
              size="lg"
              :block="true"
            >
              审核任务
            </PixelButton>
            
            <PixelButton
              v-if="task.status === 'submitted' && !canReview"
              variant="secondary"
              size="lg"
              :block="true"
              :disabled="true"
            >
              等待审核
            </PixelButton>
            
            <!-- 待审核状态 -->
            <PixelButton
              v-if="task.status === 'under_review' && canReview"
              @click="reviewTask"
              variant="warning"
              size="lg"
              :block="true"
            >
              审核任务
            </PixelButton>
            
            <PixelButton
              v-if="task.status === 'under_review' && !canReview"
              variant="secondary"
              size="lg"
              :block="true"
              :disabled="true"
            >
              审核中
            </PixelButton>
            
            <!-- 已完成状态 - 审核者可以看到转账按钮 -->
            <template v-if="task.status === 'completed' && canReview">
              <!-- 未转账：显示转账按钮和标记按钮 -->
              <template v-if="!task.transferredAt">
            <PixelButton
                  @click="handleTransferToSemi"
                  variant="primary"
                  size="lg"
                  :block="true"
                  :disabled="isTransferring"
                  class="mb-3"
                >
                  {{ isTransferring ? '处理中...' : '跳转到Semi转账' }}
                </PixelButton>
                <PixelButton
                  @click="handleMarkTransferCompleted"
                  variant="secondary"
                  size="lg"
                  :block="true"
                  :disabled="isMarkingTransfer"
                >
                  {{ isMarkingTransfer ? '标记中...' : '标记为已转账' }}
                </PixelButton>
              </template>
              <!-- 已转账：显示状态标记 -->
              <div v-else class="text-center py-4">
                <div class="bg-success/20 border border-success shadow-soft-sm p-4 mb-3">
                  <p class=" text-base text-text-title mb-1">
                    <span class="font-bold text-xs">✓</span> 已转账
                  </p>
                  <p class=" text-sm text-text-body">
                    转账时间：{{ formatDate(task.transferredAt) }}
                  </p>
                </div>
                <PixelButton
                  @click="handleUnmarkTransfer"
                  variant="secondary"
                  size="lg"
                  :block="true"
                  :disabled="isMarkingTransfer"
                >
                  {{ isMarkingTransfer ? '处理中...' : '取消转账标记' }}
                </PixelButton>
              </div>
            </template>
            <!-- 已完成状态 - 非审核者 -->
            <PixelButton
              v-else-if="task.status === 'completed'"
              variant="secondary"
              size="lg"
              :block="true"
              :disabled="true"
            >
              已完成
            </PixelButton>
            
            <!-- 已驳回状态 -->
            <PixelButton
              v-if="task.status === 'rejected'"
              variant="secondary"
              size="lg"
              :block="true"
              :disabled="true"
            >
              已驳回
            </PixelButton>
          </div>
        </PixelCard>
      </div>
    </div>

    <!-- 凭证图片/文件预览弹层 -->
    <Teleport to="body">
      <div
        v-if="proofPreviewUrl"
        class="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
        @click.self="proofPreviewUrl = null"
      >
        <div class="relative max-w-[90vw] max-h-[90vh] bg-card rounded-2xl shadow-soft overflow-hidden">
          <img
            v-if="proofPreviewUrl"
            :src="proofPreviewUrl"
            alt="预览"
            class="max-w-full max-h-[85vh] w-auto h-auto object-contain"
            @click.stop
          />
          <button
            type="button"
            class="absolute top-2 right-2 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70"
            aria-label="关闭"
            @click="proofPreviewUrl = null"
          >
            ✕
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { getTaskById, claimTask, getApiBaseUrl, markTransferCompleted, unmarkTransferCompleted, buildSemiTransferUrl, getWalletAddressByUserId } from '~/utils/api'
import { useToast } from '~/composables/useToast'
import { useUserStore } from '~/stores/user'
import PixelCard from '~/components/pixel/PixelCard.vue'
import PixelButton from '~/components/pixel/PixelButton.vue'
import { getTaskRewardSymbol } from '~/utils/display'
import { parseBeijingTime, getCurrentBeijingDate, formatBeijingTime } from '~/utils/time'

// 获取路由参数
const route = useRoute()
const router = useRouter()
const taskId = route.params.id as string  // UUID是字符串，不需要parseInt
const toast = useToast()
const loading = ref(false)
const claimError = ref<string | null>(null)
const userStore = useUserStore()
const taskRewardSymbol = ref('积分') // 任务奖励的积分符号
const isTransferring = ref(false)
const isMarkingTransfer = ref(false)
const proofPreviewUrl = ref<string | null>(null)

// 当前查看的参与者ID（用于多人任务导航）

// 任务数据
const task = ref<any>({
  id: taskId,
  title: '',
  description: '',
  reward: 0,
  status: 'unclaimed',
  deadline: '',
  submitDeadline: '',
  startDate: '',
  creator: '',
  creatorId: '',  // ✅ 改为空字符串，因为creatorId是UUID (string)
  submissionInstructions: '',
  proofConfig: null,
  proof: null as string | null, // 当前查看的参与者的凭证
  updates: [],
  participantLimit: null as number | null,
  participantsList: [] as any[]
})

// 当前查看的参与者任务ID（用于多人任务切换）
const currentParticipantId = ref<string>(taskId)

// 权限检查：判断当前用户是否是任务创建者
const canReview = computed(() => {
  return userStore.user?.id === task.value.creatorId
})

// 权限检查：判断当前用户是否是任务领取者
const isClaimer = computed(() => {
  return userStore.user?.id === task.value.claimerId
})

// 获取用户名（用于显示预留用户）
const getUserName = (userId: string) => {
  // 从assignedUserNames中获取
  if (task.value.assignedUserNames && task.value.assignedUserNames[userId]) {
    return task.value.assignedUserNames[userId]
  }
  return null
}

// 计算已领取的参与者数量
const claimedParticipantsCount = computed(() => {
  if (!task.value.participantsList || task.value.participantsList.length === 0) {
    return 0
  }
  return task.value.participantsList.filter((p: any) => p.claimerId && p.claimedAt).length
})

// 检查创建者是否已领取
const isCreatorClaimed = computed(() => {
  if (!task.value.participantsList || task.value.participantsList.length === 0) {
    return false
  }
  return task.value.participantsList.some(
    (p: any) => p.claimerId === task.value.creatorId && p.claimedAt
  )
})

// 获取创建者自己的任务行ID
const creatorTaskId = computed(() => {
  if (!task.value.participantsList || task.value.participantsList.length === 0) {
    return null
  }
  const creatorTask = task.value.participantsList.find(
    (p: any) => p.claimerId === task.value.creatorId
  )
  return creatorTask?.id || null
})

// 获取参与者显示名称（支持指定用户未领取时显示用户名）
const getParticipantDisplayName = (participant: any, index: number) => {
  // 如果已领取，显示领取者名称
  if (participant.claimerId && participant.name && participant.name !== '未领取') {
    return participant.name
  }
  
  // 如果未领取，检查是否是指定用户
  if (task.value.assignedUserIds && task.value.assignedUserIds.length > 0) {
    // 尝试从 assignedUserIds 中找到对应的用户
    // 注意：这里需要根据 participantIndex 或 index 来匹配
    // 由于后端返回的 participantsList 是按 participant_index 排序的
    // 我们可以通过索引来匹配 assignedUserIds
    if (task.value.assignedUserIds[index]) {
      const assignedUserId = task.value.assignedUserIds[index]
      const userName = getUserName(assignedUserId)
      if (userName) {
        return userName // 显示指定用户的名称（灰色）
      }
    }
  }
  
  // 默认显示"未领取"
  return '未领取'
}

// 检查是否是指定用户但未领取（用于灰色标记）
const isAssignedUserUnclaimed = (claimerId: string | null, index: number) => {
  // 如果已领取，不是灰色
  if (claimerId) {
    return false
  }
  
  // 如果未领取，检查是否是指定用户
  if (task.value.assignedUserIds && task.value.assignedUserIds.length > 0) {
    if (task.value.assignedUserIds[index]) {
      return true // 是指定用户但未领取，显示灰色
    }
  }
  
  return false
}

// 检查任务是否可以领取（多人任务：检查是否还有未领取的位置）
// 判断逻辑顺序（按优先级）：
// 1. 任务是否已开始
// 2. 任务是否已过期（领取截止日期）
// 3. 任务是否已截止（提交截止日期）
// 4. 是否指定了参与人员（如果指定了，只有指定用户才能领取）
// 5. 用户是否已经领取过（多人任务）
// 6. 是否还有未领取的位置（多人任务）或是否已被领取（单人任务）
const canClaim = computed(() => {
  // 1. 检查任务是否已开始
  if (!isTaskStarted.value) {
    return false
  }
  
  // 2. 检查任务是否已过期（领取截止日期）
  if (isTaskExpired.value) {
    return false
  }
  
  // 3. 检查任务是否已截止（提交截止日期）- 如果过了提交截止日期，不能再领取
  if (isTaskOverdue.value) {
    return false
  }
  
  // 4. 检查是否指定了参与人员（支持多个用户）
  // 对于多人任务：如果指定的人数少于总人数，未指定的席位任何人都可以领取
  if (task.value.assignedUserIds && task.value.assignedUserIds.length > 0) {
    // 如果是多人任务，检查是否所有席位都被指定
    if (task.value.participantLimit && task.value.participantLimit > 1) {
      // 如果所有席位都被指定，只有指定的用户才能领取
      if (task.value.assignedUserIds.length >= task.value.participantLimit) {
        if (!userStore.user?.id || !task.value.assignedUserIds.includes(userStore.user.id)) {
          return false
        }
      }
      // 如果还有未指定的席位，任何人都可以领取（包括指定的用户）
    } else {
      // 单人任务：如果指定了用户，只有该用户才能领取
      if (!userStore.user?.id || !task.value.assignedUserIds.includes(userStore.user.id)) {
        return false
      }
    }
  } else if (task.value.assignedUserId) {
    // 向后兼容：单个assignedUserId
    // 对于多人任务，如果只有一个用户被指定，其他席位仍然可以领取
    if (task.value.participantLimit && task.value.participantLimit > 1) {
      // 多人任务：如果指定了用户，该用户可以领取，其他人也可以领取未指定的席位
      // 这里不阻止，让后续逻辑判断
    } else {
      // 单人任务：如果指定了用户，只有该用户才能领取
      if (task.value.assignedUserId !== userStore.user?.id) {
        return false
      }
    }
  }
  
  // 5. 如果是多人任务
  if (task.value.participantLimit && task.value.participantLimit > 1) {
    // 5.1 检查当前用户是否已经领取过（允许创建者领取自己的任务）
    if (task.value.participantsList && task.value.participantsList.length > 0) {
      const userClaimed = task.value.participantsList.some(
        (p: any) => p.claimerId === userStore.user?.id && p.claimedAt
      )
      if (userClaimed) {
        return false // 用户已经领取过
      }
    }
    
    // 5.2 检查是否还有未领取的位置
    const claimedCount = task.value.participantsList?.filter(
      (p: any) => p.claimerId && p.claimedAt
    ).length || 0
    
    return claimedCount < task.value.participantLimit
  } else {
    // 6. 单人任务：检查是否已被领取
    return !task.value.claimerId
  }
})

// 检查是否应该显示"已指定给其他用户"的提示
const shouldShowAssignedToOthersMessage = computed(() => {
  // 如果用户可以领取，不显示这个提示
  if (canClaim.value) {
    return false
  }
  
  // 如果用户已经领取了，不显示这个提示（因为已经有其他状态显示）
  if (task.value.claimerId === userStore.user?.id) {
    return false
  }
  
  // 检查是否所有席位都被指定
  if (task.value.assignedUserIds && task.value.assignedUserIds.length > 0) {
    // 如果是多人任务
    if (task.value.participantLimit && task.value.participantLimit > 1) {
      // 如果所有席位都被指定，且用户不在指定列表中，显示提示
      if (task.value.assignedUserIds.length >= task.value.participantLimit) {
        if (!userStore.user?.id || !task.value.assignedUserIds.includes(userStore.user.id)) {
          return true
        }
      }
      // 如果还有未指定的席位，不显示这个提示
    } else {
      // 单人任务：如果指定了用户，且用户不在指定列表中，显示提示
      if (!userStore.user?.id || !task.value.assignedUserIds.includes(userStore.user.id)) {
        return true
      }
    }
  } else if (task.value.assignedUserId) {
    // 向后兼容：单个assignedUserId
    // 如果是多人任务，且只有一个用户被指定，不显示这个提示（因为还有未指定的席位）
    if (task.value.participantLimit && task.value.participantLimit > 1) {
      return false
    } else {
      // 单人任务：如果指定了其他用户，显示提示
      if (task.value.assignedUserId !== userStore.user?.id) {
        return true
      }
    }
  }
  
  return false
})

// 检查任务是否已开始
// 统一使用 UTC+8 北京时间进行比较，不受机器时区影响
const isTaskStarted = computed(() => {
  if (!task.value.startDate) return true // 如果没有开始时间，默认认为已开始（向后兼容）
  
  // 使用统一的时间解析函数，将 YYYY-MM-DDTHH:mm 当作北京时间（UTC+8）处理
  const startDate = parseBeijingTime(task.value.startDate)
  if (!startDate) return true // 如果无法解析，默认认为已开始
  
  // 获取当前北京时间（UTC+8）
  const now = getCurrentBeijingDate()
  return now.getTime() >= startDate.getTime()
})

// 检查任务是否已过期（过了领取截止日期）
// 对于多人任务：过了领取截止日期就不能再领取
// 对于单人任务：过了领取截止日期且未领取才算过期
// 统一使用 UTC+8 北京时间进行比较，不受机器时区影响
const isTaskExpired = computed(() => {
  if (!task.value.deadline) return false // 如果没有领取截止时间，认为未过期
  
  // 使用统一的时间解析函数，将 YYYY-MM-DDTHH:mm 当作北京时间（UTC+8）处理
  const deadline = parseBeijingTime(task.value.deadline)
  if (!deadline) return false // 无效时间，认为未过期
  
  // 获取当前北京时间（UTC+8）
  const now = getCurrentBeijingDate()
  
  // 如果过了领取截止日期
  if (now.getTime() > deadline.getTime()) {
    // 多人任务：过了领取截止日期就不能再领取
    if (task.value.participantLimit && task.value.participantLimit > 1) {
      return true
    }
    // 单人任务：过了领取截止日期且未领取才算过期
    return !task.value.claimerId
  }
  
  return false
})

// 检查任务是否已截止（过了提交截止日期）
// 如果过了提交截止日期，不能再领取新任务
// 统一使用 UTC+8 北京时间进行比较，不受机器时区影响
const isTaskOverdue = computed(() => {
  // 优先使用提交截止日期
  const submitDeadline = task.value.submitDeadline || task.value.deadline
  if (!submitDeadline) return false // 如果没有提交截止时间，认为未截止
  
  // 使用统一的时间解析函数，将 YYYY-MM-DDTHH:mm 当作北京时间（UTC+8）处理
  const deadline = parseBeijingTime(submitDeadline)
  if (!deadline) return false // 无效时间，认为未截止
  
  // 获取当前北京时间（UTC+8）
  const now = getCurrentBeijingDate()
  
  // 如果过了提交截止日期，不能再领取
  return now.getTime() > deadline.getTime()
})

// 检查任务是否已截止（用于已领取任务的提交按钮）
// 过了提交截止日期且已领取但未提交的任务才算已截止
// 统一使用 UTC+8 北京时间进行比较，不受机器时区影响
const isTaskSubmissionOverdue = computed(() => {
  if (!task.value.submitDeadline) return false // 如果没有提交截止时间，认为未截止
  
  // 使用统一的时间解析函数，将 YYYY-MM-DDTHH:mm 当作北京时间（UTC+8）处理
  const submitDeadline = parseBeijingTime(task.value.submitDeadline)
  if (!submitDeadline) return false // 无效时间，认为未截止
  
  // 获取当前北京时间（UTC+8）
  const now = getCurrentBeijingDate()
  
  // 过了提交截止日期且已领取但未提交的任务才算已截止
  return now.getTime() > submitDeadline.getTime() && !!task.value.claimerId && task.value.status !== 'completed' && task.value.status !== 'submitted' && task.value.status !== 'under_review'
})

// 状态类型
type TaskStatus = 'unclaimed' | 'claimed' | 'unsubmit' | 'submitted' | 'under_review' | 'completed' | 'rejected'

// 状态文本（统一的状态文本映射）
const getStatusText = (status: string, task?: any): string => {
  const statusMap: Record<string, string> = {
    'unclaimed': '未领取',
    'claimed': '已领取',
    'unsubmit': '待提交',
    'submitted': '已提交',
    'completed': '已完成',
    'under_review': '审核中',
    'rejected': '已终止'
  }
  return statusMap[status] || '未知'
}

// 状态样式类（用于时间线）
const getStatusClass = (status: string): string => {
  const statusClassMap: Record<string, string> = {
    'completed': 'bg-success/10 text-success',
    'unsubmit': 'bg-primary/10 text-primary',
    'claimed': 'bg-primary/10 text-primary',
    'under_review': 'bg-warning/10 text-warning',
    'rejected': 'bg-destructive/10 text-destructive'
  }
  return statusClassMap[status] || 'bg-muted/10 text-muted-foreground'
}

// 状态徽章样式类（像素风格）
const getStatusBadgeClass = (status: string): string => {
  const statusClassMap: Record<TaskStatus, string> = {
    'unclaimed': 'bg-card text-text-title',
    'unsubmit': 'bg-warning text-text-title',
    'claimed': 'bg-warning text-text-title',
    'submitted': 'bg-warning text-text-title',
    'completed': 'bg-success text-white',
    'under_review': 'bg-warning text-text-title',
    'rejected': 'bg-destructive text-white'
  }
  return statusClassMap[status as TaskStatus] || 'bg-card text-text-title'
}

// 格式化日期
// 统一使用 UTC+8 北京时间显示，不受机器时区影响
const formatDate = (dateString: string | undefined) => {
  if (!dateString) return '未设置'
  
  // 使用统一的时间格式化函数
  const beijingTimeStr = formatBeijingTime(dateString)
  if (!beijingTimeStr) return '未设置'
  
  // 解析为 Date 对象用于格式化显示
  const date = parseBeijingTime(beijingTimeStr)
  if (!date || isNaN(date.getTime())) {
    return '未设置'
  }
  
  // 加上 8 小时得到北京时间用于显示
  const beijingDate = new Date(date.getTime() + 8 * 60 * 60 * 1000)
  
  // 使用 UTC 方法读取（因为已经手动偏移了 8 小时）
  const year = beijingDate.getUTCFullYear()
  const month = beijingDate.getUTCMonth()
  const day = beijingDate.getUTCDate()
  const hour = beijingDate.getUTCHours()
  const minute = beijingDate.getUTCMinutes()
  
  // 格式化显示
  const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
  return `${year}年${monthNames[month]}${day}日 ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

// 检查是否有任何证明配置
const hasAnyProofConfig = (proofConfig: any) => {
  if (!proofConfig) return false
  return (
    (proofConfig.photo?.enabled) ||
    (proofConfig.gps?.enabled) ||
    (proofConfig.description?.enabled)
  )
}

// 解析凭证内容（支持 JSON 和纯文本格式）
const parseProof = (proof: string) => {
  if (!proof) return { description: '', files: [], gps: null }
  
  try {
    if (proof.trim().startsWith('{')) {
      const parsed = JSON.parse(proof)
      return {
        description: parsed.description || '',
        files: parsed.files || [],
        gps: parsed.gps || (parsed.latitude && parsed.longitude ? { latitude: parsed.latitude, longitude: parsed.longitude } : null)
      }
    }
  } catch (e) {
    // 如果不是 JSON，返回纯文本
  }
  
  return {
    description: proof,
    files: [],
    gps: null
  }
}

// 判断是否为图片文件（按 URL 或 name 后缀）
const isImageFile = (file: { name?: string; url?: string }) => {
  const ext = (file.name || file.url || '').split('.').pop()?.toLowerCase() || ''
  return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext)
}
const openProofPreview = (file: { url?: string }) => {
  if (file?.url) proofPreviewUrl.value = file.url
}

// 解析并判断是否为「真实提交内容」（过滤掉仅默认「任务完成」、无文件无位置的情况）
const parsedProofContent = (proof: string) => {
  const base = parseProof(proof)
  const hasFiles = !!(base.files && base.files.length > 0)
  const hasGps = !!base.gps
  const desc = (base.description || '').trim()
  const isDefaultOnly = desc === '任务完成' && !hasFiles && !hasGps
  return {
    ...base,
    hasRealContent: !isDefaultOnly && (!!desc || hasFiles || hasGps),
    description: isDefaultOnly ? '' : desc
  }
}

// 生成进度时间线
// 优先使用任务的时间线字段（timeline），如果不存在则根据任务状态生成
const updateTimeline = () => {
  // 如果任务有 timeline 字段，直接使用（这是后端维护的仅追加写入的时间线）
  if (task.value.timeline && Array.isArray(task.value.timeline) && task.value.timeline.length > 0) {
    console.log('[UPDATE TIMELINE] 使用数据库时间线:', {
      taskId: task.value.id,
      claimerId: task.value.claimerId,
      timelineLength: task.value.timeline.length,
      timeline: task.value.timeline
    })
    
    // 按时间戳排序，确保时间线按时间顺序显示
    const sortedTimeline = [...task.value.timeline].sort((a: any, b: any) => {
      const timeA = new Date(a.timestamp || a.created_at || 0).getTime()
      const timeB = new Date(b.timestamp || b.created_at || 0).getTime()
      return timeA - timeB
    })
    // 合并连续重复项（同一 status + 同一 action），避免多次点击审核导致多条「审核通过」重复显示
    const dedupedTimeline = sortedTimeline.filter((item: any, i: number) => {
      const prev = sortedTimeline[i - 1]
      if (!prev) return true
      const same = (prev.status === item.status) && (String(prev.action || '').trim() === String(item.action || '').trim())
      return !same
    })

    task.value.updates = dedupedTimeline.map((statusItem: any, index: number) => {
      // 处理字段名称兼容性
      const actorName = statusItem.actorName || statusItem.actor_name || ''
      const action = statusItem.action || ''
      const reason = statusItem.reason || statusItem.reject_reason || ''
      const timestamp = statusItem.timestamp || statusItem.created_at || new Date().toISOString()
      
      // 根据状态值生成显示文本
      let title = ''
      let description = ''
      let status = statusItem.status || 'completed'
      
      // 根据状态和操作生成显示文本
      switch (statusItem.status) {
        case 'unclaimed':
          title = action || (index === 0 ? '任务创建' : '任务状态')
          description = action === '创建任务' 
            ? `任务已创建，等待领取${actorName ? `（创建者：${actorName}）` : ''}`
            : action === '重新发布'
            ? `任务已重新发布，等待领取${actorName ? `（操作者：${actorName}）` : ''}${reason ? `，原因：${reason}` : ''}`
            : '任务未领取'
          break
        case 'claimed':
          title = action || '任务领取'
          description = action === '领取任务'
            ? `任务已被${actorName || '参与者'}领取`
            : `任务状态：已领取${actorName ? `（操作者：${actorName}）` : ''}`
          break
        case 'unsubmit':
          title = action || '任务状态'
          description = action === '领取任务'
            ? `任务已被${actorName || '参与者'}领取，等待提交`
            : action === '重新提交'
            ? `任务已重新提交，等待提交凭证${actorName ? `（操作者：${actorName}）` : ''}${reason ? `，原因：${reason}` : ''}`
            : action === '审核驳回'
            ? `审核未通过，需要重新提交任务${actorName ? `（审核者：${actorName}）` : ''}${reason ? `，驳回原因：${reason}` : ''}`
            : '任务待提交'
          if (action === '审核驳回') title = '审核驳回'
          break
        case 'submitted':
          title = action || '凭证提交'
          description = `任务完成凭证已提交，等待审核${actorName ? `（提交者：${actorName}）` : ''}`
          break
        case 'under_review':
          title = action || '凭证提交'
          description = `任务完成凭证已提交，等待审核${actorName ? `（提交者：${actorName}）` : ''}`
          break
        case 'completed':
          title = action || '审核通过'
          description = `任务审核通过，奖励已发放${actorName ? `（审核者：${actorName}）` : ''}${reason ? `，审核意见：${reason}` : ''}`
          break
        case 'resubmit':
          title = action || '审核驳回'
          description = `审核未通过，需要重新提交${actorName ? `（审核者：${actorName}）` : ''}${reason ? `，驳回原因：${reason}` : ''}`
          status = 'unsubmit' // 显示为待提交状态
          break
        case 'reclaim':
          title = action || '审核驳回'
          description = `审核未通过，需要重新领取任务${actorName ? `（审核者：${actorName}）` : ''}${reason ? `，驳回原因：${reason}` : ''}`
          status = 'unclaimed' // 显示为未领取状态
          break
        case 'rejected':
          title = action || '审核驳回'
          description = `任务审核未通过，已驳回${actorName ? `（审核者：${actorName}）` : ''}${reason ? `，驳回原因：${reason}` : ''}`
          // 确保驳回状态在时间线中正确显示
          status = 'rejected'
          break
        default:
          title = action || '状态更新'
          description = reason || '状态已更新'
      }
      
      return {
        id: `${index}-${statusItem.status}-${timestamp}`,
        title,
        description,
        timestamp,
        status,
        actorName,
        action,
        reason
      }
    })
    console.log('Generated updates from timeline:', task.value.updates)
    return
  }
  
  console.log('No timeline found, generating from task status')
  
  // 如果没有 timeline 字段，根据任务状态生成（向后兼容）
  const updates: any[] = []
  
  // 任务创建
  updates.push({
    id: '1',
    title: '任务创建',
    description: '任务已创建，等待领取',
    timestamp: task.value.createdAt || new Date().toISOString(),
    status: 'completed'
  })
  
  // 任务领取（只显示当前任务行的领取信息，不使用 participantsList 避免混合多个参与者的时间线）
  if (['claimed', 'unsubmit', 'submitted', 'under_review', 'completed'].includes(task.value.status) && task.value.claimerId) {
    updates.push({
      id: '2',
      title: '任务领取',
      description: `任务已被${task.value.claimerName || '参与者'}领取`,
      timestamp: task.value.claimedAt || new Date().toISOString(),
      status: 'completed'
    })
  }
  
  // 凭证提交（只显示当前任务行的提交信息，不使用 participantsList 避免混合多个参与者的时间线）
  if (['submitted', 'under_review', 'completed'].includes(task.value.status) && task.value.submittedAt) {
    updates.push({
      id: '3',
      title: '凭证提交',
      description: '任务完成凭证已提交，等待审核',
      timestamp: task.value.submittedAt || new Date().toISOString(),
      status: 'completed'
    })
  }
  
  // 审核结果
  if (task.value.status === 'completed') {
    updates.push({
      id: '4',
      title: '审核通过',
      description: '任务审核通过，奖励已发放',
      timestamp: task.value.completedAt || new Date().toISOString(),
      status: 'completed'
    })
  } else if (task.value.status === 'rejected') {
    // 根据 rejectOption 显示不同的文本
    const rejectOption = (task.value as any).rejectOption
    if (rejectOption === 'rejected') {
    updates.push({
        id: '4',
        title: '审核驳回',
        description: '任务审核未通过，已驳回',
        timestamp: task.value.updatedAt || new Date().toISOString(),
        status: 'rejected'
      })
    } else if (rejectOption === 'resubmit') {
      const rejectReason = (task.value as any).rejectReason || ''
      updates.push({
        id: '4',
        title: '审核驳回',
        description: `审核未通过，需要重新提交任务${rejectReason ? `，驳回原因：${rejectReason}` : ''}`,
        timestamp: task.value.updatedAt || new Date().toISOString(),
        status: 'unsubmit'
      })
    } else if (rejectOption === 'reclaim') {
      const rejectReason = (task.value as any).rejectReason || ''
      updates.push({
        id: '4',
        title: '审核驳回',
        description: `审核未通过，需要重新领取任务${rejectReason ? `，驳回原因：${rejectReason}` : ''}`,
        timestamp: task.value.updatedAt || new Date().toISOString(),
        status: 'unclaimed'
      })
    } else {
      // 默认情况
      const rejectReason = (task.value as any).rejectReason || ''
      updates.push({
        id: '4',
        title: '审核驳回',
        description: `任务审核未通过，已驳回${rejectReason ? `，驳回原因：${rejectReason}` : ''}`,
        timestamp: task.value.updatedAt || new Date().toISOString(),
        status: 'rejected'
      })
    }
  }
  
  // 如果任务正在进行中，添加实时更新标记
  if (task.value.status === 'claimed' || task.value.status === 'unsubmit') {
    updates.push({
      id: Date.now().toString(),
      title: '任务进行中',
      description: '任务正在进行中，等待提交...',
      timestamp: new Date().toISOString(),
      status: 'unsubmit',
      isRealTime: true
    })
  }
  
  task.value.updates = updates
}

// 加载任务详情
const loadTask = async () => {
  loading.value = true
  claimError.value = null // 清除之前的错误消息
  try {
    const baseUrl = getApiBaseUrl()
    // 第一次加载使用缓存，后续加载不使用缓存以确保数据最新
    const taskData = await getTaskById(taskId, baseUrl, true, 5000)
    if (!taskData) {
      toast.add({
        title: '任务不存在',
        description: '无法找到该任务',
        color: 'red'
      })
      router.push('/tasks')
      return
    }
    
    // 处理多人任务：确定要显示的任务行
    let currentTaskData = taskData
    let targetTaskId = taskId
    
    // 如果是多人任务（participantLimit > 1）
    if (taskData.participantLimit && taskData.participantLimit > 1 && taskData.participantsList && taskData.participantsList.length > 0) {
      // 判断用户角色
      if (userStore.user?.id === taskData.creatorId) {
        // 创建者：如果已领取，默认显示自己的任务行；否则显示第一个已领取的任务行
        if (creatorTaskId.value) {
          // 创建者已领取，显示自己的任务行
          targetTaskId = creatorTaskId.value
          const creatorTask = taskData.participantsList.find((p: any) => p.id === creatorTaskId.value)
          if (creatorTask) {
            // 需要重新获取创建者任务行的完整数据（包括时间线）
            currentTaskData = await getTaskById(creatorTaskId.value, baseUrl, true, 5000) || taskData
          }
        } else {
          // 创建者未领取，显示第一个已领取的任务行，或第一个任务行
          const firstClaimed = taskData.participantsList.find((p: any) => p.claimerId && p.claimedAt) || taskData.participantsList[0]
          if (firstClaimed && firstClaimed.id) {
            targetTaskId = firstClaimed.id
            currentTaskData = await getTaskById(firstClaimed.id, baseUrl, true, 5000) || taskData
          }
        }
        currentParticipantId.value = targetTaskId
      } else {
        // 非创建者：显示自己领取的任务行
        const myTask = taskData.participantsList.find((p: any) => p.claimerId === userStore.user?.id)
        if (myTask && myTask.id) {
          targetTaskId = myTask.id
          currentTaskData = await getTaskById(myTask.id, baseUrl, true, 5000) || taskData
          currentParticipantId.value = myTask.id
        } else {
          // 未领取，显示第一个未领取的任务行
          const firstUnclaimed = taskData.participantsList.find((p: any) => !p.claimerId) || taskData.participantsList[0]
          if (firstUnclaimed && firstUnclaimed.id) {
            targetTaskId = firstUnclaimed.id
            currentTaskData = await getTaskById(firstUnclaimed.id, baseUrl, true, 5000) || taskData
          }
          currentParticipantId.value = targetTaskId
        }
      }
    } else {
      // 单人任务
      currentParticipantId.value = taskId
    }
    
    // 构建 assignedUserNames 映射（从 participantsList 中获取，或从 assignedUserIds 中获取）
    let assignedUserNames: Record<string, string> = {}
    if (taskData.assignedUserIds && taskData.assignedUserIds.length > 0) {
      // 如果后端返回了 assignedUserNames，直接使用
      if (taskData.assignedUserNames && typeof taskData.assignedUserNames === 'object') {
        assignedUserNames = taskData.assignedUserNames
      } else {
        // 否则从 participantsList 中构建
        taskData.assignedUserIds.forEach((userId: string, index: number) => {
          // 先从 participantsList 中查找（如果已领取）
          if (taskData.participantsList && taskData.participantsList.length > index) {
            const participant = taskData.participantsList[index]
            if (participant && participant.claimerId === userId && participant.name && participant.name !== '未领取') {
              assignedUserNames[userId] = participant.name
              return
            }
          }
          // 如果 participantsList 中没有，标记为未知用户
          assignedUserNames[userId] = '未知用户'
        })
      }
    }
    
    // 转换API数据为页面需要的格式
    task.value = {
      id: currentTaskData.id,
      title: currentTaskData.title || taskData.title,
      description: currentTaskData.description || taskData.description,
      reward: currentTaskData.reward || taskData.reward,
      status: currentTaskData.status || taskData.status,
      deadline: currentTaskData.deadline || taskData.deadline || currentTaskData.createdAt, // 领取截止日期
      submitDeadline: currentTaskData.submitDeadline || taskData.submitDeadline || currentTaskData.deadline || currentTaskData.createdAt, // 提交截止日期
      startDate: currentTaskData.startDate || taskData.startDate, // 任务领取时间
      isClaimed: !!currentTaskData.claimerId, // 是否已领取（通过 claimerId 判断）
      creator: currentTaskData.creatorName || taskData.creatorName || '发布者',
      creatorId: currentTaskData.creatorId || taskData.creatorId,
      claimerId: currentTaskData.claimerId || null, // 保存当前查看的领取者ID，用于权限检查
      claimerName: currentTaskData.claimerName || null, // 保存当前查看的领取者名称，用于显示
      assignedUserId: currentTaskData.assignedUserId || taskData.assignedUserId || null, // 指定参与人员ID（向后兼容）
      assignedUserIds: currentTaskData.assignedUserIds || taskData.assignedUserIds || (currentTaskData.assignedUserId ? [currentTaskData.assignedUserId] : []) || (taskData.assignedUserId ? [taskData.assignedUserId] : []), // 指定参与人员ID列表
      assignedUserNames: assignedUserNames || currentTaskData.assignedUserNames || taskData.assignedUserNames || {} as Record<string, string>,
      participantLimit: taskData.participantLimit || null, // 多人任务限制
      participantsList: taskData.participantsList || [], // 参与者列表
      submissionInstructions: currentTaskData.submissionInstructions || taskData.submissionInstructions || '',
      proofConfig: currentTaskData.proofConfig || taskData.proofConfig || null, // 获取证明配置
      proof: currentTaskData.proof || null, // 保存当前任务行的凭证（用于创建者查看）
      timeline: currentTaskData.timeline || [], // 保存当前任务行的时间线数据
      updates: [],
      // 保存原始API数据字段用于时间线
      createdAt: currentTaskData.createdAt || taskData.createdAt,
      updatedAt: currentTaskData.updatedAt || taskData.updatedAt,
      claimedAt: currentTaskData.claimedAt,
      submittedAt: currentTaskData.submittedAt,
      completedAt: currentTaskData.completedAt,
      transferredAt: currentTaskData.transferredAt || undefined // ✅ 新增：从后端数据中读取转账状态
    }
    
    // 调试：打印 assignedUserId
    console.log('[LOAD TASK] assignedUserId:', {
      currentTaskData: currentTaskData.assignedUserId,
      taskData: taskData.assignedUserId,
      final: task.value.assignedUserId,
      assignedUserIds: task.value.assignedUserIds,
      assignedUserNames: task.value.assignedUserNames,
      currentUserId: userStore.user?.id
    })
    
    // 调试：打印时间线数据
    console.log('[LOAD TASK] 时间线数据加载:', {
      taskId: task.value.id,
      currentParticipantId: currentParticipantId.value,
      timelineLength: task.value.timeline?.length || 0,
      timeline: task.value.timeline,
      claimerId: task.value.claimerId,
      claimerName: task.value.claimerName
    })
    
    // 获取任务奖励的积分符号
    taskRewardSymbol.value = await getTaskRewardSymbol(taskData)
    
    // 生成进度时间线
    updateTimeline()
  } catch (error) {
    console.error('加载任务失败:', error)
    toast.add({
      title: '加载失败',
      description: '无法加载任务详情，请稍后重试',
      color: 'red'
    })
  } finally {
    loading.value = false
  }
}


// 领取任务
const handleClaimTask = async () => {
  claimError.value = null // 清除之前的错误
  loading.value = true
  
  try {
    const baseUrl = getApiBaseUrl()
    const result = await claimTask(taskId, baseUrl)
    if (result.success) {
      toast.add({
        title: '领取成功',
        description: result.message,
        color: 'green'
      })
      // 重新加载任务数据
      await loadTask()
    } else {
      // 显示错误消息在页面上
      claimError.value = result.message || '领取失败'
      toast.add({
        title: '领取失败',
        description: result.message,
        color: 'red'
      })
    }
  } catch (error: any) {
    console.error('领取任务失败:', error)
    const errorMessage = error?.message || '网络错误，请稍后重试'
    claimError.value = errorMessage
    toast.add({
      title: '领取失败',
      description: errorMessage,
      color: 'red'
    })
  } finally {
    loading.value = false
  }
}

// 提交任务
const submitTask = () => {
      // 使用当前查看的任务行ID（对于多人任务，这应该是用户实际领取的任务行ID）
      router.push(`/tasks/submit?id=${task.value.id}`)
}

// 切换参与者（多人任务）
const switchParticipant = async (participantTaskId: string) => {
  if (currentParticipantId.value === participantTaskId) return
  
  currentParticipantId.value = participantTaskId
  loading.value = true
  
  try {
    const baseUrl = getApiBaseUrl()
    
    // 清除缓存，确保获取最新的时间线数据
    const { responseCache } = await import('~/utils/cache')
    responseCache.delete(`task:${participantTaskId}`)
    
    // 从 API 获取最新的任务数据
    const participantTaskData = await getTaskById(participantTaskId, baseUrl, false, 0)
    
    if (participantTaskData) {
      // 更新当前显示的任务数据（确保只使用当前任务行的时间线）
      task.value.id = participantTaskData.id
      task.value.status = participantTaskData.status
      task.value.claimerId = participantTaskData.claimerId
      task.value.claimerName = participantTaskData.claimerName
      task.value.reward = participantTaskData.reward
      task.value.proof = participantTaskData.proof || null // 更新当前查看的参与者的凭证
      task.value.timeline = Array.isArray(participantTaskData.timeline) ? participantTaskData.timeline : []
      task.value.claimedAt = participantTaskData.claimedAt
      task.value.submittedAt = participantTaskData.submittedAt
      task.value.completedAt = participantTaskData.completedAt
      task.value.transferredAt = participantTaskData.transferredAt
      
      // 更新任务奖励的积分符号
      taskRewardSymbol.value = await getTaskRewardSymbol(participantTaskData)
      
      // 重新生成时间线（只使用当前任务行的时间线）
      updateTimeline()
    }
  } catch (error) {
    console.error('切换参与者失败:', error)
    toast.add({
      title: '切换失败',
      description: '无法加载参与者信息',
      color: 'red'
    })
  } finally {
    loading.value = false
  }
}

// 跳转到Semi转账页面
const handleTransferToSemi = async () => {
  if (!task.value.claimerId) {
    toast.add({
      title: '无法转账',
      description: '参与者信息不存在',
      color: 'red'
    })
    return
  }

  isTransferring.value = true
  
  try {
    const baseUrl = getApiBaseUrl()
    const creatorId = task.value.creatorId
    const claimerId = task.value.claimerId
    const reward = task.value.reward
    
    // 获取创建者的钱包地址（发送方）
    const creatorAddress = await getWalletAddressByUserId(creatorId, baseUrl)
    
    // 获取参与者的钱包地址（接受方）
    const claimerAddress = await getWalletAddressByUserId(claimerId, baseUrl)
    
    // 检查钱包地址
    if (!creatorAddress) {
      toast.add({
        title: '无法转账',
        description: '创建者未绑定钱包，无法转账',
        color: 'orange'
      })
      return
    }
    
    if (!claimerAddress) {
      toast.add({
        title: '无法转账',
        description: '参与者未绑定钱包，无法转账',
        color: 'orange'
      })
      return
    }

    // 构造并跳转到semi转账页面
    const transferUrl = buildSemiTransferUrl(
      claimerAddress,
      reward.toString(),
    )
    
    // 在新窗口打开semi转账页面
    const newWindow = window.open(transferUrl, '_blank')
    if (!newWindow) {
      toast.add({
        title: '无法打开转账页面',
        description: '浏览器阻止了弹窗，请允许弹窗后重试',
        color: 'orange'
      })
    } else {
      toast.add({
        title: '已打开转账页面',
        description: '请在 Semi 页面完成转账后，点击"标记为已转账"',
        color: 'green'
      })
    }
  } catch (error) {
    console.error('获取钱包地址失败：', error)
    toast.add({
      title: '无法转账',
      description: '获取钱包地址失败，请稍后重试',
      color: 'orange'
    })
  } finally {
    isTransferring.value = false
  }
}

// 标记转账完成
const handleMarkTransferCompleted = async () => {
  isMarkingTransfer.value = true
  
  try {
    const baseUrl = getApiBaseUrl()
    const result = await markTransferCompleted(task.value.id, baseUrl)
    
    if (result.success) {
      toast.add({
        title: '标记成功',
        description: result.message,
        color: 'green'
      })
      
      // 更新当前任务行的转账状态
      const transferredAtValue = result.data?.transferredAt
      task.value.transferredAt = transferredAtValue
      
      // 如果是多人任务，同时更新 participantsList 中对应参与者的 transferredAt
      if (task.value.participantsList && Array.isArray(task.value.participantsList)) {
        const currentParticipant = task.value.participantsList.find(
          (p: any) => p.id === task.value.id
        )
        if (currentParticipant) {
          currentParticipant.transferredAt = transferredAtValue
        }
      }
      
    } else {
      toast.add({
        title: '标记失败',
        description: result.message,
        color: 'red'
      })
    }
  } catch (error) {
    console.error('标记转账完成失败：', error)
    toast.add({
      title: '标记失败',
      description: '网络错误，请稍后重试',
      color: 'red'
    })
  } finally {
    isMarkingTransfer.value = false
  }
}

// 取消转账标记（清除 transferredAt）
const handleUnmarkTransfer = async () => {
  isMarkingTransfer.value = true
  
  try {
    const baseUrl = getApiBaseUrl()
    const result = await unmarkTransferCompleted(task.value.id, baseUrl)
    
    if (result.success) {
      toast.add({
        title: '取消标记成功',
        description: result.message,
        color: 'green'
      })
      
      // 清除当前任务行的转账状态
      task.value.transferredAt = null
      
      // 如果是多人任务，同时清除 participantsList 中对应参与者的 transferredAt
      if (task.value.participantsList && Array.isArray(task.value.participantsList)) {
        const currentParticipant = task.value.participantsList.find(
          (p: any) => p.id === task.value.id
        )
        if (currentParticipant) {
          currentParticipant.transferredAt = undefined
        }
      }
    } else {
      toast.add({
        title: '取消标记失败',
        description: result.message,
        color: 'red'
      })
    }
  } catch (error) {
    console.error('取消转账标记失败：', error)
    toast.add({
      title: '取消标记失败',
      description: '网络错误，请稍后重试',
      color: 'red'
    })
  } finally {
    isMarkingTransfer.value = false
  }
}

// 审核任务
const reviewTask = () => {
      // 使用当前查看的参与者任务ID
      router.push(`/tasks/review?id=${task.value.id}`)
}

// 导航到成员页面
const navigateToMember = (memberId: string | number) => {
  router.push(`/member/${memberId}`)
}

// 导航函数
const navigateTo = (path: string) => {
  router.push(path)
}

// 进度更新轮询
let pollingInterval: ReturnType<typeof setInterval> | null = null

const startProgressPolling = () => {
  // 清除已有轮询
  if (pollingInterval) {
    clearInterval(pollingInterval)
  }
  
  // 每10秒轮询一次任务状态（减少频率，避免过度刷新）
  // 注意：对于多人任务，非创建者不应该轮询，因为他们只能看到自己的任务
  pollingInterval = setInterval(async () => {
    try {
      // 只在任务未完成时轮询
      if (task.value.status === 'completed' || task.value.status === 'rejected') {
        return // 任务已完成，停止轮询
      }
      
      const baseUrl = getApiBaseUrl()
      // 轮询时使用当前任务行ID（对于多人任务，这应该是当前查看的任务行ID）
      const taskIdToPoll = currentParticipantId.value || taskId
      
      // 轮询时使用缓存，但设置较短的缓存时间（2秒），只检查状态变化
      const updatedTask = await getTaskById(taskIdToPoll, baseUrl, true, 2000)
      if (updatedTask && updatedTask.status !== task.value.status) {
        // 状态发生变化，只更新状态相关字段，不重新加载整个任务
        task.value.status = updatedTask.status
        task.value.claimerId = updatedTask.claimerId
        task.value.claimerName = updatedTask.claimerName
        task.value.timeline = Array.isArray(updatedTask.timeline) ? updatedTask.timeline : [] // 确保只使用当前任务行的时间线
        task.value.claimedAt = updatedTask.claimedAt
        task.value.submittedAt = updatedTask.submittedAt
        task.value.completedAt = updatedTask.completedAt
        
        // 重新生成时间线（只使用当前任务行的时间线）
        updateTimeline()
        
        // 清除相关缓存，确保下次获取最新数据
        const { responseCache } = await import('~/utils/cache')
        responseCache.delete(`task:${taskIdToPoll}`)
      }
    } catch (error) {
      console.error('轮询任务状态失败:', error)
    }
  }, 10000) // 改为10秒，减少刷新频率
}

const stopProgressPolling = () => {
  if (pollingInterval) {
    clearInterval(pollingInterval)
    pollingInterval = null
  }
}

// 组件挂载时加载任务并开始轮询
onMounted(async () => {
  // 确保用户信息已加载
  await userStore.getUser()
  
  await loadTask()
  
  // 检查是否从提交页面返回
  if (route.query.submitted === 'true') {
    // 清除缓存，确保获取最新数据
    const { responseCache } = await import('~/utils/cache')
    responseCache.delete(`task:${taskId}`)
    
    // 重新加载任务以获取最新状态
    await loadTask()
    // 清理URL参数
    router.replace({ query: {} })
  }
  
  // 检查是否从审核页面返回
  if (route.query.reviewed === 'true') {
    // 重新加载任务以获取最新状态
    await loadTask()
    // 清理URL参数
    router.replace({ query: {} })
  }
  
  // 开始进度轮询
  startProgressPolling()
})

// 组件卸载时清理轮询
onUnmounted(() => {
  stopProgressPolling()
})
</script>

<style scoped>
</style>
