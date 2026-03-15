// ==================== 响应缓存工具 ====================

interface CacheEntry<T> {
  data: T
  timestamp: number
  expiresAt: number
}

class ResponseCache {
  private cache: Map<string, CacheEntry<any>> = new Map()
  private defaultTTL: number = 5000 // 默认5秒缓存

  /**
   * 获取缓存数据
   * @param key 缓存键
   * @returns 缓存数据或 null
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) {
      return null
    }

    // 检查是否过期
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return null
    }

    return entry.data as T
  }

  /**
   * 设置缓存数据
   * @param key 缓存键
   * @param data 要缓存的数据
   * @param ttl 缓存时间（毫秒），默认5秒
   */
  set<T>(key: string, data: T, ttl: number = this.defaultTTL): void {
    const now = Date.now()
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + ttl
    })
  }

  /**
   * 删除缓存
   * @param key 缓存键
   */
  delete(key: string): void {
    this.cache.delete(key)
  }

  /**
   * 清除所有缓存
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * 清除过期的缓存
   */
  clearExpired(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key)
      }
    }
  }
}

// 导出单例
export const responseCache = new ResponseCache()

// 定期清理过期缓存（每30秒清理一次）
if (typeof window !== 'undefined') {
  setInterval(() => {
    responseCache.clearExpired()
  }, 30000)
}
