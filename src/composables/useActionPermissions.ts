import { computed, ref } from 'vue'
import { getCapabilitiesApi } from '@/api/auth'
import { API_SUCCESS_CODE } from '@/types/api'
import { showToast } from '@/composables/useToast'
import { getStoredCurrentSystem, getToken } from '@/utils/authSession'

const PERMISSIONS_KEY = 'meiling_permissions'
const FULL_PERMISSION_KEY = 'meiling_full_permission'
const PERMISSIONS_SYSTEM_KEY = 'meiling_permissions_system_id'
const PERMISSIONS_LOADED_KEY = 'meiling_permissions_loaded'
const PERMISSIONS_UPDATED_AT_KEY = 'meiling_permissions_updated_at'

/** 路由守卫等场景的默认缓存有效期（毫秒） */
const DEFAULT_PERMISSIONS_MAX_AGE_MS = 60_000

let refreshPromise: Promise<void> | null = null

const permissions = ref<string[]>(loadStoredPermissions())
const fullPermission = ref(loadStoredFullPermission())

function loadStoredPermissions(): string[] {
  if (!getToken() || sessionStorage.getItem(PERMISSIONS_LOADED_KEY) !== '1') return []
  const raw = sessionStorage.getItem(PERMISSIONS_KEY)
  if (!raw) return []
  try {
    return JSON.parse(raw) as string[]
  } catch {
    return []
  }
}

function loadStoredFullPermission(): boolean {
  if (!getToken() || sessionStorage.getItem(PERMISSIONS_LOADED_KEY) !== '1') return false
  return sessionStorage.getItem(FULL_PERMISSION_KEY) === '1'
}

/** 已写入过 permissions（含空数组），区别于「从未拉取」 */
function hasCachedPermissions(): boolean {
  return sessionStorage.getItem(PERMISSIONS_LOADED_KEY) === '1'
}

export function hasPermissionsPayload(
  list?: string[],
  full?: boolean,
): boolean {
  return list !== undefined || full !== undefined
}

export function savePermissions(list: string[] | undefined, full?: boolean) {
  const next = list ?? []
  permissions.value = next
  fullPermission.value = full === true
  sessionStorage.setItem(PERMISSIONS_KEY, JSON.stringify(next))
  sessionStorage.setItem(FULL_PERMISSION_KEY, fullPermission.value ? '1' : '0')
  sessionStorage.setItem(PERMISSIONS_LOADED_KEY, '1')
  sessionStorage.setItem(PERMISSIONS_UPDATED_AT_KEY, String(Date.now()))
  const current = getStoredCurrentSystem()
  if (current?.id != null) {
    sessionStorage.setItem(PERMISSIONS_SYSTEM_KEY, String(current.id))
  } else {
    sessionStorage.removeItem(PERMISSIONS_SYSTEM_KEY)
  }
}

export function clearActionPermissions() {
  permissions.value = []
  fullPermission.value = false
  sessionStorage.removeItem(PERMISSIONS_KEY)
  sessionStorage.removeItem(FULL_PERMISSION_KEY)
  sessionStorage.removeItem(PERMISSIONS_SYSTEM_KEY)
  sessionStorage.removeItem(PERMISSIONS_LOADED_KEY)
  sessionStorage.removeItem(PERMISSIONS_UPDATED_AT_KEY)
}

function permissionsCacheStale(maxAgeMs: number): boolean {
  const updatedAt = Number(sessionStorage.getItem(PERMISSIONS_UPDATED_AT_KEY) || 0)
  return !updatedAt || Date.now() - updatedAt > maxAgeMs
}

function permissionsSystemMatches(): boolean {
  const current = getStoredCurrentSystem()
  const cachedSystemId = sessionStorage.getItem(PERMISSIONS_SYSTEM_KEY)
  const currentId = current?.id != null ? String(current.id) : null
  return currentId === cachedSystemId || (!currentId && !cachedSystemId)
}

export function assertAction(code: string): boolean {
  if (fullPermission.value || permissions.value.includes(code) || permissions.value.includes('*:*:*')) {
    return true
  }
  return false
}

export function guardAction(code: string): boolean {
  if (assertAction(code)) return true
  showToast('error', '无权限操作')
  return false
}

/** 点击按钮前补拉权限（角色刚被改配时本地缓存可能过期） */
export async function guardActionWithRefresh(code: string): Promise<boolean> {
  if (assertAction(code)) return true
  try {
    await ensurePermissionsLoaded({ force: true })
  } catch {
    showToast('error', '无权限操作')
    return false
  }
  if (assertAction(code)) return true
  showToast('error', '无权限操作')
  return false
}

export async function refreshPermissions() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const result = await getCapabilitiesApi()
      if (result.code !== API_SUCCESS_CODE || !result.data) {
        throw new Error(result.msg || '加载权限失败')
      }
      savePermissions(result.data.permissions, result.data.fullPermission)
    })().finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

export async function ensurePermissionsLoaded(options?: {
  force?: boolean
  maxAgeMs?: number
}) {
  if (!getToken()) return

  const force = options?.force === true
  const maxAgeMs = options?.maxAgeMs ?? DEFAULT_PERMISSIONS_MAX_AGE_MS

  if (!force && hasCachedPermissions() && permissionsSystemMatches() && !permissionsCacheStale(maxAgeMs)) {
    return
  }

  await refreshPermissions()
}

export function setupPermissionsAutoRefresh() {
  if (typeof document === 'undefined') return

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !getToken()) return
    void ensurePermissionsLoaded({ maxAgeMs: 30_000 }).catch(() => {
      /* 静默失败，避免切回标签页时打断操作 */
    })
  })
}

export function initActionPermissions() {
  permissions.value = loadStoredPermissions()
  fullPermission.value = loadStoredFullPermission()
}

export function useActionPermissions() {
  return {
    permissions: computed(() => permissions.value),
    fullPermission: computed(() => fullPermission.value),
    savePermissions,
    clearActionPermissions,
    assertAction,
    guardAction,
    guardActionWithRefresh,
    refreshPermissions,
    ensurePermissionsLoaded,
  }
}
