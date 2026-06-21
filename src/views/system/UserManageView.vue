<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { listDeptApi, getDeptTreeListApi } from '@/api/dept'
import { allPostApi, listPostApi } from '@/api/post'
import {
  addUserApi,
  changeUserStatusApi,
  deleteUserApi,
  getRoleByUserIdApi,
  getUserDetailApi,
  insertUserRoleApi,
  listUserApi,
  resetUserPasswordApi,
  updateUserApi,
} from '@/api/user'
import { getRoleAllApi } from '@/api/role'
import AppModal from '@/components/ui/AppModal.vue'
import AppDatePicker from '@/components/ui/AppDatePicker.vue'
import AppStatusPill from '@/components/ui/AppStatusPill.vue'
import FormField from '@/components/ui/FormField.vue'
import { PERM } from '@/constants/permissions'
import { guardActionWithRefresh } from '@/composables/useActionPermissions'
import { confirm } from '@/composables/useConfirm'
import { showToast } from '@/composables/useToast'
import AppPagination from '@/components/ui/AppPagination.vue'
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination'
import DeptTreePanel from '@/components/system/DeptTreePanel.vue'
import DeptTreeSelect from '@/components/system/DeptTreeSelect.vue'
import UserRoleTags from '@/components/system/UserRoleTags.vue'
import { API_SUCCESS_CODE } from '@/types/api'
import type { DeptVo } from '@/types/dept'
import type { SysPost } from '@/types/post'
import type { SysRole } from '@/types/role'
import { createEmptyUser, type UserQuery, type UserVo } from '@/types/user'
import { filterAssignableRoles, isBuiltinSuperAdminRole } from '@/utils/role'
import { toEntityId } from '@/utils/id'
import { buildTree, collectTreeIds, normalizeNestedTree, sortTreeByOrderNum } from '@/utils/tree'
import { KeyRound, LayoutGrid, Pencil, Plus, RefreshCw, Search, Shield, Trash2 } from 'lucide-vue-next'

const { t } = useI18n()
const router = useRouter()

const loading = ref(false)
const deptLoading = ref(false)
const saving = ref(false)
const userList = ref<UserVo[]>([])
const total = ref(0)
const deptTree = ref<DeptVo[]>([])
const postOptions = ref<SysPost[]>([])
const modalOpen = ref(false)
const modalTitle = ref('')
const form = ref<UserVo>(createEmptyUser())
const isEdit = computed(() => form.value.id != null)

const resetOpen = ref(false)
const resetTarget = ref<UserVo | null>(null)
const resetPassword = ref('')
const resetting = ref(false)

const selectedIds = ref(new Set<string>())
const roleAssignOpen = ref(false)
const roleAssignTarget = ref<UserVo | null>(null)
const roleOptions = ref<SysRole[]>([])
const checkedRoleIds = ref(new Set<string>())
const roleAssignSaving = ref(false)

const query = reactive({
  pageNum: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  userName: '',
  telephone: '',
  status: '' as UserQuery['status'],
  deptId: '' as UserQuery['deptId'],
  beginTime: '',
  endTime: '',
})

const allSelected = computed(
  () =>
    userList.value.length > 0 &&
    userList.value.every((row) => !isProtectedUser(row) && selectedIds.value.has(String(row.id))),
)

const selectableUsers = computed(() => userList.value.filter((row) => !isProtectedUser(row)))

const hasSelection = computed(() => selectedIds.value.size > 0)

const formDeptId = computed({
  get() {
    return form.value.deptId != null && form.value.deptId !== '' ? String(form.value.deptId) : ''
  },
  set(value: string) {
    form.value.deptId = value ? Number(value) : undefined
  },
})

const selectedDeptName = computed(() => {
  if (!query.deptId) return t('system.user.deptAll')
  const findName = (nodes: DeptVo[]): string | undefined => {
    for (const node of nodes) {
      if (String(node.id) === String(query.deptId)) return node.deptName
      if (node.children?.length) {
        const found = findName(node.children)
        if (found) return found
      }
    }
    return undefined
  }
  return findName(deptTree.value) ?? t('system.user.deptAll')
})

function formatTime(value?: string | number) {
  if (value == null || value === '') return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString()
}

function isProtectedUser(row: UserVo) {
  return String(row.id) === '1'
}

async function loadDepts() {
  deptLoading.value = true
  try {
    const result = await listDeptApi()
    if (result.code !== API_SUCCESS_CODE || !result.data) return

    const flat = result.data
    try {
      const treeResult = await getDeptTreeListApi()
      if (treeResult.code === API_SUCCESS_CODE && treeResult.data?.length) {
        const nested = normalizeNestedTree(treeResult.data) as DeptVo[]
        const treeIds = new Set(collectTreeIds(nested))
        const missing = flat.filter((item) => item.id != null && !treeIds.has(String(item.id)))
        deptTree.value = sortTreeByOrderNum(
          missing.length ? [...nested, ...(buildTree(missing) as DeptVo[])] : nested,
        ) as DeptVo[]
        return
      }
    } catch {
      /* fall back to client-side tree */
    }

    deptTree.value = sortTreeByOrderNum(buildTree(flat)) as DeptVo[]
  } catch {
    deptTree.value = []
  } finally {
    deptLoading.value = false
  }
}

function selectDept(deptId: string) {
  query.deptId = deptId as UserQuery['deptId']
  searchUsers()
}

async function loadPostOptions() {
  try {
    const result = await listPostApi({
      pageNum: 1,
      pageSize: 500,
      status: 1,
    })
    if (result.code === API_SUCCESS_CODE && result.data?.list) {
      postOptions.value = [...result.data.list].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
      return
    }
  } catch {
    /* fall back to allPost */
  }

  try {
    const result = await allPostApi()
    if (result.code === API_SUCCESS_CODE && result.data) {
      postOptions.value = result.data
        .filter((post) => post.status !== 0)
        .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
      return
    }
  } catch {
    /* ignore */
  }

  postOptions.value = []
}

function resolvePostIds(data: UserVo & { posts?: SysPost[] }) {
  if (data.postIds?.length) {
    return data.postIds.map((id) => Number(id))
  }
  if (data.posts?.length) {
    return data.posts
      .map((post) => Number(post.id))
      .filter((id) => !Number.isNaN(id))
  }
  return []
}

async function loadUsers() {
  loading.value = true
  try {
    const result = await listUserApi({
      pageNum: query.pageNum,
      pageSize: query.pageSize,
      userName: query.userName || undefined,
      telephone: query.telephone || undefined,
      status: query.status === '' ? undefined : query.status,
      deptId: query.deptId === '' ? undefined : query.deptId,
      beginTime: query.beginTime || undefined,
      endTime: query.endTime || query.beginTime || undefined,
    })
    if (result.code !== API_SUCCESS_CODE || !result.data) {
      throw new Error(result.msg || t('system.user.loadFailed'))
    }
    userList.value = (result.data.list ?? []).map((row) => ({
      ...row,
      id: row.id != null ? String(row.id) : row.id,
    }))
    total.value = result.data.total ?? 0
    selectedIds.value = new Set(
      [...selectedIds.value].filter((id) => userList.value.some((row) => String(row.id) === id)),
    )
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.user.loadFailed'))
  } finally {
    loading.value = false
  }
}

function searchUsers() {
  if (query.pageNum === 1) loadUsers()
  else query.pageNum = 1
}

function resetQuery() {
  query.userName = ''
  query.telephone = ''
  query.status = ''
  query.deptId = ''
  query.beginTime = ''
  query.endTime = ''
  selectedIds.value = new Set()
  searchUsers()
}

function toggleSelectAll() {
  if (allSelected.value) {
    selectedIds.value = new Set()
    return
  }
  selectedIds.value = new Set(selectableUsers.value.map((row) => String(row.id)))
}

function toggleSelect(id: number | string) {
  const key = String(id)
  const next = new Set(selectedIds.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  selectedIds.value = next
}

async function removeUsers(ids: Array<number | string>) {
  if (!ids.length) return
  try {
    const result = await deleteUserApi(ids)
    if (result.code !== API_SUCCESS_CODE) {
      throw new Error(result.msg || t('system.user.deleteFailed'))
    }
    showToast('success', t('system.user.deleteOk'))
    selectedIds.value = new Set()
    await loadUsers()
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.user.deleteFailed'))
  }
}

async function removeSelected() {
  const ids = [...selectedIds.value]
  if (!ids.length) return
  if (!(await confirm({ message: t('system.user.deleteBatchConfirm', { count: ids.length }) }))) return
  await removeUsers(ids)
}

async function onAddClick() {
  if (!(await guardActionWithRefresh(PERM.USER_ADD))) return
  void openCreate()
}

async function onEditClick(row: UserVo) {
  if (!(await guardActionWithRefresh(PERM.USER_EDIT))) return
  void openEdit(row)
}

async function onDeleteClick(row: UserVo) {
  if (!(await guardActionWithRefresh(PERM.USER_REMOVE))) return
  void removeUser(row)
}

async function onBatchDeleteClick() {
  if (!(await guardActionWithRefresh(PERM.USER_REMOVE))) return
  void removeSelected()
}

async function onResetPwdClick(row: UserVo) {
  if (!(await guardActionWithRefresh(PERM.USER_RESET_PWD))) return
  openResetPwd(row)
}

async function onAssignRolesClick(row: UserVo) {
  if (!(await guardActionWithRefresh(PERM.USER_ASSIGN_ROLE))) return
  void openAssignRoles(row)
}

async function onAssignSystemsClick(row: UserVo) {
  if (!(await guardActionWithRefresh(PERM.USER_ASSIGN_SYSTEM))) return
  void openAssignSystems(row)
}

async function onToggleStatusClick(row: UserVo) {
  if (!(await guardActionWithRefresh(PERM.USER_EDIT))) return
  void toggleStatus(row)
}

async function openCreate() {
  form.value = createEmptyUser()
  if (query.deptId) form.value.deptId = query.deptId
  form.value.sex = 0
  modalTitle.value = t('system.user.add')
  await loadPostOptions()
  modalOpen.value = true
}

async function openEdit(row: UserVo) {
  try {
    await loadPostOptions()
    const result = await getUserDetailApi(row.id!)
    if (result.code !== API_SUCCESS_CODE || !result.data) {
      throw new Error(result.msg || t('system.user.loadFailed'))
    }
    const data = result.data
    form.value = {
      ...data,
      password: '',
      sex: data.sex === 1 ? 1 : 0,
      postIds: resolvePostIds(data),
    }
    modalTitle.value = t('system.user.edit')
    modalOpen.value = true
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.user.loadFailed'))
  }
}

function closeModal() {
  modalOpen.value = false
  form.value = createEmptyUser()
}

function validateForm() {
  const userName = form.value.userName?.trim()
  if (!userName) return t('system.user.userNameRequired')
  if (userName.length < 2 || userName.length > 20) return t('system.user.userNameLength')
  if (!form.value.nickName?.trim()) return t('system.user.nickNameRequired')
  if (!isEdit.value) {
    const pwd = form.value.password?.trim()
    if (!pwd) return t('system.user.passwordRequired')
    if (pwd.length < 5 || pwd.length > 20) return t('system.user.passwordLength')
  }
  const phone = form.value.telephone?.trim()
  if (phone && !/^1[3-9]\d{9}$/.test(phone)) return t('system.user.phoneInvalid')
  const email = form.value.email?.trim()
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return t('system.user.emailInvalid')
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
    const payload: UserVo = {
      ...form.value,
      userName: form.value.userName!.trim(),
      nickName: form.value.nickName!.trim(),
      telephone: form.value.telephone?.trim() || undefined,
      email: form.value.email?.trim() || undefined,
      deptId: form.value.deptId ? Number(form.value.deptId) : undefined,
      status: Number(form.value.status ?? 1),
      sex: Number(form.value.sex ?? 0),
      postIds: form.value.postIds?.map((id) => Number(id)) ?? [],
    }

    if (!isEdit.value) {
      payload.password = form.value.password!.trim()
    } else {
      delete payload.password
    }

    const result = isEdit.value ? await updateUserApi(payload) : await addUserApi(payload)
    if (result.code !== API_SUCCESS_CODE) {
      throw new Error(result.msg || t('system.user.saveFailed'))
    }

    showToast('success', isEdit.value ? t('system.user.updateOk') : t('system.user.createOk'))
    closeModal()
    await loadUsers()
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.user.saveFailed'))
  } finally {
    saving.value = false
  }
}

async function removeUser(row: UserVo) {
  if (isProtectedUser(row)) return
  if (!(await confirm({ message: t('system.user.deleteConfirm', { name: row.userName }) }))) return
  await removeUsers([row.id!])
}

async function toggleStatus(row: UserVo) {
  if (isProtectedUser(row)) return
  const nextStatus = row.status === 1 ? 0 : 1
  const action = nextStatus === 1 ? t('system.user.enable') : t('system.user.disable')
  if (!(await confirm({ message: t('system.user.statusConfirm', { action, name: row.userName }), danger: false }))) return

  try {
    const result = await changeUserStatusApi(row.id!, nextStatus)
    if (result.code !== API_SUCCESS_CODE) {
      throw new Error(result.msg || t('system.user.statusFailed'))
    }
    row.status = nextStatus
    showToast('success', t('system.user.statusOk'))
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.user.statusFailed'))
  }
}

function openResetPwd(row: UserVo) {
  resetTarget.value = { ...row, id: row.id != null ? String(row.id) : row.id }
  resetPassword.value = ''
  resetOpen.value = true
}

function closeResetPwd() {
  resetOpen.value = false
  resetTarget.value = null
  resetPassword.value = ''
}

async function submitResetPwd() {
  const pwd = resetPassword.value.trim()
  if (!pwd || pwd.length < 5 || pwd.length > 20) {
    showToast('error', t('system.user.passwordLength'))
    return
  }
  const userId = toEntityId(resetTarget.value?.id)
  if (!userId) return

  resetting.value = true
  try {
    const result = await resetUserPasswordApi(userId, pwd)
    if (result.code !== API_SUCCESS_CODE) {
      throw new Error(result.msg || t('system.user.resetFailed'))
    }
    showToast('success', t('system.user.resetOk'))
    closeResetPwd()
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.user.resetFailed'))
  } finally {
    resetting.value = false
  }
}

const selectedPostId = computed({
  get: () => {
    const id = form.value.postIds?.[0]
    return id != null && id !== '' ? String(id) : ''
  },
  set: (value: string) => {
    form.value.postIds = value ? [Number(value)] : []
  },
})

function toggleFormStatus() {
  form.value.status = form.value.status === 1 ? 0 : 1
}

async function loadRoleOptions() {
  const result = await getRoleAllApi()
  if (result.code === API_SUCCESS_CODE && result.data) {
    roleOptions.value = filterAssignableRoles(result.data).map((role) => ({
      ...role,
      id: role.id != null ? String(role.id) : role.id,
    }))
  } else {
    roleOptions.value = []
  }
}

async function openAssignRoles(row: UserVo) {
  try {
    await loadRoleOptions()
    const userId = toEntityId(row.id)
    if (!userId) throw new Error(t('system.user.loadFailed'))
    const result = await getRoleByUserIdApi(userId)
    if (result.code !== API_SUCCESS_CODE) {
      throw new Error(result.msg || t('system.user.loadFailed'))
    }
    const roleIds =
      result.data?.roleList
        ?.filter((role) => !isBuiltinSuperAdminRole(role))
        .map((role) => String(role.id)) ?? []
    checkedRoleIds.value = new Set(roleIds)
    roleAssignTarget.value = { ...row, id: userId }
    roleAssignOpen.value = true
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.user.loadFailed'))
  }
}

function closeAssignRoles() {
  roleAssignOpen.value = false
  roleAssignTarget.value = null
  checkedRoleIds.value = new Set()
}

function toggleRoleCheck(roleId: number | string, checked: boolean) {
  const key = String(roleId)
  const next = new Set(checkedRoleIds.value)
  if (checked) next.add(key)
  else next.delete(key)
  checkedRoleIds.value = next
}

function openAssignSystems(row: UserVo) {
  if (!row.id) return
  router.push({ name: 'SystemUserAssign', query: { userId: String(row.id) } })
}

async function submitAssignRoles() {
  const userId = toEntityId(roleAssignTarget.value?.id)
  if (!userId) return

  roleAssignSaving.value = true
  try {
    const roleIds = [...checkedRoleIds.value].filter((id) => {
      const role = roleOptions.value.find((item) => String(item.id) === String(id))
      return role != null && !isBuiltinSuperAdminRole(role)
    })
    const result = await insertUserRoleApi({ userId, roleIds })
    if (result.code !== API_SUCCESS_CODE) {
      throw new Error(result.msg || t('system.user.assignRoleFailed'))
    }
    showToast('success', t('system.user.assignRoleOk'))
    closeAssignRoles()
    await loadUsers()
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.user.assignRoleFailed'))
  } finally {
    roleAssignSaving.value = false
  }
}

watch(
  () => [query.pageNum, query.pageSize],
  () => loadUsers(),
)

onMounted(async () => {
  await Promise.all([loadDepts(), loadPostOptions()])
  await loadUsers()
})
</script>

<template>
  <div class="page-stack">
    <div class="flex flex-col gap-4 xl:flex-row xl:items-start">
      <aside class="w-full shrink-0 xl:w-64 xl:sticky xl:top-20 xl:self-start 2xl:w-72">
        <div class="card p-4">
          <DeptTreePanel
            :tree="deptTree"
            :selected-id="String(query.deptId)"
            :loading="deptLoading"
            @select="selectDept"
          />
        </div>
      </aside>

      <div class="card min-w-0 flex-1 p-5">
      <div class="mb-4 flex flex-wrap items-center gap-3">
        <form class="form-search-toolbar contents" @submit.prevent="searchUsers">
          <FormField :label="t('system.user.userName')" horizontal class="form-field-search">
            <input v-model="query.userName" type="text" class="field-input" :placeholder="t('system.user.userNamePlaceholder')" />
          </FormField>
          <FormField :label="t('system.user.telephone')" horizontal class="form-field-search">
            <input v-model="query.telephone" type="text" class="field-input" :placeholder="t('system.user.telephonePlaceholder')" />
          </FormField>
          <FormField :label="t('system.user.status')" horizontal class="form-field-search">
            <select v-model="query.status" class="field-input">
              <option value="">{{ t('system.user.statusAll') }}</option>
              <option :value="1">{{ t('system.user.statusOn') }}</option>
              <option :value="0">{{ t('system.user.statusOff') }}</option>
            </select>
          </FormField>
          <FormField :label="t('system.user.beginTime')" horizontal class="form-field-search">
            <AppDatePicker v-model="query.beginTime" />
          </FormField>
          <FormField :label="t('system.user.endTime')" horizontal class="form-field-search">
            <AppDatePicker v-model="query.endTime" />
          </FormField>
          <button type="submit" class="btn-primary shrink-0">
            <Search class="h-4 w-4" /> {{ t('system.user.search') }}
          </button>
          <button type="button" class="btn-ghost shrink-0" @click="resetQuery">
            <RefreshCw class="h-4 w-4" /> {{ t('system.user.reset') }}
          </button>
        </form>
        <div class="toolbar-actions">
          <button type="button" class="btn-ghost shrink-0" :disabled="!hasSelection" @click="onBatchDeleteClick">
            <Trash2 class="h-4 w-4" /> {{ t('system.user.deleteBatch') }}
          </button>
          <button type="button" class="btn-primary shrink-0" @click="onAddClick">
            <Plus class="h-4 w-4" /> {{ t('system.user.add') }}
          </button>
        </div>
      </div>

      <p v-if="query.deptId" class="mb-3 text-sm text-gray-500 dark:text-gray-400">
        {{ t('system.user.deptFilterActive', { name: selectedDeptName }) }}
      </p>

      <div class="overflow-x-auto rounded-lg border border-gray-100 dark:border-white/5">
        <table class="w-full min-w-[72rem] text-left text-sm">
          <thead class="bg-gray-50 text-xs uppercase tracking-wide text-gray-400 dark:bg-white/5">
            <tr>
              <th class="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  :checked="allSelected"
                  :disabled="!selectableUsers.length"
                  @change="toggleSelectAll"
                />
              </th>
              <th class="px-4 py-3">{{ t('system.user.id') }}</th>
              <th class="px-4 py-3">{{ t('system.user.userName') }}</th>
              <th class="px-4 py-3">{{ t('system.user.nickName') }}</th>
              <th class="px-4 py-3">{{ t('system.user.dept') }}</th>
              <th class="min-w-[12rem] px-4 py-3">{{ t('system.user.roles') }}</th>
              <th class="px-4 py-3">{{ t('system.user.telephone') }}</th>
              <th class="px-4 py-3">{{ t('system.user.status') }}</th>
              <th class="px-4 py-3">{{ t('system.user.createTime') }}</th>
              <th class="min-w-[26rem] px-4 py-3 text-right">{{ t('system.user.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="10" class="px-4 py-10 text-center text-gray-400">{{ t('system.user.loading') }}</td>
            </tr>
            <tr v-else-if="!userList.length">
              <td colspan="10" class="px-4 py-10 text-center text-gray-400">{{ t('system.user.empty') }}</td>
            </tr>
            <tr
              v-for="row in userList"
              v-else
              :key="String(row.id)"
              class="border-t border-gray-50 transition hover:bg-gray-50/80 dark:border-white/5 dark:hover:bg-white/5"
            >
              <td class="px-4 py-3">
                <input
                  type="checkbox"
                  :checked="selectedIds.has(String(row.id))"
                  :disabled="isProtectedUser(row)"
                  @change="toggleSelect(row.id!)"
                />
              </td>
              <td class="px-4 py-3 tabular-nums text-gray-600 dark:text-gray-300">{{ row.id }}</td>
              <td class="px-4 py-3 font-medium text-gray-900 dark:text-white">{{ row.userName }}</td>
              <td class="px-4 py-3 text-gray-600 dark:text-gray-300">{{ row.nickName || '-' }}</td>
              <td class="px-4 py-3 text-gray-600 dark:text-gray-300">{{ row.deptName || '-' }}</td>
              <td class="min-w-[12rem] px-4 py-3 align-top">
                <UserRoleTags :role-names="row.roleNames" />
              </td>
              <td class="px-4 py-3 text-gray-600 dark:text-gray-300">{{ row.telephone || '-' }}</td>
              <td class="px-4 py-3">
                <AppStatusPill
                  :active="row.status === 1"
                  :disabled="isProtectedUser(row)"
                  :label="t('system.user.status')"
                  @click="onToggleStatusClick(row)"
                />
              </td>
              <td class="px-4 py-3 text-gray-600 dark:text-gray-300">{{ formatTime(row.createTime) }}</td>
              <td class="min-w-[26rem] px-4 py-3 text-right align-middle">
                <div class="btn-action-group">
                  <button type="button" class="btn-action-edit" @click="onEditClick(row)">
                    <Pencil class="h-3.5 w-3.5" />
                    {{ t('system.user.edit') }}
                  </button>
                  <button type="button" class="btn-action-add" @click="onAssignRolesClick(row)">
                    <Shield class="h-3.5 w-3.5" />
                    {{ t('system.user.assignRole') }}
                  </button>
                  <button type="button" class="btn-action-add" @click="onAssignSystemsClick(row)">
                    <LayoutGrid class="h-3.5 w-3.5" />
                    {{ t('system.user.assignSystem') }}
                  </button>
                  <button type="button" class="btn-action-add" @click="onResetPwdClick(row)">
                    <KeyRound class="h-3.5 w-3.5" />
                    {{ t('system.user.resetPwd') }}
                  </button>
                  <button
                    v-if="!isProtectedUser(row)"
                    type="button"
                    class="btn-action-danger"
                    @click="onDeleteClick(row)"
                  >
                    <Trash2 class="h-3.5 w-3.5" />
                    {{ t('system.user.delete') }}
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
    </div>

    <AppModal :open="modalOpen" :title="modalTitle" wide @close="closeModal">
      <form class="form-modal" novalidate @submit.prevent="submitForm">
        <div class="form-grid-pairs">
          <div class="form-grid-row">
            <FormField :label="t('system.user.nickName')" horizontal required>
              <input v-model="form.nickName" type="text" class="field-input" />
            </FormField>
            <FormField :label="t('system.user.dept')" horizontal>
              <DeptTreeSelect
                v-model="formDeptId"
                :tree="deptTree"
                :loading="deptLoading"
              />
            </FormField>
          </div>
          <div class="form-grid-row">
            <FormField :label="t('system.user.userName')" horizontal required>
              <input
                v-model="form.userName"
                type="text"
                class="field-input"
                :disabled="isEdit"
              />
            </FormField>
            <FormField v-if="!isEdit" :label="t('system.user.password')" horizontal required>
              <input
                v-model="form.password"
                type="password"
                class="field-input"
                autocomplete="new-password"
              />
            </FormField>
            <FormField v-else :label="t('system.user.telephone')" horizontal>
              <input
                v-model="form.telephone"
                type="text"
                class="field-input"
                :placeholder="t('system.user.telephonePlaceholder')"
              />
            </FormField>
          </div>
          <div class="form-grid-row">
            <template v-if="!isEdit">
              <FormField :label="t('system.user.telephone')" horizontal>
                <input
                  v-model="form.telephone"
                  type="text"
                  class="field-input"
                  :placeholder="t('system.user.telephonePlaceholder')"
                />
              </FormField>
              <FormField :label="t('system.user.email')" horizontal>
                <input v-model="form.email" type="email" class="field-input" autocomplete="email" />
              </FormField>
            </template>
            <template v-else>
              <FormField :label="t('system.user.email')" horizontal>
                <input v-model="form.email" type="email" class="field-input" autocomplete="email" />
              </FormField>
              <FormField :label="t('system.user.sex')" horizontal>
                <select v-model.number="form.sex" class="field-input">
                  <option :value="0">{{ t('system.user.sexMale') }}</option>
                  <option :value="1">{{ t('system.user.sexFemale') }}</option>
                </select>
              </FormField>
            </template>
          </div>
          <div class="form-grid-row">
            <template v-if="!isEdit">
              <FormField :label="t('system.user.sex')" horizontal>
                <select v-model.number="form.sex" class="field-input">
                  <option :value="0">{{ t('system.user.sexMale') }}</option>
                  <option :value="1">{{ t('system.user.sexFemale') }}</option>
                </select>
              </FormField>
              <FormField :label="t('system.user.status')" horizontal>
                <div class="form-row-inline">
                  <AppStatusPill
                    :active="form.status === 1"
                    :label="t('system.user.status')"
                    @click="toggleFormStatus"
                  />
                  <span class="text-sm text-gray-500 dark:text-gray-400">
                    {{ form.status === 1 ? t('system.user.statusOn') : t('system.user.statusOff') }}
                  </span>
                </div>
              </FormField>
            </template>
            <template v-else>
              <FormField :label="t('system.user.status')" horizontal>
                <div class="form-row-inline">
                  <AppStatusPill
                    :active="form.status === 1"
                    :label="t('system.user.status')"
                    @click="toggleFormStatus"
                  />
                  <span class="text-sm text-gray-500 dark:text-gray-400">
                    {{ form.status === 1 ? t('system.user.statusOn') : t('system.user.statusOff') }}
                  </span>
                </div>
              </FormField>
              <FormField :label="t('system.user.posts')" horizontal>
                <select
                  v-model="selectedPostId"
                  class="field-input"
                  :class="{ 'field-input-empty-display': !postOptions.length && !selectedPostId }"
                >
                  <option value="">{{ t('system.user.postNone') }}</option>
                  <option v-for="post in postOptions" :key="String(post.id)" :value="String(post.id)">
                    {{ post.postName }}
                  </option>
                </select>
              </FormField>
            </template>
          </div>
          <div v-if="!isEdit" class="form-grid-row">
            <FormField :label="t('system.user.posts')" horizontal>
              <select
                v-model="selectedPostId"
                class="field-input"
                :class="{ 'field-input-empty-display': !postOptions.length && !selectedPostId }"
              >
                <option value="">{{ t('system.user.postNone') }}</option>
                <option v-for="post in postOptions" :key="String(post.id)" :value="String(post.id)">
                  {{ post.postName }}
                </option>
              </select>
            </FormField>
          </div>
          <div class="form-grid-row">
            <FormField :label="t('system.user.remark')" horizontal class="form-field-span-2">
              <textarea v-model="form.remark" rows="3" class="field-input resize-y" />
            </FormField>
          </div>
        </div>
      </form>

      <template #footer>
        <button type="button" class="btn-ghost" @click="closeModal">{{ t('system.user.cancel') }}</button>
        <button type="button" class="btn-primary" :disabled="saving" @click="submitForm">
          {{ saving ? t('system.user.saving') : t('system.user.save') }}
        </button>
      </template>
    </AppModal>

    <AppModal :open="resetOpen" :title="t('system.user.resetPwd')" @close="closeResetPwd">
      <form class="form-modal form-modal-compact" novalidate @submit.prevent="submitResetPwd">
        <p class="mb-4 text-sm text-gray-500 dark:text-gray-400">
          {{ t('system.user.resetPwdHint', { name: resetTarget?.userName ?? '' }) }}
        </p>
        <FormField :label="t('system.user.password')" horizontal>
          <input
            v-model="resetPassword"
            type="text"
            class="field-input"
            autocomplete="new-password"
            maxlength="20"
          />
        </FormField>
      </form>
      <template #footer>
        <button type="button" class="btn-ghost" @click="closeResetPwd">{{ t('system.user.cancel') }}</button>
        <button type="button" class="btn-primary" :disabled="resetting" @click="submitResetPwd">
          {{ resetting ? t('system.user.saving') : t('system.user.save') }}
        </button>
      </template>
    </AppModal>

    <AppModal
      :open="roleAssignOpen"
      :title="t('system.user.assignRoleTitle', { name: roleAssignTarget?.userName ?? '' })"
      wide
      @close="closeAssignRoles"
    >
      <p class="mb-4 text-sm text-gray-500 dark:text-gray-400">
        {{ t('system.user.assignRoleHint', { name: roleAssignTarget?.userName ?? '' }) }}
      </p>
      <div
        v-if="!roleOptions.length"
        class="rounded-lg border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-400 dark:border-white/10"
      >
        {{ t('system.user.rolesEmpty') }}
      </div>
      <div v-else class="max-h-[360px] overflow-y-auto rounded-lg border border-gray-100 dark:border-white/5">
        <label
          v-for="role in roleOptions"
          :key="String(role.id)"
          class="flex cursor-pointer items-center gap-3 border-t border-gray-50 px-4 py-3 first:border-t-0 dark:border-white/5"
        >
          <input
            type="checkbox"
            :checked="checkedRoleIds.has(String(role.id))"
            @change="toggleRoleCheck(role.id!, ($event.target as HTMLInputElement).checked)"
          />
          <span class="font-medium text-gray-900 dark:text-white">{{ role.roleName }}</span>
          <span v-if="role.remark" class="truncate text-sm text-gray-500 dark:text-gray-400">{{ role.remark }}</span>
        </label>
      </div>
      <template #footer>
        <button type="button" class="btn-ghost" @click="closeAssignRoles">{{ t('system.user.cancel') }}</button>
        <button type="button" class="btn-primary" :disabled="roleAssignSaving" @click="submitAssignRoles">
          {{ roleAssignSaving ? t('system.user.saving') : t('system.user.save') }}
        </button>
      </template>
    </AppModal>
  </div>
</template>
