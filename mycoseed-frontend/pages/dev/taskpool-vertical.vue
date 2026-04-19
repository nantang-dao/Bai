<template>
  <div class="min-h-screen bg-background py-6 px-4 max-w-3xl mx-auto pb-24">
    <h1 class="text-2xl font-bold text-text-title mb-2">TaskPool 竖切（单池单子任务）</h1>
    <p class="text-sm text-text-title/70 mb-4">
      阶段 4：浏览器注入钱包（MetaMask 等）下 approve / deposit / createTaskPool 等竖切的默认入口；任务池「管理」页主路径以 Semi 为主，本页用于联调与对照。
      开发用：同一钱包可兼任 Publisher / Manager / Claimer。正式环境请拆分角色。
      合约需 <code class="text-xs bg-card px-1 rounded">remarkProxy == 0</code>，否则终审会报错。
    </p>
    <div
      v-if="remarkWarn"
      class="mb-4 p-3 rounded-2xl border border-amber-500/50 bg-amber-500/10 text-amber-900 dark:text-amber-100 text-sm"
    >
      {{ remarkWarn }}
    </div>

    <div class="space-y-3 mb-6 text-sm">
      <div>
        <span class="text-text-title/70">Proxy：</span>
        <code class="break-all text-xs">{{ slice.proxyAddress }}</code>
      </div>
      <div>
        <span class="text-text-title/70">chainId：</span> {{ slice.chainId }}
      </div>
      <div v-if="account">
        <span class="text-text-title/70">当前钱包：</span>
        <code class="text-xs">{{ account }}</code>
      </div>
      <div v-if="poolUuid">
        <span class="text-text-title/70">Pool UUID：</span> {{ poolUuid }}
      </div>
      <div>
        <span class="text-text-title/70">poolId：</span>
        <code class="break-all text-xs">{{ poolId != null ? poolId.toString() : '（未生成）' }}</code>
      </div>
      <div>
        <span class="text-text-title/70">taskId（单子任务）：</span>
        {{ taskId.toString() }}
      </div>
    </div>

    <div class="flex flex-wrap gap-2 mb-4">
      <PixelButton variant="primary" @click="onConnect">1. 连接钱包</PixelButton>
      <PixelButton @click="genPoolId">生成 poolId（UUID）</PixelButton>
    </div>

    <div class="grid gap-2 mb-4 max-w-md">
      <label class="text-xs font-bold text-text-title">锁定金额（人类可读 NT）</label>
      <input
        v-model="lockHuman"
        type="text"
        class="h-11 px-3 rounded-2xl border border-border bg-input-bg"
      />
    </div>

    <div class="flex flex-wrap gap-2 mb-6">
      <PixelButton :disabled="!account" @click="onApproveNt">2. 授权 NT</PixelButton>
      <PixelButton :disabled="!account" @click="onDeposit">3. deposit → credit</PixelButton>
      <PixelButton :disabled="!account || poolId == null" @click="onCreatePool">4. createTaskPool</PixelButton>
      <PixelButton :disabled="!account || poolId == null" @click="onClaim">5. claimTask</PixelButton>
      <PixelButton :disabled="!account || poolId == null" @click="onApproveSub">6. approveSubtask</PixelButton>
      <PixelButton :disabled="!account || poolId == null" @click="onFinalApprove">7. finalApprovePool</PixelButton>
      <PixelButton :disabled="!account || poolId == null" @click="onDistribute">8. distribute</PixelButton>
    </div>

    <div class="mb-2 text-sm font-bold text-text-title">日志</div>
    <button
      type="button"
      class="text-xs text-primary mb-2 underline"
      @click="slice.clearLogs()"
    >
      清空
    </button>
    <pre
      class="text-xs bg-card border border-border rounded-2xl p-3 max-h-80 overflow-auto font-mono whitespace-pre-wrap"
    >{{ slice.logs.value.join('\n') }}</pre>
  </div>
</template>

<script setup lang="ts">
import type { Address } from 'viem'
import { uuidToTaskPoolUint256 } from '~/utils/taskpool/ids'

definePageMeta({
  layout: 'default',
  // 仅客户端：避免 viem / BigInt 字面量进入 Nitro es2019 SSR 打包报警
  ssr: false,
})

const slice = useTaskPoolVerticalSlice()
const toast = useToast()

const account = ref<Address | ''>('')
const remarkWarn = ref('')
const poolUuid = ref('')
const poolId = ref<bigint | null>(null)
const taskId = ref<bigint>(BigInt(1))
const lockHuman = ref('1')
const decimals = ref(18)

function genPoolId() {
  const u = crypto.randomUUID()
  poolUuid.value = u
  poolId.value = uuidToTaskPoolUint256(u)
  slice.log(`已生成 poolId（来自 UUID）`)
}

function deadlines() {
  const now = Math.floor(Date.now() / 1000)
  return {
    claimDeadline: BigInt(now + 86400 * 7),
    credentialDeadline: BigInt(now + 86400 * 8),
    sigShort: BigInt(now + 3600),
  }
}

onMounted(async () => {
  try {
    const rp = await slice.readRemarkProxy()
    if (
      rp &&
      rp !== '0x0000000000000000000000000000000000000000'
    ) {
      remarkWarn.value =
        '检测到 remarkProxy 非零：本页终审（空评语）将失败。请使用未配置 Remark 的 TaskPool 或使用带评语流程。'
    }
  } catch {
    /* 忽略：未连 RPC 等 */
  }
})

async function onConnect() {
  try {
    account.value = await slice.connect()
    const pt = await slice.readPointToken()
    decimals.value = await slice.readNtDecimals(pt)
    slice.log(`NT pointToken: ${pt}，decimals=${decimals.value}`)
  } catch (e) {
    toast.add({ title: '错误', description: String(e), color: 'red' })
  }
}

async function onApproveNt() {
  if (!account.value) return
  try {
    const pt = await slice.readPointToken()
    const amt = slice.parseUnits('1000000', decimals.value)
    await slice.approveNt(account.value, pt, amt)
  } catch (e) {
    toast.add({ title: 'approve 失败', description: String(e), color: 'red' })
  }
}

async function onDeposit() {
  if (!account.value) return
  try {
    const lock = slice.parseUnits(lockHuman.value || '0', decimals.value)
    if (lock <= BigInt(0)) throw new Error('锁定金额须大于 0')
    await slice.deposit(account.value, lock)
  } catch (e) {
    toast.add({ title: 'deposit 失败', description: String(e), color: 'red' })
  }
}

async function onCreatePool() {
  if (!account.value || poolId.value == null) return
  try {
    const lock = slice.parseUnits(lockHuman.value || '0', decimals.value)
    if (lock <= BigInt(0)) throw new Error('锁定金额须大于 0')
    const d = deadlines()
    await slice.createPoolFlow(account.value, {
      poolId: poolId.value,
      taskId: taskId.value,
      lockedBalance: lock,
      claimDeadline: d.claimDeadline,
      credentialDeadline: d.credentialDeadline,
      createSigDeadline: d.sigShort,
    })
  } catch (e) {
    toast.add({ title: 'createTaskPool 失败', description: String(e), color: 'red' })
  }
}

async function onClaim() {
  if (!account.value || poolId.value == null) return
  try {
    const lock = slice.parseUnits(lockHuman.value || '0', decimals.value)
    const d = deadlines()
    await slice.claimFlow(account.value, {
      poolId: poolId.value,
      taskId: taskId.value,
      amount: lock,
      claimSigDeadline: d.sigShort,
    })
  } catch (e) {
    toast.add({ title: 'claimTask 失败', description: String(e), color: 'red' })
  }
}

async function onApproveSub() {
  if (!account.value || poolId.value == null) return
  try {
    await slice.approveSubtaskFlow(account.value, poolId.value, taskId.value)
  } catch (e) {
    toast.add({ title: 'approveSubtask 失败', description: String(e), color: 'red' })
  }
}

async function onFinalApprove() {
  if (!account.value || poolId.value == null) return
  try {
    await slice.finalApproveFlow(account.value, poolId.value)
  } catch (e) {
    toast.add({ title: 'finalApprove 失败', description: String(e), color: 'red' })
  }
}

async function onDistribute() {
  if (!account.value || poolId.value == null) return
  try {
    await slice.distributeFlow(account.value, poolId.value)
  } catch (e) {
    toast.add({ title: 'distribute 失败', description: String(e), color: 'red' })
  }
}
</script>
