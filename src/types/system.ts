import type { MenuVo } from '@/types/api'
import type { SystemGroup } from '@/constants/systemGroup'

export type SsoMode = 'INTERNAL' | 'EXTERNAL'

export type SysSystem = {
  id?: number | string
  systemCode?: string
  systemName?: string
  baseUrl?: string
  icon?: string
  sort?: number
  status?: number
  ssoMode?: SsoMode | string
  entryPath?: string
  remark?: string
  systemGroup?: SystemGroup | string
  createTime?: string | number
  pageNum?: number
  pageSize?: number
}

export type SystemQuery = {
  pageNum?: number
  pageSize?: number
  systemName?: string
  systemCode?: string
  status?: number | ''
  systemGroup?: SystemGroup | string
}

export const SSO_MODE_OPTIONS: SsoMode[] = ['INTERNAL', 'EXTERNAL']

export function createEmptySystem(): SysSystem {
  return {
    systemCode: '',
    systemName: '',
    baseUrl: '',
    icon: '',
    sort: 0,
    status: 1,
    ssoMode: 'INTERNAL',
    entryPath: '/sso/login',
    remark: '',
    systemGroup: 'business',
  }
}

export type SystemVo = {
  id: number
  systemCode: string
  systemName: string
  baseUrl?: string
  icon?: string
  sort?: number
  ssoMode?: string
  isDefault?: boolean
  systemGroup?: SystemGroup | string
}

export type SystemEnterVo = {
  currentSystem: SystemVo
  menuVoList?: MenuVo[]
  redirectUrl?: string
  hubToken?: string
  permissions?: string[]
  fullPermission?: boolean
}

export type UserSystemVo = {
  userId?: number | string
  systemIds?: Array<number | string>
  systemList?: SysSystem[]
}
