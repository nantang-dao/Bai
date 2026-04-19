/**
 * Express `res.json` / `JSON.stringify` 无法序列化 `bigint`（viem 解码事件参数常用 bigint）。
 * 将任意结构中的 bigint 转为十进制字符串，便于 HTTP JSON 响应。
 */
export function jsonSafe<T>(data: T): T {
  return JSON.parse(JSON.stringify(data, (_key, value) => (typeof value === 'bigint' ? value.toString() : value))) as T
}
