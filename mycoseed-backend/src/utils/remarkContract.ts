export const remarkProxyGetRemarksAbi = [
  {
    inputs: [{ name: 'taskId', type: 'string', internalType: 'string' }],
    name: 'getRemarks',
    outputs: [
      { name: 'senderRemark', type: 'string', internalType: 'string' },
      { name: 'receiverRemark', type: 'string', internalType: 'string' },
      { name: 'timestamp', type: 'uint256', internalType: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const
