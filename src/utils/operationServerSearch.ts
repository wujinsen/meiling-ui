export function resolveServerSearchParams(keyword: string) {
  const q = keyword.trim()
  if (!q) return {}
  if (q.includes('.') || /^\d{1,3}(\.\d{1,3}){0,3}$/.test(q)) {
    return { ip: q }
  }
  return { serverName: q }
}

/** 客户端过滤：名称或 IP 包含关键字（不区分大小写） */
export function matchesServerKeyword(
  srv: { serverName?: string | null; ip?: string | null; innerIp?: string | null },
  keyword: string,
) {
  const q = keyword.trim().toLowerCase()
  if (!q) return true
  const name = (srv.serverName || '').toLowerCase()
  const ip = (srv.innerIp || srv.ip || '').toLowerCase()
  return name.includes(q) || ip.includes(q)
}
