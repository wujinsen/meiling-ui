import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { listActionsByMenuApi, type ActionVo } from '@/api/action'
import { getMenuTreeAllApi } from '@/api/menu'
import {
  getRoleApi,
  getRoleAuthApi,
  getRoleAuthMenuTreeApi,
  updateRoleApi,
} from '@/api/role'
import { guardActionWithRefresh } from '@/composables/useActionPermissions'
import { showToast } from '@/composables/useToast'
import { PERM } from '@/constants/permissions'
import { useTreeExpand } from '@/composables/useTreeExpand'
import { useTreeCheck } from '@/composables/useTreeCheck'
import { API_SUCCESS_CODE, type MenuVo } from '@/types/api'
import { createEmptyRole, type RoleVo } from '@/types/role'
import { collectTreeIds, flattenVisibleTree } from '@/utils/tree'

export type MenuTreeNode = MenuVo & { children?: MenuTreeNode[] }

export type ActionPanel = {
  menuId: string
  menuName: string
  actions: ActionVo[]
  scopeMenuIds?: string[]
}

function collectPageMenuIdsUnder(nodes: MenuTreeNode[]): string[] {
  const ids: string[] = []
  const walk = (list: MenuTreeNode[]) => {
    for (const node of list) {
      if (isPageMenu(node)) ids.push(String(node.id))
      if (node.children?.length) walk(node.children)
    }
  }
  walk(nodes)
  return ids
}

export function isPageMenu(node: MenuTreeNode) {
  return String(node.menuType ?? '').toUpperCase() === 'C'
}

function normalizeMenuTree(nodes: MenuVo[]): MenuTreeNode[] {
  return nodes.map((node) => ({
    ...node,
    children: node.children?.length ? normalizeMenuTree(node.children) : undefined,
  }))
}

export function useRolePermAssign() {
  const { t } = useI18n()

  const loading = ref(false)
  const saving = ref(false)
  const roleForm = ref<RoleVo>(createEmptyRole())
  const menuTree = ref<MenuTreeNode[]>([])
  const {
    expanded: menuExpanded,
    isFullyCollapsed,
    treeExpandLabel,
    toggleExpand: toggleMenuExpand,
    expandAll: expandAllMenus,
    toggleTreeExpand,
  } = useTreeExpand()
  const {
    checked: checkedMenuIds,
    isFullyUnchecked,
    treeCheckLabel,
    toggleTreeCheck,
  } = useTreeCheck()

  const actionPanelsLoading = ref(false)
  const checkedActionCodes = ref(new Set<string>())
  const actionPanels = ref<ActionPanel[]>([])
  const activePermMenuId = ref<string | null>(null)

  const autoGrantActionsOnCheck = ref(
    sessionStorage.getItem('meiling_role_auto_grant_actions') !== '0',
  )

  const flatMenuRows = computed(() => flattenVisibleTree(menuTree.value, menuExpanded.value))

  const hasCheckedCPage = computed(() => {
    let found = false
    const walk = (nodes: MenuTreeNode[]) => {
      for (const node of nodes) {
        if (isPageMenu(node) && checkedMenuIds.value.has(String(node.id))) found = true
        if (node.children?.length) walk(node.children)
      }
    }
    walk(menuTree.value)
    return found
  })

  const checkedCPageNames = computed(() => {
    const names: string[] = []
    const walk = (nodes: MenuTreeNode[]) => {
      for (const node of nodes) {
        if (isPageMenu(node) && checkedMenuIds.value.has(String(node.id))) {
          names.push(node.menuName ?? String(node.id))
        }
        if (node.children?.length) walk(node.children)
      }
    }
    walk(menuTree.value)
    return names
  })

  const activeActionPanel = computed(
    () => actionPanels.value.find((p) => p.menuId === activePermMenuId.value) ?? null,
  )

  function panelIsActive(panel: ActionPanel) {
    if (panel.scopeMenuIds?.length) {
      return panel.scopeMenuIds.some((id) => checkedMenuIds.value.has(id))
    }
    return checkedMenuIds.value.has(panel.menuId)
  }

  function countSelectedActionsForMenu(menuId: string) {
    const panel = actionPanels.value.find((p) => p.menuId === menuId)
    if (!panel) return 0
    return panel.actions.filter((a) => checkedActionCodes.value.has(a.permCode)).length
  }

  function ensureActivePermMenu() {
    if (activePermMenuId.value && actionPanels.value.some((p) => p.menuId === activePermMenuId.value)) {
      return
    }
    activePermMenuId.value = actionPanels.value[0]?.menuId ?? null
  }

  function persistAutoGrantPreference() {
    sessionStorage.setItem('meiling_role_auto_grant_actions', autoGrantActionsOnCheck.value ? '1' : '0')
  }

  function syncActionsWithPageCheck() {
    const next = new Set(checkedActionCodes.value)
    for (const panel of actionPanels.value) {
      if (panelIsActive(panel)) {
        for (const action of panel.actions) next.add(action.permCode)
      } else {
        for (const action of panel.actions) next.delete(action.permCode)
      }
    }
    checkedActionCodes.value = next
  }

  function removeActionsForUncheckedPages() {
    const next = new Set(checkedActionCodes.value)
    for (const panel of actionPanels.value) {
      if (!panelIsActive(panel)) {
        for (const action of panel.actions) next.delete(action.permCode)
      }
    }
    checkedActionCodes.value = next
  }

  function grantAllActionsForCheckedPages() {
    const next = new Set(checkedActionCodes.value)
    for (const panel of actionPanels.value) {
      for (const action of panel.actions) next.add(action.permCode)
    }
    checkedActionCodes.value = next
  }

  function clearAllActionsForCheckedPages() {
    const remove = new Set(actionPanels.value.flatMap((p) => p.actions.map((a) => a.permCode)))
    checkedActionCodes.value = new Set([...checkedActionCodes.value].filter((c) => !remove.has(c)))
  }

  function toggleActionCheck(code: string, checked: boolean) {
    const next = new Set(checkedActionCodes.value)
    if (checked) next.add(code)
    else next.delete(code)
    checkedActionCodes.value = next
  }

  function toggleAllActionsForPanel(panel: ActionPanel, select: boolean) {
    const next = new Set(checkedActionCodes.value)
    for (const action of panel.actions) {
      if (select) next.add(action.permCode)
      else next.delete(action.permCode)
    }
    checkedActionCodes.value = next
  }

  function toggleAllActionsForActivePage(select: boolean) {
    const panel = activeActionPanel.value
    if (!panel) return
    toggleAllActionsForPanel(panel, select)
  }

  async function loadActionPanels() {
    actionPanelsLoading.value = true
    const panels: ActionPanel[] = []
    const panelMenuIds = new Set<string>()
    try {
      const walk = async (nodes: MenuTreeNode[]) => {
        for (const node of nodes) {
          const id = String(node.id)
          if (isPageMenu(node) && checkedMenuIds.value.has(id)) {
            try {
              const result = await listActionsByMenuApi(node.id!)
              if (result.code === API_SUCCESS_CODE && result.data?.length) {
                panels.push({
                  menuId: id,
                  menuName: node.menuName ?? id,
                  actions: result.data,
                })
                panelMenuIds.add(id)
              }
            } catch {
              /* ignore single page failure */
            }
          }
          const children = node.children ?? []
          if (children.length) {
            const scopeIds = collectPageMenuIdsUnder(children).filter((cid) => checkedMenuIds.value.has(cid))
            if (!isPageMenu(node) && scopeIds.length) {
              try {
                const result = await listActionsByMenuApi(node.id!)
                if (result.code === API_SUCCESS_CODE && result.data?.length && !panelMenuIds.has(id)) {
                  panels.push({
                    menuId: id,
                    menuName: `${node.menuName ?? id} · ${t('system.role.dirActions')}`,
                    actions: result.data,
                    scopeMenuIds: scopeIds,
                  })
                  panelMenuIds.add(id)
                }
              } catch {
                /* ignore */
              }
            }
            await walk(children)
          }
        }
      }
      await walk(menuTree.value)
      actionPanels.value = panels
      const validCodes = new Set(panels.flatMap((p) => p.actions.map((a) => a.permCode)))
      checkedActionCodes.value = new Set([...checkedActionCodes.value].filter((c) => validCodes.has(c)))
      ensureActivePermMenu()
    } finally {
      actionPanelsLoading.value = false
    }
  }

  function collectMenuIdsForSave(): (number | string)[] {
    const ids = new Set(checkedMenuIds.value)
    const walk = (nodes: MenuTreeNode[], ancestors: string[]) => {
      for (const node of nodes) {
        const id = String(node.id)
        const children = node.children ?? []
        if (children.length) walk(children, [...ancestors, id])
        const hasCheckedDescendant = collectTreeIds(children).some((cid) => ids.has(cid))
        if (ids.has(id) || hasCheckedDescendant) {
          ids.add(id)
          ancestors.forEach((aid) => ids.add(aid))
        }
      }
    }
    walk(menuTree.value, [])
    return [...ids]
  }

  async function loadRoleAuthMenuTree() {
    const fromRole = await getRoleAuthMenuTreeApi()
    if (fromRole.code === API_SUCCESS_CODE && fromRole.data) {
      return fromRole
    }
    return getMenuTreeAllApi()
  }

  async function applyActionSyncAfterMenuChange(focusMenuId?: string) {
    await loadActionPanels()
    if (autoGrantActionsOnCheck.value) {
      syncActionsWithPageCheck()
    } else {
      removeActionsForUncheckedPages()
    }
    if (focusMenuId && checkedMenuIds.value.has(focusMenuId)) {
      activePermMenuId.value = focusMenuId
    } else {
      ensureActivePermMenu()
    }
  }

  async function toggleMenuCheck(row: MenuTreeNode, checked: boolean) {
    const next = new Set(checkedMenuIds.value)
    const id = String(row.id)
    if (checked) next.add(id)
    else next.delete(id)
    const descendants = collectTreeIds(row.children ?? [])
    for (const desc of descendants) {
      if (checked) next.add(desc)
      else next.delete(desc)
    }
    checkedMenuIds.value = next
    await applyActionSyncAfterMenuChange(checked && isPageMenu(row) ? id : undefined)
  }

  async function onToggleTreeCheckAll() {
    const selectAll = isFullyUnchecked.value
    toggleTreeCheck(menuTree.value)
    await loadActionPanels()
    if (selectAll && autoGrantActionsOnCheck.value) {
      grantAllActionsForCheckedPages()
    } else if (!selectAll) {
      clearAllActionsForCheckedPages()
    } else {
      removeActionsForUncheckedPages()
    }
  }

  function selectPermMenu(row: MenuTreeNode) {
    if (!isPageMenu(row)) return
    const id = String(row.id)
    if (!checkedMenuIds.value.has(id)) return
    if (!actionPanels.value.some((p) => p.menuId === id)) return
    activePermMenuId.value = id
  }

  function scrollToPermPanel(menuId: string) {
    activePermMenuId.value = menuId
    const el = document.getElementById(`role-perm-panel-${menuId}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function resetState() {
    roleForm.value = createEmptyRole()
    menuTree.value = []
    checkedMenuIds.value = new Set()
    checkedActionCodes.value = new Set()
    actionPanels.value = []
    activePermMenuId.value = null
  }

  async function loadMenuTreeFallback() {
    const result = await loadRoleAuthMenuTree()
    if (result.code === API_SUCCESS_CODE && result.data) {
      menuTree.value = normalizeMenuTree(result.data)
      expandAllMenus(menuTree.value)
    }
  }

  async function loadForRole(roleId: number | string) {
    loading.value = true
    try {
      const roleIdStr = String(roleId)
      const [treeResult, authResult, roleResult] = await Promise.all([
        loadRoleAuthMenuTree(),
        getRoleAuthApi(roleIdStr),
        getRoleApi(roleIdStr),
      ])
      if (treeResult.code !== API_SUCCESS_CODE || treeResult.data == null) {
        throw new Error(treeResult.msg || t('system.role.menuTreeFailed'))
      }
      if (authResult.code !== API_SUCCESS_CODE || !authResult.data) {
        throw new Error(authResult.msg || t('system.role.authLoadFailed'))
      }
      if (roleResult.code !== API_SUCCESS_CODE || !roleResult.data) {
        throw new Error(roleResult.msg || t('system.role.loadFailed'))
      }
      menuTree.value = normalizeMenuTree(treeResult.data)
      checkedMenuIds.value = new Set((authResult.data.menuIds ?? []).map(String))
      checkedActionCodes.value = new Set(authResult.data.actionCodes ?? [])
      expandAllMenus(menuTree.value)
      roleForm.value = { ...roleResult.data }
      await loadActionPanels()
    } finally {
      loading.value = false
    }
  }

  async function submitPermissions() {
    if (!(await guardActionWithRefresh(PERM.ROLE_ASSIGN_PERM))) return false
    if (!roleForm.value.id) return false

    saving.value = true
    try {
      const payload: RoleVo = {
        ...roleForm.value,
        menuIds: collectMenuIdsForSave(),
        actionCodes: [...checkedActionCodes.value],
      }
      const result = await updateRoleApi(payload)
      if (result.code !== API_SUCCESS_CODE) {
        throw new Error(result.msg || t('system.role.saveFailed'))
      }
      showToast('success', t('system.role.permOk'))
      return true
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : t('system.role.saveFailed'))
      return false
    } finally {
      saving.value = false
    }
  }

  return {
    loading,
    saving,
    roleForm,
    menuTree,
    menuExpanded,
    isFullyCollapsed,
    treeExpandLabel,
    toggleMenuExpand,
    expandAllMenus,
    toggleTreeExpand,
    checkedMenuIds,
    isFullyUnchecked,
    treeCheckLabel,
    actionPanelsLoading,
    checkedActionCodes,
    actionPanels,
    activePermMenuId,
    autoGrantActionsOnCheck,
    flatMenuRows,
    hasCheckedCPage,
    checkedCPageNames,
    activeActionPanel,
    countSelectedActionsForMenu,
    persistAutoGrantPreference,
    grantAllActionsForCheckedPages,
    clearAllActionsForCheckedPages,
    toggleActionCheck,
    toggleAllActionsForActivePage,
    toggleAllActionsForPanel,
    toggleMenuCheck,
    onToggleTreeCheckAll,
    selectPermMenu,
    scrollToPermPanel,
    resetState,
    loadMenuTreeFallback,
    loadForRole,
    submitPermissions,
  }
}
