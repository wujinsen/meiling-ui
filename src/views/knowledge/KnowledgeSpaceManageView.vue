<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Globe,
  Lock,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-vue-next'
import AppModal from '@/components/ui/AppModal.vue'
import FormField from '@/components/ui/FormField.vue'
import KbAccessDenied from '@/components/knowledge/KbAccessDenied.vue'
import {
  addKbSpaceMemberApi,
  createKbSpaceApi,
  deleteKbSpaceApi,
  getKbAccessibleSpacesApi,
  getKbSpaceApi,
  listKbSpaceMembersApi,
  removeKbSpaceMemberApi,
  updateKbSpaceApi,
  updateKbSpaceMemberApi,
} from '@/api/knowledge'
import { getUserApi, listUserApi } from '@/api/user'
import { confirm } from '@/composables/useConfirm'
import { assertAction } from '@/composables/useActionPermissions'
import { showToast } from '@/composables/useToast'
import { API_SUCCESS_CODE } from '@/types/api'
import type { KbAccessibleSpace, KbMemberRole, KbSpace, KbSpaceMember } from '@/types/knowledge'
import type { UserVo } from '@/types/user'

const { t } = useI18n()

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

const userSearch = ref('')
const userResults = ref<UserVo[]>([])
const userSearchLoading = ref(false)
const newMemberRole = ref<KbMemberRole>('viewer')
const selectedUserIds = ref(new Set<string>())
const batchAdding = ref(false)

const allUsersSelected = computed(
  () =>
    userResults.value.length > 0
    && userResults.value.every((u) => u.id != null && selectedUserIds.value.has(String(u.id))),
)
const hasUserSelection = computed(() => selectedUserIds.value.size > 0)
const selectedUserCount = computed(() => selectedUserIds.value.size)

const canCreateSpace = computed(() => true)
const isKbAdmin = computed(() => assertAction('kb:admin'))
const adminSpaces = computed(() =>
  spaces.value.filter((s) => s.canAdmin || isKbAdmin.value),
)
const hasManageAccess = computed(() => adminSpaces.value.length > 0 || isKbAdmin.value)

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

function memberLabel(memberId: number | string) {
  const key = String(memberId)
  return userLabelMap.value[key] || key
}

async function loadSpaces() {
  loading.value = true
  loadError.value = ''
  try {
    const res = await getKbAccessibleSpacesApi()
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
  spaceForm.value = emptySpace()
  spaceModalTitle.value = t('knowledge.spaceManage.create')
  spaceModalOpen.value = true
}

async function openEditSpace(row: KbAccessibleSpace) {
  if (!row.canAdmin && !isKbAdmin.value) {
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
  savingSpace.value = true
  try {
    const isEdit = spaceForm.value.id != null
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
  if (!row.canAdmin && !isKbAdmin.value) return
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

function memberIdSet() {
  return new Set(members.value.filter((m) => m.memberType !== 1).map((m) => String(m.memberId)))
}

async function loadUserLabels(ids: Array<number | string>) {
  if (!ids.length) return
  const map = { ...userLabelMap.value }
  await Promise.all(
    ids.map(async (id) => {
      const key = String(id)
      if (map[key]) return
      try {
        const res = await getUserApi(id)
        if (res.code === API_SUCCESS_CODE && res.data) {
          map[key] = res.data.nickName || res.data.userName || key
        }
      } catch {
        /* optional enrichment */
      }
    }),
  )
  userLabelMap.value = map
}

async function openMembers(row: KbAccessibleSpace) {
  if (!row.canAdmin && !isKbAdmin.value) {
    showToast('error', t('knowledge.accessDenied.title'))
    return
  }
  memberSpace.value = row
  memberModalOpen.value = true
  membersLoading.value = true
  userSearch.value = ''
  userResults.value = []
  selectedUserIds.value = new Set()
  newMemberRole.value = 'viewer'
  try {
    const res = await listKbSpaceMembersApi(row.id)
    if (res.code !== API_SUCCESS_CODE) throw new Error(res.msg || t('knowledge.spaceManage.memberLoadFailed'))
    members.value = res.data ?? []
    await loadUserLabels(members.value.filter((m) => m.memberType !== 1).map((m) => m.memberId))
    await searchUsers()
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
  await searchUsers()
}

async function searchUsers() {
  const kw = userSearch.value.trim()
  userSearchLoading.value = true
  try {
    const res = await listUserApi({ pageNum: 1, pageSize: 50, userName: kw || undefined, status: 1 })
    if (res.code !== API_SUCCESS_CODE) {
      userResults.value = []
      selectedUserIds.value = new Set()
      return
    }
    const existing = memberIdSet()
    userResults.value = (res.data?.list ?? []).filter((u) => u.id != null && !existing.has(String(u.id)))
    const visible = new Set(userResults.value.map((u) => String(u.id)))
    selectedUserIds.value = new Set([...selectedUserIds.value].filter((id) => visible.has(id)))
  } finally {
    userSearchLoading.value = false
  }
}

function toggleSelectAllUsers() {
  if (allUsersSelected.value) {
    selectedUserIds.value = new Set()
    return
  }
  selectedUserIds.value = new Set(
    userResults.value.filter((u) => u.id != null).map((u) => String(u.id)),
  )
}

function toggleUserSelect(id: number | string) {
  const key = String(id)
  const next = new Set(selectedUserIds.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  selectedUserIds.value = next
}

async function batchAddMembers() {
  if (!memberSpace.value || !selectedUserIds.value.size) {
    showToast('error', t('knowledge.spaceManage.batchAddNone'))
    return
  }
  batchAdding.value = true
  let ok = 0
  let fail = 0
  try {
    for (const id of selectedUserIds.value) {
      try {
        const res = await addKbSpaceMemberApi({
          spaceId: memberSpace.value.id,
          memberType: 0,
          memberId: id,
          role: newMemberRole.value,
        })
        if (res.code === API_SUCCESS_CODE) ok += 1
        else fail += 1
      } catch {
        fail += 1
      }
    }
    selectedUserIds.value = new Set()
    if (fail === 0) {
      showToast('success', t('knowledge.spaceManage.batchAddOk', { count: ok }))
    } else {
      showToast('error', t('knowledge.spaceManage.batchAddPartial', { ok, fail }))
    }
    await refreshMembers()
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('knowledge.spaceManage.memberAddFailed'))
  } finally {
    batchAdding.value = false
  }
}

async function addMember(user: UserVo) {
  if (!memberSpace.value || user.id == null) return
  try {
    const res = await addKbSpaceMemberApi({
      spaceId: memberSpace.value.id,
      memberType: 0,
      memberId: user.id,
      role: newMemberRole.value,
    })
    if (res.code !== API_SUCCESS_CODE) throw new Error(res.msg || t('knowledge.spaceManage.memberAddFailed'))
    showToast('success', t('knowledge.spaceManage.memberAddOk'))
    await refreshMembers()
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('knowledge.spaceManage.memberAddFailed'))
  }
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
  const ok = await confirm({ title: t('knowledge.spaceManage.memberRemoveConfirm'), message: memberLabel(row.memberId) })
  if (!ok) return
  try {
    const res = await removeKbSpaceMemberApi(row.id)
    if (res.code !== API_SUCCESS_CODE) throw new Error(res.msg || t('knowledge.spaceManage.memberRemoveFailed'))
    members.value = members.value.filter((m) => m.id !== row.id)
    showToast('success', t('knowledge.spaceManage.memberRemoveOk'))
    await searchUsers()
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('knowledge.spaceManage.memberRemoveFailed'))
  }
}

onMounted(() => loadSpaces())
</script>

<template>
  <div class="page-stack">
    <div class="flex flex-wrap items-end gap-2">
      <button type="button" class="btn-ghost shrink-0" :disabled="loading" @click="loadSpaces">
        <RefreshCw class="h-4 w-4" :class="loading && 'animate-spin'" /> {{ t('knowledge.graph.refresh') }}
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
                <div class="flex flex-wrap gap-1">
                  <span v-if="row.canEdit" class="badge bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">{{ t('knowledge.spaceManage.canEdit') }}</span>
                  <span v-if="row.canAdmin" class="badge bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">{{ t('knowledge.spaceManage.canAdmin') }}</span>
                  <span v-if="!row.canEdit && !row.canAdmin" class="badge bg-gray-100 text-gray-500">{{ t('knowledge.spaceManage.readOnly') }}</span>
                </div>
              </td>
              <td class="px-4 py-3">
                <div class="flex justify-end gap-1">
                  <button
                    v-if="row.canAdmin || isKbAdmin"
                    type="button"
                    class="btn-ghost px-2 py-1 text-xs"
                    @click="openEditSpace(row)"
                  >
                    <Pencil class="h-3.5 w-3.5" />
                  </button>
                  <button
                    v-if="row.canAdmin || isKbAdmin"
                    type="button"
                    class="btn-ghost px-2 py-1 text-xs"
                    @click="openMembers(row)"
                  >
                    <Users class="h-3.5 w-3.5" />
                  </button>
                  <button
                    v-if="row.canAdmin || isKbAdmin"
                    type="button"
                    class="btn-ghost px-2 py-1 text-xs text-rose-600"
                    @click="removeSpace(row)"
                  >
                    <Trash2 class="h-3.5 w-3.5" />
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
      :title="t('knowledge.spaceManage.membersTitle', { name: memberSpace?.spaceName ?? '' })"
      wide
      @close="memberModalOpen = false"
    >
      <div class="space-y-4">
        <div class="rounded-lg border border-gray-100 p-3 dark:border-white/5">
          <p class="mb-2 text-sm font-medium text-gray-700 dark:text-gray-200">{{ t('knowledge.spaceManage.addMember') }}</p>
          <div class="flex flex-wrap items-end gap-2">
            <input v-model="userSearch" class="field-input min-w-[12rem] flex-1" :placeholder="t('knowledge.spaceManage.userSearch')" @keydown.enter.prevent="searchUsers" />
            <select v-model="newMemberRole" class="field-input w-auto">
              <option value="viewer">{{ roleLabel('viewer') }}</option>
              <option value="editor">{{ roleLabel('editor') }}</option>
              <option value="admin">{{ roleLabel('admin') }}</option>
            </select>
            <button type="button" class="btn-ghost" :disabled="userSearchLoading" @click="searchUsers">
              {{ t('knowledge.spaceManage.search') }}
            </button>
          </div>
          <p v-if="userSearchLoading" class="mt-2 text-xs text-gray-400">{{ t('common.loading') }}</p>
          <div v-else-if="userResults.length" class="mt-2">
            <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
              <label class="flex cursor-pointer items-center gap-2 text-xs text-gray-500">
                <input
                  type="checkbox"
                  class="h-4 w-4 rounded"
                  :checked="allUsersSelected"
                  @change="toggleSelectAllUsers"
                />
                {{ t('common.selectAll') }}
              </label>
              <div class="flex items-center gap-2">
                <span v-if="hasUserSelection" class="text-xs text-gray-500">
                  {{ t('knowledge.spaceManage.selectedCount', { count: selectedUserCount }) }}
                </span>
                <button
                  type="button"
                  class="btn-primary inline-flex items-center gap-1 px-2 py-1 text-xs"
                  :disabled="!hasUserSelection || batchAdding"
                  @click="batchAddMembers"
                >
                  <UserPlus class="h-3.5 w-3.5" />
                  {{ t('knowledge.spaceManage.batchAdd') }}
                </button>
              </div>
            </div>
            <ul class="max-h-40 space-y-1 overflow-y-auto">
              <li v-for="u in userResults" :key="u.id">
                <div class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-white/5">
                  <input
                    type="checkbox"
                    class="h-4 w-4 shrink-0 rounded"
                    :checked="u.id != null && selectedUserIds.has(String(u.id))"
                    @change="u.id != null && toggleUserSelect(u.id)"
                  />
                  <span class="min-w-0 flex-1 truncate">
                    {{ u.nickName || u.userName }}
                    <span class="text-xs text-gray-400">({{ u.userName }})</span>
                  </span>
                  <button
                    type="button"
                    class="btn-ghost shrink-0 px-1 py-0.5"
                    @click="addMember(u)"
                  >
                    <UserPlus class="h-4 w-4 text-brand-500" />
                  </button>
                </div>
              </li>
            </ul>
          </div>
          <p v-else-if="userSearch.trim()" class="mt-2 text-xs text-gray-400">{{ t('knowledge.spaceManage.userSearchEmpty') }}</p>
        </div>

        <p v-if="membersLoading" class="py-8 text-center text-sm text-gray-400">{{ t('common.loading') }}</p>
        <div v-else class="overflow-x-auto rounded-lg border border-gray-100 dark:border-white/5">
          <table class="w-full min-w-[32rem] text-left text-sm">
            <thead class="bg-gray-50 text-xs text-gray-500 dark:bg-white/5">
              <tr>
                <th class="px-3 py-2">{{ t('knowledge.spaceManage.col.user') }}</th>
                <th class="px-3 py-2">{{ t('knowledge.spaceManage.col.role') }}</th>
                <th class="px-3 py-2 text-right">{{ t('knowledge.spaceManage.col.actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in members" :key="m.id" class="border-t border-gray-50 dark:border-white/5">
                <td class="px-3 py-2">{{ memberLabel(m.memberId) }}</td>
                <td class="px-3 py-2">
                  <select :value="m.role" class="field-input py-1 text-xs" @change="changeMemberRole(m, ($event.target as HTMLSelectElement).value as KbMemberRole)">
                    <option value="viewer">{{ roleLabel('viewer') }}</option>
                    <option value="editor">{{ roleLabel('editor') }}</option>
                    <option value="admin">{{ roleLabel('admin') }}</option>
                  </select>
                </td>
                <td class="px-3 py-2 text-right">
                  <button type="button" class="btn-ghost px-2 py-1 text-xs text-rose-600" @click="removeMember(m)">
                    <Trash2 class="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
              <tr v-if="!members.length">
                <td colspan="3" class="px-3 py-8 text-center text-gray-400">{{ t('knowledge.spaceManage.membersEmpty') }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </AppModal>
  </div>
</template>
