/**
 * 4B 最小上链：创建链上 TaskPool → 回写后端。
 * 该函数是“可注入依赖”的纯流程，方便脚本/测试 mock。
 */

export async function createPoolAndPersist(params: {
  createOnchain: () => Promise<`0x${string}`>
  persist: (txHash: `0x${string}`) => Promise<void>
}): Promise<{ txHash: `0x${string}` }> {
  const txHash = await params.createOnchain()
  await params.persist(txHash)
  return { txHash }
}

