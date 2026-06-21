import { computed, ref } from 'vue'
import { enterSystemApi, mySystemsApi, switchSystemApi } from '@/api/system'
import {
  ensurePermissionsLoaded,
  hasPermissionsPayload,
  savePermissions,
} from '@/composables/useActionPermissions'
import { loadDynamicRoutes, resetDynamicRoutes, getPermissionMenus } from '@/composables/usePermission'
import { resetPageTabs } from '@/composables/usePageTabs'
import type { LoginVo } from '@/types/api'
import { API_SUCCESS_CODE } from '@/types/api'
import type { SystemVo } from '@/types/system'
import { resolveDefaultPath } from '@/router/routeGenerator'
import {
  clearMenus,
  getStoredCurrentSystem,
  getStoredSystemList,
  isPortalEnabledStored,
  saveCurrentSystem,
  savePortalEnabled,
  saveSystemList,
} from '@/utils/authSession'

export type PortalSyncResult = {
  /** 当前会话是否仍可停留在业务页（已选系统且仍在授权列表中） */
  allowed: boolean
  noSystems?: boolean
}

const systemList = ref<SystemVo[]>(getStoredSystemList())
const currentSystem = ref<SystemVo | null>(getStoredCurrentSystem())
const portalEnabled = ref(isPortalEnabledStored())

let syncPromise: Promise<PortalSyncResult> | null = null

export function initSystemPortal() {
  systemList.value = getStoredSystemList()
  currentSystem.value = getStoredCurrentSystem()
  portalEnabled.value = isPortalEnabledStored()
}

export function useSystemPortal() {
  const hasMultipleSystems = computed(() => systemList.value.length > 1)
  const showSwitcher = computed(() => portalEnabled.value && systemList.value.length > 0)

  function persistPortalState(list: SystemVo[], current: SystemVo | null, enabled: boolean) {
    systemList.value = list
    currentSystem.value = current
    portalEnabled.value = enabled
    saveSystemList(list)
    saveCurrentSystem(current)
    savePortalEnabled(enabled)
  }

  async function applyEnterResult(data: {
    currentSystem: SystemVo
    menuVoList?: import('@/types/api').MenuVo[]
    redirectUrl?: string
    permissions?: string[]
    fullPermission?: boolean
  }) {
    if (data.redirectUrl) {
      window.location.href = data.redirectUrl
      return 'external' as const
    }
    persistPortalState(systemList.value, data.currentSystem, portalEnabled.value)
    if (hasPermissionsPayload(data.permissions, data.fullPermission)) {
      savePermissions(data.permissions, data.fullPermission)
    }
    await resetDynamicRoutes()
    resetPageTabs()
    try {
      await Promise.all([
        hasPermissionsPayload(data.permissions, data.fullPermission)
          ? Promise.resolve()
          : ensurePermissionsLoaded(),
        loadDynamicRoutes(true),
      ])
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : '加载系统菜单失败')
    }
    return 'internal' as const
  }

  /** 登录成功后决定跳转路径 */
  async function handlePostLogin(loginData: LoginVo): Promise<string> {
    clearMenus()
    const enabled = loginData.systemPortalEnabled === true
    const list = loginData.systemList ?? []
    persistPortalState(list, loginData.currentSystem ?? null, enabled)

    const hasPayload = hasPermissionsPayload(loginData.permissions, loginData.fullPermission)
    if (hasPayload) {
      savePermissions(loginData.permissions, loginData.fullPermission)
    }

    if (!enabled) {
      await resetDynamicRoutes()
      await Promise.all([
        hasPayload ? Promise.resolve() : ensurePermissionsLoaded(),
        loadDynamicRoutes(true),
      ])
      return '/'
    }

    if (!list.length) {
      throw new Error('NO_SYSTEM_ASSIGNED')
    }

    if (loginData.currentSystem) {
      await resetDynamicRoutes()
      await Promise.all([
        hasPayload ? Promise.resolve() : ensurePermissionsLoaded(),
        loadDynamicRoutes(true),
      ])
      return resolveDefaultPath(getPermissionMenus())
    }

    return '/system-select'
  }

  async function enterSystem(systemId: number | string) {
    const result = await enterSystemApi(systemId)
    if (result.code !== API_SUCCESS_CODE || !result.data) {
      throw new Error(result.msg || '进入系统失败')
    }
    const mode = await applyEnterResult(result.data)
    if (mode === 'external') return result.data.redirectUrl!
    return resolveDefaultPath(getPermissionMenus())
  }

  async function switchToSystem(systemId: number | string) {
    const result = await switchSystemApi(systemId)
    if (result.code !== API_SUCCESS_CODE || !result.data) {
      throw new Error(result.msg || '切换系统失败')
    }
    const mode = await applyEnterResult(result.data)
    if (mode === 'external') return result.data.redirectUrl!
    return resolveDefaultPath(getPermissionMenus())
  }

  async function refreshSystemList() {
    const result = await mySystemsApi()
    if (result.code === API_SUCCESS_CODE && result.data) {
      systemList.value = result.data
      saveSystemList(result.data)
    }
    return systemList.value
  }

  /** 与后端同步可访问系统；当前系统被收回时清空本地会话并返回 allowed=false */
  async function syncPortalAccess(force = false): Promise<PortalSyncResult> {
    if (!portalEnabled.value && !isPortalEnabledStored()) {
      return { allowed: true }
    }

    if (!force && syncPromise) return syncPromise

    const run = async (): Promise<PortalSyncResult> => {
      try {
        const result = await mySystemsApi()
        if (result.code !== API_SUCCESS_CODE) {
          const current = currentSystem.value ?? getStoredCurrentSystem()
          if (!current) return { allowed: true }
          const cached = systemList.value.length ? systemList.value : getStoredSystemList()
          const stillAllowed = cached.some((item) => String(item.id) === String(current.id))
          return { allowed: stillAllowed, noSystems: !cached.length }
        }

        const list = result.data ?? []
        systemList.value = list
        saveSystemList(list)

        const current = currentSystem.value ?? getStoredCurrentSystem()
        if (!current) {
          return { allowed: true, noSystems: !list.length }
        }

        const freshCurrent = list.find((item) => String(item.id) === String(current.id))
        if (!freshCurrent) {
          persistPortalState(list, null, true)
          clearMenus()
          await resetDynamicRoutes()
          resetPageTabs()
          return { allowed: false, noSystems: !list.length }
        }

        persistPortalState(list, freshCurrent, true)
        return { allowed: true, noSystems: !list.length }
      } catch {
        return { allowed: true }
      }
    }

    syncPromise = run()
    try {
      return await syncPromise
    } finally {
      syncPromise = null
    }
  }

  function clearPortalState() {
    persistPortalState([], null, false)
  }

  return {
    systemList,
    currentSystem,
    portalEnabled,
    hasMultipleSystems,
    showSwitcher,
    handlePostLogin,
    enterSystem,
    switchToSystem,
    refreshSystemList,
    syncPortalAccess,
    clearPortalState,
  }
}
