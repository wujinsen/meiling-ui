<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
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
import RolePermAssignPanel from '@/components/system/RolePermAssignPanel.vue'
import UserAssignPanel from '@/components/system/UserAssignPanel.vue'
import { confirm } from '@/composables/useConfirm'
import { guardAction, guardActionWithRefresh } from '@/composables/useActionPermissions'
import { showToast } from '@/composables/useToast'
import { PERM } from '@/constants/permissions'
import AppPagination from '@/components/ui/AppPagination.vue'
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination'
import { rolePermAssignPath } from '@/router/systemSupplementRoutes'
import { API_SUCCESS_CODE } from '@/types/api'
import { normalizePageRes } from '@/types/page'
import { createEmptyRole, type RoleQuery, type RoleVo, type SysRole } from '@/types/role'
import type { UserVo } from '@/types/user'
import { hasFullPermission } from '@/utils/privilege'
import { ArrowLeft, ArrowRight, Pencil, Plus, RefreshCw, Search, Shield, Trash2, UserPlus, Users } from 'lucide-vue-next'

const { t } = useI18n()
const router = useRouter()

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

const permRoleId = ref<number | string | null>(null)
const permRoleName = ref('')

function isNarrowPermViewport() {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches
}

async function openPermissions(row: SysRole) {
  if (!(await guardActionWithRefresh(PERM.ROLE_ASSIGN_PERM))) return
  const roleId = row.id
  if (roleId == null || roleId === '') {
    showToast('error', t('system.role.loadFailed'))
    return
  }
  if (isNarrowPermViewport()) {
    router.push(rolePermAssignPath(roleId))
    return
  }
  permRoleId.value = roleId
  permRoleName.value = row.roleName ?? ''
  permOpen.value = true
}

function closePermModal() {
  permOpen.value = false
  permRoleId.value = null
  permRoleName.value = ''
}

const query = reactive({
  pageNum: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  roleName: '',
  status: '' as RoleQuery['status'],
})

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
const batchSelectingAuthorized = ref(false)
const batchSelectingUnauthorized = ref(false)
const batchProgress = ref('')

const hasBatchSelection = computed(
  () => selectedAuthorizedIds.value.size > 0 || selectedUnauthorizedIds.value.size > 0,
)

const authorizedQuery = reactive({
  pageNum: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  userName: '',
})

const unauthorizedQuery = reactive({
  pageNum: 1,
  pageSize: DEFAULT_PAGE_SIZE,
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
  if (!guardAction(PERM.ROLE_ADD)) return
  form.value = createEmptyRole()
  modalTitle.value = t('system.role.add')
  modalOpen.value = true
}

async function openEdit(row: SysRole) {
  if (!guardAction(PERM.ROLE_EDIT)) return
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
  if (!guardAction(isEdit.value ? PERM.ROLE_EDIT : PERM.ROLE_ADD)) return
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
  if (!guardAction(PERM.ROLE_REMOVE)) return
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
  if (!guardAction(PERM.ROLE_EDIT)) return
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

function isSuperAdminUser(user?: UserVo | null) {
  return hasFullPermission(user?.userName)
}

function selectAllAuthorizedOnPage() {
  const next = new Set(selectedAuthorizedIds.value)
  authorizedUsers.value.forEach((user) => {
    if (user.id != null && !isSuperAdminUser(user)) next.add(String(user.id))
  })
  selectedAuthorizedIds.value = next
}

function deselectAuthorizedOnPage() {
  const next = new Set(selectedAuthorizedIds.value)
  authorizedUsers.value.forEach((user) => {
    if (user.id != null) next.delete(String(user.id))
  })
  selectedAuthorizedIds.value = next
}

function clearAuthorizedSelection() {
  selectedAuthorizedIds.value = new Set()
}

function selectAllUnauthorizedOnPage() {
  const next = new Set(selectedUnauthorizedIds.value)
  unauthorizedUsers.value.forEach((user) => {
    if (user.id != null && !isSuperAdminUser(user)) next.add(String(user.id))
  })
  selectedUnauthorizedIds.value = next
}

function deselectUnauthorizedOnPage() {
  const next = new Set(selectedUnauthorizedIds.value)
  unauthorizedUsers.value.forEach((user) => {
    if (user.id != null) next.delete(String(user.id))
  })
  selectedUnauthorizedIds.value = next
}

function clearUnauthorizedSelection() {
  selectedUnauthorizedIds.value = new Set()
}

async function fetchAllUserIdsForRole(authorized: boolean) {
  if (!assignRoleId.value) return []

  const fetchPage = authorized ? getUserByRoleApi : unauthorizedUsersApi
  const query = authorized ? authorizedQuery : unauthorizedQuery
  const pageSize = 200
  let pageNum = 1
  let total = 0
  const ids = new Set<string>()

  do {
    const result = await fetchPage({
      roleId: assignRoleId.value,
      pageNum,
      pageSize,
      userName: query.userName || undefined,
    })
    if (result.code !== API_SUCCESS_CODE || !result.data) {
      throw new Error(result.msg || t('system.role.loadFailed'))
    }
    total = result.data.total ?? 0
    for (const user of result.data.list ?? []) {
      if (user.id != null && !isSuperAdminUser(user)) ids.add(String(user.id))
    }
    pageNum += 1
  } while ((pageNum - 1) * pageSize < total)

  return [...ids]
}

async function selectAllAuthorizedFiltered() {
  if (!authorizedTotal.value || !assignRoleId.value) return
  if (
    authorizedTotal.value > 100 &&
    !(await confirm({
      message: t('system.userAssign.selectAllFilteredConfirm', { count: authorizedTotal.value }),
    }))
  ) {
    return
  }

  batchSelectingAuthorized.value = true
  batchProgress.value = t('system.userAssign.batchSelectLoading')
  try {
    const ids = await fetchAllUserIdsForRole(true)
    selectedAuthorizedIds.value = new Set(ids)
    showToast('success', t('system.userAssign.selectAllFilteredOk', { count: ids.length }))
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.role.loadFailed'))
  } finally {
    batchSelectingAuthorized.value = false
    batchProgress.value = ''
  }
}

async function selectAllUnauthorizedFiltered() {
  if (!unauthorizedTotal.value || !assignRoleId.value) return
  if (
    unauthorizedTotal.value > 100 &&
    !(await confirm({
      message: t('system.userAssign.selectAllFilteredConfirm', { count: unauthorizedTotal.value }),
    }))
  ) {
    return
  }

  batchSelectingUnauthorized.value = true
  batchProgress.value = t('system.userAssign.batchSelectLoading')
  try {
    const ids = await fetchAllUserIdsForRole(false)
    selectedUnauthorizedIds.value = new Set(ids)
    showToast('success', t('system.userAssign.selectAllFilteredOk', { count: ids.length }))
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.role.loadFailed'))
  } finally {
    batchSelectingUnauthorized.value = false
    batchProgress.value = ''
  }
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
    if (result.code !== API_SUCCESS_CODE) {
      throw new Error(result.msg || t('system.role.loadFailed'))
    }
    const page = normalizePageRes(result.data)
    authorizedUsers.value = page.list ?? []
    authorizedTotal.value = page.total ?? 0
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
    if (result.code !== API_SUCCESS_CODE) {
      throw new Error(result.msg || t('system.role.loadFailed'))
    }
    const page = normalizePageRes(result.data)
    unauthorizedUsers.value = page.list ?? []
    unauthorizedTotal.value = page.total ?? 0
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
  if (!(await guardActionWithRefresh(PERM.ROLE_ASSIGN_USER))) return
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
  batchSelectingAuthorized.value = false
  batchSelectingUnauthorized.value = false
  batchProgress.value = ''
}

async function addSelectedUsers() {
  if (!(await guardActionWithRefresh(PERM.ROLE_ASSIGN_USER))) return
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
  if (!(await guardActionWithRefresh(PERM.ROLE_ASSIGN_USER))) return
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
  () => [authorizedQuery.pageNum, authorizedQuery.pageSize],
  () => {
    if (userAssignOpen.value) loadAuthorizedUsers()
  },
)

watch(
  () => [unauthorizedQuery.pageNum, unauthorizedQuery.pageSize],
  () => {
    if (userAssignOpen.value) loadUnauthorizedUsers()
  },
)

watch(
  () => [query.pageNum, query.pageSize],
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
        <AppPagination v-model:page-num="query.pageNum" v-model:page-size="query.pageSize" :total="total" />
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

    <AppModal
      :open="permOpen"
      :title="t('system.role.permModalTitle', { name: permRoleName })"
      extra-wide
      @close="closePermModal"
    >
      <RolePermAssignPanel
        v-if="permRoleId != null"
        :role-id="permRoleId"
        mode="modal"
        @saved="closePermModal"
        @cancel="closePermModal"
      />
    </AppModal>

    <AppModal
      :open="userAssignOpen"
      :title="t('system.role.assignUserTitle', { name: assignRoleName })"
      wide
      @close="closeAssignUsers"
    >
      <div
        v-if="hasBatchSelection || batchProgress"
        class="assign-batch-bar"
      >
        <div class="min-w-0 flex-1 text-sm text-gray-600 dark:text-gray-300">
          <span class="font-medium text-gray-900 dark:text-white">{{ t('system.userAssign.batchTitle') }}</span>
          <span v-if="selectedUnauthorizedIds.size" class="ml-2 tabular-nums">
            {{ t('system.userAssign.batchPendingAdd', { count: selectedUnauthorizedIds.size }) }}
          </span>
          <span v-if="selectedAuthorizedIds.size" class="ml-2 tabular-nums">
            {{ t('system.userAssign.batchPendingRemove', { count: selectedAuthorizedIds.size }) }}
          </span>
          <span v-if="batchProgress" class="ml-2 text-xs text-brand-600 dark:text-brand-300">{{ batchProgress }}</span>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="btn-ghost text-xs"
            :disabled="userAssignSaving || (!selectedUnauthorizedIds.size && !selectedAuthorizedIds.size)"
            @click="clearUnauthorizedSelection(); clearAuthorizedSelection()"
          >
            {{ t('system.userAssign.clearSelection') }}
          </button>
          <button
            type="button"
            class="btn-primary text-xs"
            :disabled="!selectedUnauthorizedIds.size || userAssignSaving"
            @click="addSelectedUsers"
          >
            <Users class="h-3.5 w-3.5" />
            {{ t('system.userAssign.batchAdd', { count: selectedUnauthorizedIds.size }) }}
          </button>
          <button
            type="button"
            class="btn-ghost text-xs text-red-600 dark:text-red-400"
            :disabled="!selectedAuthorizedIds.size || userAssignSaving"
            @click="removeSelectedUsers"
          >
            <Trash2 class="h-3.5 w-3.5" />
            {{ t('system.userAssign.batchRemove', { count: selectedAuthorizedIds.size }) }}
          </button>
        </div>
      </div>

      <div class="assign-dual-panel assign-dual-panel-transfer">
        <UserAssignPanel
          :title="t('system.role.authorizedUsers')"
          :total="authorizedTotal"
          :users="authorizedUsers"
          :loading="authorizedLoading"
          :batch-selecting="batchSelectingAuthorized"
          :selected-ids="selectedAuthorizedIds"
          :user-name="authorizedQuery.userName"
          :page-num="authorizedQuery.pageNum"
          :page-size="authorizedQuery.pageSize"
          :is-super-admin-user="isSuperAdminUser"
          :empty-text="t('system.role.authorizedEmpty')"
          @update:user-name="authorizedQuery.userName = $event"
          @update:page-num="authorizedQuery.pageNum = $event"
          @update:page-size="authorizedQuery.pageSize = $event"
          @search="searchAuthorizedUsers"
          @toggle="toggleAuthorizedSelect"
          @select-all-page="selectAllAuthorizedOnPage"
          @deselect-page="deselectAuthorizedOnPage"
          @clear-selection="clearAuthorizedSelection"
          @select-all-filtered="selectAllAuthorizedFiltered"
        />

        <div class="assign-transfer-col">
          <button
            type="button"
            class="btn-primary assign-transfer-btn"
            :disabled="!selectedUnauthorizedIds.size || userAssignSaving"
            :title="t('system.role.addSelected')"
            @click="addSelectedUsers"
          >
            <ArrowLeft class="h-4 w-4" />
          </button>
          <button
            type="button"
            class="btn-ghost assign-transfer-btn text-red-600 dark:text-red-400"
            :disabled="!selectedAuthorizedIds.size || userAssignSaving"
            :title="t('system.role.removeSelected')"
            @click="removeSelectedUsers"
          >
            <ArrowRight class="h-4 w-4" />
          </button>
          <div class="hidden w-full gap-2 xl:hidden">
            <button
              type="button"
              class="btn-primary mt-3 w-full"
              :disabled="!selectedUnauthorizedIds.size || userAssignSaving"
              @click="addSelectedUsers"
            >
              <UserPlus class="h-4 w-4" /> {{ t('system.role.addSelected') }}
            </button>
            <button
              type="button"
              class="btn-ghost mt-2 w-full text-red-600 dark:text-red-400"
              :disabled="!selectedAuthorizedIds.size || userAssignSaving"
              @click="removeSelectedUsers"
            >
              <Trash2 class="h-4 w-4" /> {{ t('system.role.removeSelected') }}
            </button>
          </div>
        </div>

        <UserAssignPanel
          :title="t('system.role.unauthorizedUsers')"
          :total="unauthorizedTotal"
          :users="unauthorizedUsers"
          :loading="unauthorizedLoading"
          :batch-selecting="batchSelectingUnauthorized"
          :selected-ids="selectedUnauthorizedIds"
          :user-name="unauthorizedQuery.userName"
          :page-num="unauthorizedQuery.pageNum"
          :page-size="unauthorizedQuery.pageSize"
          :is-super-admin-user="isSuperAdminUser"
          :empty-text="t('system.role.unauthorizedEmpty')"
          @update:user-name="unauthorizedQuery.userName = $event"
          @update:page-num="unauthorizedQuery.pageNum = $event"
          @update:page-size="unauthorizedQuery.pageSize = $event"
          @search="searchUnauthorizedUsers"
          @toggle="toggleUnauthorizedSelect"
          @select-all-page="selectAllUnauthorizedOnPage"
          @deselect-page="deselectUnauthorizedOnPage"
          @clear-selection="clearUnauthorizedSelection"
          @select-all-filtered="selectAllUnauthorizedFiltered"
        />
      </div>
      <template #footer>
        <button type="button" class="btn-primary" @click="closeAssignUsers">{{ t('system.role.close') }}</button>
      </template>
    </AppModal>
  </div>
</template>

<style scoped>
.assign-dual-panel-transfer {
  @apply grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)];
}

.assign-transfer-col {
  @apply flex flex-row items-center justify-center gap-2 lg:flex-col lg:justify-center lg:px-1;
}

.assign-transfer-btn {
  @apply inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full p-0;
}

.assign-batch-bar {
  @apply mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-100 bg-brand-50/50 px-4 py-3 dark:border-brand-500/20 dark:bg-brand-500/10;
}
</style>
