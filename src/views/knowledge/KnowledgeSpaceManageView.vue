<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  Globe,
  Lock,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-vue-next'
import AppModal from '@/components/ui/AppModal.vue'
import FormField from '@/components/ui/FormField.vue'
import KbAccessDenied from '@/components/knowledge/KbAccessDenied.vue'
import AppCheckbox from '@/components/ui/AppCheckbox.vue'
import UserAssignPanel from '@/components/system/UserAssignPanel.vue'
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination'
import { hasFullPermission } from '@/utils/privilege'
import {
  batchAddKbSpaceMembersApi,
  batchRemoveKbSpaceMembersApi,
  createKbSpaceApi,
  deleteKbSpaceApi,
  getKbManageSpacesApi,
  getKbSpaceApi,
  listKbSpaceMembersApi,
  updateKbSpaceApi,
  updateKbSpaceMemberApi,
} from '@/api/knowledge'
import { getUserApi, listUserApi } from '@/api/user'
import { confirm } from '@/composables/useConfirm'
import { assertAction, guardAction, useActionPermissions } from '@/composables/useActionPermissions'
import { showToast } from '@/composables/useToast'
import { API_SUCCESS_CODE } from '@/types/api'
import type { KbAccessibleSpace, KbMemberRole, KbSpace, KbSpaceMember } from '@/types/knowledge'
import type { UserVo } from '@/types/user'
import { PERM } from '@/constants/permissions'

const { t } = useI18n()
const { fullPermission } = useActionPermissions()

const loading = ref(false)
const spaces = ref<KbAccessibleSpace[]>([])
const loadError = ref('')

const spaceModalOpen = ref(false)
const spaceModalTitle = ref('')
const spaceForm = ref<KbSpace>(emptySpace())
const savingSpace = ref(false)

const memberModalOpen = ref(false)
const memberSpace = ref<KbAccessibleSpace | null>(null)
const members = ref<KbSpaceMember[]>([])
const membersLoading = ref(false)
const userLabelMap = ref<Record<string, string>>({})
const missingUserIds = ref(new Set<string>())

const userQuery = reactive({
  pageNum: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  userName: '',
})
const availableUsers = ref<UserVo[]>([])
const availableTotal = ref(0)
const availableLoading = ref(false)
const pickerExistingIds = ref(new Set<string>())
const pickerRole = ref<KbMemberRole>('viewer')
const selectedUserIds = ref(new Set<string>())
const batchSelectingUsers = ref(false)
const batchProgress = ref('')
const pickerSaving = ref(false)

const selectedMemberIds = ref(new Set<string>())
const memberRemoving = ref(false)

const hasUserSelection = computed(() => selectedUserIds.value.size > 0)
const hasMemberSelection = computed(() => selectedMemberIds.value.size > 0)
const hasBatchSelection = computed(() => hasUserSelection.value || hasMemberSelection.value)

const membersPageAllSelected = computed(
  () =>
    members.value.length > 0 &&
    members.value.every((m) => m.id != null && selectedMemberIds.value.has(String(m.id))),
)
const membersPagePartialSelected = computed(
  () =>
    !membersPageAllSelected.value &&
    members.value.some((m) => m.id != null && selectedMemberIds.value.has(String(m.id))),
)

function toggleMembersPageSelect() {
  if (membersPageAllSelected.value) clearMemberSelection()
  else if (members.value.length) selectAllMembersOnPage()
}

const activePickerSpaceId = computed(() => {
  if (memberModalOpen.value && memberSpace.value?.id != null) return memberSpace.value.id
  return null
})

const canCreateSpace = computed(() => assertAction(PERM.KB_SPACE_ADD))
const canManageMembers = computed(() => assertAction(PERM.KB_SPACE_MEMBER))
const hasSpaceManageScope = computed(
  () =>
    fullPermission.value
    || assertAction(PERM.KB_SPACE_ADMIN)
    || assertAction(PERM.KB_SPACE_ADD)
    || assertAction(PERM.KB_SPACE_EDIT)
    || assertAction(PERM.KB_SPACE_REMOVE)
    || assertAction(PERM.KB_SPACE_MEMBER),
)
const adminSpaces = computed(() =>
  hasSpaceManageScope.value
    ? spaces.value
    : spaces.value.filter((s) => s.canAdmin || fullPermission.value),
)
const hasManageAccess = computed(
  () =>
    hasSpaceManageScope.value
    || canCreateSpace.value
    || (canManageMembers.value && adminSpaces.value.length > 0)
    || adminSpaces.value.some((s) => canEditSpace(s) || canRemoveSpace(s)),
)

function canEditSpace(row: KbAccessibleSpace) {
  return row.canEdit && assertAction(PERM.KB_SPACE_EDIT)
}

function canRemoveSpace(_row: KbAccessibleSpace) {
  return assertAction(PERM.KB_SPACE_REMOVE)
}

function emptySpace(): KbSpace {
  return { spaceCode: '', spaceName: '', description: '', visibility: 1, status: 1, sort: 0 }
}

function visibilityLabel(v?: number) {
  if (v === 0) return t('knowledge.space.private')
  if (v === 2) return t('knowledge.space.public')
  return t('knowledge.space.internal')
}

function visibilityIcon(v?: number) {
  if (v === 0) return Lock
  if (v === 2) return Globe
  return Users
}

function roleLabel(role: string) {
  return t(`knowledge.spaceManage.roles.${role}` as 'knowledge.spaceManage.roles.viewer')
}

function spaceRoleLabel(role?: string) {
  if (!role) return t('knowledge.spaceManage.readOnly')
  if (role === 'platform') return t('knowledge.spaceManage.roles.platform')
  if (role === 'owner') return t('knowledge.spaceManage.roles.owner')
  return roleLabel(role)
}

function spaceRoleBadgeClass(role?: string) {
  if (role === 'platform' || role === 'owner' || role === 'admin') {
    return 'badge bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
  }
  if (role === 'editor') {
    return 'badge bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
  }
  return 'badge bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300'
}

const roleCardOptions = computed(() =>
  (['viewer', 'editor'] as KbMemberRole[]).map((role) => ({
    value: role,
    label: roleLabel(role),
    desc: t(`knowledge.spaceManage.roleDesc.${role}` as 'knowledge.spaceManage.roleDesc.viewer'),
    icon: role === 'viewer' ? Eye : role === 'editor' ? Pencil : ShieldCheck,
  })),
)

function memberInitial(member: KbSpaceMember) {
  const label = memberDisplay(member)
  if (!label || label.includes(t('knowledge.spaceManage.loadingUser'))) return '?'
  const char = label.replace(/^[\(（]/, '').charAt(0)
  return char ? char.toUpperCase() : '?'
}

function formatUserLabel(user: UserVo) {
  const primary = user.nickName || user.userName
  if (!primary) return String(user.id ?? '')
  if (user.userName && primary !== user.userName) return `${primary} (${user.userName})`
  return primary
}

function memberDisplay(member: KbSpaceMember) {
  if (member.memberType === 1) {
    return t('knowledge.spaceManage.roleMember', { id: member.memberId })
  }
  const key = String(member.memberId)
  const label = userLabelMap.value[key]
  if (label) return label
  if (missingUserIds.value.has(key)) {
    return t('knowledge.spaceManage.unknownUser', { id: key })
  }
  return t('knowledge.spaceManage.loadingUser')
}

function isUnknownMember(member: KbSpaceMember) {
  return member.memberType !== 1 && missingUserIds.value.has(String(member.memberId))
}

async function loadSpaces() {
  loading.value = true
  loadError.value = ''
  try {
    const res = await getKbManageSpacesApi()
    if (res.code !== API_SUCCESS_CODE || !res.data) {
      throw new Error(res.msg || t('knowledge.spaceManage.loadFailed'))
    }
    spaces.value = res.data
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : t('knowledge.spaceManage.loadFailed')
    spaces.value = []
  } finally {
    loading.value = false
  }
}

function openCreateSpace() {
  if (!guardAction(PERM.KB_SPACE_ADD)) return
  spaceForm.value = emptySpace()
  spaceModalTitle.value = t('knowledge.spaceManage.create')
  spaceModalOpen.value = true
}

async function openEditSpace(row: KbAccessibleSpace) {
  if (!canEditSpace(row)) {
    showToast('error', t('knowledge.accessDenied.title'))
    return
  }
  try {
    const res = await getKbSpaceApi(row.id)
    if (res.code !== API_SUCCESS_CODE || !res.data) throw new Error(res.msg || t('knowledge.spaceManage.loadFailed'))
    spaceForm.value = { ...res.data }
    spaceModalTitle.value = t('knowledge.spaceManage.edit')
    spaceModalOpen.value = true
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('knowledge.spaceManage.loadFailed'))
  }
}

async function submitSpace() {
  if (!spaceForm.value.spaceCode?.trim() || !spaceForm.value.spaceName?.trim()) {
    showToast('error', t('knowledge.spaceManage.formRequired'))
    return
  }
  const isEdit = spaceForm.value.id != null
  if (isEdit) {
    if (!guardAction(PERM.KB_SPACE_EDIT)) return
  } else if (!guardAction(PERM.KB_SPACE_ADD)) {
    return
  }
  savingSpace.value = true
  try {
    const res = isEdit
      ? await updateKbSpaceApi(spaceForm.value)
      : await createKbSpaceApi(spaceForm.value)
    if (res.code !== API_SUCCESS_CODE) throw new Error(res.msg || t('knowledge.spaceManage.saveFailed'))
    showToast('success', t('knowledge.spaceManage.saveOk'))
    spaceModalOpen.value = false
    await loadSpaces()
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('knowledge.spaceManage.saveFailed'))
  } finally {
    savingSpace.value = false
  }
}

async function removeSpace(row: KbAccessibleSpace) {
  if (!canRemoveSpace(row)) return
  if (!guardAction(PERM.KB_SPACE_REMOVE)) return
  const ok = await confirm({
    title: t('knowledge.spaceManage.deleteConfirm'),
    message: row.spaceName,
  })
  if (!ok) return
  try {
    const res = await deleteKbSpaceApi(row.id)
    if (res.code !== API_SUCCESS_CODE) throw new Error(res.msg || t('knowledge.spaceManage.deleteFailed'))
    showToast('success', t('knowledge.spaceManage.deleteOk'))
    await loadSpaces()
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('knowledge.spaceManage.deleteFailed'))
  }
}

function isSuperAdminUser(user?: UserVo | null) {
  return hasFullPermission(user?.userName)
}

function resetUserPicker() {
  userQuery.pageNum = 1
  userQuery.pageSize = DEFAULT_PAGE_SIZE
  userQuery.userName = ''
  selectedUserIds.value = new Set()
  availableUsers.value = []
  availableTotal.value = 0
  pickerRole.value = 'viewer'
  batchProgress.value = ''
}

async function loadPickerExistingMembers(spaceId: number | string) {
  const res = await listKbSpaceMembersApi(spaceId)
  if (res.code !== API_SUCCESS_CODE) {
    throw new Error(res.msg || t('knowledge.spaceManage.memberLoadFailed'))
  }
  pickerExistingIds.value = new Set(
    (res.data ?? []).filter((m) => m.memberType !== 1).map((m) => String(m.memberId)),
  )
}

async function loadAvailableUsers() {
  if (!activePickerSpaceId.value) return
  availableLoading.value = true
  try {
    const res = await listUserApi({
      pageNum: userQuery.pageNum,
      pageSize: userQuery.pageSize,
      userName: userQuery.userName || undefined,
      status: 1,
    })
    if (res.code !== API_SUCCESS_CODE || !res.data) {
      availableUsers.value = []
      availableTotal.value = 0
      return
    }
    availableTotal.value = res.data.total ?? 0
    const existing = pickerExistingIds.value
    availableUsers.value = (res.data.list ?? []).filter(
      (u) => u.id != null && !existing.has(String(u.id)),
    )
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('knowledge.spaceManage.userLoadFailed'))
    availableUsers.value = []
    availableTotal.value = 0
  } finally {
    availableLoading.value = false
  }
}

async function reloadPickerUsers() {
  if (!activePickerSpaceId.value) return
  await loadPickerExistingMembers(activePickerSpaceId.value)
  await loadAvailableUsers()
}

function searchAvailableUsers() {
  if (userQuery.pageNum === 1) void loadAvailableUsers()
  else userQuery.pageNum = 1
}

function toggleUserSelect(id: number | string) {
  const key = String(id)
  const next = new Set(selectedUserIds.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  selectedUserIds.value = next
}

function selectAllUsersOnPage() {
  const next = new Set(selectedUserIds.value)
  availableUsers.value.forEach((user) => {
    if (user.id != null && !isSuperAdminUser(user)) next.add(String(user.id))
  })
  selectedUserIds.value = next
}

function deselectUsersOnPage() {
  const next = new Set(selectedUserIds.value)
  availableUsers.value.forEach((user) => {
    if (user.id != null) next.delete(String(user.id))
  })
  selectedUserIds.value = next
}

function clearUserSelection() {
  selectedUserIds.value = new Set()
}

async function fetchAllAvailableUserIds() {
  const pageSize = 200
  let pageNum = 1
  let total = 0
  const ids = new Set<string>()
  const existing = pickerExistingIds.value

  do {
    const res = await listUserApi({
      pageNum,
      pageSize,
      userName: userQuery.userName || undefined,
      status: 1,
    })
    if (res.code !== API_SUCCESS_CODE || !res.data) {
      throw new Error(res.msg || t('knowledge.spaceManage.userLoadFailed'))
    }
    total = res.data.total ?? 0
    for (const user of res.data.list ?? []) {
      if (user.id != null && !isSuperAdminUser(user) && !existing.has(String(user.id))) {
        ids.add(String(user.id))
      }
    }
    pageNum += 1
  } while ((pageNum - 1) * pageSize < total)

  return [...ids]
}

async function selectAllAvailableFiltered() {
  if (!availableTotal.value || !activePickerSpaceId.value) return
  if (
    availableTotal.value > 100
    && !(await confirm({
      message: t('system.userAssign.selectAllFilteredConfirm', { count: availableTotal.value }),
    }))
  ) {
    return
  }

  batchSelectingUsers.value = true
  batchProgress.value = t('system.userAssign.batchSelectLoading')
  try {
    const ids = await fetchAllAvailableUserIds()
    selectedUserIds.value = new Set(ids)
    showToast('success', t('system.userAssign.selectAllFilteredOk', { count: ids.length }))
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('knowledge.spaceManage.userLoadFailed'))
  } finally {
    batchSelectingUsers.value = false
    batchProgress.value = ''
  }
}

async function batchAddUsersToSpace(spaceId: number | string, role: KbMemberRole) {
  if (!selectedUserIds.value.size) {
    showToast('error', t('knowledge.spaceManage.batchAddNone'))
    return
  }

  pickerSaving.value = true
  try {
    const res = await batchAddKbSpaceMembersApi({
      spaceId,
      memberType: 0,
      memberIds: [...selectedUserIds.value],
      role,
    })
    if (res.code !== API_SUCCESS_CODE) throw new Error(res.msg || t('knowledge.spaceManage.memberAddFailed'))
    const { successCount = 0, skipCount = 0, failCount = 0 } = res.data ?? {}
    selectedUserIds.value = new Set()
    if (failCount === 0) {
      const total = successCount + skipCount
      showToast('success', t('knowledge.spaceManage.batchAddOk', { count: total }))
    } else {
      showToast('error', t('knowledge.spaceManage.batchAddPartial', { ok: successCount, fail: failCount + skipCount }))
    }
    await loadPickerExistingMembers(spaceId)
    if (memberModalOpen.value && memberSpace.value) {
      await refreshMembers()
    }
    await loadAvailableUsers()
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('knowledge.spaceManage.memberAddFailed'))
  } finally {
    pickerSaving.value = false
  }
}

async function submitMemberBatchAdd() {
  if (!memberSpace.value) return
  await batchAddUsersToSpace(memberSpace.value.id, pickerRole.value)
}

async function switchMemberSpace(spaceId: string) {
  const space = adminSpaces.value.find((s) => String(s.id) === spaceId)
  if (!space || space.id === memberSpace.value?.id) return
  memberSpace.value = space
  selectedMemberIds.value = new Set()
  selectedUserIds.value = new Set()
  userQuery.pageNum = 1
  membersLoading.value = true
  try {
    await refreshMembers()
    await reloadPickerUsers()
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('knowledge.spaceManage.memberLoadFailed'))
  } finally {
    membersLoading.value = false
  }
}

function toggleMemberSelect(id: number | string) {
  const key = String(id)
  const next = new Set(selectedMemberIds.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  selectedMemberIds.value = next
}

function selectAllMembersOnPage() {
  selectedMemberIds.value = new Set(
    members.value.filter((m) => m.id != null).map((m) => String(m.id)),
  )
}

function clearMemberSelection() {
  selectedMemberIds.value = new Set()
}

async function batchRemoveMembers() {
  const ids = [...selectedMemberIds.value]
  if (!ids.length) return
  if (!(await confirm({ message: t('knowledge.spaceManage.batchRemoveConfirm', { count: ids.length }) }))) return

  memberRemoving.value = true
  try {
    const res = await batchRemoveKbSpaceMembersApi({ ids })
    if (res.code !== API_SUCCESS_CODE) throw new Error(res.msg || t('knowledge.spaceManage.memberRemoveFailed'))
    const { successCount = 0, skipCount = 0, failCount = 0 } = res.data ?? {}
    selectedMemberIds.value = new Set()
    if (failCount === 0) {
      showToast('success', t('knowledge.spaceManage.batchRemoveOk', { count: successCount + skipCount }))
    } else {
      showToast('error', t('knowledge.spaceManage.batchRemovePartial', { ok: successCount, fail: failCount }))
    }
    if (memberSpace.value) {
      await refreshMembers()
      await reloadPickerUsers()
    }
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('knowledge.spaceManage.memberRemoveFailed'))
  } finally {
    memberRemoving.value = false
  }
}

async function openBatchGrant() {
  if (!canManageMembers.value) {
    showToast('error', t('knowledge.accessDenied.title'))
    return
  }
  if (!guardAction(PERM.KB_SPACE_MEMBER)) return
  if (!adminSpaces.value.length) {
    showToast('error', t('knowledge.spaceManage.batchGrantNoSpace'))
    return
  }
  await openMembers(adminSpaces.value[0])
}

async function loadUserLabels(ids: Array<number | string>) {
  if (!ids.length) return
  const map = { ...userLabelMap.value }
  const missing = new Set(missingUserIds.value)
  await Promise.all(
    ids.map(async (id) => {
      const key = String(id)
      if (map[key]) {
        missing.delete(key)
        return
      }
      try {
        const res = await getUserApi(id)
        if (res.code === API_SUCCESS_CODE && res.data) {
          map[key] = formatUserLabel(res.data)
          missing.delete(key)
        } else {
          missing.add(key)
        }
      } catch {
        missing.add(key)
      }
    }),
  )
  userLabelMap.value = map
  missingUserIds.value = missing
}

async function openMembers(row: KbAccessibleSpace) {
  // 成员授权由动作权限 kb:space:member 控制（菜单管数据、动作管按钮）
  if (!canManageMembers.value) {
    showToast('error', t('knowledge.accessDenied.title'))
    return
  }
  if (!guardAction(PERM.KB_SPACE_MEMBER)) return
  memberSpace.value = row
  resetUserPicker()
  selectedMemberIds.value = new Set()
  memberModalOpen.value = true
  membersLoading.value = true
  try {
    await refreshMembers()
    await reloadPickerUsers()
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('knowledge.spaceManage.memberLoadFailed'))
    members.value = []
  } finally {
    membersLoading.value = false
  }
}

async function refreshMembers() {
  if (!memberSpace.value) return
  const res = await listKbSpaceMembersApi(memberSpace.value.id)
  if (res.code !== API_SUCCESS_CODE) throw new Error(res.msg || t('knowledge.spaceManage.memberLoadFailed'))
  members.value = res.data ?? []
  await loadUserLabels(members.value.filter((m) => m.memberType !== 1).map((m) => m.memberId))
  pickerExistingIds.value = new Set(
    members.value.filter((m) => m.memberType !== 1).map((m) => String(m.memberId)),
  )
  selectedMemberIds.value = new Set(
    [...selectedMemberIds.value].filter((id) => members.value.some((m) => String(m.id) === id)),
  )
}

async function changeMemberRole(row: KbSpaceMember, role: KbMemberRole) {
  try {
    const res = await updateKbSpaceMemberApi({ ...row, role })
    if (res.code !== API_SUCCESS_CODE) throw new Error(res.msg || t('knowledge.spaceManage.memberUpdateFailed'))
    row.role = role
    showToast('success', t('knowledge.spaceManage.memberUpdateOk'))
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('knowledge.spaceManage.memberUpdateFailed'))
  }
}

async function removeMember(row: KbSpaceMember) {
  if (row.id == null) return
  const ok = await confirm({ title: t('knowledge.spaceManage.memberRemoveConfirm'), message: memberDisplay(row) })
  if (!ok) return
  try {
    const res = await batchRemoveKbSpaceMembersApi({ ids: [row.id] })
    if (res.code !== API_SUCCESS_CODE) throw new Error(res.msg || t('knowledge.spaceManage.memberRemoveFailed'))
    members.value = members.value.filter((m) => m.id !== row.id)
    showToast('success', t('knowledge.spaceManage.memberRemoveOk'))
    await reloadPickerUsers()
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('knowledge.spaceManage.memberRemoveFailed'))
  }
}

watch(
  () => [userQuery.pageNum, userQuery.pageSize],
  () => {
    if (memberModalOpen.value) void loadAvailableUsers()
  },
)

onMounted(() => loadSpaces())
</script>

<template>
  <div class="page-stack">
    <div class="flex flex-wrap items-end gap-2">
      <button type="button" class="btn-ghost shrink-0" :disabled="loading" @click="loadSpaces">
        <RefreshCw class="h-4 w-4" :class="loading && 'animate-spin'" /> {{ t('knowledge.graph.refresh') }}
      </button>
      <button
        v-if="canManageMembers && adminSpaces.length"
        type="button"
        class="btn-ghost shrink-0 border border-brand-200/90 text-brand-700 hover:border-brand-300 hover:bg-brand-50 dark:border-brand-500/30 dark:text-brand-300 dark:hover:border-brand-500/45 dark:hover:bg-brand-500/10"
        @click="openBatchGrant"
      >
        <UserPlus class="h-4 w-4" /> {{ t('knowledge.spaceManage.batchGrant') }}
      </button>
      <button v-if="canCreateSpace" type="button" class="btn-primary shrink-0" @click="openCreateSpace">
        <Plus class="h-4 w-4" /> {{ t('knowledge.spaceManage.create') }}
      </button>
    </div>

    <KbAccessDenied
      v-if="!loading && !hasManageAccess && !spaces.length"
      :title="t('knowledge.accessDenied.emptyTitle')"
      :message="t('knowledge.accessDenied.emptyMessage')"
      :hint="t('knowledge.accessDenied.emptyHint')"
    />

    <KbAccessDenied
      v-else-if="!loading && !hasManageAccess && spaces.length"
      :title="t('knowledge.accessDenied.readOnlyTitle')"
      :message="t('knowledge.accessDenied.readOnlyMessage')"
    />

    <div v-else class="card overflow-hidden">
      <p v-if="loading" class="p-12 text-center text-sm text-gray-400">{{ t('common.loading') }}</p>
      <p v-else-if="loadError" class="p-8 text-center text-sm text-rose-500">{{ loadError }}</p>
      <div v-else class="overflow-x-auto">
        <table class="w-full min-w-[48rem] text-left text-sm">
          <thead class="border-b border-gray-100 bg-gray-50 text-xs text-gray-500 dark:border-white/5 dark:bg-white/5">
            <tr>
              <th class="px-4 py-3">{{ t('knowledge.spaceManage.col.name') }}</th>
              <th class="px-4 py-3">{{ t('knowledge.spaceManage.col.code') }}</th>
              <th class="px-4 py-3">{{ t('knowledge.spaceManage.col.visibility') }}</th>
              <th class="px-4 py-3">{{ t('knowledge.spaceManage.col.permission') }}</th>
              <th class="px-4 py-3 text-right">{{ t('knowledge.spaceManage.col.actions') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-white/5">
            <tr v-for="row in spaces" :key="row.id">
              <td class="px-4 py-3 font-medium text-gray-900 dark:text-white">{{ row.spaceName }}</td>
              <td class="px-4 py-3 font-mono text-xs text-gray-500">{{ row.spaceCode }}</td>
              <td class="px-4 py-3">
                <span class="inline-flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300">
                  <component :is="visibilityIcon(row.visibility)" class="h-3.5 w-3.5" />
                  {{ visibilityLabel(row.visibility) }}
                </span>
              </td>
              <td class="px-4 py-3">
                <span :class="spaceRoleBadgeClass(row.myRole)">{{ spaceRoleLabel(row.myRole) }}</span>
              </td>
              <td class="px-4 py-3 text-right">
                <div v-if="canEditSpace(row) || canRemoveSpace(row)" class="btn-action-group justify-end">
                  <button v-if="canEditSpace(row)" type="button" class="btn-action-edit" @click="openEditSpace(row)">
                    <Pencil class="h-3.5 w-3.5" />
                    {{ t('system.user.edit') }}
                  </button>
                  <button v-if="canRemoveSpace(row)" type="button" class="btn-action-danger" @click="removeSpace(row)">
                    <Trash2 class="h-3.5 w-3.5" />
                    {{ t('system.user.delete') }}
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <AppModal :open="spaceModalOpen" :title="spaceModalTitle" @close="spaceModalOpen = false">
      <div class="space-y-4">
        <FormField :label="t('knowledge.spaceManage.form.code')" required>
          <input v-model="spaceForm.spaceCode" class="field-input" :disabled="spaceForm.id != null" />
        </FormField>
        <FormField :label="t('knowledge.spaceManage.form.name')" required>
          <input v-model="spaceForm.spaceName" class="field-input" />
        </FormField>
        <FormField :label="t('knowledge.spaceManage.form.description')">
          <textarea v-model="spaceForm.description" rows="2" class="field-input" />
        </FormField>
        <FormField :label="t('knowledge.spaceManage.form.visibility')">
          <select v-model.number="spaceForm.visibility" class="field-input">
            <option :value="2">{{ t('knowledge.space.public') }}</option>
            <option :value="1">{{ t('knowledge.space.internal') }}</option>
            <option :value="0">{{ t('knowledge.space.private') }}</option>
          </select>
        </FormField>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" class="btn-ghost" @click="spaceModalOpen = false">{{ t('confirm.cancel') }}</button>
          <button type="button" class="btn-primary" :disabled="savingSpace" @click="submitSpace">{{ t('confirm.ok') }}</button>
        </div>
      </div>
    </AppModal>

    <AppModal
      :open="memberModalOpen"
      :title="t('knowledge.spaceManage.batchGrantTitle')"
      extra-wide
      @close="memberModalOpen = false"
    >
      <div class="kb-grant-hero mb-4">
        <div class="flex flex-wrap items-start gap-4">
          <div
            class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 shadow-md"
          >
            <Users class="h-6 w-6 text-white" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('knowledge.spaceManage.batchGrantSpace') }}</p>
            <h4 class="text-base font-semibold text-gray-900 dark:text-white">{{ memberSpace?.spaceName }}</h4>
            <p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{{ t('knowledge.spaceManage.batchGrantHint') }}</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <span class="kb-grant-stat kb-grant-stat-ok">
              {{ t('knowledge.spaceManage.authorizedUsers') }} {{ members.length }}
            </span>
            <span class="kb-grant-stat">
              {{ t('knowledge.spaceManage.unauthorizedUsers') }} {{ availableTotal }}
            </span>
          </div>
        </div>

        <div class="mt-4 space-y-4 border-t border-gray-100 pt-4 dark:border-white/5">
          <FormField :label="t('knowledge.spaceManage.batchGrantSpace')" required class="sm:max-w-md">
            <select
              class="field-input"
              :value="String(memberSpace?.id ?? '')"
              @change="switchMemberSpace(($event.target as HTMLSelectElement).value)"
            >
              <option v-for="space in adminSpaces" :key="space.id" :value="String(space.id)">
                {{ space.spaceName }}
              </option>
            </select>
          </FormField>
          <div class="form-field">
            <span class="form-label">
              {{ t('knowledge.spaceManage.col.role') }}<span class="form-required">*</span>
            </span>
            <div class="kb-role-cards" role="radiogroup">
              <button
                v-for="opt in roleCardOptions"
                :key="opt.value"
                type="button"
                role="radio"
                :aria-checked="pickerRole === opt.value"
                class="kb-role-card"
                :class="pickerRole === opt.value && 'kb-role-card-active'"
                @click="pickerRole = opt.value"
              >
                <span class="kb-role-card-icon">
                  <component :is="opt.icon" class="h-4 w-4" />
                </span>
                <span class="min-w-0">
                  <span class="block text-sm font-semibold text-gray-900 dark:text-white">{{ opt.label }}</span>
                  <span class="block truncate text-xs text-gray-500 dark:text-gray-400">{{ opt.desc }}</span>
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="hasBatchSelection || batchProgress"
        class="assign-batch-bar mb-4"
      >
        <div class="min-w-0 flex-1 text-sm text-gray-600 dark:text-gray-300">
          <span class="font-medium text-gray-900 dark:text-white">{{ t('system.userAssign.batchTitle') }}</span>
          <span v-if="selectedUserIds.size" class="ml-2 tabular-nums">
            {{ t('system.userAssign.batchPendingAdd', { count: selectedUserIds.size }) }}
          </span>
          <span v-if="selectedMemberIds.size" class="ml-2 tabular-nums">
            {{ t('knowledge.spaceManage.batchPendingRemove', { count: selectedMemberIds.size }) }}
          </span>
          <span v-if="batchProgress" class="ml-2 text-xs text-brand-600 dark:text-brand-300">{{ batchProgress }}</span>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="btn-ghost text-xs"
            :disabled="pickerSaving || memberRemoving || (!selectedUserIds.size && !selectedMemberIds.size)"
            @click="clearUserSelection(); clearMemberSelection()"
          >
            {{ t('system.userAssign.clearSelection') }}
          </button>
          <button
            type="button"
            class="btn-primary text-xs"
            :disabled="!selectedUserIds.size || pickerSaving"
            @click="submitMemberBatchAdd"
          >
            <UserPlus class="h-3.5 w-3.5" />
            {{ t('system.userAssign.batchAdd', { count: selectedUserIds.size }) }}
          </button>
          <button
            type="button"
            class="btn-ghost text-xs text-red-600 dark:text-red-400"
            :disabled="!selectedMemberIds.size || memberRemoving"
            @click="batchRemoveMembers"
          >
            <Trash2 class="h-3.5 w-3.5" />
            {{ t('knowledge.spaceManage.batchRemove', { count: selectedMemberIds.size }) }}
          </button>
        </div>
      </div>

      <div class="assign-dual-panel assign-dual-panel-transfer">
        <div class="kb-grant-panel">
          <UserAssignPanel
            :title="t('knowledge.spaceManage.unauthorizedUsers')"
            :total="availableTotal"
            :users="availableUsers"
            :loading="availableLoading"
            :batch-selecting="batchSelectingUsers"
            :selected-ids="selectedUserIds"
            :user-name="userQuery.userName"
            :page-num="userQuery.pageNum"
            :page-size="userQuery.pageSize"
            :is-super-admin-user="isSuperAdminUser"
            :empty-text="t('knowledge.spaceManage.userSearchEmpty')"
            @update:user-name="userQuery.userName = $event"
            @update:page-num="userQuery.pageNum = $event"
            @update:page-size="userQuery.pageSize = $event"
            @search="searchAvailableUsers"
            @toggle="toggleUserSelect"
            @select-all-page="selectAllUsersOnPage"
            @deselect-page="deselectUsersOnPage"
            @clear-selection="clearUserSelection"
            @select-all-filtered="selectAllAvailableFiltered"
          />
        </div>

        <div class="assign-transfer-col">
          <button
            type="button"
            class="btn-primary assign-transfer-btn"
            :disabled="!selectedUserIds.size || pickerSaving"
            :title="t('knowledge.spaceManage.batchAdd')"
            @click="submitMemberBatchAdd"
          >
            <ArrowRight class="h-4 w-4" />
          </button>
          <button
            type="button"
            class="btn-ghost assign-transfer-btn text-red-600 dark:text-red-400"
            :disabled="!selectedMemberIds.size || memberRemoving"
            :title="t('knowledge.spaceManage.batchRemove', { count: selectedMemberIds.size })"
            @click="batchRemoveMembers"
          >
            <ArrowLeft class="h-4 w-4" />
          </button>
          <div class="hidden w-full gap-2 lg:contents">
            <button
              type="button"
              class="btn-primary mt-3 w-full lg:hidden"
              :disabled="!selectedUserIds.size || pickerSaving"
              @click="submitMemberBatchAdd"
            >
              <UserPlus class="h-4 w-4" /> {{ t('system.userAssign.batchAdd', { count: selectedUserIds.size }) }}
            </button>
            <button
              type="button"
              class="btn-ghost mt-2 w-full text-red-600 dark:text-red-400 lg:hidden"
              :disabled="!selectedMemberIds.size || memberRemoving"
              @click="batchRemoveMembers"
            >
              <Trash2 class="h-4 w-4" /> {{ t('knowledge.spaceManage.batchRemove', { count: selectedMemberIds.size }) }}
            </button>
          </div>
        </div>

        <div class="kb-grant-panel">
          <section class="assign-user-panel">
            <div class="assign-panel-head">
              <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
                {{ t('knowledge.spaceManage.authorizedUsers') }}
                <span class="ml-1 font-normal tabular-nums text-gray-400">({{ members.length }})</span>
              </h3>
            </div>
            <div class="assign-user-toolbar">
              <AppCheckbox
                class="assign-user-toolbar-check"
                size="sm"
                :class="!members.length && 'cursor-not-allowed opacity-50'"
                :disabled="!members.length"
                :model-value="membersPageAllSelected"
                :indeterminate="membersPagePartialSelected"
                @update:model-value="toggleMembersPageSelect"
              >
                <span>{{ t('system.userAssign.selectAllPage') }}</span>
              </AppCheckbox>
              <span v-if="selectedMemberIds.size" class="assign-user-toolbar-selected">
                {{ t('system.userAssign.selectedCount', { count: selectedMemberIds.size }) }}
                <button type="button" class="assign-user-toolbar-clear" @click="clearMemberSelection">
                  {{ t('system.userAssign.clearSelection') }}
                </button>
              </span>
            </div>
            <p v-if="membersLoading" class="py-12 text-center text-sm text-gray-400">{{ t('common.loading') }}</p>
            <ul v-else-if="members.length" class="assign-user-list">
              <li v-for="m in members" :key="m.id" class="assign-member-item">
                <div
                  class="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5"
                  @click="m.id != null && toggleMemberSelect(m.id)"
                >
                  <AppCheckbox
                    standalone
                    size="sm"
                    :model-value="m.id != null && selectedMemberIds.has(String(m.id))"
                    @update:model-value="m.id != null && toggleMemberSelect(m.id)"
                    @click.stop
                  />
                  <div
                    class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                    :class="isUnknownMember(m) ? 'bg-gradient-to-br from-amber-400 to-orange-500' : 'bg-gradient-to-br from-emerald-400 to-teal-600'"
                  >
                    {{ memberInitial(m) }}
                  </div>
                  <div class="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                    <span class="truncate text-sm font-medium text-gray-900 dark:text-white">{{ memberDisplay(m) }}</span>
                    <span
                      v-if="isUnknownMember(m)"
                      class="inline-flex items-center rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                    >
                      {{ t('knowledge.spaceManage.invalidMember') }}
                    </span>
                  </div>
                </div>
                <div class="flex shrink-0 items-center gap-1.5">
                  <select
                    :value="m.role"
                    class="kb-grant-role-select"
                    @change="changeMemberRole(m, ($event.target as HTMLSelectElement).value as KbMemberRole)"
                  >
                    <option value="viewer">{{ roleLabel('viewer') }}</option>
                    <option value="editor">{{ roleLabel('editor') }}</option>
                  </select>
                  <button
                    type="button"
                    class="btn-action-danger !px-1.5 !py-0.5"
                    :title="t('system.user.delete')"
                    @click="removeMember(m)"
                  >
                    <Trash2 class="h-3 w-3" />
                  </button>
                </div>
              </li>
            </ul>
            <p v-else class="py-12 text-center text-sm text-gray-400">{{ t('knowledge.spaceManage.membersEmpty') }}</p>
          </section>
        </div>
      </div>

      <template #footer>
        <button type="button" class="btn-ghost" @click="memberModalOpen = false">{{ t('confirm.cancel') }}</button>
        <button
          type="button"
          class="btn-primary"
          :disabled="!selectedUserIds.size || pickerSaving"
          @click="submitMemberBatchAdd"
        >
          <UserPlus class="h-4 w-4" />
          {{ t('system.userAssign.batchAdd', { count: selectedUserIds.size }) }}
        </button>
      </template>
    </AppModal>
  </div>
</template>

<style scoped>
.kb-grant-hero {
  @apply rounded-xl border border-gray-100 bg-gradient-to-br from-gray-50/80 to-white px-4 py-4 dark:border-white/5 dark:from-white/[0.03] dark:to-transparent;
}

.kb-grant-stat {
  @apply rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600 dark:bg-white/10 dark:text-gray-300;
}

.kb-grant-stat-ok {
  @apply bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300;
}

.kb-grant-panel {
  @apply min-w-0 rounded-xl border border-gray-100 bg-white p-3 dark:border-white/5 dark:bg-white/[0.02] sm:p-4;
}

.kb-grant-role-select {
  @apply field-input max-w-[6.5rem] py-1 text-xs;
}

.kb-role-cards {
  @apply grid gap-2 sm:grid-cols-3;
}

.kb-role-card {
  @apply flex items-center gap-2.5 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-left transition;
  @apply hover:border-brand-300 hover:bg-brand-50/40 hover:shadow-sm;
  @apply focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40;
  @apply dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-brand-500/40 dark:hover:bg-brand-500/10;
}

.kb-role-card-icon {
  @apply flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 transition;
  @apply dark:bg-white/10 dark:text-gray-300;
}

.kb-role-card-active {
  @apply border-brand-500 bg-brand-50 shadow-sm ring-1 ring-brand-500/30;
  @apply dark:border-brand-400/60 dark:bg-brand-500/15 dark:ring-brand-400/30;
}

.kb-role-card-active .kb-role-card-icon {
  @apply bg-brand-500 text-white dark:bg-brand-500;
}

.assign-member-item {
  @apply flex items-center gap-2 rounded-lg px-1.5 py-1 transition hover:bg-gray-50 dark:hover:bg-white/5;
}

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
  @apply flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-100 bg-brand-50/50 px-4 py-3 dark:border-brand-500/20 dark:bg-brand-500/10;
}

.assign-user-toolbar {
  @apply mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-gray-50 px-2.5 py-2 text-xs text-gray-600 dark:bg-white/5 dark:text-gray-300;
}

.assign-user-toolbar-check {
  @apply inline-flex cursor-pointer items-center gap-1.5;
}

.assign-user-toolbar-selected {
  @apply inline-flex items-center gap-1.5 text-brand-700 dark:text-brand-300;
}

.assign-user-toolbar-clear {
  @apply text-gray-500 underline-offset-2 hover:text-brand-600 hover:underline dark:text-gray-400 dark:hover:text-brand-300;
}

.assign-user-list {
  @apply max-h-[min(480px,55vh)] space-y-0.5 overflow-y-auto rounded-lg border border-gray-100 p-1 dark:border-white/5;
}
</style>
