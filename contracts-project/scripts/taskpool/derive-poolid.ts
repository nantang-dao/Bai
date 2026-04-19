/**
 * Step0 对照：用 ethers 计算 poolId（uint256(keccak256(utf8(uuid))))。
 *
 * 用法：
 *   UUID=00000000-0000-0000-0000-000000000000 npm run taskpool:derive-poolid
 */
import { keccak256, toUtf8Bytes } from 'ethers'

const uuid = (process.env.UUID || '').trim()
if (!uuid) {
  console.error('请设置环境变量 UUID（canonical uuid string）')
  process.exit(1)
}

const h = keccak256(toUtf8Bytes(uuid))
const u = BigInt(h)

console.log('uuid:', uuid)
console.log('keccak:', h)
console.log('poolId(uint256):', u.toString())

