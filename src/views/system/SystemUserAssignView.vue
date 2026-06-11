<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { listSystemApi } from '@/api/system'
import {
  getSystemByUserIdApi,
  getUserApi,
  getUserBySystemApi,
  listUserApi,
  unauthorizedUsersBySystemApi,
} from '@/api/user'
import SystemAssignSidebar from '@/components/system/SystemAssignSidebar.vue'
import UserAssignPanel from '@/components/system/UserAssignPanel.vue'
import UserAssignSidebar from '@/components/system/UserAssignSidebar.vue'
import UserSystemGroupChecklist from '@/components/system/UserSystemGroupChecklist.vue'
import { confirm } from '@/composables/useConfirm'
import { showToast } from '@/composables/useToast'
import { useSystemUserMatrix } from '@/composables/useSystemUserMatrix'
import { API_SUCCESS_CODE } from '@/types/api'
import {
  SYSTEM_GROUP_ACCENT,
  normalizeSystemGroup,
  type SystemGroup,
} from '@/constants/systemGroup'
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination'
import type { SysSystem } from '@/types/system'
import type { UserVo } from '@/types/user'
import {
  ArrowLeft,
  ArrowRight,
  LayoutGrid,
  RefreshCw,
  Trash2,
  UserRound,
  Users,
} from 'lucide-vue-next'

type AssignTab = 'system' | 'user'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const {
  isSuperAdminUser,
  addUsersToSystem,
  removeUsersFromSystem,
  saveUserSystems,
} = useSystemUserMatrix()

const activeTab = ref<AssignTab>('system')
const systemLoading = ref(false)
const systemList = ref<SysSystem[]>([])
const selectedSystemId = ref('')
const selectedUserId = ref('')
const panelSaving = ref(false)

const systemSidebarQuery = reactive({
  systemName: '',
})

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

const userListQuery = reactive({
  pageNum: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  userName: '',
})

const userList = ref<UserVo[]>([])
const userListTotal = ref(0)
const userListLoading = ref(false)
const selectedUser = ref<UserVo | null>(null)

const selectedAuthorizedIds = ref(new Set<string>())
const selectedUnauthorizedIds = ref(new Set<string>())

const userSystemOptions = ref<SysSystem[]>([])
const checkedSystemIds = ref(new Set<string>())
const userAssignSaving = ref(false)
const userAssignLoading = ref(false)

const authorizedUsers = ref<UserVo[]>([])
const unauthorizedUsers = ref<UserVo[]>([])
const authorizedTotal = ref(0)
const unauthorizedTotal = ref(0)
const authorizedLoading = ref(false)
const unauthorizedLoading = ref(false)
const systemUserCounts = ref(new Map<string, number>())
const batchSelectingUnauthorized = ref(false)
const batchSelectingAuthorized = ref(false)
const batchProgress = ref('')

const selectedSystem = computed(() =>
  systemList.value.find((row) => String(row.id) === selectedSystemId.value),
)

const userAssignReadonly = computed(() => isSuperAdminUser(selectedUser.value))

const selectedSystemGroup = computed(() =>
  selectedSystem.value ? normalizeSystemGroup(selectedSystem.value.systemGroup) : 'business',
)

const systemPanelLoading = computed(() => authorizedLoading.value || unauthorizedLoading.value)
const pageBusy = computed(
  () =>
    userListLoading.value ||
    systemLoading.value ||
    systemPanelLoading.value ||
    batchSelectingUnauthorized.value ||
    batchSelectingAuthorized.value ||
    panelSaving.value,
)
const hasBatchSelection = computed(
  () => selectedUnauthorizedIds.value.size > 0 || selectedAuthorizedIds.value.size > 0,
)

function userInitial(user: UserVo) {
  return (user.nickName || user.userName || 'U').charAt(0).toUpperCase()
}

function selectSystem(id: number | string) {
  selectedSystemId.value = String(id)
  authorizedQuery.pageNum = 1
  unauthorizedQuery.pageNum = 1
  authorizedQuery.userName = ''
  unauthorizedQuery.userName = ''
  selectedAuthorizedIds.value = new Set()
  selectedUnauthorizedIds.value = new Set()
  void loadSystemPanelUsers()
}

function selectUser(id: number | string) {
  selectedUserId.value = String(id)
  const picked = userList.value.find((row) => String(row.id) === String(id))
  selectedUser.value = picked ?? selectedUser.value
  void loadUserSystems(id)
}

async function loadUserList() {
  userListLoading.value = true
  try {
    const result = await listUserApi({
      pageNum: userListQuery.pageNum,
      pageSize: userListQuery.pageSize,
      userName: userListQuery.userName || undefined,
    })
    if (result.code !== API_SUCCESS_CODE || !result.data) {
      throw new Error(result.msg || t('system.userAssign.loadFailed'))
    }
    userList.value = result.data.list ?? []
    userListTotal.value = result.data.total ?? 0
    if (selectedUserId.value) {
      const picked = userList.value.find((row) => String(row.id) === selectedUserId.value)
      if (picked) selectedUser.value = picked
    }
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.userAssign.loadFailed'))
  } finally {
    userListLoading.value = false
  }
}

async function resolveSelectedUser(userId: string) {
  selectedUserId.value = userId
  const picked = userList.value.find((row) => String(row.id) === userId)
  if (picked) {
    selectedUser.value = picked
    return
  }
  try {
    const result = await getUserApi(userId)
    if (result.code === API_SUCCESS_CODE && result.data) {
      selectedUser.value = result.data as UserVo
    }
  } catch {
    selectedUser.value = null
  }
}

function searchUserList() {
  if (userListQuery.pageNum === 1) void loadUserList()
  else userListQuery.pageNum = 1
}

function syncSelectedSystemUserCount() {
  if (!selectedSystemId.value) return
  systemUserCounts.value.set(selectedSystemId.value, authorizedTotal.value)
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

async function fetchAllUserIdsForSystem(authorized: boolean) {
  if (!selectedSystemId.value) return []

  const fetchPage = authorized ? getUserBySystemApi : unauthorizedUsersBySystemApi
  const query = authorized ? authorizedQuery : unauthorizedQuery
  const pageSize = 200
  let pageNum = 1
  let total = 0
  const ids = new Set<string>()

  do {
    const result = await fetchPage({
      systemId: selectedSystemId.value,
      pageNum,
      pageSize,
      userName: query.userName || undefined,
    })
    if (result.code !== API_SUCCESS_CODE || !result.data) {
      throw new Error(result.msg || t('system.userAssign.loadFailed'))
    }
    total = result.data.total ?? 0
    for (const user of result.data.list ?? []) {
      if (user.id != null && !isSuperAdminUser(user)) ids.add(String(user.id))
    }
    pageNum += 1
  } while ((pageNum - 1) * pageSize < total)

  return [...ids]
}

async function selectAllUnauthorizedFiltered() {
  if (!unauthorizedTotal.value || !selectedSystemId.value) return
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
    const ids = await fetchAllUserIdsForSystem(false)
    selectedUnauthorizedIds.value = new Set(ids)
    showToast('success', t('system.userAssign.selectAllFilteredOk', { count: ids.length }))
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.userAssign.loadFailed'))
  } finally {
    batchSelectingUnauthorized.value = false
    batchProgress.value = ''
  }
}

async function selectAllAuthorizedFiltered() {
  if (!authorizedTotal.value || !selectedSystemId.value) return
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
    const ids = await fetchAllUserIdsForSystem(true)
    selectedAuthorizedIds.value = new Set(ids)
    showToast('success', t('system.userAssign.selectAllFilteredOk', { count: ids.length }))
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.userAssign.loadFailed'))
  } finally {
    batchSelectingAuthorized.value = false
    batchProgress.value = ''
  }
}

function selectAllUserSystems() {
  checkedSystemIds.value = new Set(userSystemOptions.value.map((row) => String(row.id)))
}

function clearAllUserSystems() {
  checkedSystemIds.value = new Set()
}

function toggleUserSystemGroup(group: SystemGroup, checked: boolean) {
  const next = new Set(checkedSystemIds.value)
  userSystemOptions.value
    .filter((row) => normalizeSystemGroup(row.systemGroup) === group)
    .forEach((row) => {
      const key = String(row.id)
      if (checked) next.add(key)
      else next.delete(key)
    })
  checkedSystemIds.value = next
}

function reportBatchProgress(done: number, total: number) {
  batchProgress.value = t('system.userAssign.batchProcessing', { done, total })
}

async function loadSystems() {
  systemLoading.value = true
  try {
    const result = await listSystemApi({ pageNum: 1, pageSize: 200 })
    if (result.code !== API_SUCCESS_CODE || !result.data) {
      throw new Error(result.msg || t('system.userAssign.loadFailed'))
    }
    systemList.value = result.data.list ?? []
    if (!selectedSystemId.value && systemList.value.length) {
      selectSystem(systemList.value[0].id!)
    }
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.userAssign.loadFailed'))
  } finally {
    systemLoading.value = false
  }
}

async function loadUserSystems(userId: number | string) {
  userAssignLoading.value = true
  try {
    const result = await getSystemByUserIdApi(userId)
    if (result.code !== API_SUCCESS_CODE) {
      throw new Error(result.msg || t('system.userAssign.loadFailed'))
    }
    userSystemOptions.value = result.data?.systemList ?? []
    checkedSystemIds.value = new Set(result.data?.systemIds?.map((id) => String(id)) ?? [])
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.userAssign.loadFailed'))
  } finally {
    userAssignLoading.value = false
  }
}

async function loadAuthorizedUsers() {
  if (!selectedSystemId.value) return
  authorizedLoading.value = true
  try {
    const result = await getUserBySystemApi({
      systemId: selectedSystemId.value,
      pageNum: authorizedQuery.pageNum,
      pageSize: authorizedQuery.pageSize,
      userName: authorizedQuery.userName || undefined,
    })
    if (result.code !== API_SUCCESS_CODE || !result.data) {
      throw new Error(result.msg || t('system.userAssign.loadFailed'))
    }
    authorizedUsers.value = result.data.list ?? []
    authorizedTotal.value = result.data.total ?? 0
    syncSelectedSystemUserCount()
    selectedAuthorizedIds.value = new Set(
      [...selectedAuthorizedIds.value].filter((id) => authorizedUsers.value.some((row) => String(row.id) === id)),
    )
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.userAssign.loadFailed'))
  } finally {
    authorizedLoading.value = false
  }
}

async function loadUnauthorizedUsers() {
  if (!selectedSystemId.value) return
  unauthorizedLoading.value = true
  try {
    const result = await unauthorizedUsersBySystemApi({
      systemId: selectedSystemId.value,
      pageNum: unauthorizedQuery.pageNum,
      pageSize: unauthorizedQuery.pageSize,
      userName: unauthorizedQuery.userName || undefined,
    })
    if (result.code !== API_SUCCESS_CODE || !result.data) {
      throw new Error(result.msg || t('system.userAssign.loadFailed'))
    }
    unauthorizedUsers.value = result.data.list ?? []
    unauthorizedTotal.value = result.data.total ?? 0
    selectedUnauthorizedIds.value = new Set(
      [...selectedUnauthorizedIds.value].filter((id) => unauthorizedUsers.value.some((row) => String(row.id) === id)),
    )
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.userAssign.loadFailed'))
  } finally {
    unauthorizedLoading.value = false
  }
}

async function loadSystemPanelUsers() {
  await Promise.all([loadAuthorizedUsers(), loadUnauthorizedUsers()])
}

async function refreshAll() {
  await loadSystems()
  if (activeTab.value === 'system') {
    if (selectedSystemId.value) {
      await loadSystemPanelUsers()
    }
  } else {
    await loadUserList()
    if (selectedUserId.value) {
      await resolveSelectedUser(selectedUserId.value)
      await loadUserSystems(selectedUserId.value)
    }
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

function toggleSystemCheck(systemId: number | string, checked: boolean) {
  const key = String(systemId)
  const next = new Set(checkedSystemIds.value)
  if (checked) next.add(key)
  else next.delete(key)
  checkedSystemIds.value = next
}

function searchAuthorizedUsers() {
  if (authorizedQuery.pageNum === 1) void loadAuthorizedUsers()
  else authorizedQuery.pageNum = 1
}

function searchUnauthorizedUsers() {
  if (unauthorizedQuery.pageNum === 1) void loadUnauthorizedUsers()
  else unauthorizedQuery.pageNum = 1
}

async function addSelectedUsers() {
  const ids = [...selectedUnauthorizedIds.value]
  if (!ids.length || !selectedSystemId.value) return

  panelSaving.value = true
  batchProgress.value = ''
  try {
    const total = ids.length
    await addUsersToSystem(
      selectedSystemId.value,
      ids,
      unauthorizedUsers.value,
      total > 20 ? reportBatchProgress : undefined,
    )
    showToast('success', t('system.userAssign.addOk'))
    selectedUnauthorizedIds.value = new Set()
    await loadSystemPanelUsers()
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.userAssign.addFailed'))
  } finally {
    panelSaving.value = false
    batchProgress.value = ''
  }
}

async function removeSelectedUsers() {
  const ids = [...selectedAuthorizedIds.value].filter((userId) => {
    const user = authorizedUsers.value.find((row) => String(row.id) === userId)
    return user && !isSuperAdminUser(user)
  })
  if (!ids.length || !selectedSystemId.value) return
  if (!(await confirm({ message: t('system.userAssign.removeConfirm', { count: ids.length }) }))) return

  panelSaving.value = true
  batchProgress.value = ''
  try {
    const total = ids.length
    await removeUsersFromSystem(
      selectedSystemId.value,
      ids,
      authorizedUsers.value,
      total > 20 ? reportBatchProgress : undefined,
    )
    showToast('success', t('system.userAssign.removeOk'))
    selectedAuthorizedIds.value = new Set()
    await loadSystemPanelUsers()
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.userAssign.removeFailed'))
  } finally {
    panelSaving.value = false
    batchProgress.value = ''
  }
}

async function submitUserSystems() {
  if (!selectedUserId.value) return

  userAssignSaving.value = true
  try {
    await saveUserSystems(selectedUserId.value, [...checkedSystemIds.value])
    showToast('success', t('system.user.assignSystemOk'))
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.user.assignSystemFailed'))
  } finally {
    userAssignSaving.value = false
  }
}

function applyRouteQuery() {
  const systemId = route.query.systemId
  const userId = route.query.userId
  if (userId != null && userId !== '') {
    activeTab.value = 'user'
    void resolveSelectedUser(String(userId)).then(() => loadUserSystems(String(userId)))
    return
  }
  activeTab.value = 'system'
  if (systemId != null && systemId !== '') {
    selectedSystemId.value = String(systemId)
  }
}

function switchTab(tab: AssignTab) {
  activeTab.value = tab
  router.replace({ query: {} })
  if (tab === 'user') {
    if (!userList.value.length) void loadUserList()
  } else if (selectedSystemId.value) {
    void loadSystemPanelUsers()
  }
}

function onFilterGroup(group: SystemGroup | '') {
  if (group && systemList.value.length) {
    const first = systemList.value.find((s) => normalizeSystemGroup(s.systemGroup) === group)
    if (first?.id) selectSystem(first.id)
  }
}

watch(activeTab, (tab) => {
  if (tab === 'user') {
    if (!userList.value.length) void loadUserList()
    if (selectedUserId.value) void loadUserSystems(selectedUserId.value)
  } else if (selectedSystemId.value) {
    void loadSystemPanelUsers()
  }
})

watch(
  () => authorizedQuery.pageNum,
  () => {
    if (activeTab.value === 'system' && selectedSystemId.value) void loadAuthorizedUsers()
  },
)

watch(
  () => authorizedQuery.pageSize,
  () => {
    if (activeTab.value === 'system' && selectedSystemId.value) searchAuthorizedUsers()
  },
)

watch(
  () => unauthorizedQuery.pageNum,
  () => {
    if (activeTab.value === 'system' && selectedSystemId.value) void loadUnauthorizedUsers()
  },
)

watch(
  () => unauthorizedQuery.pageSize,
  () => {
    if (activeTab.value === 'system' && selectedSystemId.value) searchUnauthorizedUsers()
  },
)

watch(
  () => [userListQuery.pageNum, userListQuery.pageSize],
  () => {
    if (activeTab.value === 'user') void loadUserList()
  },
)

watch(
  () => [route.query.userId, route.query.systemId],
  () => applyRouteQuery(),
)

onMounted(async () => {
  applyRouteQuery()
  await loadSystems()
  if (activeTab.value === 'system') {
    if (selectedSystemId.value) await loadSystemPanelUsers()
  } else {
    await loadUserList()
    if (selectedUserId.value) {
      await resolveSelectedUser(selectedUserId.value)
      await loadUserSystems(selectedUserId.value)
    }
  }
})
</script>

<template>
  <div class="page-stack">
    <div class="card p-5">
      <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <button type="button" class="btn-ghost mb-2 px-2 py-1 text-sm" @click="router.back()">
            <ArrowLeft class="h-4 w-4" />
            {{ t('system.userAssign.back') }}
          </button>
          <h1 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('system.userAssign.title') }}</h1>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ t('system.userAssign.subtitle') }}</p>
        </div>
        <button
          type="button"
          class="btn-ghost shrink-0"
          :disabled="pageBusy"
          @click="refreshAll"
        >
          <RefreshCw
            class="h-4 w-4"
            :class="{ 'animate-spin': pageBusy }"
          />
          {{ t('system.userAssign.refresh') }}
        </button>
      </div>

      <div class="flex flex-wrap gap-2 border-b border-gray-100 pb-4 dark:border-white/5">
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition"
          :class="
            activeTab === 'system'
              ? 'bg-primary/10 text-primary'
              : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/5'
          "
          @click="switchTab('system')"
        >
          <LayoutGrid class="h-4 w-4" />
          {{ t('system.userAssign.tabBySystem') }}
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition"
          :class="
            activeTab === 'user'
              ? 'bg-primary/10 text-primary'
              : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/5'
          "
          @click="switchTab('user')"
        >
          <UserRound class="h-4 w-4" />
          {{ t('system.userAssign.tabByUser') }}
        </button>
      </div>
    </div>

    <!-- 按系统 -->
    <div v-if="activeTab === 'system'" class="flex flex-col gap-4 xl:flex-row xl:items-start">
      <aside class="w-full shrink-0 xl:w-80 xl:sticky xl:top-20 xl:self-start 2xl:w-[22rem]">
        <div class="card p-4 sm:p-5">
          <h2 class="mb-4 text-base font-semibold text-gray-900 dark:text-white">
            {{ t('system.userAssign.selectSystem') }}
          </h2>
          <SystemAssignSidebar
            :systems="systemList"
            :selected-id="selectedSystemId"
            :loading="systemLoading"
            :user-counts="systemUserCounts"
            :search="systemSidebarQuery.systemName"
            @select="selectSystem"
            @update:search="systemSidebarQuery.systemName = $event"
            @filter-group="onFilterGroup"
          />
        </div>
      </aside>

      <div class="min-w-0 flex-1">
        <div v-if="!selectedSystem" class="card p-10 text-center text-sm text-gray-400">
          {{ t('system.userAssign.pickSystemHint') }}
        </div>
        <div v-else class="card p-5">
          <div class="mb-5 flex flex-wrap items-start gap-4 border-b border-gray-100 pb-4 dark:border-white/5">
            <div
              class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl shadow-md"
              :class="`bg-gradient-to-br ${SYSTEM_GROUP_ACCENT[selectedSystemGroup]}`"
            >
              <LayoutGrid class="h-6 w-6 text-white" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-xs text-gray-500 dark:text-gray-400">
                {{ t(`system.portal.group.${selectedSystemGroup}`) }}
              </p>
              <h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ selectedSystem.systemName }}</h2>
              <p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                {{ t('system.userAssign.systemMembersHint', { name: selectedSystem.systemName ?? '' }) }}
              </p>
            </div>
            <div class="flex flex-wrap gap-2">
              <span class="rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                {{ t('system.userAssign.authorizedUsers') }} {{ authorizedTotal }}
              </span>
              <span class="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600 dark:bg-white/10 dark:text-gray-300">
                {{ t('system.userAssign.unauthorizedUsers') }} {{ unauthorizedTotal }}
              </span>
            </div>
          </div>

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
                :disabled="panelSaving || (!selectedUnauthorizedIds.size && !selectedAuthorizedIds.size)"
                @click="clearUnauthorizedSelection(); clearAuthorizedSelection()"
              >
                {{ t('system.userAssign.clearSelection') }}
              </button>
              <button
                type="button"
                class="btn-primary text-xs"
                :disabled="!selectedUnauthorizedIds.size || panelSaving"
                @click="addSelectedUsers"
              >
                <Users class="h-3.5 w-3.5" />
                {{ t('system.userAssign.batchAdd', { count: selectedUnauthorizedIds.size }) }}
              </button>
              <button
                type="button"
                class="btn-ghost text-xs text-red-600 dark:text-red-400"
                :disabled="!selectedAuthorizedIds.size || panelSaving"
                @click="removeSelectedUsers"
              >
                <Trash2 class="h-3.5 w-3.5" />
                {{ t('system.userAssign.batchRemove', { count: selectedAuthorizedIds.size }) }}
              </button>
            </div>
          </div>

          <div class="assign-dual-panel assign-dual-panel-transfer">
            <UserAssignPanel
              :title="t('system.userAssign.authorizedUsers')"
              :total="authorizedTotal"
              :users="authorizedUsers"
              :loading="authorizedLoading"
              :batch-selecting="batchSelectingAuthorized"
              :selected-ids="selectedAuthorizedIds"
              :user-name="authorizedQuery.userName"
              :page-num="authorizedQuery.pageNum"
              :page-size="authorizedQuery.pageSize"
              :is-super-admin-user="isSuperAdminUser"
              :empty-text="t('system.userAssign.authorizedEmpty')"
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
                :disabled="!selectedUnauthorizedIds.size || panelSaving"
                :title="t('system.userAssign.addSelected')"
                @click="addSelectedUsers"
              >
                <ArrowLeft class="h-4 w-4" />
              </button>
              <button
                type="button"
                class="btn-ghost assign-transfer-btn text-red-600 dark:text-red-400"
                :disabled="!selectedAuthorizedIds.size || panelSaving"
                :title="t('system.userAssign.removeSelected')"
                @click="removeSelectedUsers"
              >
                <ArrowRight class="h-4 w-4" />
              </button>
              <div class="hidden w-full gap-2 xl:contents">
                <button
                  type="button"
                  class="btn-primary mt-3 w-full xl:hidden"
                  :disabled="!selectedUnauthorizedIds.size || panelSaving"
                  @click="addSelectedUsers"
                >
                  <Users class="h-4 w-4" /> {{ t('system.userAssign.addSelected') }}
                </button>
                <button
                  type="button"
                  class="btn-ghost mt-2 w-full text-red-600 dark:text-red-400 xl:hidden"
                  :disabled="!selectedAuthorizedIds.size || panelSaving"
                  @click="removeSelectedUsers"
                >
                  <Trash2 class="h-4 w-4" /> {{ t('system.userAssign.removeSelected') }}
                </button>
              </div>
            </div>

            <UserAssignPanel
              :title="t('system.userAssign.unauthorizedUsers')"
              :total="unauthorizedTotal"
              :users="unauthorizedUsers"
              :loading="unauthorizedLoading"
              :batch-selecting="batchSelectingUnauthorized"
              :selected-ids="selectedUnauthorizedIds"
              :user-name="unauthorizedQuery.userName"
              :page-num="unauthorizedQuery.pageNum"
              :page-size="unauthorizedQuery.pageSize"
              :is-super-admin-user="isSuperAdminUser"
              :empty-text="t('system.userAssign.unauthorizedEmpty')"
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
        </div>
      </div>
    </div>

    <!-- 按用户 -->
    <div v-else class="flex flex-col gap-4 xl:flex-row xl:items-start">
      <aside class="w-full shrink-0 xl:w-80 xl:sticky xl:top-20 xl:self-start 2xl:w-[22rem]">
        <div class="card p-4 sm:p-5">
          <h2 class="mb-4 text-base font-semibold text-gray-900 dark:text-white">{{ t('system.userAssign.selectUser') }}</h2>
          <UserAssignSidebar
            :users="userList"
            :total="userListTotal"
            :loading="userListLoading"
            :selected-id="selectedUserId"
            :user-name="userListQuery.userName"
            :page-num="userListQuery.pageNum"
            :page-size="userListQuery.pageSize"
            :is-super-admin-user="isSuperAdminUser"
            @select="selectUser"
            @update:user-name="userListQuery.userName = $event"
            @update:page-num="userListQuery.pageNum = $event"
            @update:page-size="userListQuery.pageSize = $event"
            @search="searchUserList"
          />
        </div>
      </aside>

      <div class="min-w-0 flex-1">
        <div v-if="!selectedUser" class="card p-10 text-center text-sm text-gray-400">
          {{ t('system.userAssign.pickUserHint') }}
        </div>
        <div v-else class="card p-5">
          <div class="mb-5 flex items-center gap-3 border-b border-gray-100 pb-4 dark:border-white/5">
            <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-lg font-semibold text-white">
              {{ userInitial(selectedUser) }}
            </div>
            <div>
              <h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ selectedUser.userName }}</h2>
              <p class="text-sm text-gray-500 dark:text-gray-400">
                {{
                  userAssignReadonly
                    ? t('system.user.assignSystemSuperAdminHint', { name: selectedUser.userName ?? '' })
                    : t('system.user.assignSystemHint', { name: selectedUser.userName ?? '' })
                }}
              </p>
            </div>
          </div>

          <div v-if="userAssignLoading" class="py-16 text-center text-sm text-gray-400">{{ t('system.user.loading') }}</div>
          <div
            v-else-if="!userSystemOptions.length"
            class="rounded-lg border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-400 dark:border-white/10"
          >
            {{ t('system.user.systemsEmpty') }}
          </div>
          <UserSystemGroupChecklist
            v-else
            :systems="userSystemOptions"
            :checked-ids="checkedSystemIds"
            :readonly="userAssignReadonly"
            @toggle="toggleSystemCheck"
            @select-all="selectAllUserSystems"
            @clear-all="clearAllUserSystems"
            @toggle-group="toggleUserSystemGroup"
          />

          <div class="mt-6 flex justify-end gap-2 border-t border-gray-100 pt-4 dark:border-white/5">
            <button type="button" class="btn-ghost" @click="router.back()">{{ t('system.user.cancel') }}</button>
            <button
              type="button"
              class="btn-primary"
              :disabled="userAssignSaving || userAssignReadonly"
              @click="submitUserSystems"
            >
              {{ userAssignSaving ? t('system.user.saving') : t('system.user.save') }}
            </button>
          </div>
        </div>
      </div>
    </div>
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
