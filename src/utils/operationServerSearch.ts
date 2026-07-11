export function resolveServerSearchParams(keyword: string) {
  const q = keyword.trim()
  if (!q) return {}
  if (q.includes('.') || /^\d{1,3}(\.\d{1,3}){0,3}$/.test(q)) {
    return { ip: q }
  }
  return { serverName: q }
}
