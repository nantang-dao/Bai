/**
 * 从 Nuxt runtimeConfig 读取 TaskPool EIP-712 / 读合约所需公开配置。
 */
export function useTaskPoolConfig() {
  const config = useRuntimeConfig()
  return {
    proxyAddress: config.public.taskpoolProxyAddress as `0x${string}`,
    adminAddress: config.public.taskpoolAdminAddress as
      | `0x${string}`
      | undefined,
    chainId: config.public.chainId as number,
    ntTokenAddress: config.public.ntTokenAddress as `0x${string}`,
  }
}
