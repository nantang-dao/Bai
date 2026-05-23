import { defineStore } from 'pinia'

// Mock 链数据
const mockChain = {
    id: 10,
    name: 'OP Mainnet',
    nativeCurrency: {
        name: 'Ethereum',
        symbol: 'ETH',
        decimals: 18
    },
    rpcUrls: {
        default: {
            http: ['https://mainnet.optimism.io']
        }
    }
}

export const useChainStore = defineStore('chain', {
    state: () => ({
        chain: mockChain
    }),
    actions: {
        setChain(chain: any) {
            this.chain = chain
        }
    }
})
