export type BusinessType = 1 | 2 | 3 | 4 | 5 | 6

export type SysOperationLog = {
  id?: number | string
  title?: string
  businessType?: BusinessType | number
  methodName?: string
  requestMethod?: string
  userName?: string
  requestIp?: string
  requestUrl?: string
  requestParam?: string
  responseResult?: string
  status?: number
  createTime?: string | number
}

export type OperLogQuery = {
  pageNum?: number
  pageSize?: number
  title?: string
  userName?: string
  businessType?: number | ''
  status?: number | ''
}

export const BUSINESS_TYPE_OPTIONS: BusinessType[] = [1, 2, 3, 4, 5, 6]
