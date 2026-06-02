import { Alchemy, Network } from 'alchemy-sdk'
import { keccak256, toUtf8Bytes } from 'ethers'
import { remarkSavedEventAbi } from '../utils/remarkContract'

const NT_TOKEN = '0x7563cb33148cD2b929ed85e69F697be13b515Bd0'
const REMARK_ADDRESS = process.env.REMARK_PROXY_ADDRESS || '0xe7c8244d80f4a3c2e4c8fe04197d38e87571df58'

let alchemyInstance: Alchemy | null = null

function getAlchemy(): Alchemy {
  if (!alchemyInstance) {
    alchemyInstance = new Alchemy({
      apiKey: process.env.ALCHEMY_API_KEY,
      network: Network.OPT_MAINNET,
    })
  }
  return alchemyInstance
}

// RemarkSaved event topic0
const REMARK_SAVED_TOPIC0 = keccak256(toUtf8Bytes('RemarkSaved(uint256,uint256,string,string,uint256)'))

function hashUuid(uuid: string): string {
  return keccak256(toUtf8Bytes(uuid))
}

interface RemarkEvent {
  txHash: string
  poolId: string
  taskId: string
  senderRemark: string
  receiverRemark: string
  timestamp: string
  blockNumber: number
}

// 按 taskId 精确查询 RemarkSaved 事件
export async function getRemarkByTaskId(taskId: string): Promise<RemarkEvent[]> {
  const alchemy = getAlchemy()
  const taskIdHash = hashUuid(taskId)

  const logs = await alchemy.core.getLogs({
    address: REMARK_ADDRESS,
    topics: [REMARK_SAVED_TOPIC0, null, taskIdHash],
    fromBlock: '0x0',
  })

  const iface = new (await import('ethers')).Interface(remarkSavedEventAbi)

  return logs.map((log) => {
    const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data })!
    return {
      txHash: log.transactionHash,
      poolId: parsed.args[0].toString(),
      taskId: parsed.args[1].toString(),
      senderRemark: parsed.args[2],
      receiverRemark: parsed.args[3],
      timestamp: parsed.args[4].toString(),
      blockNumber: log.blockNumber,
    }
  })
}

// 按 poolId 精确查询 RemarkSaved 事件（活动用）
export async function getRemarkByPoolId(poolId: string): Promise<RemarkEvent[]> {
  const alchemy = getAlchemy()
  const poolIdHash = hashUuid(poolId)

  const logs = await alchemy.core.getLogs({
    address: REMARK_ADDRESS,
    topics: [REMARK_SAVED_TOPIC0, poolIdHash],
    fromBlock: '0x0',
  })

  const iface = new (await import('ethers')).Interface(remarkSavedEventAbi)

  return logs.map((log) => {
    const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data })!
    return {
      txHash: log.transactionHash,
      poolId: parsed.args[0].toString(),
      taskId: parsed.args[1].toString(),
      senderRemark: parsed.args[2],
      receiverRemark: parsed.args[3],
      timestamp: parsed.args[4].toString(),
      blockNumber: log.blockNumber,
    }
  })
}

interface TransferDetail {
  from: string
  to: string
  value: string
  blockTimestamp: string
}

// 用 tx_hash 查同一笔交易的 ERC20 Transfer 详情
export async function getTransferByTxHash(txHash: string): Promise<TransferDetail | null> {
  const alchemy = getAlchemy()

  const receipt = await alchemy.core.getTransactionReceipt(txHash)
  if (!receipt) return null

  // Transfer event topic0
  const transferTopic0 = keccak256(toUtf8Bytes('Transfer(address,address,uint256)'))

  const transferLog = receipt.logs.find(
    (log) =>
      log.address.toLowerCase() === NT_TOKEN.toLowerCase() &&
      log.topics[0] === transferTopic0
  )

  if (!transferLog) return null

  // topics: [Transfer, from (indexed), to (indexed)]
  const from = '0x' + transferLog.topics[1].slice(26)
  const to = '0x' + transferLog.topics[2].slice(26)
  const value = BigInt(transferLog.data).toString()

  const block = await alchemy.core.getBlock(receipt.blockNumber)
  const blockTimestamp = block
    ? new Date(block.timestamp * 1000).toISOString()
    : new Date().toISOString()

  return { from, to, value, blockTimestamp }
}
