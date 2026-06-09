import type { MenuVo, SysUser } from '@/types/api'

const TOKEN_KEY = 'meiling_token'
const USER_KEY = 'meiling_user'
const MENU_KEY = 'meiling_menus'

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

export function clearAuthSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
  clearMenus()
}
