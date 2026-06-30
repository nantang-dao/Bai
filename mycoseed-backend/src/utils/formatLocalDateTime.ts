/** 将 DB 时间戳格式化为 YYYY-MM-DDTHH:mm（北京时间） */
export function formatLocalDateTime(timestamp: string | null | undefined): string | undefined {
  if (!timestamp) return undefined
  const date = new Date(timestamp)
  if (isNaN(date.getTime())) return undefined
  const beijingTime = new Date(date.getTime() + 8 * 60 * 60 * 1000)
  const year = beijingTime.getUTCFullYear()
  const month = String(beijingTime.getUTCMonth() + 1).padStart(2, '0')
  const day = String(beijingTime.getUTCDate()).padStart(2, '0')
  const hour = String(beijingTime.getUTCHours()).padStart(2, '0')
  const minute = String(beijingTime.getUTCMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hour}:${minute}`
}
