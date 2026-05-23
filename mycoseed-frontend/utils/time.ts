/**
 * 统一时间处理工具函数
 * 所有时间处理都基于 UTC，然后 +8 小时转换为北京时间（UTC+8）
 * 不受机器时区影响
 */

/**
 * 获取当前北京时间（UTC+8）
 * 返回 YYYY-MM-DDTHH:mm 格式的字符串
 */
export const getCurrentBeijingTime = (): string => {
  // 获取 UTC 时间戳
  const now = new Date()
  const utcTime = now.getTime()
  
  // 加上 8 小时得到北京时间
  const beijingTime = new Date(utcTime + 8 * 60 * 60 * 1000)
  
  // 使用 UTC 方法读取（因为已经手动偏移了 8 小时）
  const year = beijingTime.getUTCFullYear()
  const month = String(beijingTime.getUTCMonth() + 1).padStart(2, '0')
  const day = String(beijingTime.getUTCDate()).padStart(2, '0')
  const hour = String(beijingTime.getUTCHours()).padStart(2, '0')
  const minute = String(beijingTime.getUTCMinutes()).padStart(2, '0')
  
  return `${year}-${month}-${day}T${hour}:${minute}`
}

/**
 * 获取当前时间的 Date 对象（用于时间比较）
 * 返回 UTC 时间戳，用于与 parseBeijingTime 返回的 UTC 时间戳进行比较
 */
export const getCurrentBeijingDate = (): Date => {
  // 直接返回当前 UTC 时间戳，用于与 parseBeijingTime 返回的 UTC 时间戳比较
  return new Date()
}

/**
 * 将 YYYY-MM-DDTHH:mm 格式的字符串解析为 Date 对象
 * 将输入当作北京时间（UTC+8），转换为 UTC 时间戳
 * 用于时间比较，不受机器时区影响
 */
export const parseBeijingTime = (dateString: string | null | undefined): Date | null => {
  if (!dateString) return null
  
  // 去除时区后缀（Z, +08:00 等）
  const cleanDateString = dateString.replace(/Z$|[+-]\d{2}:?\d{2}$/, '')
  
  // 匹配 YYYY-MM-DDTHH:mm 格式
  const match = cleanDateString.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/)
  
  if (match) {
    const [_, year, month, day, hour, minute] = match.map(Number)
    // 将 YYYY-MM-DDTHH:mm 当作北京时间（UTC+8）
    // 使用 UTC 方法创建 Date 对象，然后减去 8 小时得到正确的 UTC 时间戳
    const utcDate = new Date(Date.UTC(year, month - 1, day, hour, minute))
    // 减去 8 小时（因为输入是 UTC+8 时间，需要转换为 UTC）
    return new Date(utcDate.getTime() - 8 * 60 * 60 * 1000)
  }
  
  // 兜底：尝试直接解析（向后兼容）
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return null
  return date
}

/**
 * 将 UTC 时间戳格式化为北京时间字符串 YYYY-MM-DDTHH:mm
 * 用于显示，不受机器时区影响
 */
export const formatBeijingTime = (timestamp: string | number | Date | null | undefined): string | undefined => {
  if (!timestamp) return undefined
  
  let date: Date
  if (timestamp instanceof Date) {
    date = timestamp
  } else if (typeof timestamp === 'number') {
    date = new Date(timestamp)
  } else {
    // 如果是字符串，先尝试解析
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(timestamp)) {
      // 已经是 YYYY-MM-DDTHH:mm 格式，直接返回
      return timestamp
    }
    date = new Date(timestamp)
  }
  
  if (isNaN(date.getTime())) {
    console.warn(`[formatBeijingTime] 无效的时间戳: ${timestamp}`)
    return undefined
  }
  
  // 加上 8 小时得到北京时间
  const beijingTime = new Date(date.getTime() + 8 * 60 * 60 * 1000)
  
  // 使用 UTC 方法读取（因为已经手动偏移了 8 小时）
  const year = beijingTime.getUTCFullYear()
  const month = String(beijingTime.getUTCMonth() + 1).padStart(2, '0')
  const day = String(beijingTime.getUTCDate()).padStart(2, '0')
  const hour = String(beijingTime.getUTCHours()).padStart(2, '0')
  const minute = String(beijingTime.getUTCMinutes()).padStart(2, '0')
  
  return `${year}-${month}-${day}T${hour}:${minute}`
}

