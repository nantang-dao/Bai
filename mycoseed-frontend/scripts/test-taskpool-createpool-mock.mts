import assert from 'node:assert/strict'
import { createPoolAndPersist } from '../utils/taskpool/createPoolAndPersist'

let persisted: string | null = null
let created = false

const { txHash } = await createPoolAndPersist({
  createOnchain: async () => {
    created = true
    return '0x' + '11'.repeat(32) as `0x${string}`
  },
  persist: async (h) => {
    persisted = h
  },
})

assert.equal(created, true, 'should call createOnchain')
assert.equal(persisted, txHash, 'should persist same txHash')
assert.match(txHash, /^0x[0-9a-fA-F]{64}$/)

console.log('[taskpool] createPool mock: OK')

