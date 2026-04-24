<template>
  <div class="min-h-screen bg-background py-4 md:py-8">
    <div class="container mx-auto px-4 md:px-6 max-w-3xl pb-24">
      <div class="mb-6 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 class="text-xl md:text-2xl font-bold text-text-title">链上进度与结算</h1>
          <p class="text-sm text-text-body mt-1 line-clamp-2">{{ displayTitle }}</p>
          <p class="text-xs text-text-placeholder mt-1 font-mono break-all">taskInfoId: {{ taskInfoId }}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <PixelButton variant="secondary" size="sm" @click="router.push('/tasks')">
            回商城列表
          </PixelButton>
          <PixelButton
            v-if="canCreatorWithdrawPool"
            variant="secondary"
            size="sm"
            :disabled="withdrawingPool"
            @click="onWithdrawPool"
          >
            {{ withdrawingPool ? '撤回中…' : '撤回发布' }}
          </PixelButton>
          <PixelButton
            v-if="canCreatorEditPool"
            variant="secondary"
            size="sm"
            @click="router.push(`/tasks/pool/${taskInfoId}/edit`)"
          >
            编辑发布信息
          </PixelButton>
          <PixelButton
            v-if="showClaimManager"
            variant="primary"
            size="sm"
            :disabled="busy === 'claim'"
            @click="onClaimManager"
          >
            {{ busy === 'claim' ? '认领中…' : '认领负责人' }}
          </PixelButton>
        </div>
      </div>

      <PixelCard v-if="taskMeta?.useTaskpool" class="mb-6" id="taskpool-flow-overview">
        <h2 class="font-bold text-text-title mb-2">链上结算顺序（TaskPool）</h2>
        <p class="text-xs text-text-placeholder mb-3">
          奖励来自合约内锁定余额，与 Semi「钱包间转账」页面无关。请按顺序完成；任一步未完成时，后续链上可能 revert。
        </p>
        <ol class="text-sm text-text-body list-decimal pl-5 space-y-2">
          <li>
            <span class="font-medium text-text-title">子任务审核</span>：参与者在任务详情提交凭证 → 创建者在
            <strong>审核页</strong>通过，并在 Semi 完成链上终局（V4：<code class="text-xs">finalApprovePool</code>，含子任务链上 Completed + 开启公示）。
          </li>
          <li>
            <span class="font-medium text-text-title">整单提交</span>：负责人提交总凭证；创建者在本页下方「整单提交」区块审核通过（链下）。
          </li>
          <li>
            <span class="font-medium text-text-title">链上终审</span>：见下方「链上终审与结算」→
            <strong>终审（开启公示）</strong>。
          </li>
          <li>
            <span class="font-medium text-text-title">结算</span>：公示结束后 →
            <strong>结算（链上发放）</strong>（<code class="text-xs">distribute</code>）。
          </li>
        </ol>
        <p class="text-xs text-text-placeholder mt-3">
          从审核页跳转来？可直接滚动到
          <a href="#taskpool-settlement-steps" class="text-primary underline">终审与结算</a>。
        </p>
      </PixelCard>

      <PixelCard
        v-if="showSemiPrepaySection"
        id="taskpool-semi-prepay"
        class="mb-6"
        data-testid="taskpool-semi-prepay-section"
      >
        <h2 class="font-bold text-text-title mb-2">链上预付（Semi · 入金 + 建池）</h2>
        <p class="text-xs text-text-placeholder mb-3">
          在 Semi App 内用智能账户完成 NT <code class="text-xs">approve</code> + <code class="text-xs">deposit</code>，并与
          <span class="font-semibold">发布页</span>一致在同一笔 UserOp 中追加 <code class="text-xs">createTaskPoolSelf</code>（带齐
          pool_id / task_ids / 截止时间等）。下方「MetaMask 建池 demo」为独立联调入口。
          仅在尚未产生链上建池交易（无 PoolCreated）时显示。
        </p>
        <p v-if="plannedAmountHint" class="text-sm text-text-body mb-2">
          建议预付金额（计划锁仓 NT）：<span class="font-mono font-medium">{{ plannedAmountHint }}</span>
        </p>
        <div class="flex flex-wrap items-center gap-2">
          <PixelButton
            variant="primary"
            size="sm"
            :disabled="!canClickSemiPrepay || prepayOpening"
            @click="onSemiPrepay"
          >
            {{ prepayOpening ? '打开 Semi…' : '用 Semi 预付' }}
          </PixelButton>
          <span v-if="!canClickSemiPrepay" class="text-xs text-text-placeholder">
            {{ semiPrepayDisabledReason }}
          </span>
        </div>
        <p v-if="prepayIntentSummary" class="text-xs text-text-body mt-3 pt-3 border-t border-border">
          {{ prepayIntentSummary }}
        </p>
        <div class="mt-3 pt-3 border-t border-border">
          <h3 class="text-xs font-semibold text-text-title mb-2">Semi 预付记录</h3>
          <p v-if="prepayHistoryLoading" class="text-xs text-text-placeholder" data-testid="taskpool-prepay-history-loading">
            加载中…
          </p>
          <p
            v-else-if="!prepayIntentList.length"
            class="text-xs text-text-placeholder"
            data-testid="taskpool-prepay-history-empty"
          >
            暂无记录。发起「用 Semi 预付」后在此查看支付单号与状态。
          </p>
          <div v-else class="overflow-x-auto" data-testid="taskpool-prepay-history">
            <table class="w-full text-xs text-left border-collapse">
              <thead>
                <tr class="text-text-placeholder border-b border-border">
                  <th class="py-1.5 pr-2 font-medium">时间</th>
                  <th class="py-1.5 pr-2 font-medium">状态</th>
                  <th class="py-1.5 pr-2 font-medium">金额 (NT)</th>
                  <th class="py-1.5 pr-2 font-medium">支付单号</th>
                  <th class="py-1.5 font-medium">tx</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in prepayIntentList"
                  :key="row.id"
                  class="border-b border-border/60 text-text-body"
                  data-testid="taskpool-prepay-row"
                  :data-intent-id="row.id"
                >
                  <td class="py-1.5 pr-2 whitespace-nowrap">{{ formatPrepayRowTime(row) }}</td>
                  <td class="py-1.5 pr-2">{{ prepayStatusLabel(row.status) }}</td>
                  <td class="py-1.5 pr-2 font-mono">{{ row.amount_human ?? '—' }}</td>
                  <td class="py-1.5 pr-2 font-mono break-all max-w-[12rem]">
                    {{ row.client_reference || '—' }}
                  </td>
                  <td class="py-1.5 font-mono break-all max-w-[8rem]">{{ shortTx(row.tx_hash) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </PixelCard>

      <PixelCard v-if="showReadOnlyBanner" class="mb-6">
        <div class="text-sm text-text-body">
          <div class="font-semibold text-text-title mb-1">只读模式</div>
          <div>
            该任务已由负责人接管（链下负责人：{{ effectiveManagerUserId }}），你当前仅可查看。若需编辑，请使用负责人账号登录。
          </div>
        </div>
      </PixelCard>

      <PixelCard class="mb-6">
        <div class="text-sm space-y-1 text-text-body">
          <p v-if="taskMeta">
            <span class="font-medium text-text-title">使用链上任务池:</span>
            {{ taskMeta.useTaskpool ? '是' : '否' }}
          </p>
          <p>
            <span class="font-medium text-text-title">负责人（链下 Manager）:</span>
            {{ effectiveManagerUserId || '（未认领；普通任务通常由发布者自行管理）' }}
          </p>
          <p v-if="taskMeta?.taskpoolPhase">
            <span class="font-medium text-text-title">链上阶段:</span>
            <span class="font-mono">{{ taskpoolPhaseLabel }}</span>
          </p>
          <p v-if="taskMeta?.taskpoolCreateTxHash">
            <span class="font-medium text-text-title">建池交易哈希:</span>
            <span class="font-mono break-all">{{ taskMeta.taskpoolCreateTxHash }}</span>
          </p>
          <p v-if="me?.id" class="text-xs text-text-placeholder">当前用户: {{ me.id }}</p>
          <p v-if="metaError" class="text-destructive text-sm">{{ metaError }}</p>
          <p v-if="claimAttempted && !effectiveManagerUserId" class="text-xs text-text-placeholder">
            已尝试认领；若失败请查看上方 toast 提示（可能已被他人认领或你无权限）。
          </p>
        </div>
      </PixelCard>

      <PixelCard v-if="showInjectedWalletDemo" class="mb-6">
        <h2 class="font-bold text-text-title mb-3">链上建池（MetaMask 注入钱包 · demo）</h2>
        <p class="text-xs text-text-placeholder mb-3">
          浏览器内 <code class="text-xs">window.ethereum</code> 签名：最小打通 createTaskPool。默认已隐藏；与 Semi 主路径独立。完整注入钱包竖切请用
          <NuxtLink to="/dev/taskpool-vertical" class="text-primary underline">开发页</NuxtLink>
          。开启本块需环境变量 <code class="text-xs">NUXT_PUBLIC_TASKPOOL_SHOW_INJECTED_WALLET_DEMO=true</code>。
        </p>
        <p class="text-xs text-text-placeholder mb-3">
          当前状态：<span class="font-mono">{{ onchainStatusText }}</span>
        </p>
        <p v-if="onchainError" class="text-sm text-destructive mb-3">{{ onchainError }}</p>
        <p v-else-if="onchainLastTxHash" class="text-xs text-text-placeholder mb-3">
          最近发起 txHash：<span class="font-mono break-all">{{ onchainLastTxHash }}</span>
        </p>
        <div class="flex items-center gap-2">
          <PixelButton
            variant="primary"
            size="sm"
            :disabled="onchainBusy || !canWrite || hasOnchainPool || (taskMeta?.taskpoolCreateStatus === 'pending')"
            @click="onCreateOnchainPoolDemo"
          >
            {{ onchainBusy ? '创建中…（钱包确认）' : hasOnchainPool ? '已建池' : '创建链上 TaskPool' }}
          </PixelButton>
          <span v-if="!canWrite" class="text-xs text-text-placeholder">仅负责人 可创建</span>
        </div>
      </PixelCard>

      <PixelCard class="mb-6">
        <h2 class="font-bold text-text-title mb-3">整单提交（总凭证）</h2>
        <div v-if="overallLoading" class="text-text-body text-sm py-2">加载中…</div>
        <p v-else-if="overallError" class="text-sm text-destructive mb-3">{{ overallError }}</p>
        <div class="space-y-3">
          <div class="text-xs text-text-placeholder space-y-1">
            <div>
              当前状态：
              <span class="font-mono text-text-body">{{ overallStatusText }}</span>
            </div>
            <div v-if="overallReviews.length" class="pt-2">
              <div class="font-semibold text-text-title mb-1">审核记录</div>
              <ul class="space-y-1">
                <li v-for="r in overallReviews" :key="r.id" class="font-mono break-all">
                  {{ r.reviewedAt }} · {{ r.decision }} · reviewer={{ r.reviewerUserId }}<span v-if="r.reason"> · {{ r.reason }}</span>
                </li>
              </ul>
            </div>
          </div>
          <div>
            <label class="block text-xs font-bold uppercase text-text-title mb-1">总凭证说明</label>
            <textarea
              v-model="overallForm.summary"
              rows="3"
              placeholder="概述整单完成情况、审核要点…"
              class="w-full px-3 py-2 bg-input-bg border border-border rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
              :disabled="!canWrite"
            ></textarea>
          </div>
          <div>
            <label class="block text-xs font-bold uppercase text-text-title mb-1">相关链接（可选）</label>
            <input
              v-model="overallForm.url"
              type="text"
              placeholder="例如：https://..."
              class="w-full h-10 px-3 bg-input-bg border border-border rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-primary/20"
              :disabled="!canWrite"
            />
          </div>
          <div class="flex items-center justify-between gap-3">
            <div v-if="overall?.submittedAt" class="text-xs text-text-placeholder">
              最近提交：{{ overall.submittedAt }}
            </div>
            <PixelButton
              variant="success"
              size="sm"
              :disabled="!canWrite || busy !== 'idle'"
              @click="onSubmitOverall"
            >
              {{ busy === 'finalize' ? '提交中…' : '整单提交' }}
            </PixelButton>
          </div>
          <p v-if="!canWrite" class="text-xs text-text-placeholder">
            仅负责人 可整单提交。
          </p>

          <div v-if="canReviewOverall" class="pt-3 border-t border-border">
            <div class="text-xs text-text-placeholder mb-2">
              你是创建者，可对整单提交做审核（不受只读模式影响）。
            </div>
            <div class="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end">
              <div class="flex-1">
                <label class="block text-xs font-bold uppercase text-text-title mb-1">审核意见（可选）</label>
                <input
                  v-model="overallReviewReason"
                  type="text"
                  placeholder="例如：请补充某些凭证细节…"
                  class="w-full h-10 px-3 bg-input-bg border border-border rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-primary/20"
                  :disabled="overallReviewBusy || !overall"
                />
              </div>
              <PixelButton
                variant="primary"
                size="sm"
                :disabled="overallReviewBusy || !overall || overall?.status !== 'under_review'"
                @click="onReviewOverall('approved')"
              >
                通过
              </PixelButton>
              <PixelButton
                variant="secondary"
                size="sm"
                :disabled="overallReviewBusy || !overall || overall?.status !== 'under_review'"
                @click="onReviewOverall('rejected')"
              >
                驳回
              </PixelButton>
            </div>
            <p v-if="!overall" class="text-xs text-text-placeholder mt-2">尚未整单提交，暂无可审核内容。</p>
            <p v-else-if="overall?.status !== 'under_review'" class="text-xs text-text-placeholder mt-2">
              当前状态为 {{ overallStatusText }}，无需重复审核。
            </p>
          </div>
        </div>
      </PixelCard>

      <PixelCard v-if="taskMeta?.useTaskpool" id="taskpool-settlement-steps" class="mb-6 scroll-mt-24">
        <h2 class="font-bold text-text-title mb-2">链上终审与结算（Semi）</h2>
        <p class="text-xs text-text-placeholder mb-3">
          先由发布者在 Semi 完成<strong>终审</strong>，合约进入约 <strong>24 小时公示</strong>；公示结束后由<strong>领取者在任务详情页</strong>优先发起<strong>结算</strong>（同一套 Semi TaskPool 路径）。
          此处「备用结算」仅作补位，且为<strong>任何登录用户</strong>开放（触发合约按规则给所有领取者发放）。若在公示期内点结算，链上通常会失败，属正常限制。
        </p>
        <div class="flex flex-wrap items-center gap-2">
          <PixelButton
            variant="primary"
            size="sm"
            :disabled="!canFinalApproveOnchain || finalApproveOpening"
            @click="onFinalApproveOnchain"
          >
            {{ finalApproveOpening ? '打开 Semi…' : '终审（开启公示）' }}
          </PixelButton>
          <PixelButton
            variant="secondary"
            size="sm"
            :disabled="!canDistributeOnchain || distributeOpening"
            @click="onDistributeOnchain"
          >
            {{ distributeOpening ? '打开 Semi…' : '备用：结算（链上发放）' }}
          </PixelButton>
          <span v-if="finalApproveDisabledHint" class="text-xs text-text-placeholder">
            {{ finalApproveDisabledHint }}
          </span>
          <span v-else-if="distributeDisabledHint" class="text-xs text-text-placeholder">
            {{ distributeDisabledHint }}
          </span>
        </div>
      </PixelCard>

      <PixelCard>
        <h2 class="font-bold text-text-title mb-3">子任务草稿</h2>
        <p v-if="subtasksError" class="text-sm text-destructive mb-3">{{ subtasksError }}</p>
        <div v-if="loadList" class="text-text-body text-sm py-6">加载中…</div>
        <ul v-else-if="subtasks.length" class="space-y-3 mb-4 border border-border rounded-2xl p-3 bg-input-bg/30">
          <li
            v-for="s in subtasks"
            :key="s.id"
            class="text-sm border-b border-border/50 last:border-0 pb-3 last:pb-0"
          >
            <div class="flex justify-between gap-2 items-start">
              <div class="min-w-0">
                <div class="font-medium text-text-title truncate">{{ s.title || '(无标题)' }}</div>
                <div v-if="s.description" class="text-text-body/70 text-xs mt-1 line-clamp-2">{{ s.description }}</div>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <span class="text-text-placeholder">#{{ s.sortOrder }}</span>
                <PixelButton
                  v-if="canWrite && !taskMeta?.subtasksFinalized"
                  size="sm"
                  variant="secondary"
                  :disabled="busy !== 'idle'"
                  data-testid="subtask-edit-btn"
                  @click="startEdit(s)"
                >
                  编辑
                </PixelButton>
              </div>
            </div>

            <div v-if="editingId === s.id" class="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div class="md:col-span-2">
                <label class="block text-xs font-bold uppercase text-text-title mb-1">标题</label>
                <input v-model="editTitle" class="w-full h-10 px-3 bg-input-bg border border-border rounded-xl" :disabled="busy !== 'idle' || !canWrite || taskMeta?.subtasksFinalized" data-testid="edit-subtask-title" />
              </div>
              <div class="md:col-span-2">
                <label class="block text-xs font-bold uppercase text-text-title mb-1">描述</label>
                <textarea v-model="editDescription" rows="3" class="w-full px-3 py-2 bg-input-bg border border-border rounded-xl" :disabled="busy !== 'idle' || !canWrite || taskMeta?.subtasksFinalized" data-testid="edit-subtask-description" />
              </div>
              <div class="md:col-span-2">
                <label class="block text-xs font-bold uppercase text-text-title mb-1">提交说明</label>
                <textarea v-model="editSubmissionInstructions" rows="2" class="w-full px-3 py-2 bg-input-bg border border-border rounded-xl" :disabled="busy !== 'idle' || !canWrite || taskMeta?.subtasksFinalized" data-testid="edit-subtask-instructions" />
              </div>
              <div>
                <label class="block text-xs font-bold uppercase text-text-title mb-1">参与人数</label>
                <input v-model.number="editParticipantLimit" type="number" min="1" class="w-full h-10 px-3 bg-input-bg border border-border rounded-xl" :disabled="busy !== 'idle' || !canWrite || taskMeta?.subtasksFinalized" data-testid="edit-subtask-participant-limit" />
              </div>
              <div>
                <label class="block text-xs font-bold uppercase text-text-title mb-1">奖励 (NT)</label>
                <input v-model.number="editRewardNt" type="number" min="0" step="0.01" class="w-full h-10 px-3 bg-input-bg border border-border rounded-xl" :disabled="busy !== 'idle' || !canWrite || taskMeta?.subtasksFinalized" data-testid="edit-subtask-reward" />
              </div>
              <div class="md:col-span-2">
                <label class="block text-xs font-bold uppercase text-text-title mb-1">提交截止（不得晚于任务池提交截止）</label>
                <input v-model="editSubmitDeadlineOverride" type="datetime-local" class="w-full h-10 px-3 bg-input-bg border border-border rounded-xl" :disabled="busy !== 'idle' || !canWrite || taskMeta?.subtasksFinalized" data-testid="edit-subtask-deadline" />
              </div>
              <div class="md:col-span-2">
                <label class="block text-xs font-bold uppercase text-text-title mb-1">提交要求 proofConfig（JSON，可选）</label>
                <textarea v-model="editProofConfigText" rows="6" class="w-full px-3 py-2 font-mono text-xs bg-input-bg border border-border rounded-xl" :disabled="busy !== 'idle' || !canWrite || taskMeta?.subtasksFinalized" data-testid="edit-subtask-proofconfig" />
              </div>
              <div class="md:col-span-2 flex gap-2 justify-end">
                <PixelButton variant="secondary" size="sm" :disabled="busy !== 'idle'" @click="cancelEdit">取消</PixelButton>
                <PixelButton variant="primary" size="sm" :disabled="busy !== 'idle'" data-testid="edit-subtask-save" @click="saveEdit">保存</PixelButton>
              </div>
            </div>
          </li>
        </ul>
        <p v-else class="text-text-body text-sm mb-4">暂无子任务。</p>

        <div v-if="taskMeta?.subtasksFinalized" class="text-amber-700 dark:text-amber-300 text-sm mb-3">
          子任务已定稿，无法再添加或重复定稿。
        </div>
        <div v-else class="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end">
          <div class="flex-1">
            <label class="block text-xs font-bold uppercase text-text-title mb-1">新子任务标题</label>
            <input
              v-model="newTitle"
              type="text"
              placeholder="例如：子任务 A"
              class="w-full h-10 px-3 bg-input-bg border border-border rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-primary/20"
              :disabled="!canWrite"
              @keyup.enter="onAddSubtask"
              data-testid="new-subtask-title"
            />
          </div>
          <PixelButton
            variant="primary"
            :disabled="!canWrite || !newTitle.trim() || busy === 'add' || taskMeta?.subtasksFinalized"
            @click="onAddSubtask"
            data-testid="new-subtask-add"
          >
            {{ busy === 'add' ? '添加中…' : '添加子任务' }}
          </PixelButton>
        </div>

        <div v-if="!taskMeta?.subtasksFinalized" class="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div class="md:col-span-2">
            <label class="block text-xs font-bold uppercase text-text-title mb-1">描述</label>
            <textarea v-model="newDescription" rows="2" class="w-full px-3 py-2 bg-input-bg border border-border rounded-xl" :disabled="!canWrite" data-testid="new-subtask-description" />
          </div>
          <div class="md:col-span-2">
            <label class="block text-xs font-bold uppercase text-text-title mb-1">提交说明</label>
            <textarea v-model="newSubmissionInstructions" rows="2" class="w-full px-3 py-2 bg-input-bg border border-border rounded-xl" :disabled="!canWrite" data-testid="new-subtask-instructions" />
          </div>
          <div>
            <label class="block text-xs font-bold uppercase text-text-title mb-1">参与人数</label>
            <input v-model.number="newParticipantLimit" type="number" min="1" class="w-full h-10 px-3 bg-input-bg border border-border rounded-xl" :disabled="!canWrite" data-testid="new-subtask-participant-limit" />
          </div>
          <div>
            <label class="block text-xs font-bold uppercase text-text-title mb-1">奖励 (NT)</label>
            <input v-model.number="newRewardNt" type="number" min="0" step="0.01" class="w-full h-10 px-3 bg-input-bg border border-border rounded-xl" :disabled="!canWrite" data-testid="new-subtask-reward" />
          </div>
          <div class="md:col-span-2">
            <label class="block text-xs font-bold uppercase text-text-title mb-1">提交截止（不得晚于任务池提交截止）</label>
            <input v-model="newSubmitDeadlineOverride" type="datetime-local" class="w-full h-10 px-3 bg-input-bg border border-border rounded-xl" :disabled="!canWrite" data-testid="new-subtask-deadline" />
          </div>
          <div class="md:col-span-2">
            <label class="block text-xs font-bold uppercase text-text-title mb-1">提交要求 proofConfig（JSON，可选）</label>
            <textarea v-model="newProofConfigText" rows="5" class="w-full px-3 py-2 font-mono text-xs bg-input-bg border border-border rounded-xl" :disabled="!canWrite" data-testid="new-subtask-proofconfig" />
          </div>
        </div>

        <div class="mt-6 pt-4 border-t border-border">
          <!-- 显示子任务总费用信息 -->
          <div v-if="subtasks.length > 0" class="mb-4 p-3 rounded-lg" :class="exceedsPoolBudget ? 'bg-destructive/15 border-l-4 border-destructive' : 'bg-primary/10 border-l-4 border-primary'">
            <div class="text-sm font-semibold" :class="exceedsPoolBudget ? 'text-destructive' : 'text-text-title'">
              子任务费用统计
            </div>
            <div class="text-xs text-text-body mt-1 space-y-0.5">
              <div>任务池总激励：<span class="font-mono font-bold">{{ taskMeta?.plannedLockNt || 0 }}</span> NT</div>
              <div>子任务已分配：<span class="font-mono font-bold" :class="exceedsPoolBudget ? 'text-destructive' : 'text-text-title'">{{ subtotalReward }}</span> NT</div>
              <div>剩余预算：<span class="font-mono font-bold" :class="exceedsPoolBudget ? 'text-destructive' : 'text-green-600'">{{ remainingBudget.toFixed(2) }}</span> NT</div>
            </div>
            <div v-if="exceedsPoolBudget" class="text-xs text-destructive mt-2">
              ⚠️ 子任务总费用已超过任务池激励！请先减少子任务费用后再定稿。
            </div>
          </div>

          <PixelButton
            variant="success"
            :disabled="!canWrite || busy === 'finalize' || !subtasks.length || taskMeta?.subtasksFinalized || exceedsPoolBudget"
            @click="onFinalize"
          >
            {{ busy === 'finalize' ? '定稿中…' : '子任务定稿 (finalize)' }}
          </PixelButton>
        </div>
      </PixelCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { definePageMeta, useRuntimeConfig } from '#imports'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PixelCard from '~/components/pixel/PixelCard.vue'
import PixelButton from '~/components/pixel/PixelButton.vue'
import {
  listTaskSubtasks,
  createTaskSubtask,
  patchTaskSubtask,
  finalizeTaskSubtasks,
  claimTaskPoolManager,
  getTaskpoolOverallSubmission,
  upsertTaskpoolOverallSubmission,
  reviewTaskpoolOverallSubmission,
  withdrawTaskPool,
  patchTaskInfoTaskpool,
  getAllTasks,
  getApiBaseUrl,
  getMe,
  generateRandomState,
  startTaskpoolPrepayIntent,
  getTaskpoolPrepayIntentLatest,
  listTaskpoolPrepayIntents,
  getTaskInfoTaskpoolFinalRemarkPayloadIntent,
  type Task,
  type TaskpoolPrepayIntent,
  type TaskSubtaskDraft,
  type TaskpoolOverallSubmission,
  type TaskpoolOverallSubmissionReview,
} from '~/utils/api'
import {
  buildSemiTaskpoolDistributeUrl,
  buildSemiTaskpoolFinalApproveUrl,
  buildSemiTaskpoolPrepayUrl,
  semiTaskpoolStateStorageKey,
} from '~/utils/semiTaskpoolPrepay'
import { useToast } from '~/composables/useToast'
import { useCommunityStore } from '~/stores/community'
import { useTaskPoolVerticalSlice } from '~/composables/useTaskPoolVerticalSlice'
import { parseNtToWei, uuidToTaskPoolUint256 } from '~/utils/taskpool'
import { createPoolAndPersist } from '~/utils/taskpool/createPoolAndPersist'
import type { Address } from 'viem'

definePageMeta({ layout: 'default' })

const route = useRoute()
const router = useRouter()
const toast = useToast()
const communityStore = useCommunityStore()
const runtimeConfig = useRuntimeConfig()

const taskInfoId = computed(() => {
  const p = route.params.taskInfoId
  return (Array.isArray(p) ? p[0] : p) || ''
})

const queryTitle = computed(() => {
  const q = route.query.title
  const raw = Array.isArray(q) ? q[0] : q
  if (!raw || typeof raw !== 'string') return ''
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
})

const taskMeta = ref<Task | null>(null)
const metaError = ref('')
const subtasks = ref<TaskSubtaskDraft[]>([])
const subtasksError = ref('')
const loadList = ref(true)
const newTitle = ref('')
const newDescription = ref('')
const newSubmissionInstructions = ref('')
const newParticipantLimit = ref<number | null>(null)
const newRewardNt = ref<number | null>(null)
const newSubmitDeadlineOverride = ref<string>('')
const newProofConfigText = ref<string>('') // JSON 字符串（可选）
const busy = ref<'idle' | 'claim' | 'add' | 'finalize'>('idle')
const me = ref<{ id?: string } | null>(null)
// 当任务列表里找不到 taskMeta 时，仍允许认领并展示结果
const claimedManagerUserId = ref<string | null>(null)
const claimAttempted = ref(false)
const overall = ref<TaskpoolOverallSubmission | null>(null)
const overallReviews = ref<TaskpoolOverallSubmissionReview[]>([])
const overallLoading = ref(false)
const overallError = ref('')
const overallForm = ref({ summary: '', url: '' })
const overallReviewReason = ref('')
const overallReviewBusy = ref(false)
const withdrawingPool = ref(false)
const prepayOpening = ref(false)
const prepayIntentLatest = ref<TaskpoolPrepayIntent | null>(null)
const prepayIntentList = ref<TaskpoolPrepayIntent[]>([])
const prepayHistoryLoading = ref(false)
const onchainBusy = ref(false)
const onchainError = ref('')
const onchainLastTxHash = ref<string>('')
const onchainState = ref<'idle' | 'signing' | 'pending' | 'confirmed' | 'failed'>('idle')

const finalApproveOpening = ref(false)
const distributeOpening = ref(false)

const displayTitle = computed(() => {
  return queryTitle.value || taskMeta.value?.title || '（未命名任务池）'
})

const effectiveManagerUserId = computed(() => {
  return taskMeta.value?.managerUserId ?? claimedManagerUserId.value
})

const canWrite = computed(() => {
  if (effectiveManagerUserId.value) {
    return !!me.value?.id && me.value.id === effectiveManagerUserId.value
  }
  return true
})

const showReadOnlyBanner = computed(() => {
  return !!effectiveManagerUserId.value && !canWrite.value
})

const canCreatorWithdrawPool = computed(() => {
  if (!taskMeta.value?.useTaskpool) return false
  if (!me.value?.id) return false
  if (!taskMeta.value.creatorId) return false
  if (taskMeta.value.creatorId !== me.value.id) return false
  // 只允许未被认领、未上链时撤回（后端仍会做最终校验）
  if (effectiveManagerUserId.value) return false
  if (taskMeta.value.taskpoolCreateTxHash) return false
  return true
})

/** 与后端 pool-draft 一致：未定稿才可改主信息 */
const canCreatorEditPool = computed(() => {
  if (!canCreatorWithdrawPool.value) return false
  if (taskMeta.value?.subtasksFinalized === true) return false
  return true
})

const canReviewOverall = computed(() => {
  return !!me.value?.id && !!taskMeta.value?.creatorId && me.value.id === taskMeta.value.creatorId
})

const overallStatusText = computed(() => {
  const s = overall.value?.status
  if (!s) return overall.value ? '未知' : '未提交'
  if (s === 'draft') return '草稿'
  if (s === 'under_review') return '待审核'
  if (s === 'approved') return '已通过'
  if (s === 'rejected') return '已驳回'
  return String(s)
})

const showClaimManager = computed(() => {
  // taskMeta 可能加载失败/找不到；此时允许显示按钮，真正权限由后端决定
  if (!taskInfoId.value) return false
  if (effectiveManagerUserId.value) return false
  // 如果能确认不是 taskpool，则不显示；否则展示，交给后端兜底
  if (taskMeta.value && taskMeta.value.useTaskpool !== true) return false
  return true
})

const hasOnchainPool = computed(() => {
  return taskMeta.value?.taskpoolPhase === 'pool_created' && !!taskMeta.value?.taskpoolCreateTxHash
})

/** 仅创建者、未链上建池时展示 Semi 预付卡片（与 MetaMask demo 分区） */
const showSemiPrepaySection = computed(() => {
  if (!taskMeta.value?.useTaskpool) return false
  if (taskMeta.value.taskpoolCreateTxHash) return false
  if (!me.value?.id || taskMeta.value.creatorId !== me.value.id) return false
  return true
})

/** 计算所有子任务的总费用（reward_nt × participant_limit） */
const subtotalReward = computed(() => {
  if (!subtasks.value || !subtasks.value.length) return 0
  return subtasks.value.reduce((sum, s) => {
    const rwd = Number(s.rewardNt) || 0
    const limit = Number(s.participantLimit) || 0
    return sum + (rwd * limit)
  }, 0)
})

/** 检查子任务总费用是否超过任务池总激励 */
const exceedsPoolBudget = computed(() => {
  const planned = Number(taskMeta.value?.plannedLockNt) || 0
  const subtotal = subtotalReward.value
  return subtotal > planned
})

/** 获取剩余予算 */
const remainingBudget = computed(() => {
  const planned = Number(taskMeta.value?.plannedLockNt) || 0
  return Math.max(0, planned - subtotalReward.value)
})

/** 阶段 4：注入钱包建池 demo 仅显式开启（或走 /dev/taskpool-vertical） */
const showInjectedWalletDemo = computed(() => {
  const pub = runtimeConfig.public as Record<string, unknown>
  return pub.taskpoolShowInjectedWalletDemo === true
})

// Step6/7：终审与结算（走 Semi 发链上交易 + 回跳确权）
const canFinalApproveOnchain = computed(() => {
  if (!taskMeta.value?.useTaskpool) return false
  // 终审必须由创建者（publisher）执行
  if (!canReviewOverall.value) return false
  // 必须已建池
  if (!taskMeta.value?.taskpoolCreateTxHash) return false
  return true
})

const canDistributeOnchain = computed(() => {
  if (!taskMeta.value?.useTaskpool) return false
  // 合约上任何人都可 distribute；本页也允许任何登录用户触发结算（permissionless）。
  // 资金去向由合约固定（按 assignee/amount 发放），触发者不影响收款人。
  if (!me.value?.id) return false
  if (!taskMeta.value?.taskpoolCreateTxHash) return false
  if (taskMeta.value?.taskpoolPhase === 'closed') return false
  return true
})

/** 管理页状态区：把枚举翻成可读中文 */
const taskpoolPhaseLabel = computed(() => {
  const p = taskMeta.value?.taskpoolPhase
  if (p === 'none') return '未开始'
  if (p === 'awaiting_pool') return '等待建池'
  if (p === 'pool_created') return '已建池'
  if (p === 'closed') return '已结算关闭'
  return p ? String(p) : '—'
})

/** 终审按钮灰掉时的人话说明（优先于结算提示） */
const finalApproveDisabledHint = computed(() => {
  if (!taskMeta.value?.useTaskpool) return ''
  if (canFinalApproveOnchain.value) return ''
  if (!me.value?.id) return '请先登录'
  if (taskMeta.value.creatorId && me.value.id !== taskMeta.value.creatorId) {
    return '仅发布者（创建者）可发起终审'
  }
  if (!taskMeta.value.taskpoolCreateTxHash) return '需先完成链上建池（或等待回跳同步）'
  return ''
})

/** 结算按钮灰掉时的人话说明（终审可用时才展示这条） */
const distributeDisabledHint = computed(() => {
  if (!taskMeta.value?.useTaskpool) return ''
  if (canDistributeOnchain.value) return ''
  if (!me.value?.id) return '请先登录'
  if (!taskMeta.value.taskpoolCreateTxHash) return '需先完成链上建池'
  if (taskMeta.value.taskpoolPhase === 'closed') return '本任务池已结算关闭'
  return ''
})

const prepayIntentSummary = computed(() => {
  const row = prepayIntentLatest.value
  if (!row) return ''
  const st = row.status
  const label =
    st === 'pending'
      ? '进行中（已登记 intent，待 Semi 回跳同步）'
      : st === 'success'
        ? '最近一次预付：成功'
        : st === 'failed'
          ? '最近一次预付：失败'
          : st === 'cancelled'
            ? '最近一次预付：已取消'
            : st === 'superseded'
              ? '曾有未完成的预付（已被新一次发起覆盖）'
              : String(st)
  const tx = row.tx_hash
  const tail = st === 'success' && tx ? ` · tx ${String(tx).slice(0, 12)}…` : ''
  const cref = row.client_reference ? ` · 支付单 ${row.client_reference}` : ''
  return `${label}${tail}${cref}`
})

function prepayStatusLabel(s: TaskpoolPrepayIntent['status']): string {
  if (s === 'pending') return '进行中'
  if (s === 'success') return '成功'
  if (s === 'failed') return '失败'
  if (s === 'cancelled') return '已取消'
  if (s === 'superseded') return '已覆盖'
  return String(s)
}

function formatPrepayRowTime(row: TaskpoolPrepayIntent): string {
  const raw = row.updated_at || row.created_at
  if (!raw) return '—'
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw
  return d.toLocaleString('zh-CN', { hour12: false })
}

function shortTx(h: string | null | undefined): string {
  if (!h) return '—'
  const s = String(h)
  if (s.length <= 14) return s
  return `${s.slice(0, 8)}…${s.slice(-6)}`
}

const plannedAmountHint = computed(() => {
  const p = taskMeta.value?.plannedLockNt
  if (p != null && Number(p) > 0) return String(p)
  return ''
})

const canClickSemiPrepay = computed(() => {
  if (!taskMeta.value?.useTaskpool) return false
  if (!me.value?.id || taskMeta.value.creatorId !== me.value.id) return false
  if (taskMeta.value.taskpoolCreateTxHash) return false
  const pub = runtimeConfig.public as Record<string, unknown>
  if (!pub.semiAppUrl || !pub.taskpoolProxyAddress) return false
  const p = taskMeta.value.plannedLockNt
  return p != null && Number(p) > 0
})

const semiPrepayDisabledReason = computed(() => {
  if (!taskMeta.value?.useTaskpool) return ''
  if (!me.value?.id || taskMeta.value.creatorId !== me.value.id) return '仅创建者可在 Semi 中完成预付'
  if (taskMeta.value.taskpoolCreateTxHash) return '已发起链上建池，请继续链上流程'
  const pub = runtimeConfig.public as Record<string, unknown>
  if (!pub.semiAppUrl) return '未配置 NUXT_PUBLIC_SEMI_APP_URL'
  if (!pub.taskpoolProxyAddress) return '未配置 NUXT_PUBLIC_TASKPOOL_PROXY_ADDRESS'
  const p = taskMeta.value.plannedLockNt
  if (p == null || Number(p) <= 0) return '缺少计划锁仓金额，请先编辑任务池并保存'
  return ''
})

function toUnixSeconds(v: unknown): string {
  const ms = typeof v === 'number' ? v : new Date(String(v)).getTime()
  if (!Number.isFinite(ms) || ms <= 0) throw new Error('无效日期，无法计算 deadline')
  return String(Math.floor(ms / 1000))
}

/**
 * 与发布页 create.vue 一致：从任务列表解析本池参与任务行 UUID（排除 taskpool_subtask 商城行），用于 Semi createTaskPoolSelf。
 */
async function resolveChainTaskIdUuidsForPrepay(): Promise<string[] | null> {
  const id = taskInfoId.value
  if (!id) return null
  const baseUrl = getApiBaseUrl()
  const cid = communityStore.currentCommunityId || undefined
  let all: Task[]
  try {
    all = await getAllTasks(baseUrl, cid)
  } catch {
    all = await getAllTasks(baseUrl)
  }

  const poolTasks = all.filter((t) => {
    if (t.taskInfoId !== id) return false
    const lk = (t as any).listingKind ?? (t as any).listing_kind ?? 'standard'
    return lk !== 'taskpool_subtask'
  })

  if (poolTasks.length === 1) {
    const card = poolTasks[0]
    if (card.participantsList && card.participantsList.length > 0) {
      const ids = card.participantsList.map((p) => p.id).filter(Boolean) as string[]
      if (ids.length > 0) return ids
    }
    if (card.id) return [card.id]
    return null
  }

  if (poolTasks.length > 1) {
    const sorted = [...poolTasks].sort(
      (a, b) =>
        Number((a as any).participantIndex ?? (a as any).participant_index ?? 0) -
        Number((b as any).participantIndex ?? (b as any).participant_index ?? 0)
    )
    const ids = sorted.map((t) => t.id).filter(Boolean) as string[]
    return ids.length > 0 ? ids : null
  }

  return null
}

async function onSemiPrepay() {
  if (!canClickSemiPrepay.value || prepayOpening.value) return
  const pub = runtimeConfig.public as Record<string, unknown>
  const base = String(pub.semiAppUrl || '')
  const proxy = String(pub.taskpoolProxyAddress || '')
  const chainId = Number(pub.chainId ?? 10)
  const token = String(pub.ntTokenAddress || '')
  const amount = String(taskMeta.value!.plannedLockNt!)
  const state = generateRandomState()
  const clientReference =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${state.slice(0, 8)}`
  if (typeof window === 'undefined') return
  const baseUrl = getApiBaseUrl()

  const tm = taskMeta.value!
  let taskIdUuids: string[]
  try {
    const resolved = await resolveChainTaskIdUuidsForPrepay()
    if (!resolved?.length) {
      toast.add({
        title: '无法拼链上参数',
        description: '未找到本任务池对应的任务行 ID，请刷新页面或从任务列表进入后重试。',
        color: 'red',
      })
      return
    }
    taskIdUuids = resolved
  } catch (e) {
    toast.add({
      title: '无法加载任务行',
      description: e instanceof Error ? e.message : String(e),
      color: 'red',
    })
    return
  }

  let claimDeadline: string
  let credentialDeadline: string
  try {
    claimDeadline = toUnixSeconds(tm.deadline)
    credentialDeadline = toUnixSeconds(tm.submitDeadline ?? tm.deadline)
  } catch (e) {
    toast.add({
      title: '截止时间无效',
      description: e instanceof Error ? e.message : String(e),
      color: 'red',
    })
    return
  }

  const rewardNum = Number(tm.reward) || 0
  const perPersonWei = parseNtToWei(String(rewardNum)).toString()
  const poolId = uuidToTaskPoolUint256(taskInfoId.value).toString()
  const taskIdsUint = taskIdUuids.map((u) => uuidToTaskPoolUint256(u).toString())
  const taskMaxAmounts = taskIdUuids.map(() => perPersonWei)

  prepayOpening.value = true
  try {
    await startTaskpoolPrepayIntent(
      taskInfoId.value,
      { state, amountHuman: amount, clientReference },
      baseUrl
    )
  } catch (e) {
    toast.add({
      title: '无法登记预付意向',
      description: e instanceof Error ? e.message : String(e),
      color: 'red',
    })
    return
  } finally {
    prepayOpening.value = false
  }
  sessionStorage.setItem(semiTaskpoolStateStorageKey('prepay', taskInfoId.value), state)
  const returnUrl = `${window.location.origin}/wallet/semi-prepay-callback`
  const url = buildSemiTaskpoolPrepayUrl({
    semiAppBaseUrl: base,
    returnUrl,
    state,
    chainId,
    tokenAddress: token,
    taskpoolProxyAddress: proxy,
    amountHuman: amount,
    poolUuid: taskInfoId.value,
    poolId,
    taskIds: taskIdsUint.join(','),
    taskMaxAmounts: taskMaxAmounts.join(','),
    claimDeadline,
    credentialDeadline,
  })
  prepayOpening.value = true
  try {
    const w = window.open('about:blank', '_blank')
    if (!w) {
      toast.add({ title: '无法打开窗口', description: '请允许弹窗后重试', color: 'orange' })
      return
    }
    // 回跳页在弹窗上下文读取 sessionStorage：写入弹窗窗口，避免旧 state 残留造成 mismatch
    try {
      const key = semiTaskpoolStateStorageKey('prepay', taskInfoId.value)
      w.sessionStorage.setItem(key, state)
      w.sessionStorage.removeItem('semi_taskpool_prepay_state')
    } catch {
      /* ignore */
    }
    try {
      w.document.title = '正在跳转…'
    } catch {
      /* ignore */
    }
    w.location.href = url
    toast.add({
      title: '已打开 Semi',
      description: '请在 Semi 完成 approve + deposit + 建池；完成后会回到本站的回调页',
      color: 'green',
    })
    await loadPrepayIntent()
  } finally {
    prepayOpening.value = false
  }
}

const onchainStatusText = computed(() => {
  const s = taskMeta.value?.taskpoolCreateStatus || onchainState.value
  if (s === 'signing') return '签名中…（钱包确认）'
  if (s === 'pending') return '链上确认中…'
  if (s === 'confirmed') return '已确认'
  if (s === 'failed') return '失败（可重试）'
  return '未开始'
})

async function loadOverall() {
  overallError.value = ''
  overallLoading.value = true
  try {
    const baseUrl = getApiBaseUrl()
    const { submission, reviews } = await getTaskpoolOverallSubmission(taskInfoId.value, baseUrl)
    overall.value = submission
    overallReviews.value = reviews || []
    overallForm.value.summary = submission?.payload?.summary || ''
    overallForm.value.url = submission?.payload?.url || ''
  } catch (e) {
    overall.value = null
    overallReviews.value = []
    overallError.value = e instanceof Error ? e.message : String(e)
  } finally {
    overallLoading.value = false
  }
}

async function loadPrepayIntent() {
  const id = taskInfoId.value
  if (!id) {
    prepayIntentLatest.value = null
    prepayIntentList.value = []
    return
  }
  const tm = taskMeta.value
  if (!tm?.useTaskpool || !me.value?.id || tm.creatorId !== me.value.id) {
    prepayIntentLatest.value = null
    prepayIntentList.value = []
    return
  }
  if (tm.taskpoolCreateTxHash) {
    prepayIntentLatest.value = null
    prepayIntentList.value = []
    return
  }
  prepayHistoryLoading.value = true
  try {
    const baseUrl = getApiBaseUrl()
    const [latest, list] = await Promise.all([
      getTaskpoolPrepayIntentLatest(id, baseUrl),
      listTaskpoolPrepayIntents(id, baseUrl, 20),
    ])
    prepayIntentLatest.value = latest
    prepayIntentList.value = list
  } catch {
    prepayIntentLatest.value = null
    prepayIntentList.value = []
  } finally {
    prepayHistoryLoading.value = false
  }
}

async function loadTaskMeta() {
  metaError.value = ''
  const id = taskInfoId.value
  if (!id) return
  const baseUrl = getApiBaseUrl()
  const cid = communityStore.currentCommunityId || undefined
  try {
    let tasks = await getAllTasks(baseUrl, cid)
    let found = tasks.find(t => t.taskInfoId === id) || null
    if (!found) {
      tasks = await getAllTasks(baseUrl)
      found = tasks.find(t => t.taskInfoId === id) || null
    }
    taskMeta.value = found
    if (!found) {
      metaError.value = '未在任务列表中找到该任务池（可仍尝试操作子任务 API）。'
    }
  } catch (e) {
    metaError.value = e instanceof Error ? e.message : String(e)
  }
}

async function refreshSubtasks() {
  subtasksError.value = ''
  const id = taskInfoId.value
  if (!id) return
  loadList.value = true
  try {
    const baseUrl = getApiBaseUrl()
    const { subtasks: list } = await listTaskSubtasks(id, baseUrl)
    subtasks.value = list || []
  } catch (e) {
    subtasks.value = []
    subtasksError.value = e instanceof Error ? e.message : String(e)
  } finally {
    loadList.value = false
  }
}

async function loadMe() {
  try {
    const baseUrl = getApiBaseUrl()
    me.value = await getMe(baseUrl)
  } catch {
    me.value = null
  }
}

watch(taskInfoId, () => {
  loadTaskMeta()
  refreshSubtasks()
  loadOverall()
})

watch([me, taskMeta], () => {
  void loadPrepayIntent()
})

/** 阶段 5.3：从任务池列表带 ?focus=semi-prepay 进入时滚动到 Semi 区块并去掉 focus 参数 */
watch(
  [showSemiPrepaySection, () => route.query.focus],
  () => {
    if (typeof window === 'undefined') return
    if (route.query.focus !== 'semi-prepay' || !showSemiPrepaySection.value) return
    nextTick(() => {
      document.getElementById('taskpool-semi-prepay')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      const q = { ...route.query } as Record<string, string | string[] | undefined>
      if (!('focus' in q)) return
      delete q.focus
      router.replace({ path: route.path, query: q })
    })
  },
  { flush: 'post' }
)

onMounted(() => {
  loadMe()
  loadTaskMeta()
  refreshSubtasks()
  loadOverall()
})

async function onClaimManager() {
  const id = taskInfoId.value
  if (!id || busy.value !== 'idle') return
  busy.value = 'claim'
  claimAttempted.value = true
  try {
    const baseUrl = getApiBaseUrl()
    const result = await claimTaskPoolManager(id, baseUrl)
    claimedManagerUserId.value = result.managerUserId
    toast.add({ title: '已认领 Manager', color: 'green' })
    // 立刻更新 UI（即便 taskMeta 暂时拿不到）
    if (taskMeta.value) {
      taskMeta.value = {
        ...taskMeta.value,
        useTaskpool: true,
        managerUserId: result.managerUserId,
      }
    }
    await Promise.all([loadTaskMeta(), refreshSubtasks(), loadOverall()])
  } catch (e) {
    toast.add({
      title: '认领失败',
      description: e instanceof Error ? e.message : String(e),
      color: 'red',
    })
  } finally {
    busy.value = 'idle'
  }
}

async function onSubmitOverall() {
  const id = taskInfoId.value
  if (!id || busy.value !== 'idle') return
  if (!canWrite.value) {
    toast.add({ title: '无权限', description: '仅负责人 可整单提交', color: 'red' })
    return
  }
  busy.value = 'finalize'
  try {
    const baseUrl = getApiBaseUrl()
    const { submission } = await upsertTaskpoolOverallSubmission(
      id,
      { summary: overallForm.value.summary, url: overallForm.value.url },
      baseUrl
    )
    overall.value = submission
    await loadOverall()
    toast.add({ title: '整单提交成功', color: 'green' })
  } catch (e) {
    toast.add({
      title: '整单提交失败',
      description: e instanceof Error ? e.message : String(e),
      color: 'red',
    })
  } finally {
    busy.value = 'idle'
  }
}

async function onReviewOverall(decision: 'approved' | 'rejected') {
  const id = taskInfoId.value
  if (!id || overallReviewBusy.value) return
  if (!canReviewOverall.value) {
    toast.add({ title: '无权限', description: '仅创建者可审核整单提交', color: 'red' })
    return
  }
  if (!overall.value) {
    toast.add({ title: '暂无提交', description: '尚未整单提交，无法审核', color: 'red' })
    return
  }
  if (overall.value.status !== 'under_review') {
    toast.add({ title: '无需审核', description: `当前状态：${overallStatusText.value}`, color: 'gray' })
    return
  }
  overallReviewBusy.value = true
  try {
    const baseUrl = getApiBaseUrl()
    const { submission } = await reviewTaskpoolOverallSubmission(
      id,
      { decision, reason: overallReviewReason.value },
      baseUrl
    )
    if (submission) overall.value = submission
    await loadOverall()
    toast.add({ title: decision === 'approved' ? '已通过' : '已驳回', color: 'green' })
  } catch (e) {
    toast.add({
      title: '审核失败',
      description: e instanceof Error ? e.message : String(e),
      color: 'red',
    })
  } finally {
    overallReviewBusy.value = false
  }
}

const TASKPOOL_DRAFT_KEY = 'mycoseed_taskpool_withdraw_draft'

async function onWithdrawPool() {
  const id = taskInfoId.value
  if (!id || withdrawingPool.value) return
  if (!canCreatorWithdrawPool.value) return
  const ok = window.confirm('确认撤回任务池？撤回后会回到发布页，并保留草稿用于重新编辑。')
  if (!ok) return
  withdrawingPool.value = true
  try {
    const baseUrl = getApiBaseUrl()
    const res = await withdrawTaskPool(id, baseUrl)
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(TASKPOOL_DRAFT_KEY, JSON.stringify(res.draft || {}))
    }
    toast.add({ title: '已撤回', description: '已为你保留草稿，可继续修改后重新发布', color: 'green' })
    await router.push('/tasks/pool/create?from=withdraw')
  } catch (e) {
    toast.add({
      title: '撤回失败',
      description: e instanceof Error ? e.message : String(e),
      color: 'red',
    })
  } finally {
    withdrawingPool.value = false
  }
}

async function onCreateOnchainPoolDemo() {
  const id = taskInfoId.value
  if (!id || onchainBusy.value) return
  if (!canWrite.value) {
    toast.add({ title: '无权限', description: '仅负责人 可创建链上 TaskPool', color: 'red' })
    return
  }
  if (!import.meta.client) {
    toast.add({ title: '仅浏览器可用', description: '请在浏览器中连接钱包执行', color: 'red' })
    return
  }
  onchainError.value = ''
  onchainBusy.value = true
  onchainState.value = 'signing'
  try {
    const slice = useTaskPoolVerticalSlice()
    const account = (await slice.connect()) as Address
    const now = Math.floor(Date.now() / 1000)
    const poolId = uuidToTaskPoolUint256(id)

    // demo 参数：同一钱包兼任 Publisher/Manager；单子任务 taskId=1；maxAmount=0；lockedBalance=0
    {
      const baseUrl = getApiBaseUrl()
      await patchTaskInfoTaskpool(
        id,
        { taskpoolCreateStatus: 'signing', taskpoolCreateLastError: '' },
        baseUrl
      )
    }
    const tx = await createPoolAndPersist({
      createOnchain: async () => {
        const h = await slice.createPoolFlow(account, {
          poolId,
          taskId: 1n,
          lockedBalance: 0n,
          claimDeadline: BigInt(now + 86400 * 7),
          credentialDeadline: BigInt(now + 86400 * 8),
          createSigDeadline: BigInt(now + 3600),
        })
        return h as `0x${string}`
      },
      persist: async (txHash) => {
        const baseUrl = getApiBaseUrl()
        await patchTaskInfoTaskpool(
          id,
          { taskpoolCreateStatus: 'pending', taskpoolCreateTxHash: txHash, taskpoolCreateLastError: '' },
          baseUrl
        )
        await patchTaskInfoTaskpool(
          id,
          {
            taskpoolPhase: 'pool_created',
            taskpoolCreateTxHash: txHash,
            taskpoolCreateStatus: 'confirmed',
          },
          baseUrl
        )
      },
    })

    onchainLastTxHash.value = tx.txHash
    onchainState.value = 'confirmed'
    toast.add({ title: '链上建池成功', description: tx.txHash, color: 'green' })
    await loadTaskMeta()
  } catch (e) {
    onchainError.value = e instanceof Error ? e.message : String(e)
    onchainState.value = 'failed'
    try {
      const baseUrl = getApiBaseUrl()
      await patchTaskInfoTaskpool(
        id,
        { taskpoolCreateStatus: 'failed', taskpoolCreateLastError: onchainError.value },
        baseUrl
      )
    } catch {
      /* ignore */
    }
    toast.add({ title: '链上建池失败', description: onchainError.value, color: 'red' })
  } finally {
    onchainBusy.value = false
    if (onchainState.value === 'signing') onchainState.value = 'idle'
  }
}

async function onFinalApproveOnchain() {
  const id = taskInfoId.value
  if (!id || finalApproveOpening.value) return
  if (!canFinalApproveOnchain.value) return
  const semiAppUrl = String((runtimeConfig.public as any).semiAppUrl || '')
  const chainId = Number((runtimeConfig.public as any).chainId ?? 10)
  const proxy = String((runtimeConfig.public as any).taskpoolProxyAddress || '')
  if (!semiAppUrl) {
    toast.add({ title: '缺少配置', description: '未配置 NUXT_PUBLIC_SEMI_APP_URL', color: 'red' })
    return
  }
  if (!proxy) {
    toast.add({ title: '缺少配置', description: '未配置 NUXT_PUBLIC_TASKPOOL_PROXY_ADDRESS', color: 'red' })
    return
  }
  finalApproveOpening.value = true
  try {
    const state = generateRandomState()
    try {
      sessionStorage.setItem(semiTaskpoolStateStorageKey('final_approve', id), state)
    } catch {}
    const poolId = uuidToTaskPoolUint256(id).toString()
    // 终审成功后，自动回跳任务详情并弹「一键分享到社区圈」需要 taskId（池列表行 id）
    let detailTaskId = String(taskMeta.value?.id || '').trim()
    try {
      const baseUrl = getApiBaseUrl()
      const cid = communityStore.currentCommunityId || undefined
      let tasks: Task[]
      try {
        tasks = await getAllTasks(baseUrl, cid)
      } catch {
        tasks = await getAllTasks(baseUrl)
      }
      const pick = (tasks || []).find((t) => {
        if (t.taskInfoId !== id) return false
        const lk = ((t as any).listingKind ?? (t as any).listing_kind ?? '') as string
        return lk === 'taskpool_pool'
      })
      if (pick?.id) detailTaskId = String(pick.id).trim()
    } catch {
      /* ignore */
    }
    const returnUrl = `${window.location.origin}/wallet/semi-final-approve-callback?taskInfoId=${encodeURIComponent(id)}${
      detailTaskId ? `&taskId=${encodeURIComponent(detailTaskId)}` : ''
    }`
    let url = buildSemiTaskpoolFinalApproveUrl({
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
      const key = semiTaskpoolStateStorageKey('final_approve', id)
      w.sessionStorage.setItem(key, state)
      w.sessionStorage.removeItem('semi_taskpool_prepay_state')
    } catch {
      /* ignore */
    }
    try {
      w.document.title = '正在跳转…'
    } catch {}
    // C1：终审备注 batch 用短 token 传递（避免 URL 塞数组）
    try {
      const baseUrl = getApiBaseUrl()
      const r = await getTaskInfoTaskpoolFinalRemarkPayloadIntent(
        id,
        { state, publisher_remark: null },
        baseUrl
      )
      if (r?.payload_id) {
        url += `&payload_id=${encodeURIComponent(r.payload_id)}`
      }
    } catch (e) {
      try {
        w.close()
      } catch {}
      throw e
    }
    w.location.href = url
    toast.add({ title: '已打开 Semi', description: '请在 Semi 完成终审（开启约 24 小时公示）', color: 'green' })
  } catch (e) {
    toast.add({ title: '打开失败', description: e instanceof Error ? e.message : String(e), color: 'red' })
  } finally {
    finalApproveOpening.value = false
  }
}

async function onDistributeOnchain() {
  const id = taskInfoId.value
  if (!id || distributeOpening.value) return
  if (!canDistributeOnchain.value) return
  const semiAppUrl = String((runtimeConfig.public as any).semiAppUrl || '')
  const chainId = Number((runtimeConfig.public as any).chainId ?? 10)
  const proxy = String((runtimeConfig.public as any).taskpoolProxyAddress || '')
  if (!semiAppUrl) {
    toast.add({ title: '缺少配置', description: '未配置 NUXT_PUBLIC_SEMI_APP_URL', color: 'red' })
    return
  }
  if (!proxy) {
    toast.add({ title: '缺少配置', description: '未配置 NUXT_PUBLIC_TASKPOOL_PROXY_ADDRESS', color: 'red' })
    return
  }
  distributeOpening.value = true
  try {
    const state = generateRandomState()
    try {
      sessionStorage.setItem(semiTaskpoolStateStorageKey('distribute', id), state)
    } catch {}
    const poolId = uuidToTaskPoolUint256(id).toString()
    const returnUrl = `${window.location.origin}/wallet/semi-distribute-callback?taskInfoId=${encodeURIComponent(id)}`
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
      const key = semiTaskpoolStateStorageKey('distribute', id)
      w.sessionStorage.setItem(key, state)
      w.sessionStorage.removeItem('semi_taskpool_prepay_state')
    } catch {
      /* ignore */
    }
    try {
      w.document.title = '正在跳转…'
    } catch {}
    w.location.href = url
    toast.add({ title: '已打开 Semi', description: '请在 Semi 完成结算（公示结束后链上才会成功）', color: 'green' })
  } catch (e) {
    toast.add({ title: '打开失败', description: e instanceof Error ? e.message : String(e), color: 'red' })
  } finally {
    distributeOpening.value = false
  }
}

async function onAddSubtask() {
  const id = taskInfoId.value
  const title = newTitle.value.trim()
  if (!id || !title || busy.value !== 'idle' || taskMeta.value?.subtasksFinalized) return
  if (!canWrite.value) {
    toast.add({ title: '无权限', description: '仅负责人 可编辑子任务', color: 'red' })
    return
  }
  busy.value = 'add'
  try {
    const baseUrl = getApiBaseUrl()
    const sortOrder = subtasks.value.length
    let proofConfig: any = undefined
    if (newProofConfigText.value.trim()) {
      try {
        proofConfig = JSON.parse(newProofConfigText.value)
      } catch {
        toast.add({ title: 'proofConfig 格式错误', description: '请填写合法 JSON', color: 'red' })
        return
      }
    }
    await createTaskSubtask(
      id,
      {
        title,
        sortOrder,
        description: newDescription.value.trim() || undefined,
        submissionInstructions: newSubmissionInstructions.value.trim() || undefined,
        participantLimit: newParticipantLimit.value ?? undefined,
        rewardNt: newRewardNt.value ?? undefined,
        submitDeadlineOverride: newSubmitDeadlineOverride.value.trim() || undefined,
        proofConfig,
      },
      baseUrl
    )
    newTitle.value = ''
    newDescription.value = ''
    newSubmissionInstructions.value = ''
    newParticipantLimit.value = null
    newRewardNt.value = null
    newSubmitDeadlineOverride.value = ''
    newProofConfigText.value = ''
    toast.add({ title: '子任务已添加', color: 'green' })
    await refreshSubtasks()
  } catch (e) {
    toast.add({
      title: '添加失败',
      description: e instanceof Error ? e.message : String(e),
      color: 'red',
    })
  } finally {
    busy.value = 'idle'
  }
}

const editingId = ref<string | null>(null)
const editTitle = ref('')
const editDescription = ref('')
const editSubmissionInstructions = ref('')
const editParticipantLimit = ref<number | null>(null)
const editRewardNt = ref<number | null>(null)
const editSubmitDeadlineOverride = ref<string>('')
const editProofConfigText = ref<string>('')

function startEdit(s: TaskSubtaskDraft) {
  editingId.value = s.id
  editTitle.value = s.title || ''
  editDescription.value = (s.description as any) || ''
  editSubmissionInstructions.value = (s.submissionInstructions as any) || ''
  editParticipantLimit.value = (s.participantLimit as any) ?? null
  editRewardNt.value = (s.rewardNt as any) ?? null
  editSubmitDeadlineOverride.value = (s.submitDeadlineOverride as any) || ''
  editProofConfigText.value = s.proofConfig ? JSON.stringify(s.proofConfig, null, 2) : ''
}

function cancelEdit() {
  editingId.value = null
}

async function saveEdit() {
  const id = taskInfoId.value
  const sid = editingId.value
  if (!id || !sid || busy.value !== 'idle' || taskMeta.value?.subtasksFinalized) return
  if (!canWrite.value) {
    toast.add({ title: '无权限', description: '仅负责人 可编辑子任务', color: 'red' })
    return
  }
  busy.value = 'add'
  try {
    const baseUrl = getApiBaseUrl()
    let proofConfig: any = undefined
    if (editProofConfigText.value.trim()) {
      try {
        proofConfig = JSON.parse(editProofConfigText.value)
      } catch {
        toast.add({ title: 'proofConfig 格式错误', description: '请填写合法 JSON', color: 'red' })
        return
      }
    }
    await patchTaskSubtask(
      id,
      sid,
      {
        title: editTitle.value.trim() || undefined,
        description: editDescription.value.trim() || undefined,
        submissionInstructions: editSubmissionInstructions.value.trim() || undefined,
        participantLimit: editParticipantLimit.value ?? undefined,
        rewardNt: editRewardNt.value ?? undefined,
        submitDeadlineOverride: editSubmitDeadlineOverride.value.trim() || undefined,
        proofConfig,
      },
      baseUrl
    )
    toast.add({ title: '已保存', color: 'green' })
    editingId.value = null
    await refreshSubtasks()
  } catch (e) {
    toast.add({ title: '保存失败', description: e instanceof Error ? e.message : String(e), color: 'red' })
  } finally {
    busy.value = 'idle'
  }
}

async function onFinalize() {
  const id = taskInfoId.value
  if (!id || busy.value !== 'idle' || !subtasks.value.length || taskMeta.value?.subtasksFinalized) return
  if (!canWrite.value) {
    toast.add({ title: '无权限', description: '仅负责人 可定稿子任务', color: 'red' })
    return
  }
  
  // 检查子任务总费用是否超过任务池激励
  if (exceedsPoolBudget.value) {
    const plannedLock = Number(taskMeta.value?.plannedLockNt) || 0
    const subtotal = subtotalReward.value
    toast.add({
      title: '无法定稿',
      description: `子任务总费用 ${subtotal} NT 已超过任务池激励 ${plannedLock} NT，请先调整子任务费用。`,
      color: 'red',
    })
    return
  }
  
  busy.value = 'finalize'
  try {
    const baseUrl = getApiBaseUrl()
    await finalizeTaskSubtasks(id, baseUrl)
    toast.add({ title: '子任务已定稿', color: 'green' })
    await Promise.all([refreshSubtasks(), loadTaskMeta()])
  } catch (e) {
    toast.add({
      title: '定稿失败',
      description: e instanceof Error ? e.message : String(e),
      color: 'red',
    })
  } finally {
    busy.value = 'idle'
  }
}
</script>
