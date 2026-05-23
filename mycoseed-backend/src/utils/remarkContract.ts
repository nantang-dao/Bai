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

export const remarkSavedEventAbi = [
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'poolId', type: 'uint256' },
      { indexed: true, name: 'taskId', type: 'uint256' },
      { indexed: false, name: 'senderRemark', type: 'string' },
      { indexed: false, name: 'receiverRemark', type: 'string' },
      { indexed: false, name: 'timestamp', type: 'uint256' },
    ],
    name: 'RemarkSaved',
    type: 'event',
  },
] as const
