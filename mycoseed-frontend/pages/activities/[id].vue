<template>
  <div class="min-h-screen bg-background">
    <div class="container mx-auto px-6 py-8">
      <!-- 返回按钮 -->
      <div class="mb-8">
        <button
          @click="navigateTo(`/member/${activity.memberId}`)"
          class="mb-4 flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors group cursor-pointer"
        >
          <UIcon name="i-heroicons-arrow-left" class="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span class="font-medium">返回成员面板</span>
        </button>
      </div>

      <!-- 活动详情 -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- 活动基本信息 -->
        <div class="lg:col-span-2">
          <div class="bg-card border border-border rounded-xl p-6">
            <div class="flex items-start justify-between mb-6">
              <div>
                <h1 class="text-3xl font-bold text-foreground mb-2">{{ activity.title }}</h1>
                <div class="flex items-center gap-4">
                  <span class="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium">
                    {{ activity.reward }} 积分
                  </span>
                  <span class="px-3 py-1 bg-muted text-muted-foreground rounded-full text-sm">
                    {{ getStatusText(activity.status) }}
                  </span>
                </div>
              </div>
            </div>
            
            <div class="space-y-4">
              <div>
                <h3 class="text-lg font-semibold text-foreground mb-2">活动描述</h3>
                <p class="text-muted-foreground">{{ activity.description }}</p>
              </div>
              
              <div>
                <h3 class="text-lg font-semibold text-foreground mb-2">提交内容</h3>
                <div class="bg-muted/50 rounded-lg p-4">
                  <p class="text-muted-foreground">{{ activity.submissionContent }}</p>
                </div>
              </div>
              
              <div v-if="activity.attachments && activity.attachments.length > 0">
                <h3 class="text-lg font-semibold text-foreground mb-2">附件</h3>
                <div class="space-y-2">
                  <div
                    v-for="attachment in activity.attachments"
                    :key="attachment.id"
                    class="flex items-center gap-2 p-2 bg-muted/50 rounded-lg"
                  >
                    <UIcon name="i-heroicons-document" class="h-4 w-4 text-muted-foreground" />
                    <span class="text-sm text-foreground">{{ attachment.name }}</span>
                    <UButton
                      @click="downloadAttachment(attachment)"
                      size="sm"
                      color="gray"
                      variant="ghost"
                    >
                      下载
                    </UButton>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 活动信息 -->
        <div class="space-y-4">
          <div class="bg-card border border-border rounded-xl p-6">
            <h3 class="text-lg font-bold text-foreground mb-4">活动信息</h3>
            <div class="space-y-3">
              <div class="flex justify-between">
                <span class="text-muted-foreground">成员:</span>
                <span class="text-foreground">{{ activity.memberName }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-muted-foreground">社区:</span>
                <span class="text-foreground">{{ activity.community }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-muted-foreground">提交时间:</span>
                <span class="text-foreground">{{ formatDate(activity.timestamp) }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-muted-foreground">审核状态:</span>
                <span class="text-foreground">{{ getStatusText(activity.status) }}</span>
              </div>
            </div>
          </div>
          
          <div class="bg-card border border-border rounded-xl p-6">
            <h3 class="text-lg font-bold text-foreground mb-4">审核信息</h3>
            <div v-if="activity.review" class="space-y-3">
              <div class="flex justify-between">
                <span class="text-muted-foreground">审核者:</span>
                <span class="text-foreground">{{ activity.review.reviewer }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-muted-foreground">审核时间:</span>
                <span class="text-foreground">{{ formatDate(activity.review.timestamp) }}</span>
              </div>
              <div>
                <span class="text-muted-foreground">审核意见:</span>
                <p class="text-foreground mt-1">{{ activity.review.comments }}</p>
              </div>
            </div>
            <div v-else class="text-muted-foreground text-sm">
              等待审核中...
            </div>
          </div>
        </div>
      </div>

      <!-- 活动进度 -->
      <div class="mt-8 bg-card border border-border rounded-xl p-6">
        <h2 class="text-2xl font-bold text-foreground mb-6">活动进度</h2>
        <div class="space-y-4">
          <div
            v-for="update in activity.updates"
            :key="update.id"
            class="border-l-2 border-primary pl-4"
          >
            <div class="flex items-center gap-2 mb-1">
              <span class="text-sm font-medium text-foreground">{{ update.title }}</span>
              <span class="text-xs text-muted-foreground">{{ formatDate(update.timestamp) }}</span>
            </div>
            <p class="text-sm text-muted-foreground">{{ update.description }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
// 获取路由参数
const route = useRoute()
const activityId = route.params.id

// 活动数据
const activity = ref({
  id: activityId,
  title: '完成智能合约开发',
  description: '为DeFi项目开发了新的流动性挖矿合约',
  reward: 0.5,
  status: 'completed',
  timestamp: '2025-01-15T10:30:00Z',
  memberId: 1,
  memberName: 'Alice',
  community: 'ETH 上海社区',
  submissionContent: '已完成智能合约开发，包括流动性挖矿合约的核心功能实现。合约支持用户存入代币获得流动性代币，并按照比例获得挖矿奖励。主要功能包括：1. 流动性添加和移除 2. 挖矿奖励计算 3. 安全机制实现 4. 事件日志记录',
  attachments: [
    {
      id: 1,
      name: '智能合约源码.sol',
      url: '/files/contract.sol'
    },
    {
      id: 2,
      name: '测试报告.pdf',
      url: '/files/test-report.pdf'
    }
  ],
  review: {
    reviewer: 'Bob',
    timestamp: '2025-01-16T14:20:00Z',
    comments: '代码质量良好，测试覆盖充分，符合项目要求。建议在部署前进行最终的安全审计。'
  },
  updates: [
    {
      id: 1,
      title: '活动开始',
      description: '开始智能合约开发任务',
      timestamp: '2025-01-15T09:00:00Z'
    },
    {
      id: 2,
      title: '代码提交',
      description: '提交智能合约源码和测试文件',
      timestamp: '2025-01-15T10:30:00Z'
    },
    {
      id: 3,
      title: '审核通过',
      description: '代码审核通过，等待最终部署',
      timestamp: '2025-01-16T14:20:00Z'
    }
  ]
})

// 状态文本
const getStatusText = (status) => {
  const statusMap = {
    'completed': '已完成',
    'claimed': '已领取',
    'unsubmit': '待提交',
    'pending': '待审核',
    'under_review': '审核中',
    'rejected': '已驳回'
  }
  return statusMap[status] || '未知'
}

// 格式化日期
const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 下载附件
const downloadAttachment = (attachment) => {
  console.log('下载附件:', attachment.name)
  // 这里可以添加实际的下载逻辑
}
</script>