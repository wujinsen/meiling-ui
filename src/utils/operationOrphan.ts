/** 台账未绑定 server_id（孤儿记录） */
export function isOperationOrphan(serverId?: string | number | null) {
  return serverId == null || serverId === ''
}
