import { computed, ref } from 'vue'
import { useRuntimeConfig } from 'nuxt/app'
import { createPublicClient, createWalletClient, custom, http, formatUnits, parseUnits, type Address, type Hex } from 'viem'
import { optimism } from 'viem/chains'
import { erc20Abi, taskPoolAbi } from '~/utils/taskpool/abi'
import {
  buildCreatePoolMessage,
  signClaimTask,
  signCreatePool,
} from '~/utils/taskpool/eip712'

function ensureBrowserEthereum() {
  if (!import.meta.client) {
    throw new Error('链上操作仅能在浏览器内执行')
  }
  const eth = (window as unknown as { ethereum?: unknown }).ethereum as
    | { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> }
    | undefined
  if (!eth?.request) {
    throw new Error('未检测到钱包（如 MetaMask）')
  }
  return eth
}

/**
 * 阶段 B：单池单子任务竖切（同一钱包可同时扮演 Publisher / Manager / Claimer 做冒烟）。
 */
export function useTaskPoolVerticalSlice() {
  const config = useRuntimeConfig()
  const logs = ref<string[]>([])

  const proxyAddress = computed(
    () => config.public.taskpoolProxyAddress as Address
  )
  const chainId = computed(() => config.public.chainId as number)
  const rpcUrl = computed(() => config.public.opRpcUrl as string)
  const ntFromEnv = computed(
    () => config.public.ntTokenAddress as Address
  )

  const chain = computed(() => ({
    ...optimism,
    rpcUrls: {
      ...optimism.rpcUrls,
      default: { http: [rpcUrl.value] },
    },
  }))

  function log(line: string) {
    logs.value.push(`${new Date().toISOString().slice(11, 19)} ${line}`)
  }

  function publicClient() {
    return createPublicClient({
      chain: chain.value,
      transport: http(rpcUrl.value),
    })
  }

  function walletClient() {
    const eth = ensureBrowserEthereum()
    return createWalletClient({
      chain: chain.value,
      transport: custom(eth),
    })
  }

  async function ensureChain(): Promise<void> {
    const eth = ensureBrowserEthereum()
    const hexChain = `0x${chainId.value.toString(16)}`
    try {
      await eth.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: hexChain }],
      })
    } catch (e: unknown) {
      if (
        e &&
        typeof e === 'object' &&
        'code' in e &&
        (e as { code: number }).code === 4902
      ) {
        throw new Error(
          `请在钱包中手动添加 chainId=${chainId.value}（OP 主网为 10）`
        )
      }
      throw e
    }
  }

  async function connect(): Promise<Address> {
    await ensureChain()
    const eth = ensureBrowserEthereum()
    const accts = (await eth.request({
      method: 'eth_requestAccounts',
    })) as Address[]
    const a = accts[0]
    if (!a) throw new Error('未获得钱包地址')
    log(`已连接 ${a.slice(0, 10)}…`)
    return a
  }

  async function readPointToken(): Promise<Address> {
    const pt = await publicClient().readContract({
      address: proxyAddress.value,
      abi: taskPoolAbi,
      functionName: 'pointToken',
    })
    return pt as Address
  }

  async function readRemarkProxy(): Promise<Address> {
    const r = await publicClient().readContract({
      address: proxyAddress.value,
      abi: taskPoolAbi,
      functionName: 'remarkProxy',
    })
    return r as Address
  }

  async function readNtDecimals(nt: Address): Promise<number> {
    return publicClient().readContract({
      address: nt,
      abi: erc20Abi,
      functionName: 'decimals',
    })
  }

  async function readCredit(account: Address): Promise<bigint> {
    return publicClient().readContract({
      address: proxyAddress.value,
      abi: taskPoolAbi,
      functionName: 'credit',
      args: [account],
    })
  }

  async function readCreditNonce(account: Address): Promise<bigint> {
    return publicClient().readContract({
      address: proxyAddress.value,
      abi: taskPoolAbi,
      functionName: 'creditNonces',
      args: [account],
    })
  }

  async function approveNt(owner: Address, nt: Address, amount: bigint) {
    const wc = walletClient()
    const hash = await wc.writeContract({
      account: owner,
      address: nt,
      abi: erc20Abi,
      functionName: 'approve',
      args: [proxyAddress.value, amount],
    })
    log(`NT approve 已发送: ${hash}`)
    await publicClient().waitForTransactionReceipt({ hash })
    log('NT approve 已确认')
  }

  async function deposit(account: Address, amount: bigint) {
    const wc = walletClient()
    const hash = await wc.writeContract({
      account,
      address: proxyAddress.value,
      abi: taskPoolAbi,
      functionName: 'deposit',
      args: [amount],
    })
    log(`deposit 已发送: ${hash}`)
    await publicClient().waitForTransactionReceipt({ hash })
    log('deposit 已确认')
  }

  async function createPoolFlow(
    account: Address,
    params: {
      poolId: bigint
      taskId: bigint
      lockedBalance: bigint
      claimDeadline: bigint
      credentialDeadline: bigint
      createSigDeadline: bigint
    }
  ): Promise<Hex> {
    const nonce = await readCreditNonce(account)
    const msg = buildCreatePoolMessage({
      poolId: params.poolId,
      publisher: account,
      manager: account,
      taskIds: [params.taskId],
      taskMaxAmounts: [BigInt(0)],
      lockedBalance: params.lockedBalance,
      claimDeadline: params.claimDeadline,
      credentialDeadline: params.credentialDeadline,
      nonce,
      sigDeadline: params.createSigDeadline,
    })
    const wc = walletClient()
    const sig = await signCreatePool(
      wc,
      account,
      chainId.value,
      proxyAddress.value,
      msg
    )
    const hash = await wc.writeContract({
      account,
      address: proxyAddress.value,
      abi: taskPoolAbi,
      functionName: 'createTaskPool',
      args: [
        params.poolId,
        account,
        [params.taskId],
        [BigInt(0)],
        params.lockedBalance,
        params.claimDeadline,
        params.credentialDeadline,
        nonce,
        params.createSigDeadline,
        sig as Hex,
      ],
    })
    log(`createTaskPool 已发送: ${hash}`)
    await publicClient().waitForTransactionReceipt({ hash })
    log('createTaskPool 已确认')
    return hash as Hex
  }

  async function claimFlow(
    account: Address,
    params: {
      poolId: bigint
      taskId: bigint
      amount: bigint
      claimSigDeadline: bigint
    }
  ) {
    const t = (await publicClient().readContract({
      address: proxyAddress.value,
      abi: taskPoolAbi,
      functionName: 'poolTasks',
      args: [params.poolId, params.taskId],
    })) as readonly unknown[]
    const claimNonce = t[3] as bigint
    const wc = walletClient()
    const sig = await signClaimTask(
      wc,
      account,
      chainId.value,
      proxyAddress.value,
      {
        poolId: params.poolId,
        taskId: params.taskId,
        claimer: account,
        amount: params.amount,
        taskClaimNonce: claimNonce,
        sigDeadline: params.claimSigDeadline,
      }
    )
    const hash = await wc.writeContract({
      account,
      address: proxyAddress.value,
      abi: taskPoolAbi,
      functionName: 'claimTask',
      args: [
        params.poolId,
        params.taskId,
        params.amount,
        params.claimSigDeadline,
        sig as Hex,
      ],
    })
    log(`claimTask 已发送: ${hash}`)
    await publicClient().waitForTransactionReceipt({ hash })
    log('claimTask 已确认')
  }

  async function approveSubtaskFlow(
    account: Address,
    poolId: bigint,
    taskId: bigint
  ) {
    const wc = walletClient()
    const hash = await wc.writeContract({
      account,
      address: proxyAddress.value,
      abi: taskPoolAbi,
      functionName: 'approveSubtask',
      args: [poolId, taskId],
    })
    log(`approveSubtask 已发送: ${hash}`)
    await publicClient().waitForTransactionReceipt({ hash })
    log('approveSubtask 已确认')
  }

  async function finalApproveFlow(account: Address, poolId: bigint) {
    const rp = await readRemarkProxy()
    if (
      rp &&
      rp !== '0x0000000000000000000000000000000000000000'
    ) {
      throw new Error(
        '合约已配置 remarkProxy，终审需按 Remark 规则传评语；此竖切仅支持 remarkProxy=0。'
      )
    }
    const wc = walletClient()
    const hash = await wc.writeContract({
      account,
      address: proxyAddress.value,
      abi: taskPoolAbi,
      functionName: 'finalApprovePool',
      args: [poolId, '', [], []],
    })
    log(`finalApprovePool 已发送: ${hash}`)
    await publicClient().waitForTransactionReceipt({ hash })
    log('finalApprovePool 已确认（进入 24h 公示）')
  }

  async function distributeFlow(account: Address, poolId: bigint) {
    const wc = walletClient()
    const pool = (await publicClient().readContract({
      address: proxyAddress.value,
      abi: taskPoolAbi,
      functionName: 'pools',
      args: [poolId],
    })) as readonly unknown[]
    const endsAt = pool[6] as bigint
    const now = BigInt(Math.floor(Date.now() / 1000))
    if (now < endsAt) {
      throw new Error(
        `公示未结束：请在 ${Number(endsAt) - Number(now)} 秒后再试 distribute`
      )
    }
    const hash = await wc.writeContract({
      account,
      address: proxyAddress.value,
      abi: taskPoolAbi,
      functionName: 'distribute',
      args: [poolId],
    })
    log(`distribute 已发送: ${hash}`)
    await publicClient().waitForTransactionReceipt({ hash })
    log('distribute 已确认')
  }

  function clearLogs() {
    logs.value = []
  }

  return {
    logs,
    log,
    clearLogs,
    proxyAddress,
    chainId,
    rpcUrl,
    ntFromEnv,
    connect,
    ensureChain,
    readPointToken,
    readRemarkProxy,
    readNtDecimals,
    readCredit,
    readCreditNonce,
    approveNt,
    deposit,
    createPoolFlow,
    claimFlow,
    approveSubtaskFlow,
    finalApproveFlow,
    distributeFlow,
    publicClient,
    formatUnits,
    parseUnits,
  }
}
