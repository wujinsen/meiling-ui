export type SysLoginLog = {
  id?: number | string
  userName?: string
  ipAddress?: string
  loginAddress?: string
  browser?: string
  os?: string
  status?: number
  remark?: string
  loginTime?: string | number
}

export type LoginLogQuery = {
  pageNum?: number
  pageSize?: number
  userName?: string
  status?: number | ''
}
