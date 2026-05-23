import { Alchemy, Network, AssetTransfersCategory, SortingOrder } from 'alchemy-sdk'

const NT_TOKEN = '0x7563cb33148cD2b929ed85e69F697be13b515Bd0'

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

// 查两个地址之间的 NT 积分转账记录
export async function getNtTransfersBetween(
  senderAddress: string,
  receiverAddress: string
) {
  const alchemy = getAlchemy()

  // 查 sender 转出的记录
  const sendResult = await alchemy.core.getAssetTransfers({
    fromBlock: '0x0',
    excludeZeroValue: true,
    withMetadata: true,
    category: [AssetTransfersCategory.ERC20],
    fromAddress: senderAddress,
    contractAddresses: [NT_TOKEN],
    maxCount: 100,
    order: SortingOrder.DESCENDING,
  })

  // 过滤出转给 receiver 的记录
  const matched = sendResult.transfers.filter(
    (t) => t.to?.toLowerCase() === receiverAddress.toLowerCase()
  )

  return matched.map((t) => ({
    txHash: t.hash,
    from: t.from,
    to: t.to!,
    value: t.rawContract?.value || '0',
    blockTimestamp: t.metadata.blockTimestamp,
    category: t.category,
  }))
}
