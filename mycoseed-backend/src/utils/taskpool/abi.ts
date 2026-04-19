/** TaskPool Proxy 最小 ABI（claim intent 读链） */
export const taskPoolAbi = [
  {
    type: 'function',
    name: 'poolTasks',
    stateMutability: 'view',
    inputs: [
      { name: 'poolId', type: 'uint256' },
      { name: 'taskId', type: 'uint256' },
    ],
    outputs: [
      { name: 'assignee', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'maxAmount', type: 'uint256' },
      { name: 'claimNonce', type: 'uint256' },
      { name: 'status', type: 'uint8' },
      { name: 'exists', type: 'bool' },
    ],
  },
] as const

