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
                <PixelButton
                  v-if="canCreatorWithdrawEffective"
                  variant="secondary"
                  size="sm"
                  :disabled="loading"
                  @click="handleWithdrawTask"
                >
                  撤回
                </PixelButton>
                <PixelButton
                  v-if="canCreatorDeleteEffective"
                  variant="danger"
                  size="sm"
                  :disabled="loading"
                  @click="handleDeleteTask"
                >
                  删除
                </PixelButton>
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
                  <div class="text-sm text-text-body">提交时需要提供位置信息</div>
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
                    v-for="(assignedUserId, idx) in task.assignedUserIds"
                    :key="assignedUserId"
                    class="font-medium text-text-title"
                  >
                    {{ getUserName(assignedUserId) || '未知用户' }}<span v-if="Number(idx) < task.assignedUserIds.length - 1">、</span>
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

            <!-- 链上托管：阶段、建池交易、入口（与方案 A 话术一致，不出现「任务池」） -->
            <div
              v-if="showTaskpoolOnchainSection"
              class="pt-4 border-t-2 border-black/20"
            >
              <h3 class="font-bold text-xs uppercase text-text-title mb-3">链上进度</h3>
              <div class="space-y-3 text-base text-text-title">
                <div class="flex flex-wrap justify-between gap-2 items-baseline">
                  <span class="text-text-body shrink-0">链上阶段</span>
                  <span class="font-medium text-right">{{ taskpoolPhaseLabel }}</span>
                </div>
                <div class="flex flex-wrap justify-between gap-2 items-baseline">
                  <span class="text-text-body shrink-0">链上发放</span>
                  <span
                    class="font-medium text-right"
                    :class="poolOnchainRow?.settled ? 'text-success' : 'text-text-title'"
                  >
                    {{ poolOnchainRow?.settled ? '已结算发放完成' : '未结算/未发放' }}
                  </span>
                </div>
                <div
                  v-if="taskpoolCreateStatusLabel"
                  class="flex flex-wrap justify-between gap-2 items-baseline"
                >
                  <span class="text-text-body shrink-0">同步状态</span>
                  <span class="text-sm text-right break-words max-w-[min(100%,18rem)]">{{ taskpoolCreateStatusLabel }}</span>
                </div>
                <div
                  v-if="task.taskpoolCreateTxHash"
                  class="flex flex-wrap justify-between gap-2 items-start"
                >
                  <span class="text-text-body shrink-0 pt-0.5">建池交易</span>
                  <a
                    :href="optimismTxExplorerUrl(task.taskpoolCreateTxHash)"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="font-mono text-sm text-primary underline break-all text-right max-w-[min(100%,20rem)]"
                  >{{ shortTxHash(task.taskpoolCreateTxHash) }}</a>
                </div>
                <div
                  v-if="finalApprovedEventRef?.txHash"
                  class="flex flex-wrap justify-between gap-2 items-start"
                >
                  <span class="text-text-body shrink-0 pt-0.5">链上备注</span>
                  <a
                    :href="optimismTxExplorerUrl(finalApprovedEventRef.txHash)"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="font-mono text-sm text-primary underline break-all text-right max-w-[min(100%,20rem)]"
                  >
                    {{ shortTxHash(finalApprovedEventRef.txHash) }}
                  </a>
                </div>
                <div
                  v-if="remarkReadError && String(remarkReadError).trim()"
                  class="text-xs text-text-placeholder break-words"
                >
                  {{ remarkReadError }}
                </div>
                <div
                  v-if="onchainClaimerRemarkText && String(onchainClaimerRemarkText).trim()"
                  class="bg-primary/5 border border-border rounded-2xl p-3"
                >
                  <div class="flex items-baseline justify-between gap-2 mb-1">
                    <span class="font-bold text-xs uppercase text-text-title">链上备注（接包者）</span>
                    <span class="text-xs text-text-placeholder">所有人可见</span>
                  </div>
                  <p
                    data-testid="taskpool-onchain-remark-assignee"
                    class="text-sm text-text-title whitespace-pre-wrap break-words"
                  >{{ onchainClaimerRemarkText }}</p>
                </div>
                <div
                  v-if="onchainPublisherRemarkText && String(onchainPublisherRemarkText).trim()"
                  class="bg-primary/5 border border-border rounded-2xl p-3"
                >
                  <div class="flex items-baseline justify-between gap-2 mb-1">
                    <span class="font-bold text-xs uppercase text-text-title">链上备注（发包者）</span>
                    <span class="text-xs text-text-placeholder">所有人可见</span>
                  </div>
                  <p
                    data-testid="taskpool-onchain-remark-publisher"
                    class="text-sm text-text-title whitespace-pre-wrap break-words"
                  >{{ onchainPublisherRemarkText }}</p>
                </div>
                <div class="pt-1">
                  <PixelButton
                    v-if="task.taskInfoId"
                    variant="secondary"
                    size="sm"
                    @click="openTaskpoolManage"
                  >
                    查看链上进度与结算
                  </PixelButton>
                  <p v-else class="text-sm text-text-body">
                    链上信息同步中，请稍后在「我的」或发布入口进入管理页。
                  </p>
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

        <!-- TaskPool：领取者收款（distribute）。卡片始终展示，按钮按状态置灰。 -->
        <PixelCard v-if="showClaimerTaskpoolSettlementCard" class="mb-4">
          <template #header>
            链上收款（领取者）
          </template>
          <div class="space-y-3 text-sm text-text-body">
            <p class="text-xs text-text-placeholder">
              奖励由合约内锁定余额结算，请使用下方按钮跳转 <strong>Semi</strong> 完成
              <code class="text-xs">distribute</code>；与「钱包间转账」页面无关。
            </p>
            <p v-if="poolReadLoading" class="text-text-placeholder">读取链上池子状态…</p>
            <template v-else-if="poolReadError">
              <p class="text-destructive">链上状态读取失败，请点击下方刷新或稍后重试。</p>
              <p class="text-xs text-text-placeholder break-words">{{ poolReadError }}</p>
            </template>
            <template v-else-if="poolNotFound">
              <div class="text-text-body">
                链上暂未找到该池子：通常是尚未完成建池/同步，或发布者还未在 Semi 发起建池。
              </div>
            </template>
            <template v-else-if="poolOnchainRow">
              <div v-if="poolOnchainRow.settled" class="text-success font-medium">
                链上已结算关闭，NT 已按合约规则发放（以区块浏览器为准）。
              </div>
              <div v-else-if="!publicizeStartedOnchain" class="text-text-body">
                审核通过后需由发布者在 Semi 完成<strong>终审（开启公示）</strong>，公示期约 24 小时；终审前无法结算。
              </div>
              <div v-else-if="publicizeRemainingSec > 0" class="space-y-1">
                <p>
                  公示进行中（链上约 24 小时）。剩余约
                  <span class="font-mono font-semibold text-text-title">{{ formatDurationCn(publicizeRemainingSec) }}</span>
                </p>
                <p class="text-xs text-text-placeholder">
                  公示结束后可结算发放；如有异议请在公示期内提出申诉（后续将提供入口）。
                </p>
                <p v-if="finalApprovedEventRef?.txHash" class="text-xs text-text-placeholder">
                  终审交易：
                  <a
                    class="text-primary underline font-mono"
                    :href="optimismTxExplorerUrl(finalApprovedEventRef.txHash)"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {{ shortTxHash(finalApprovedEventRef.txHash) }}
                  </a>
                  <span v-if="finalApprovedEventRef.blockNumber">
                    · 区块 {{ finalApprovedEventRef.blockNumber.toString() }}
                  </span>
                </p>
              </div>
              <div v-else class="text-text-title font-medium">
                已到链上可结算时间，请领取者本人在 Semi 确认交易。
              </div>
            </template>

            <PixelButton
              variant="primary"
              size="lg"
              :block="true"
              :disabled="claimerDistributeOpening || settlementCtaDisabled"
              @click="onClaimerSemiDistribute"
            >
              {{ claimerDistributeOpening ? '正在打开 Semi…' : settlementCtaText }}
            </PixelButton>
            <p v-if="settlementHint" class="text-xs text-text-placeholder">{{ settlementHint }}</p>

            <PixelButton
              variant="secondary"
              size="sm"
              :disabled="poolReadLoading"
              @click="refreshTaskpoolPoolOnchain"
            >
              刷新链上状态
            </PixelButton>

            <PixelButton
              v-if="showShareButton && poolOnchainRow?.settled"
              variant="secondary"
              size="sm"
              class="ml-2"
              @click="openShareModal('claimer')"
            >
              一键分享社区圈
            </PixelButton>
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
                'text-gray-400': !participant.claimerId && isAssignedUserUnclaimed(participant.claimerId, Number(index)) // 指定用户未领取时灰色
              }"
            >
              {{ getParticipantDisplayName(participant, Number(index)) }}
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
                      <a
                        :href="`https://uri.amap.com/marker?position=${parsedProofContent(task.proof).gps!.longitude || (parsedProofContent(task.proof).gps as any).lng},${parsedProofContent(task.proof).gps!.latitude || (parsedProofContent(task.proof).gps as any).lat}&name=任务位置`"
                        target="_blank"
                        rel="noopener"
                        class="inline-block mt-2 text-sm text-primary underline"
                      >在地图中查看</a>
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

            <template v-if="showTaskpoolClaimReconcileButton">
              <PixelButton
                variant="secondary"
                size="lg"
                :block="true"
                :disabled="claimReconcileLoading || loading"
                @click="handleReconcileTaskpoolClaim"
              >
                {{ claimReconcileLoading ? '同步中…' : '同步链上领取状态' }}
              </PixelButton>
              <p class="text-xs text-text-placeholder text-center">
                若 Semi 侧已领取成功但本站仍显示未领取，可点此从链上补全（不依赖回跳）。
              </p>
            </template>
            
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
            
            <!-- 已完成状态 - 发包方：转账按钮 -->
            <template v-if="task.status === 'completed' && canReview">
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
                v-if="!task.transferredAt && chainTransactions.length === 0"
                @click="handleMarkTransferCompleted"
                variant="secondary"
                size="lg"
                :block="true"
                :disabled="isMarkingTransfer"
              >
                {{ isMarkingTransfer ? '标记中...' : '标记为已转账' }}
              </PixelButton>
              <PixelButton
                v-if="task.transferredAt && chainTransactions.length === 0"
                @click="handleUnmarkTransfer"
                variant="secondary"
                size="lg"
                :block="true"
                :disabled="isMarkingTransfer"
              >
                {{ isMarkingTransfer ? '处理中...' : '取消转账标记' }}
              </PixelButton>
            </template>
            <PixelButton
              v-else-if="task.status === 'completed'"
              variant="secondary"
              size="lg"
              :block="true"
              :disabled="true"
            >
              已完成
            </PixelButton>

            <PixelButton
              v-if="showShareButton"
              variant="secondary"
              size="lg"
              :block="true"
              class="mt-3"
              @click="openShareModal()"
            >
              一键分享任务到社区圈
            </PixelButton>

            <div v-if="task.status === 'completed'" class="mt-3">
              <div v-if="chainTransactions.length > 0" class="bg-success/20 border border-success shadow-soft-sm p-4">
                <p class="text-base text-text-title mb-1">
                  <span class="font-bold">✓</span> 已转账
                </p>
                <p class="text-sm text-text-body">
                  金额：{{ weiToToken(chainTransactions[0]?.actual_amount || chainTransactions[0]?.amount) || task.reward }} 积分
                </p>
                <p class="text-sm text-text-body">
                  转账时间：{{ formatDate(chainTransactions[0].created_at) }}
                </p>
                <a
                  :href="`https://optimistic.etherscan.io/tx/${chainTransactions[0].tx_hash}`"
                  target="_blank"
                  class="text-sm text-blue-600 underline mt-1 inline-block"
                >
                  查看交易详情
                </a>
              </div>
              <div v-else-if="task.transferredAt" class="bg-success/20 border border-success shadow-soft-sm p-4">
                <p class="text-base text-text-title mb-1">
                  <span class="font-bold">✓</span> 已标记转账
                </p>
                <p class="text-sm text-text-body">
                  标记时间：{{ formatDate(task.transferredAt) }}
                </p>
              </div>
              <div v-else class="bg-warning/20 border border-warning shadow-soft-sm p-4">
                <p class="text-base text-text-title">
                  <span class="font-bold">⏳</span> 待转账
                </p>
                <p class="text-sm text-text-body">
                  预期金额：{{ task.reward }} 积分
                </p>
              </div>
            </div>
            
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

    <ShareToCommunityModal
      :visible="shareModalVisible"
      :mode="shareModalMode"
      :task="shareTask"
      :sender-remark="shareSenderRemark"
      :onchain-remark="shareModalMode === 'claimer' ? shareOnchainClaimerRemark : shareOnchainPublisherRemark"
      @close="onShareModalClose"
    />
  </div>
</template>

<script setup lang="ts">
import { nextTick, onUnmounted, watch } from 'vue'
import {
  getTaskById,
  claimTask,
  getApiBaseUrl,
  markTransferCompleted,
  unmarkTransferCompleted,
  buildSemiTransferUrl,
  getWalletAddressByUserId,
  getTaskpoolClaimIntent,
  reconcileTaskpoolClaim,
  generateRandomState,
  getFinalReward,
  getTaskTransactions,
} from '~/utils/api'
import ShareToCommunityModal from '~/components/tasks/ShareToCommunityModal.vue'
import { useToast } from '~/composables/useToast'
import { useUserStore } from '~/stores/user'
import PixelCard from '~/components/pixel/PixelCard.vue'
import PixelButton from '~/components/pixel/PixelButton.vue'
import { getTaskRewardSymbol, weiToToken } from '~/utils/display'
import { parseBeijingTime, getCurrentBeijingDate, formatBeijingTime } from '~/utils/time'
import { withdrawTask, deleteTask, withdrawTaskPool } from '~/utils/api'
import {
  buildSemiTaskpoolClaimUrl,
  buildSemiTaskpoolDistributeUrl,
  semiTaskpoolStateStorageKey,
  optimismTxExplorerUrl,
} from '~/utils/semiTaskpoolPrepay'
import { uuidToTaskPoolUint256 } from '~/utils/taskpool'
import { useTaskpoolPoolOnchain } from '~/composables/useTaskpoolPoolOnchain'
import type { TaskpoolPoolEventRef, TaskpoolPoolRow } from '~/composables/useTaskpoolPoolOnchain'
import type { Hex } from 'viem'

// 获取路由参数
const route = useRoute()
const router = useRouter()
const taskId = route.params.id as string  // UUID是字符串，不需要parseInt
const toast = useToast()
const loading = ref(false)
const claimReconcileLoading = ref(false)
const claimError = ref<string | null>(null)
const userStore = useUserStore()
const taskRewardSymbol = ref('积分') // 任务奖励的积分符号
const isTransferring = ref(false)
const isMarkingTransfer = ref(false)
const proofPreviewUrl = ref<string | null>(null)
const chainTransactions = ref<any[]>([])
const loadingTransactions = ref(false)

const shareModalVisible = ref(false)
const shareTask = ref<{
  id: string
  title: string
  completedAt?: string
  proof?: string | null
  receiverRemark?: string | null
  taskInfo?: { id?: string; communityId?: string | null }
} | null>(null)
const shareSenderRemark = ref('')
const shareModalMode = ref<'claimer' | 'reviewer'>('claimer')
const shareOnchainPublisherRemark = ref<string | null>(null)
const shareOnchainClaimerRemark = ref<string | null>(null)

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
  participantsList: [] as any[],
  // taskpool 扩展字段（用于门禁与提示）
  taskInfoId: '',
  useTaskpool: false as boolean | undefined,
  listingKind: undefined as 'standard' | 'taskpool_pool' | 'taskpool_subtask' | undefined,
  managerUserId: null as string | null | undefined,
  subtasksFinalized: false as boolean | undefined,
  taskpoolCreateTxHash: null as string | null | undefined,
  taskpoolPhase: undefined as 'none' | 'awaiting_pool' | 'pool_created' | 'closed' | undefined,
  taskpoolCreateStatus: undefined as
    | 'idle'
    | 'signing'
    | 'pending'
    | 'confirmed'
    | 'failed'
    | undefined,
  taskpoolCreateLastError: null as string | null | undefined,
  /** 读链上备注用的「真实任务行」UUID（商城池列表行可能与链上 taskId 不一致，以后端为准） */
  remarkTaskRowId: null as string | null | undefined,
})

// 当前查看的参与者任务ID（用于多人任务切换）
const currentParticipantId = ref<string>(taskId)

// 权限检查：判断当前用户是否是任务创建者
const canReview = computed(() => {
  return userStore.user?.id === task.value.creatorId
})

const isCreator = computed(() => {
  return userStore.user?.id === task.value.creatorId
})

const noOneClaimed = computed(() => {
  // 多人任务：一个人都没领取过
  if (task.value.participantLimit && task.value.participantLimit > 1) {
    return claimedParticipantsCount.value === 0
  }
  // 单人任务：未领取
  return !task.value.claimerId
})

const canCreatorWithdraw = computed(() => isCreator.value && noOneClaimed.value)
const canCreatorDelete = computed(() => isCreator.value && noOneClaimed.value)

const isTaskpoolPoolListing = computed(() => task.value?.useTaskpool === true && task.value?.listingKind === 'taskpool_pool')

/** 走链上托管的普通任务：详情页展示链上阶段与建池交易 */
const showTaskpoolOnchainSection = computed(() => task.value?.useTaskpool === true)

/** 任务池任务且本站尚未记录领取者：允许从链上 TaskClaimed 日志补同步 */
const showTaskpoolClaimReconcileButton = computed(() => {
  if (task.value?.useTaskpool !== true) return false
  if (task.value?.claimerId) return false
  return !!userStore.user?.id
})

const taskpoolPhaseLabel = computed(() => {
  const p = task.value?.taskpoolPhase
  if (p === 'none') return '未开始'
  if (p === 'awaiting_pool') return '等待建池'
  if (p === 'pool_created') return '已建池'
  if (p === 'closed') return '已结算关闭'
  return p ? String(p) : '—'
})

const taskpoolCreateStatusLabel = computed(() => {
  const s = task.value?.taskpoolCreateStatus
  if (!s || s === 'idle' || s === 'confirmed') return ''
  if (s === 'signing') return '等待钱包签名'
  if (s === 'pending') return '链上确认中…'
  if (s === 'failed') {
    return task.value?.taskpoolCreateLastError
      ? `失败：${task.value.taskpoolCreateLastError}`
      : '建池失败'
  }
  return String(s)
})

function shortTxHash(hash: string) {
  if (!hash || hash.length < 18) return hash
  return `${hash.slice(0, 10)}…${hash.slice(-8)}`
}

function openTaskpoolManage() {
  const id = task.value?.taskInfoId
  if (!id) return
  navigateTo(`/tasks/pool/${id}/manage`)
}

// 与任务池管理页 gate 对齐：仅早期可撤回
const canCreatorWithdrawPoolFromMall = computed(() => {
  if (!isTaskpoolPoolListing.value) return false
  if (!isCreator.value) return false
  if (!noOneClaimed.value) return false
  if (task.value?.managerUserId != null) return false
  if (task.value?.taskpoolCreateTxHash) return false
  if (task.value?.subtasksFinalized === true) return false
  return true
})

const canCreatorWithdrawEffective = computed(() => {
  if (isTaskpoolPoolListing.value) return canCreatorWithdrawPoolFromMall.value
  return canCreatorWithdraw.value
})

const canCreatorDeleteEffective = computed(() => {
  // 任务池：管理侧只有“撤回”，商城详情不提供“物理删除”入口
  if (isTaskpoolPoolListing.value) return false
  return canCreatorDelete.value
})

// 权限检查：判断当前用户是否是任务领取者
const isClaimer = computed(() => {
  return userStore.user?.id === task.value.claimerId
})

/** TaskPool：领取者在详情页发起 Semi distribute（主路径） */
const runtimeConfig = useRuntimeConfig()
const taskpoolPoolReader = useTaskpoolPoolOnchain()
const poolOnchainRow = ref<TaskpoolPoolRow | null>(null)
const poolReadLoading = ref(false)
const poolReadError = ref('')
const finalApprovedEventRef = ref<TaskpoolPoolEventRef | null>(null)
const distributedEventRef = ref<TaskpoolPoolEventRef | null>(null)
/**
 * 链上备注正文（remarkProxy）：
 * - 发包者总评：`getRemarks(poolId, 0).receiverRemark`
 * - 接包者备注：`getRemarks(poolId, taskRow).senderRemark`
 */
const onchainClaimerRemarkText = ref<string | null>(null)
const onchainPublisherRemarkText = ref<string | null>(null)
const remarkReadError = ref<string>('')
const lastRemarkFetchKey = ref<string>('')
const claimerDistributeOpening = ref(false)
/** 仅用于公示倒计时每秒刷新 */
const poolUiTick = ref(0)
const poolPollTimerRef = ref<ReturnType<typeof setInterval> | null>(null)
const tickTimerRef = ref<ReturnType<typeof setInterval> | null>(null)
/** TaskPool：链上读状态退避轮询（避免 RPC 429） */
const taskpoolBackoffTimerRef = ref<ReturnType<typeof setTimeout> | null>(null)
const taskpoolBackoffStepRef = ref(0)
const taskpoolBackoffStartedAtRef = ref(0)

function friendlyRpcErrorMessage(raw: unknown): string {
  const msg = raw instanceof Error ? raw.message : String(raw || '')
  if (msg.includes('429') || msg.includes('HTTP 429')) {
    return '读链被限流（HTTP 429），稍后会自动重试；也可点击「刷新链上状态」。'
  }
  return msg
}

function stopTaskpoolBackoffPoll() {
  if (taskpoolBackoffTimerRef.value) {
    clearTimeout(taskpoolBackoffTimerRef.value)
    taskpoolBackoffTimerRef.value = null
  }
  taskpoolBackoffStepRef.value = 0
  taskpoolBackoffStartedAtRef.value = 0
}

function scheduleTaskpoolBackoffPoll() {
  if (!import.meta.client) return
  if (!task.value?.useTaskpool || !task.value?.taskInfoId) return
  if (poolOnchainRow.value?.settled) {
    stopTaskpoolBackoffPoll()
    return
  }
  // 避免重复调度
  if (taskpoolBackoffTimerRef.value) return

  const now = Date.now()
  if (!taskpoolBackoffStartedAtRef.value) taskpoolBackoffStartedAtRef.value = now
  // 最多自动重试 2 分钟，避免后台刷屏；用户仍可手动点刷新
  if (now - taskpoolBackoffStartedAtRef.value > 2 * 60 * 1000) {
    stopTaskpoolBackoffPoll()
    return
  }

  const step = taskpoolBackoffStepRef.value
  const delays = [15_000, 30_000, 60_000] as const
  const delay = delays[Math.min(step, delays.length - 1)]
  taskpoolBackoffStepRef.value = step + 1

  taskpoolBackoffTimerRef.value = setTimeout(async () => {
    taskpoolBackoffTimerRef.value = null
    try {
      await refreshTaskpoolPoolOnchain()
    } finally {
      // 继续下一轮（若已 settled，会在 schedule 内停止）
      scheduleTaskpoolBackoffPoll()
    }
  }, delay)
}

const poolNotFound = computed(() => {
  const p = poolOnchainRow.value
  return !!p && !p.exists
})

const showClaimerTaskpoolSettlementCard = computed(() => {
  if (!task.value?.useTaskpool) return false
  if (!task.value?.taskInfoId) return false
  if (!isClaimer.value) return false
  return true
})

const publicizeStartedOnchain = computed(() => {
  const p = poolOnchainRow.value
  if (!p) return false
  return taskpoolPoolReader.isPublicizeStarted(p)
})

const publicizeRemainingSec = computed(() => {
  poolUiTick.value
  const p = poolOnchainRow.value
  if (!p || !taskpoolPoolReader.isPublicizeStarted(p)) return 0
  const now = BigInt(Math.floor(Date.now() / 1000))
  if (now >= p.publicizeEndsAt) return 0
  return Number(p.publicizeEndsAt - now)
})

const canClaimerOpenSemiDistribute = computed(() => {
  poolUiTick.value
  const p = poolOnchainRow.value
  if (!p) return false
  const now = BigInt(Math.floor(Date.now() / 1000))
  return taskpoolPoolReader.canAttemptDistribute(p, now)
})

const settlementCtaText = computed(() => {
  if (poolReadLoading.value) return '读取链上状态中…'
  if (poolReadError.value) return '暂不可结算（请先刷新）'
  const p = poolOnchainRow.value
  if (!p) return '暂不可结算（缺少链上信息）'
  if (poolNotFound.value) return '等待建池完成'
  if (p.settled) return '已结算发放（链上）'
  if (!publicizeStartedOnchain.value) return '等待终审开启公示'
  if (publicizeRemainingSec.value > 0) return '公示中，暂不可结算'
  return '打开 Semi 收款（链上结算）'
})

const settlementCtaDisabled = computed(() => {
  if (poolReadLoading.value) return true
  if (poolReadError.value) return true
  const p = poolOnchainRow.value
  if (!p) return true
  if (poolNotFound.value) return true
  if (p.settled) return true
  return !canClaimerOpenSemiDistribute.value
})

const settlementHint = computed(() => {
  if (poolReadLoading.value) return '正在读取链上池子状态…'
  if (poolReadError.value) return '链上状态读取失败，请点击下方「刷新链上状态」重试。'
  const p = poolOnchainRow.value
  if (!p) return '暂未拿到链上池子信息，可稍后刷新或前往任务池管理页查看。'
  if (poolNotFound.value) {
    return '链上暂未找到该池子：通常是尚未完成建池/同步。请稍后刷新，或前往任务池管理页查看建池进度。'
  }
  if (p.settled) return '已结算关闭，无需再次结算。'
  if (!publicizeStartedOnchain.value) return '等待发布者终审开启公示；开启后将显示 24 小时倒计时。'
  if (publicizeRemainingSec.value > 0) return `公示剩余约 ${formatDurationCn(publicizeRemainingSec.value)}，结束后可结算发放。`
  return ''
})

function formatDurationCn(totalSec: number): string {
  if (totalSec <= 0) return '0 秒'
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const parts: string[] = []
  if (h > 0) parts.push(`${h} 小时`)
  if (m > 0) parts.push(`${m} 分`)
  if (s > 0 || parts.length === 0) parts.push(`${s} 秒`)
  return parts.join('')
}

async function refreshTaskpoolPoolOnchain() {
  const tid = task.value?.taskInfoId
  if (!tid || !import.meta.client) return
  poolReadLoading.value = true
  poolReadError.value = ''
  try {
    const row = await taskpoolPoolReader.readPoolByTaskInfoId(tid)
    poolOnchainRow.value = row
    // 读取终审/结算交易信息（按 poolId 过滤日志）。失败不阻塞主流程。
    try {
      const refs = await taskpoolPoolReader.readPoolEventRefsByTaskInfoId({
        taskInfoId: tid,
        taskpoolCreateTxHash: task.value?.taskpoolCreateTxHash || null,
      })
      finalApprovedEventRef.value = refs.finalApproved
      distributedEventRef.value = refs.distributed

      // 读取链上备注文本（publisher + assignee），失败不阻塞主流程
      try {
        remarkReadError.value = ''
        const rowId = String(
          (task.value as any)?.remarkTaskRowId ||
            currentParticipantId.value ||
            task.value?.id ||
            ''
        ).trim()
        // 只有终审后才会写备注；并且避免轮询时重复打 RPC（429 会导致“备注消失”）
        const gateTx = String(finalApprovedEventRef.value?.txHash || '').trim()
        if (!gateTx) {
          // 未终审时不读备注，避免无意义读链 + 限流
          onchainPublisherRemarkText.value = null
          onchainClaimerRemarkText.value = null
          shareOnchainPublisherRemark.value = null
          shareOnchainClaimerRemark.value = null
        } else {
          const fetchKey = `${tid}:${rowId}:${gateTx}`
          const alreadyHas =
            !!(onchainPublisherRemarkText.value && String(onchainPublisherRemarkText.value).trim()) ||
            !!(onchainClaimerRemarkText.value && String(onchainClaimerRemarkText.value).trim())
          if (alreadyHas && lastRemarkFetchKey.value === fetchKey) {
            // keep existing text
          } else {
            lastRemarkFetchKey.value = fetchKey
            const r = await taskpoolPoolReader.readTaskpoolSplitRemarksByTaskInfoId(tid, rowId)
            // 语义对齐 RemarkLogicV1 + TaskPoolLogicV4：
            // - publisherRemark：写入 remark(taskId=0) 的 receiver 槽位
            // - assigneeRemark：写入 remark(taskId=taskRow) 的 sender 槽位
            shareOnchainPublisherRemark.value = r?.publisherRemark || null
            shareOnchainClaimerRemark.value = r?.assigneeRemark || null
            onchainPublisherRemarkText.value = r?.publisherRemark || null
            onchainClaimerRemarkText.value = r?.assigneeRemark || null
          }
        }
      } catch {
        remarkReadError.value = '链上备注读取失败（可能是 RPC 限流），稍后重试或点击「刷新链上状态」。'
        shareOnchainPublisherRemark.value = null
        shareOnchainClaimerRemark.value = null
        onchainClaimerRemarkText.value = null
        onchainPublisherRemarkText.value = null
      }
    } catch (e) {
      finalApprovedEventRef.value = null
      distributedEventRef.value = null
      remarkReadError.value = ''
      shareOnchainPublisherRemark.value = null
      shareOnchainClaimerRemark.value = null
      onchainClaimerRemarkText.value = null
      onchainPublisherRemarkText.value = null
    }

    // 自动弹出「一键转发到活动圈」（仅领取者、链上已发放、且只弹一次）
    if (!shareModalVisible.value && shouldAutoPromptShare()) {
      markAutoPromptedShare()
      await nextTick()
      openShareModal('claimer')
    }

    // 链上状态变化时，合并更新时间线展示（避免仍停留在“公示后可结算”）
    try {
      updateTimeline()
    } catch {
      /* ignore */
    }
  } catch (e) {
    poolReadError.value = friendlyRpcErrorMessage(e)
    poolOnchainRow.value = null
    finalApprovedEventRef.value = null
    distributedEventRef.value = null
    remarkReadError.value = ''
    shareOnchainPublisherRemark.value = null
    shareOnchainClaimerRemark.value = null
    onchainClaimerRemarkText.value = null
    onchainPublisherRemarkText.value = null
  } finally {
    poolReadLoading.value = false
  }
}

async function onClaimerSemiDistribute() {
  const id = task.value?.taskInfoId
  if (!id || claimerDistributeOpening.value) return
  if (!canClaimerOpenSemiDistribute.value) return
  const semiAppUrl = String((runtimeConfig.public as Record<string, unknown>).semiAppUrl || '')
  const chainId = Number((runtimeConfig.public as Record<string, unknown>).chainId ?? 10)
  const proxy = String((runtimeConfig.public as Record<string, unknown>).taskpoolProxyAddress || '')
  if (!semiAppUrl) {
    toast.add({ title: '缺少配置', description: '未配置 NUXT_PUBLIC_SEMI_APP_URL', color: 'red' })
    return
  }
  if (!proxy) {
    toast.add({ title: '缺少配置', description: '未配置 NUXT_PUBLIC_TASKPOOL_PROXY_ADDRESS', color: 'red' })
    return
  }
  claimerDistributeOpening.value = true
  try {
    const state = generateRandomState()
    try {
      sessionStorage.setItem(semiTaskpoolStateStorageKey('distribute', id), state)
    } catch {
      /* ignore */
    }
    const poolId = uuidToTaskPoolUint256(id).toString()
    // 回跳后需要自动回到任务详情并弹分享：携带 taskId（当前详情页 id）
    const returnUrl = `${window.location.origin}/wallet/semi-distribute-callback?taskInfoId=${encodeURIComponent(
      id
    )}&taskId=${encodeURIComponent(task.value?.id || taskId)}`
    const url = buildSemiTaskpoolDistributeUrl({
      semiAppBaseUrl: semiAppUrl,
      returnUrl,
      state,
      chainId,
      taskpoolProxyAddress: proxy,
      poolId,
    })
    const w = window.open('about:blank', '_blank')
    if (!w) throw new Error('浏览器阻止了弹窗，请允许弹窗后重试')
    try {
      w.document.title = '正在跳转…'
    } catch {
      /* ignore */
    }
    w.location.href = url
    toast.add({
      title: '已打开 Semi',
      description: '请在 Semi 完成结算（公示结束后链上才会成功）',
      color: 'green',
    })
  } catch (e) {
    toast.add({
      title: '打开失败',
      description: e instanceof Error ? e.message : String(e),
      color: 'red',
    })
  } finally {
    claimerDistributeOpening.value = false
  }
}

watch(
  showClaimerTaskpoolSettlementCard,
  (on) => {
    if (poolPollTimerRef.value) {
      clearInterval(poolPollTimerRef.value)
      poolPollTimerRef.value = null
    }
    // 使用退避轮询替代固定 interval
    stopTaskpoolBackoffPoll()
    if (tickTimerRef.value) {
      clearInterval(tickTimerRef.value)
      tickTimerRef.value = null
    }
    if (on && import.meta.client) {
      void refreshTaskpoolPoolOnchain()
      scheduleTaskpoolBackoffPoll()
      tickTimerRef.value = setInterval(() => {
        poolUiTick.value++
      }, 1000)
    }
  },
  { immediate: true }
)

// TaskPool：任何人进入详情页都应能看到链上备注/是否已发放（至少刷新一次；并在未结算时低频轮询）
watch(
  () => [showTaskpoolOnchainSection.value, task.value?.taskInfoId],
  ([on, tid]) => {
    if (!import.meta.client) return
    if (!on || !tid) return
    void refreshTaskpoolPoolOnchain()
    scheduleTaskpoolBackoffPoll()
  },
  { immediate: true }
)

onUnmounted(() => {
  if (poolPollTimerRef.value) clearInterval(poolPollTimerRef.value)
  if (tickTimerRef.value) clearInterval(tickTimerRef.value)
  stopTaskpoolBackoffPoll()
})

// 当前选中社区（来自 localStorage），用于任务未带 communityId 时的兜底分享目标
const currentCommunityId = ref<string | null>(null)

const shareCommunityId = computed(() => {
  // 严格使用“任务所属社区”，避免跨社区错发圈帖；缺失则不提供分享入口
  return (task.value?.taskInfo?.communityId ?? task.value?.communityId ?? null) as string | null
})

const showShareButton = computed(() => {
  if (!shareCommunityId.value) return false
  // 领取者：以链上发放（settled）为准
  if (isClaimer.value) return !!poolOnchainRow.value?.settled
  if (canReview.value) {
    // TaskPool：发包者分享以“终审已发生”为准（不依赖链下 transferredAt）
    if (task.value?.useTaskpool) return !!finalApprovedEventRef.value?.txHash
    // 非 TaskPool：沿用旧逻辑
    if (task.value.transferredAt) return true
  }
  return false
})

function openShareModal(mode?: 'claimer' | 'reviewer') {
  const communityId = shareCommunityId.value
  if (!communityId) return

  const effectiveMode: 'claimer' | 'reviewer' =
    mode ?? (isClaimer.value ? 'claimer' : 'reviewer')

  // reviewer 必须在已转账后才允许分享（避免流程混乱）
  if (effectiveMode === 'reviewer') {
    if (task.value?.useTaskpool) {
      if (!finalApprovedEventRef.value?.txHash) return
    } else {
      if (!task.value.transferredAt) return
    }
  }
  // claimer：必须链上已结算（settled）才允许分享
  if (effectiveMode === 'claimer' && !poolOnchainRow.value?.settled) return

  shareTask.value = {
    id: task.value.id,
    title: task.value.title,
    completedAt: task.value.completedAt,
    proof: task.value.proof,
    receiverRemark: (task.value as any)?.receiverRemark ?? null,
    taskInfo: { id: (task.value as any)?.taskInfoId ?? (task.value as any)?.taskInfo?.id, communityId }
  }

  shareModalMode.value = effectiveMode
  // reviewer：默认用链上备注作为发帖备注（可在弹窗中继续编辑）
  shareSenderRemark.value = effectiveMode === 'reviewer' ? (shareOnchainPublisherRemark.value || '') : ''
  shareModalVisible.value = true
}

function onShareModalClose() {
  shareModalVisible.value = false
  shareTask.value = null
  shareSenderRemark.value = ''
  shareModalMode.value = 'claimer'
  shareOnchainPublisherRemark.value = null
  shareOnchainClaimerRemark.value = null
}

function sharePromptStorageKey(taskInfoId: string, userId: string): string {
  return `taskpool_share_prompt_shown:${taskInfoId}:${userId}`
}

function shouldAutoPromptShare(): boolean {
  if (!import.meta.client) return false
  const uid = userStore.user?.id
  const tid = String(task.value?.taskInfoId || '').trim()
  if (!uid || !tid) return false
  if (!isClaimer.value) return false
  if (!shareCommunityId.value) return false
  if (!poolOnchainRow.value?.settled) return false
  try {
    return localStorage.getItem(sharePromptStorageKey(tid, uid)) !== '1'
  } catch {
    return false
  }
}

function markAutoPromptedShare() {
  if (!import.meta.client) return
  const uid = userStore.user?.id
  const tid = String(task.value?.taskInfoId || '').trim()
  if (!uid || !tid) return
  try {
    localStorage.setItem(sharePromptStorageKey(tid, uid), '1')
  } catch {
    /* ignore */
  }
}

function reviewerSharePromptStorageKey(taskInfoId: string, userId: string): string {
  return `taskpool_share_prompt_shown:reviewer:${taskInfoId}:${userId}`
}

function shouldAutoPromptReviewerShareOnReturn(): boolean {
  if (!import.meta.client) return false
  const uid = userStore.user?.id
  const tid = String(task.value?.taskInfoId || '').trim()
  if (!uid || !tid) return false
  if (!canReview.value) return false
  if (!shareCommunityId.value) return false
  if (!task.value?.useTaskpool) return false
  if (!finalApprovedEventRef.value?.txHash) return false
  try {
    return localStorage.getItem(reviewerSharePromptStorageKey(tid, uid)) !== '1'
  } catch {
    return false
  }
}

function markAutoPromptedReviewerShare() {
  if (!import.meta.client) return
  const uid = userStore.user?.id
  const tid = String(task.value?.taskInfoId || '').trim()
  if (!uid || !tid) return
  try {
    localStorage.setItem(reviewerSharePromptStorageKey(tid, uid), '1')
  } catch {
    /* ignore */
  }
}

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
          description = task.value?.useTaskpool
            ? `任务审核通过，进入约 24 小时公示期；公示结束后可链上结算发放${actorName ? `（审核者：${actorName}）` : ''}${reason ? `，审核意见：${reason}` : ''}`
            : `任务审核通过，奖励已发放${actorName ? `（审核者：${actorName}）` : ''}${reason ? `，审核意见：${reason}` : ''}`
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
    // TaskPool：链上已结算时，追加一条“链上发放完成”节点（避免仍显示公示期话术）
    if (task.value?.useTaskpool && poolOnchainRow.value?.settled) {
      const already =
        Array.isArray(task.value.updates) &&
        task.value.updates.some((u: any) => String(u?.id || '').includes('onchain-settled'))
      if (!already) {
        const ts = new Date().toISOString()
        task.value.updates = [
          ...(task.value.updates || []),
          {
            id: `onchain-settled-${ts}`,
            title: '链上发放完成',
            description: '已在链上结算发放完成（以链上为准）。',
            timestamp: ts,
            status: 'completed',
          },
        ]
      }
    }
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
const loadTask = async (options?: { useCache?: boolean }) => {
  loading.value = true
  claimError.value = null // 清除之前的错误消息
  try {
    const baseUrl = getApiBaseUrl()
    // 第一次加载使用缓存，后续加载不使用缓存以确保数据最新
    const useCache = options?.useCache ?? true
    const taskData = await getTaskById(taskId, baseUrl, useCache, 5000)
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
    
    // 多人任务：历史数据有时不带 participantLimit，但会带 participantsList；两者任一可判定为多人任务
    const isMultiParticipantTask =
      (Number(taskData.participantLimit) || 0) > 1 ||
      (Array.isArray(taskData.participantsList) && taskData.participantsList.length > 1)

    if (isMultiParticipantTask && taskData.participantsList && taskData.participantsList.length > 0) {
      // 判断用户角色
      if (userStore.user?.id === taskData.creatorId) {
        // 创建者：如果已领取，默认显示自己的任务行；否则显示第一个已领取的任务行
        if (creatorTaskId.value) {
          // 创建者已领取，显示自己的任务行
          targetTaskId = creatorTaskId.value
          const creatorTask = taskData.participantsList.find((p: any) => p.id === creatorTaskId.value)
          if (creatorTask) {
            // 需要重新获取创建者任务行的完整数据（包括时间线）
            currentTaskData = await getTaskById(creatorTaskId.value, baseUrl, useCache, 5000) || taskData
          }
        } else {
          // 创建者未领取，显示第一个已领取的任务行，或第一个任务行
          const firstClaimed = taskData.participantsList.find((p: any) => p.claimerId && p.claimedAt) || taskData.participantsList[0]
          if (firstClaimed && firstClaimed.id) {
            targetTaskId = firstClaimed.id
            currentTaskData = await getTaskById(firstClaimed.id, baseUrl, useCache, 5000) || taskData
          }
        }
        currentParticipantId.value = targetTaskId
      } else {
        // 非创建者：显示自己领取的任务行
        const myTask = taskData.participantsList.find((p: any) => p.claimerId === userStore.user?.id)
        if (myTask && myTask.id) {
          targetTaskId = myTask.id
          currentTaskData = await getTaskById(myTask.id, baseUrl, useCache, 5000) || taskData
          currentParticipantId.value = myTask.id
        } else {
          // 未领取，显示第一个未领取的任务行
          const firstUnclaimed = taskData.participantsList.find((p: any) => !p.claimerId) || taskData.participantsList[0]
          if (firstUnclaimed && firstUnclaimed.id) {
            targetTaskId = firstUnclaimed.id
            currentTaskData = await getTaskById(firstUnclaimed.id, baseUrl, useCache, 5000) || taskData
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
      communityId: (currentTaskData as any).communityId || (taskData as any).communityId || null,
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
      transferredAt: currentTaskData.transferredAt || undefined, // ✅ 新增：从后端数据中读取转账状态
      // taskpool 扩展字段（多人任务行可能不带 task_info，优先用聚合 taskData）
      taskInfoId: (taskData as any).taskInfoId || (currentTaskData as any).taskInfoId || '',
      useTaskpool: (taskData as any).useTaskpool ?? (currentTaskData as any).useTaskpool,
      listingKind: (taskData as any).listingKind ?? (currentTaskData as any).listingKind,
      managerUserId: (taskData as any).managerUserId ?? (currentTaskData as any).managerUserId ?? null,
      subtasksFinalized: (taskData as any).subtasksFinalized ?? (currentTaskData as any).subtasksFinalized,
      taskpoolCreateTxHash:
        (taskData as any).taskpoolCreateTxHash ?? (currentTaskData as any).taskpoolCreateTxHash ?? null,
      taskpoolPhase: (taskData as any).taskpoolPhase ?? (currentTaskData as any).taskpoolPhase,
      taskpoolCreateStatus:
        (taskData as any).taskpoolCreateStatus ?? (currentTaskData as any).taskpoolCreateStatus,
      taskpoolCreateLastError:
        (taskData as any).taskpoolCreateLastError ?? (currentTaskData as any).taskpoolCreateLastError ?? null,
      remarkTaskRowId:
        (taskData as any).remarkTaskRowId ?? (currentTaskData as any).remarkTaskRowId ?? null,
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

    // 如果任务已完成，加载链上转账记录
    if (task.value.status === 'completed') {
      loadChainTransactions()
    }
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

// 加载链上转账记录
async function loadChainTransactions() {
  if (!task.value?.id) return
  loadingTransactions.value = true
  try {
    const baseUrl = getApiBaseUrl()
    chainTransactions.value = await getTaskTransactions(task.value.id, baseUrl)
  } catch (e) {
    console.error('加载转账记录失败:', e)
    chainTransactions.value = []
  } finally {
    loadingTransactions.value = false
  }
}

const TASK_DRAFT_KEY = 'mycoseed_task_withdraw_draft'

async function handleWithdrawTask() {
  if (!canCreatorWithdrawEffective.value) return
  const ok = window.confirm(
    isTaskpoolPoolListing.value
      ? '确认撤回任务池？撤回后会回到发布页，并保留草稿用于重新编辑。'
      : '确认撤回？撤回后会回到编辑页，任务将从列表中移除。'
  )
  if (!ok) return
  loading.value = true
  try {
    const baseUrl = getApiBaseUrl()
    if (isTaskpoolPoolListing.value) {
      const TASKPOOL_DRAFT_KEY = 'mycoseed_taskpool_withdraw_draft'
      const res = await withdrawTaskPool(task.value.taskInfoId, baseUrl)
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(TASKPOOL_DRAFT_KEY, JSON.stringify(res.draft || {}))
      }
      toast.add({ title: '已撤回', description: '已为你保留草稿，可继续修改后重新发布', color: 'green' })
      router.push('/tasks/pool/create?from=withdraw')
    } else {
      const res = await withdrawTask(taskId, baseUrl)
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(TASK_DRAFT_KEY, JSON.stringify(res.draft || {}))
      }
      toast.add({ title: '已撤回', description: '已为你保留草稿，可继续修改后重新发布', color: 'green' })
      router.push('/tasks/create?from=withdraw')
    }
  } catch (e: any) {
    toast.add({ title: '撤回失败', description: e?.message || '请稍后重试', color: 'red' })
  } finally {
    loading.value = false
  }
}

async function handleDeleteTask() {
  if (!canCreatorDelete.value) return
  const ok = window.confirm('确认删除？删除后将无法恢复。')
  if (!ok) return
  loading.value = true
  try {
    const baseUrl = getApiBaseUrl()
    await deleteTask(taskId, baseUrl)
    toast.add({ title: '已删除', description: '任务已彻底删除', color: 'green' })
    router.push('/tasks')
  } catch (e: any) {
    toast.add({ title: '删除失败', description: e?.message || '请稍后重试', color: 'red' })
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
    // TaskPool 普通任务：走 Semi claimTask（链上领取）
    // 须先同步 window.open（再 await 接口），否则 Safari 等会拦截弹窗
    if (task.value?.useTaskpool) {
      const w = window.open('about:blank', '_blank')
      if (!w) {
        toast.add({
          title: '无法打开 Semi',
          description: '浏览器阻止了弹窗，请允许本站点弹窗后重试',
          color: 'red',
        })
        return
      }
      try {
        try {
          w.document.title = '正在获取领取参数…'
        } catch {
          /* 跨域或沙箱时可能不可写 */
        }

        let intent: any
        try {
          const r = await getTaskpoolClaimIntent(taskId, baseUrl)
          intent = (r as any)?.intent
        } catch (e: any) {
          try {
            w.close()
          } catch {
            /* ignore */
          }
          const body = e?.body as { last_error?: string; hint?: string; code?: string } | undefined
          const raw = e?.message || String(e)
          const baseHint =
            raw.includes('尚未上链建池完成') || raw.includes('暂不可领取')
              ? '服务端尚未记录建池交易哈希：接包者需等发布者在 Semi 预付链上完成且后台校验到 PoolCreated。请到「任务池管理」查看预付记录与 last_error。'
              : raw
          const detail =
            body?.last_error != null && String(body.last_error).trim()
              ? ` 链上/后台原因：${String(body.last_error).slice(0, 500)}`
              : ''
          const friendly = `${baseHint}${detail}`
          claimError.value = friendly
          toast.add({
            title: '暂不可领取',
            description: friendly,
            color: 'orange',
          })
          try {
            const taskInfoId = String((task.value as any)?.taskInfoId || '')
            if (taskInfoId) {
              router.push(`/tasks/pool/${encodeURIComponent(taskInfoId)}/manage`)
            }
          } catch {}
          return
        }

        const config = useRuntimeConfig()
        const semiAppUrl = String((config.public as any).semiAppUrl || '')
        const chainId = Number((config.public as any).chainId ?? 10)
        const proxy = String((config.public as any).taskpoolProxyAddress || '')
        if (!semiAppUrl) {
          try {
            w.close()
          } catch {
            /* ignore */
          }
          throw new Error('未配置 NUXT_PUBLIC_SEMI_APP_URL')
        }
        if (!proxy) {
          try {
            w.close()
          } catch {
            /* ignore */
          }
          throw new Error('未配置 NUXT_PUBLIC_TASKPOOL_PROXY_ADDRESS')
        }

        const state =
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(16).slice(2)}`
        const stateKey = semiTaskpoolStateStorageKey('claim', taskId)
        try {
          sessionStorage.setItem(stateKey, state)
        } catch {}
        // Safari 等浏览器：回跳页在弹窗上下文里读取 sessionStorage，需同步写入弹窗窗口
        try {
          w.sessionStorage.setItem(stateKey, state)
          // 兼容：清理旧版全局 key，避免误判 stateMismatch
          w.sessionStorage.removeItem('semi_taskpool_prepay_state')
        } catch {
          /* ignore */
        }

        const infoId = String((task.value as any)?.taskInfoId || '')
        const returnUrl = `${window.location.origin}/wallet/semi-claim-callback?taskId=${encodeURIComponent(
          taskId
        )}${infoId ? `&taskInfoId=${encodeURIComponent(infoId)}` : ''}`
        const url = buildSemiTaskpoolClaimUrl({
          semiAppBaseUrl: semiAppUrl,
          returnUrl,
          state,
          chainId,
          taskpoolProxyAddress: proxy,
          poolId: String(intent.message.poolId),
          taskId: String(intent.message.taskId),
          amountWei: String(intent.message.amountWei),
          sigDeadline: String(intent.message.sigDeadline),
          signature: String(intent.signature),
        })

        try {
          w.document.title = '正在跳转…'
        } catch {
          /* ignore */
        }
        w.location.href = url

        toast.add({ title: '已打开 Semi', description: '请在 Semi 完成领取确认', color: 'green' })
        return
      } catch (e) {
        try {
          w.close()
        } catch {
          /* ignore */
        }
        throw e
      }
    }

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

/** 链上已领取但回跳未写库：按 TaskClaimed 日志补同步 */
const handleReconcileTaskpoolClaim = async () => {
  if (claimReconcileLoading.value) return
  claimReconcileLoading.value = true
  try {
    const baseUrl = getApiBaseUrl()
    const r = await reconcileTaskpoolClaim(taskId, baseUrl)
    if (r.alreadyClaimed) {
      toast.add({ title: '已是领取状态', description: '无需补同步', color: 'green' })
    } else {
      toast.add({ title: '已同步', description: '链上领取状态已写入本站', color: 'green' })
    }
    await loadTask()
  } catch (e: unknown) {
    toast.add({
      title: '同步失败',
      description: e instanceof Error ? e.message : String(e),
      color: 'red',
    })
  } finally {
    claimReconcileLoading.value = false
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
  
  // 先同步打开空白页，避免异步后 window.open 被拦截
  const newWindow = window.open('about:blank', '_blank')
  if (!newWindow) {
    console.error('浏览器阻止了弹窗')
    toast.add({
      title: '无法打开转账页面',
      description: '浏览器阻止了弹窗，请允许弹窗后重试',
      color: 'orange'
    })
    isTransferring.value = false
    return
  }
  
  try {
    // 给空白页一个轻提示，减少“白屏感”
    newWindow.document.title = '正在跳转…'
    newWindow.document.body.innerHTML = `
      <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; padding: 24px; color: #111;">
        <div style="font-size: 16px; font-weight: 600; margin-bottom: 8px;">正在跳转到 Semi…</div>
        <div style="font-size: 13px; color: #555;">请稍候，如果没有自动跳转请返回重试。</div>
      </div>
    `
  } catch (e) {
    // 某些浏览器策略下可能不允许操作新窗口 document，忽略即可
  }
  
  try {
    const config = useRuntimeConfig()
    const semiAppUrl = config.public.semiAppUrl as string
    const baseUrl = getApiBaseUrl()
    const creatorId = task.value.creatorId
    const claimerId = task.value.claimerId
    const reward = getFinalReward(task.value)
    
    // 并行获取创建者/参与者钱包地址（更快，也更不容易被弹窗策略影响）
    const [creatorAddress, claimerAddress] = await Promise.all([
      getWalletAddressByUserId(creatorId, baseUrl),
      getWalletAddressByUserId(claimerId, baseUrl),
    ])
    
    // 检查钱包地址
    if (!creatorAddress) {
      toast.add({
        title: '无法转账',
        description: '创建者未绑定钱包，无法转账',
        color: 'orange'
      })
      try { newWindow.close() } catch (e) {}
      return
    }
    
    if (!claimerAddress) {
      toast.add({
        title: '无法转账',
        description: '参与者未绑定钱包，无法转账',
        color: 'orange'
      })
      try { newWindow.close() } catch (e) {}
      return
    }

    // 生成默认 memo（公开上链，最多 32 字，可修改）
    const now = new Date()
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const dd = String(now.getDate()).padStart(2, '0')
    const hh = String(now.getHours()).padStart(2, '0')
    const mi = String(now.getMinutes()).padStart(2, '0')
    const shortTime = `${mm}${dd}-${hh}:${mi}`
    const defaultMemo = `任务：《${task.value.title || ''}》${shortTime}`.slice(0, 32)
    // 不再弹窗；直接带默认 memo 到 semi，再由用户在 semi 页面修改
    const memo = defaultMemo.trim().slice(0, 32)

    const targetTaskId = task.value.id
    const receiverRemark = ((task.value as any)?.receiverRemark ?? '').trim().slice(0, 32)
    const poolUuid = ((task.value as any)?.taskInfoId || (task.value as any)?.taskInfo?.id || '').toString()

    // 构造并跳转到semi转账页面
    const transferUrl = buildSemiTransferUrl(
      claimerAddress,
      reward.toString(),
      {
        semiAppUrl,
        // scheme A: semi 用 pool_uuid/task_uuid 来派生 uint256 poolId/taskId
        pool_uuid: poolUuid || undefined,
        task_uuid: targetTaskId,
        // backward compat
        task_id: targetTaskId,
        memo,
        receiver_remark: receiverRemark,
      }
    )
    
    // 使用已打开的窗口跳转到 semi
    try {
      newWindow.location.href = transferUrl
    } catch (e) {
      // 兜底：如果被浏览器限制，尝试直接打开
      window.open(transferUrl, '_blank')
    }
    
    toast.add({
      title: '已打开转账页面',
      description: '请在 Semi 页面完成转账后，点击"标记为已转账"',
      color: 'green'
    })
  } catch (error) {
    console.error('获取钱包地址失败：', error)
    toast.add({
      title: '无法转账',
      description: '获取钱包地址失败，请稍后重试',
      color: 'orange'
    })
    try { newWindow.close() } catch (e) {}
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

      // 发布者在本页点「标记为已转账」时不会带 URL query，需在此直接弹出「分享到社区圈」
      await nextTick()
      if (canReview.value && shareCommunityId.value) {
        openShareModal('reviewer')
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

async function handleReturnQuery () {
  const shareMode =
    route.query.share === 'reviewer' || route.query.share === 'claimer'
      ? (route.query.share as 'reviewer' | 'claimer')
      : null

  const shouldRefresh =
    route.query.submitted === 'true' || route.query.reviewed === 'true' || !!shareMode

  if (!shouldRefresh) return

  /** Semi 回跳写入；在下方多次 loadTask / watch 触发 refresh 后仍可能需再次注入 */
  const poolFinalTxRaw =
    typeof route.query.pool_final_tx === 'string' ? route.query.pool_final_tx.trim() : ''
  const poolFinalTxHex: Hex | null =
    poolFinalTxRaw.startsWith('0x') && poolFinalTxRaw.length === 66 ? (poolFinalTxRaw as Hex) : null

  function applyPoolFinalTxSeed (): void {
    if (!task.value?.useTaskpool || !poolFinalTxHex) return
    if (!(shareMode === 'reviewer' || route.query.reviewed === 'true')) return
    finalApprovedEventRef.value = {
      txHash: poolFinalTxHex,
      blockNumber: 0n,
      logIndex: 0n,
    }
  }

  // 清缓存 + 绕过缓存，确保 transferredAt / 状态是最新的
  const { responseCache } = await import('~/utils/cache')
  responseCache.delete(`task:${taskId}`)
  await loadTask({ useCache: false })

  // TaskPool：reviewer 回跳后需要链上 refs/备注，先刷新一次链上状态
  if (route.query.reviewed === 'true' && canReview.value && task.value?.useTaskpool) {
    try {
      await refreshTaskpoolPoolOnchain()
    } catch {
      /* ignore */
    }
  }

  // TaskPool：claimer 回跳后需要链上 settled 才能弹分享；share=claimer 时先刷新一次链上状态
  if (shareMode === 'claimer' && task.value?.useTaskpool) {
    try {
      await refreshTaskpoolPoolOnchain()
    } catch {
      /* ignore */
    }
  }

  applyPoolFinalTxSeed()

  // 从审核页带回时，偶发 API 与缓存竞态：reviewer 分享前再拉一次
  if (shareMode === 'reviewer' && !task.value.transferredAt) {
    await new Promise((r) => setTimeout(r, 400))
    await loadTask({ useCache: false })
  }

  // loadTask 会触发 watch → 异步 refresh，可能把 finalApprovedEventRef 清空；弹窗前再注入一次
  applyPoolFinalTxSeed()
  await nextTick()

  if (shareMode) {
    openShareModal(shareMode)
  }

  // reviewer：审核后回跳到 bai 自动弹一次（与接包者一致：只弹一次 + 可手动再点）
  if (!shareMode && route.query.reviewed === 'true') {
    if (!shareModalVisible.value && shouldAutoPromptReviewerShareOnReturn()) {
      markAutoPromptedReviewerShare()
      await nextTick()
      openShareModal('reviewer')
    }
  }

  router.replace({ query: {} })
}

// 组件挂载时加载任务并开始轮询（return query 统一走 handleReturnQuery，避免与 watch 重复）
onMounted(async () => {
  await userStore.getUser()

  // 读取当前选中的社区（仅客户端）
  try {
    currentCommunityId.value = localStorage.getItem('mycoseed_current_community_id')
  } catch {}

  const q = route.query
  const hasReturn =
    q.submitted === 'true' ||
    q.reviewed === 'true' ||
    q.share === 'reviewer' ||
    q.share === 'claimer'

  if (hasReturn) {
    await handleReturnQuery()
  } else {
    await loadTask()
  }

  startProgressPolling()
})

// 同一路由仅 query 变化时（例如从审核页 client 导航回来）不会再次 onMounted
watch(
  () => route.query,
  () => {
    void handleReturnQuery()
  }
)

// 组件卸载时清理轮询
onUnmounted(() => {
  stopProgressPolling()
})
</script>

<style scoped>
</style>
