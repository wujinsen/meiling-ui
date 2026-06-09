<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { getMenuTreeAllApi, selectMenuTreeByRoleIdApi } from '@/api/menu'
import {
  addRoleApi,
  changeRoleStatusApi,
  deleteRoleApi,
  getRoleApi,
  listRoleApi,
  updateRoleApi,
} from '@/api/role'
import {
  addUserRoleApi,
  getUserByRoleApi,
  removeUsersFromRoleApi,
  unauthorizedUsersApi,
} from '@/api/user'
import AppModal from '@/components/ui/AppModal.vue'
import FormField from '@/components/ui/FormField.vue'
import AppStatusPill from '@/components/ui/AppStatusPill.vue'
import { confirm } from '@/composables/useConfirm'
import { showToast } from '@/composables/useToast'
import { useTreeExpand } from '@/composables/useTreeExpand'
import { useTreeCheck } from '@/composables/useTreeCheck'
import AppPagination from '@/components/ui/AppPagination.vue'
import { API_SUCCESS_CODE, type MenuVo } from '@/types/api'
import { createEmptyRole, type RoleQuery, type RoleVo, type SysRole } from '@/types/role'
import type { UserVo } from '@/types/user'
import { collectTreeIds, flattenVisibleTree } from '@/utils/tree'
import { ChevronDown, ChevronRight, CheckSquare, FoldVertical, Pencil, Plus, RefreshCw, Search, Shield, Square, Trash2, UnfoldVertical, UserPlus, Users } from 'lucide-vue-next'

type MenuTreeNode = MenuVo & { children?: MenuTreeNode[] }

function normalizeMenuTree(nodes: MenuVo[]): MenuTreeNode[] {
  return nodes.map((node) => ({
    ...node,
    children: node.children?.length ? normalizeMenuTree(node.children) : undefined,
  }))
}

const { t } = useI18n()

const loading = ref(false)
const saving = ref(false)
const roleList = ref<SysRole[]>([])
const total = ref(0)
const modalOpen = ref(false)
const permOpen = ref(false)
const userAssignOpen = ref(false)
const modalTitle = ref('')
const form = ref<RoleVo>(createEmptyRole())
const isEdit = computed(() => form.value.id != null)

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

const query = reactive({
  pageNum: 1,
  pageSize: 10,
  roleName: '',
  status: '' as RoleQuery['status'],
})

const flatMenuRows = computed(() => flattenVisibleTree(menuTree.value, menuExpanded.value))

const assignRoleId = ref<number | string | null>(null)
const assignRoleName = ref('')
const authorizedLoading = ref(false)
const unauthorizedLoading = ref(false)
const authorizedUsers = ref<UserVo[]>([])
const unauthorizedUsers = ref<UserVo[]>([])
const authorizedTotal = ref(0)
const unauthorizedTotal = ref(0)
const selectedAuthorizedIds = ref(new Set<string>())
const selectedUnauthorizedIds = ref(new Set<string>())
const userAssignSaving = ref(false)

const authorizedQuery = reactive({
  pageNum: 1,
  pageSize: 8,
  userName: '',
})

const unauthorizedQuery = reactive({
  pageNum: 1,
  pageSize: 8,
  userName: '',
})

function formatTime(value?: string | number) {
  if (value == null || value === '') return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString()
}

function isProtectedRole(row: SysRole) {
  return String(row.id) === '1'
}

function searchRoles() {
  if (query.pageNum === 1) loadRoles()
  else query.pageNum = 1
}

function resetQuery() {
  query.roleName = ''
  query.status = ''
  searchRoles()
}

async function loadRoles() {
  loading.value = true
  try {
    const result = await listRoleApi({
      pageNum: query.pageNum,
      pageSize: query.pageSize,
      roleName: query.roleName || undefined,
      status: query.status === '' ? undefined : query.status,
    })
    if (result.code !== API_SUCCESS_CODE || !result.data) {
      throw new Error(result.msg || t('system.role.loadFailed'))
    }
    roleList.value = result.data.list ?? []
    total.value = result.data.total ?? 0
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.role.loadFailed'))
  } finally {
    loading.value = false
  }
}

function openCreate() {
  form.value = createEmptyRole()
  modalTitle.value = t('system.role.add')
  modalOpen.value = true
}

async function openEdit(row: SysRole) {
  try {
    const result = await getRoleApi(row.id!)
    if (result.code !== API_SUCCESS_CODE || !result.data) {
      throw new Error(result.msg || t('system.role.loadFailed'))
    }
    form.value = { ...result.data }
    modalTitle.value = t('system.role.edit')
    modalOpen.value = true
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.role.loadFailed'))
  }
}

function closeModal() {
  modalOpen.value = false
  form.value = createEmptyRole()
}

function validateForm() {
  if (!form.value.roleName?.trim()) return t('system.role.roleNameRequired')
  if (form.value.orderNum == null || String(form.value.orderNum) === '') return t('system.role.orderRequired')
  return null
}

async function submitForm() {
  const error = validateForm()
  if (error) {
    showToast('error', error)
    return
  }

  saving.value = true
  try {
    const payload: RoleVo = {
      ...form.value,
      roleName: form.value.roleName!.trim(),
      orderNum: form.value.orderNum,
      status: Number(form.value.status ?? 1),
      remark: form.value.remark?.trim() || undefined,
    }

    if (!isEdit.value) {
      payload.menuIds = []
    }

    const result = isEdit.value ? await updateRoleApi(payload) : await addRoleApi(payload)
    if (result.code !== API_SUCCESS_CODE) {
      throw new Error(result.msg || t('system.role.saveFailed'))
    }

    showToast('success', isEdit.value ? t('system.role.updateOk') : t('system.role.createOk'))
    closeModal()
    await loadRoles()
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.role.saveFailed'))
  } finally {
    saving.value = false
  }
}

async function removeRole(row: SysRole) {
  if (isProtectedRole(row)) return
  if (!(await confirm({ message: t('system.role.deleteConfirm', { name: row.roleName }) }))) return

  try {
    const result = await deleteRoleApi(row.id!)
    if (result.code !== API_SUCCESS_CODE) {
      throw new Error(result.msg || t('system.role.deleteFailed'))
    }
    showToast('success', t('system.role.deleteOk'))
    await loadRoles()
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.role.deleteFailed'))
  }
}

async function toggleStatus(row: SysRole) {
  if (isProtectedRole(row)) return
  const nextStatus = row.status === 1 ? 0 : 1
  const action = nextStatus === 1 ? t('system.role.enable') : t('system.role.disable')
  if (!(await confirm({ message: t('system.role.statusConfirm', { action, name: row.roleName }), danger: false }))) return

  try {
    const result = await changeRoleStatusApi(row.id!, nextStatus)
    if (result.code !== API_SUCCESS_CODE) {
      throw new Error(result.msg || t('system.role.statusFailed'))
    }
    row.status = nextStatus
    showToast('success', t('system.role.statusOk'))
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.role.statusFailed'))
  }
}

function toggleMenuCheck(row: MenuTreeNode, checked: boolean) {
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
}

function collectMenuIdsForSave(): number[] {
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

  return [...ids].map((id) => Number(id)).filter((id) => !Number.isNaN(id))
}

async function openPermissions(row: SysRole) {
  try {
    const [treeResult, roleResult] = await Promise.all([
      selectMenuTreeByRoleIdApi(row.id!),
      getRoleApi(row.id!),
    ])
    if (treeResult.code !== API_SUCCESS_CODE || !treeResult.data) {
      throw new Error(treeResult.msg || t('system.role.loadFailed'))
    }
    if (roleResult.code !== API_SUCCESS_CODE || !roleResult.data) {
      throw new Error(roleResult.msg || t('system.role.loadFailed'))
    }

    menuTree.value = normalizeMenuTree(treeResult.data)
    const menuIds = treeResult.data[0]?.menuIds ?? []
    checkedMenuIds.value = new Set(menuIds.map(String))
    expandAllMenus(menuTree.value)

    form.value = { ...roleResult.data }
    modalTitle.value = t('system.role.assignPerm')
    permOpen.value = true
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.role.loadFailed'))
  }
}

async function loadMenuTreeFallback() {
  const result = await getMenuTreeAllApi()
  if (result.code === API_SUCCESS_CODE && result.data) {
    menuTree.value = normalizeMenuTree(result.data)
    expandAllMenus(menuTree.value)
  }
}

function closePermModal() {
  permOpen.value = false
  checkedMenuIds.value = new Set()
  form.value = createEmptyRole()
}

async function submitPermissions() {
  if (!form.value.id) return

  saving.value = true
  try {
    const payload: RoleVo = {
      ...form.value,
      menuIds: collectMenuIdsForSave(),
    }
    const result = await updateRoleApi(payload)
    if (result.code !== API_SUCCESS_CODE) {
      throw new Error(result.msg || t('system.role.saveFailed'))
    }
    showToast('success', t('system.role.permOk'))
    closePermModal()
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.role.saveFailed'))
  } finally {
    saving.value = false
  }
}

function toggleAuthorizedSelect(id: number | string) {
  const key = String(id)
  const next = new Set(selectedAuthorizedIds.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  selectedAuthorizedIds.value = next
}

function toggleUnauthorizedSelect(id: number | string) {
  const key = String(id)
  const next = new Set(selectedUnauthorizedIds.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  selectedUnauthorizedIds.value = next
}

async function loadAuthorizedUsers() {
  if (!assignRoleId.value) return
  authorizedLoading.value = true
  try {
    const result = await getUserByRoleApi({
      roleId: assignRoleId.value,
      pageNum: authorizedQuery.pageNum,
      pageSize: authorizedQuery.pageSize,
      userName: authorizedQuery.userName || undefined,
    })
    if (result.code !== API_SUCCESS_CODE || !result.data) {
      throw new Error(result.msg || t('system.role.loadFailed'))
    }
    authorizedUsers.value = result.data.list ?? []
    authorizedTotal.value = result.data.total ?? 0
    selectedAuthorizedIds.value = new Set(
      [...selectedAuthorizedIds.value].filter((id) => authorizedUsers.value.some((row) => String(row.id) === id)),
    )
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.role.loadFailed'))
  } finally {
    authorizedLoading.value = false
  }
}

async function loadUnauthorizedUsers() {
  if (!assignRoleId.value) return
  unauthorizedLoading.value = true
  try {
    const result = await unauthorizedUsersApi({
      roleId: assignRoleId.value,
      pageNum: unauthorizedQuery.pageNum,
      pageSize: unauthorizedQuery.pageSize,
      userName: unauthorizedQuery.userName || undefined,
    })
    if (result.code !== API_SUCCESS_CODE || !result.data) {
      throw new Error(result.msg || t('system.role.loadFailed'))
    }
    unauthorizedUsers.value = result.data.list ?? []
    unauthorizedTotal.value = result.data.total ?? 0
    selectedUnauthorizedIds.value = new Set(
      [...selectedUnauthorizedIds.value].filter((id) => unauthorizedUsers.value.some((row) => String(row.id) === id)),
    )
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.role.loadFailed'))
  } finally {
    unauthorizedLoading.value = false
  }
}

function searchAuthorizedUsers() {
  if (authorizedQuery.pageNum === 1) loadAuthorizedUsers()
  else authorizedQuery.pageNum = 1
}

function searchUnauthorizedUsers() {
  if (unauthorizedQuery.pageNum === 1) loadUnauthorizedUsers()
  else unauthorizedQuery.pageNum = 1
}

async function openAssignUsers(row: SysRole) {
  assignRoleId.value = row.id!
  assignRoleName.value = row.roleName ?? ''
  authorizedQuery.pageNum = 1
  authorizedQuery.userName = ''
  unauthorizedQuery.pageNum = 1
  unauthorizedQuery.userName = ''
  selectedAuthorizedIds.value = new Set()
  selectedUnauthorizedIds.value = new Set()
  userAssignOpen.value = true
  await Promise.all([loadAuthorizedUsers(), loadUnauthorizedUsers()])
}

function closeAssignUsers() {
  userAssignOpen.value = false
  assignRoleId.value = null
  assignRoleName.value = ''
  authorizedUsers.value = []
  unauthorizedUsers.value = []
  selectedAuthorizedIds.value = new Set()
  selectedUnauthorizedIds.value = new Set()
}

async function addSelectedUsers() {
  const ids = [...selectedUnauthorizedIds.value]
  if (!ids.length || !assignRoleId.value) return

  userAssignSaving.value = true
  try {
    const result = await addUserRoleApi({
      roleId: assignRoleId.value,
      userIds: ids,
    })
    if (result.code !== API_SUCCESS_CODE) {
      throw new Error(result.msg || t('system.role.assignUserFailed'))
    }
    showToast('success', t('system.role.assignUserOk'))
    selectedUnauthorizedIds.value = new Set()
    await Promise.all([loadAuthorizedUsers(), loadUnauthorizedUsers()])
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.role.assignUserFailed'))
  } finally {
    userAssignSaving.value = false
  }
}

async function removeSelectedUsers() {
  const ids = [...selectedAuthorizedIds.value]
  if (!ids.length || !assignRoleId.value) return
  if (!(await confirm({ message: t('system.role.removeUserConfirm', { count: ids.length }) }))) return

  userAssignSaving.value = true
  try {
    const result = await removeUsersFromRoleApi({
      roleId: assignRoleId.value,
      userIds: ids,
    })
    if (result.code !== API_SUCCESS_CODE) {
      throw new Error(result.msg || t('system.role.removeUserFailed'))
    }
    showToast('success', t('system.role.removeUserOk'))
    selectedAuthorizedIds.value = new Set()
    await Promise.all([loadAuthorizedUsers(), loadUnauthorizedUsers()])
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.role.removeUserFailed'))
  } finally {
    userAssignSaving.value = false
  }
}

watch(
  () => authorizedQuery.pageNum,
  () => {
    if (userAssignOpen.value) loadAuthorizedUsers()
  },
)

watch(
  () => unauthorizedQuery.pageNum,
  () => {
    if (userAssignOpen.value) loadUnauthorizedUsers()
  },
)

watch(
  () => query.pageNum,
  () => loadRoles(),
)

onMounted(loadRoles)
</script>

<template>
  <div class="page-stack">
    <div class="card p-5">
      <div class="mb-4 flex flex-wrap items-center gap-3">
        <form class="form-search-toolbar contents" @submit.prevent="searchRoles">
          <FormField :label="t('system.role.roleName')" horizontal class="form-field-search">
            <input
              v-model="query.roleName"
              type="text"
              class="field-input"
              :placeholder="t('system.role.roleNamePlaceholder')"
            />
          </FormField>
          <FormField :label="t('system.role.status')" horizontal class="form-field-search">
            <select v-model="query.status" class="field-input">
              <option value="">{{ t('system.role.statusAll') }}</option>
              <option :value="1">{{ t('system.role.statusOn') }}</option>
              <option :value="0">{{ t('system.role.statusOff') }}</option>
            </select>
          </FormField>
          <button type="submit" class="btn-primary shrink-0">
            <Search class="h-4 w-4" /> {{ t('system.role.search') }}
          </button>
          <button type="button" class="btn-ghost shrink-0" @click="resetQuery">
            <RefreshCw class="h-4 w-4" /> {{ t('system.role.reset') }}
          </button>
        </form>
        <div class="toolbar-actions">
          <button type="button" class="btn-primary shrink-0" @click="openCreate">
            <Plus class="h-4 w-4" /> {{ t('system.role.add') }}
          </button>
        </div>
      </div>

      <div class="overflow-x-auto rounded-lg border border-gray-100 dark:border-white/5">
        <table class="w-full min-w-[720px] text-left text-sm">
          <thead class="bg-gray-50 text-xs uppercase tracking-wide text-gray-400 dark:bg-white/5">
            <tr>
              <th class="px-4 py-3">{{ t('system.role.id') }}</th>
              <th class="px-4 py-3">{{ t('system.role.roleName') }}</th>
              <th class="px-4 py-3">{{ t('system.role.orderNum') }}</th>
              <th class="px-4 py-3">{{ t('system.role.status') }}</th>
              <th class="px-4 py-3">{{ t('system.role.createTime') }}</th>
              <th class="px-4 py-3 text-right">{{ t('system.role.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="6" class="px-4 py-10 text-center text-gray-400">{{ t('system.role.loading') }}</td>
            </tr>
            <tr v-else-if="!roleList.length">
              <td colspan="6" class="px-4 py-10 text-center text-gray-400">{{ t('system.role.empty') }}</td>
            </tr>
            <tr
              v-for="row in roleList"
              v-else
              :key="String(row.id)"
              class="border-t border-gray-50 transition hover:bg-gray-50/80 dark:border-white/5 dark:hover:bg-white/5"
            >
              <td class="px-4 py-3 tabular-nums text-gray-600 dark:text-gray-300">{{ row.id }}</td>
              <td class="px-4 py-3 font-medium text-gray-900 dark:text-white">{{ row.roleName }}</td>
              <td class="px-4 py-3 tabular-nums text-gray-600 dark:text-gray-300">{{ row.orderNum ?? '-' }}</td>
              <td class="px-4 py-3">
                <AppStatusPill
                  :active="row.status === 1"
                  :disabled="isProtectedRole(row)"
                  :label="t('system.role.status')"
                  @click="toggleStatus(row)"
                />
              </td>
              <td class="px-4 py-3 text-gray-600 dark:text-gray-300">{{ formatTime(row.createTime) }}</td>
              <td class="px-4 py-3">
                <div class="btn-action-group">
                  <button type="button" class="btn-action-edit" @click="openEdit(row)">
                    <Pencil class="h-3.5 w-3.5" />
                    {{ t('system.role.edit') }}
                  </button>
                  <button type="button" class="btn-action-add" @click="openAssignUsers(row)">
                    <Users class="h-3.5 w-3.5" />
                    {{ t('system.role.assignUser') }}
                  </button>
                  <button type="button" class="btn-action-add" @click="openPermissions(row)">
                    <Shield class="h-3.5 w-3.5" />
                    {{ t('system.role.assignPerm') }}
                  </button>
                  <button
                    v-if="!isProtectedRole(row)"
                    type="button"
                    class="btn-action-danger"
                    @click="removeRole(row)"
                  >
                    <Trash2 class="h-3.5 w-3.5" />
                    {{ t('system.role.delete') }}
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="total > 0" class="mt-4">
        <AppPagination v-model:page-num="query.pageNum" :page-size="query.pageSize" :total="total" />
      </div>
    </div>

    <AppModal :open="modalOpen" :title="modalTitle" wide @close="closeModal">
      <form class="form-modal" @submit.prevent="submitForm">
        <div class="form-grid-pairs">
          <div class="form-grid-row">
            <FormField :label="t('system.role.roleName')" horizontal required>
              <input v-model="form.roleName" type="text" class="field-input" />
            </FormField>
            <FormField :label="t('system.role.orderNum')" horizontal required>
              <input v-model="form.orderNum" type="number" min="0" class="field-input" />
            </FormField>
          </div>
          <div class="form-grid-row">
            <FormField :label="t('system.role.status')" horizontal class="form-field-span-2">
              <div class="form-row-inline">
                <label class="inline-flex items-center gap-2 text-sm">
                  <input v-model.number="form.status" type="radio" :value="1" /> {{ t('system.role.statusOn') }}
                </label>
                <label class="inline-flex items-center gap-2 text-sm">
                  <input v-model.number="form.status" type="radio" :value="0" /> {{ t('system.role.statusOff') }}
                </label>
              </div>
            </FormField>
          </div>
          <div class="form-grid-row">
            <FormField :label="t('system.role.remark')" horizontal class="form-field-span-2">
              <textarea v-model="form.remark" rows="3" class="field-input resize-y" />
            </FormField>
          </div>
        </div>
      </form>

      <template #footer>
        <button type="button" class="btn-ghost" @click="closeModal">{{ t('system.role.cancel') }}</button>
        <button type="button" class="btn-primary" :disabled="saving" @click="submitForm">
          {{ saving ? t('system.role.saving') : t('system.role.save') }}
        </button>
      </template>
    </AppModal>

    <AppModal :open="permOpen" :title="modalTitle" wide @close="closePermModal">
      <div
        v-if="!menuTree.length"
        class="rounded-lg border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-400 dark:border-white/10"
      >
        {{ t('system.role.menuEmpty') }}
        <button type="button" class="btn-ghost ml-2 text-xs" @click="loadMenuTreeFallback">{{ t('system.role.retry') }}</button>
      </div>
      <div
        v-else
      >
        <div class="toolbar-actions mb-3">
          <button type="button" class="btn-tree-toggle" @click="toggleTreeExpand(menuTree)">
            <UnfoldVertical v-if="isFullyCollapsed" class="h-4 w-4 text-gray-400" />
            <FoldVertical v-else class="h-4 w-4 text-gray-400" />
            {{ treeExpandLabel }}
          </button>
          <button type="button" class="btn-tree-toggle" @click="toggleTreeCheck(menuTree)">
            <CheckSquare v-if="isFullyUnchecked" class="h-4 w-4 text-gray-400" />
            <Square v-else class="h-4 w-4 text-gray-400" />
            {{ treeCheckLabel }}
          </button>
        </div>
        <div class="max-h-[420px] overflow-y-auto rounded-lg border border-gray-100 dark:border-white/5">
        <div
          v-for="row in flatMenuRows"
          :key="String(row.id)"
          class="flex items-center gap-2 border-t border-gray-50 px-3 py-2 first:border-t-0 dark:border-white/5"
          :style="{ paddingLeft: `${12 + row.depth * 20}px` }"
        >
          <button
            v-if="row.hasChildren"
            type="button"
            class="rounded p-0.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10"
            @click="toggleMenuExpand(String(row.id))"
          >
            <ChevronDown v-if="menuExpanded.has(String(row.id))" class="h-4 w-4" />
            <ChevronRight v-else class="h-4 w-4" />
          </button>
          <span v-else class="w-5" />
          <label class="inline-flex flex-1 cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              :checked="checkedMenuIds.has(String(row.id))"
              @change="toggleMenuCheck(row, ($event.target as HTMLInputElement).checked)"
            />
            <span class="text-gray-800 dark:text-gray-200">{{ row.menuName }}</span>
            <span v-if="row.menuType === 'F'" class="badge bg-gray-100 text-xs text-gray-500 dark:bg-white/10">{{ t('system.role.menuButton') }}</span>
          </label>
        </div>
        </div>
      </div>

      <template #footer>
        <button type="button" class="btn-ghost" @click="closePermModal">{{ t('system.role.cancel') }}</button>
        <button type="button" class="btn-primary" :disabled="saving" @click="submitPermissions">
          {{ saving ? t('system.role.saving') : t('system.role.save') }}
        </button>
      </template>
    </AppModal>

    <AppModal
      :open="userAssignOpen"
      :title="t('system.role.assignUserTitle', { name: assignRoleName })"
      wide
      @close="closeAssignUsers"
    >
      <div class="assign-dual-panel">
        <section class="assign-panel">
          <div class="assign-panel-head">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('system.role.authorizedUsers') }}</h3>
            <form class="flex flex-wrap items-end gap-2" @submit.prevent="searchAuthorizedUsers">
              <input
                v-model="authorizedQuery.userName"
                type="text"
                class="field-input min-w-0 flex-1"
                :placeholder="t('system.role.userNamePlaceholder')"
              />
              <button type="submit" class="btn-ghost shrink-0 text-xs">
                <Search class="h-3.5 w-3.5" />
              </button>
            </form>
          </div>
          <div class="overflow-x-auto rounded-lg border border-gray-100 dark:border-white/5">
            <table class="w-full text-left text-sm">
              <thead class="bg-gray-50 text-xs uppercase tracking-wide text-gray-400 dark:bg-white/5">
                <tr>
                  <th class="w-10 px-3 py-2" />
                  <th class="px-3 py-2">{{ t('system.role.userName') }}</th>
                  <th class="px-3 py-2">{{ t('system.role.nickName') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="authorizedLoading">
                  <td colspan="3" class="px-3 py-8 text-center text-gray-400">{{ t('system.role.loading') }}</td>
                </tr>
                <tr v-else-if="!authorizedUsers.length">
                  <td colspan="3" class="px-3 py-8 text-center text-gray-400">{{ t('system.role.authorizedEmpty') }}</td>
                </tr>
                <tr
                  v-for="user in authorizedUsers"
                  v-else
                  :key="String(user.id)"
                  class="border-t border-gray-50 dark:border-white/5"
                >
                  <td class="px-3 py-2">
                    <input
                      type="checkbox"
                      :checked="selectedAuthorizedIds.has(String(user.id))"
                      @change="toggleAuthorizedSelect(user.id!)"
                    />
                  </td>
                  <td class="px-3 py-2">{{ user.userName }}</td>
                  <td class="px-3 py-2 text-gray-600 dark:text-gray-300">{{ user.nickName || '-' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-if="authorizedTotal > authorizedQuery.pageSize" class="mt-2">
            <AppPagination
              v-model:page-num="authorizedQuery.pageNum"
              :page-size="authorizedQuery.pageSize"
              :total="authorizedTotal"
            />
          </div>
          <button
            type="button"
            class="btn-ghost mt-3 w-full text-red-600 dark:text-red-400"
            :disabled="!selectedAuthorizedIds.size || userAssignSaving"
            @click="removeSelectedUsers"
          >
            <Trash2 class="h-4 w-4" /> {{ t('system.role.removeSelected') }}
          </button>
        </section>

        <section class="assign-panel">
          <div class="assign-panel-head">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('system.role.unauthorizedUsers') }}</h3>
            <form class="flex flex-wrap items-end gap-2" @submit.prevent="searchUnauthorizedUsers">
              <input
                v-model="unauthorizedQuery.userName"
                type="text"
                class="field-input min-w-0 flex-1"
                :placeholder="t('system.role.userNamePlaceholder')"
              />
              <button type="submit" class="btn-ghost shrink-0 text-xs">
                <Search class="h-3.5 w-3.5" />
              </button>
            </form>
          </div>
          <div class="overflow-x-auto rounded-lg border border-gray-100 dark:border-white/5">
            <table class="w-full text-left text-sm">
              <thead class="bg-gray-50 text-xs uppercase tracking-wide text-gray-400 dark:bg-white/5">
                <tr>
                  <th class="w-10 px-3 py-2" />
                  <th class="px-3 py-2">{{ t('system.role.userName') }}</th>
                  <th class="px-3 py-2">{{ t('system.role.nickName') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="unauthorizedLoading">
                  <td colspan="3" class="px-3 py-8 text-center text-gray-400">{{ t('system.role.loading') }}</td>
                </tr>
                <tr v-else-if="!unauthorizedUsers.length">
                  <td colspan="3" class="px-3 py-8 text-center text-gray-400">{{ t('system.role.unauthorizedEmpty') }}</td>
                </tr>
                <tr
                  v-for="user in unauthorizedUsers"
                  v-else
                  :key="String(user.id)"
                  class="border-t border-gray-50 dark:border-white/5"
                >
                  <td class="px-3 py-2">
                    <input
                      type="checkbox"
                      :checked="selectedUnauthorizedIds.has(String(user.id))"
                      @change="toggleUnauthorizedSelect(user.id!)"
                    />
                  </td>
                  <td class="px-3 py-2">{{ user.userName }}</td>
                  <td class="px-3 py-2 text-gray-600 dark:text-gray-300">{{ user.nickName || '-' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-if="unauthorizedTotal > unauthorizedQuery.pageSize" class="mt-2">
            <AppPagination
              v-model:page-num="unauthorizedQuery.pageNum"
              :page-size="unauthorizedQuery.pageSize"
              :total="unauthorizedTotal"
            />
          </div>
          <button
            type="button"
            class="btn-primary mt-3 w-full"
            :disabled="!selectedUnauthorizedIds.size || userAssignSaving"
            @click="addSelectedUsers"
          >
            <UserPlus class="h-4 w-4" /> {{ t('system.role.addSelected') }}
          </button>
        </section>
      </div>
      <template #footer>
        <button type="button" class="btn-primary" @click="closeAssignUsers">{{ t('system.role.close') }}</button>
      </template>
    </AppModal>
  </div>
</template>
