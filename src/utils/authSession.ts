import type { MenuVo, SysUser } from '@/types/api'
import type { SystemVo } from '@/types/system'

const TOKEN_KEY = 'meiling_token'
const USER_KEY = 'meiling_user'
const MENU_KEY = 'meiling_menus'
const SYSTEM_LIST_KEY = 'meiling_system_list'
const CURRENT_SYSTEM_KEY = 'meiling_current_system'
const PORTAL_ENABLED_KEY = 'meiling_portal_enabled'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function getStoredUser(): SysUser | null {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as SysUser
  } catch {
    return null
  }
}

export function saveAuthSession(token: string, user: SysUser) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function getStoredMenus(): MenuVo[] {
  const raw = localStorage.getItem(MENU_KEY)
  if (!raw) return []
  try {
    return JSON.parse(raw) as MenuVo[]
  } catch {
    return []
  }
}

export function saveMenus(menus: MenuVo[]) {
  localStorage.setItem(MENU_KEY, JSON.stringify(menus))
}

export function clearMenus() {
  localStorage.removeItem(MENU_KEY)
}

export function getStoredSystemList(): SystemVo[] {
  const raw = localStorage.getItem(SYSTEM_LIST_KEY)
  if (!raw) return []
  try {
    return JSON.parse(raw) as SystemVo[]
  } catch {
    return []
  }
}

export function saveSystemList(systems: SystemVo[]) {
  localStorage.setItem(SYSTEM_LIST_KEY, JSON.stringify(systems))
}

export function getStoredCurrentSystem(): SystemVo | null {
  const raw = localStorage.getItem(CURRENT_SYSTEM_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as SystemVo
  } catch {
    return null
  }
}

export function saveCurrentSystem(system: SystemVo | null) {
  if (!system) {
    localStorage.removeItem(CURRENT_SYSTEM_KEY)
    return
  }
  localStorage.setItem(CURRENT_SYSTEM_KEY, JSON.stringify(system))
}

export function isPortalEnabledStored(): boolean {
  return localStorage.getItem(PORTAL_ENABLED_KEY) === '1'
}

export function savePortalEnabled(enabled: boolean) {
  if (enabled) {
    localStorage.setItem(PORTAL_ENABLED_KEY, '1')
  } else {
    localStorage.removeItem(PORTAL_ENABLED_KEY)
  }
}

export function clearSystemPortalSession() {
  localStorage.removeItem(SYSTEM_LIST_KEY)
  localStorage.removeItem(CURRENT_SYSTEM_KEY)
  localStorage.removeItem(PORTAL_ENABLED_KEY)
}

export function clearAuthSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
  clearMenus()
  clearSystemPortalSession()
  sessionStorage.removeItem('meiling_permissions')
  sessionStorage.removeItem('meiling_full_permission')
  sessionStorage.removeItem('meiling_permissions_system_id')
  sessionStorage.removeItem('meiling_permissions_loaded')
}
