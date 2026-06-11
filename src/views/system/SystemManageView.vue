<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { addSystemApi, deleteSystemApi, listSystemApi, updateSystemApi } from '@/api/system'
import AppModal from '@/components/ui/AppModal.vue'
import FormField from '@/components/ui/FormField.vue'
import { confirm } from '@/composables/useConfirm'
import { guardAction } from '@/composables/useActionPermissions'
import { showToast } from '@/composables/useToast'
import { PERM } from '@/constants/permissions'
import AppPagination from '@/components/ui/AppPagination.vue'
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination'
import SystemRegistryGroupView from '@/components/system/SystemRegistryGroupView.vue'
import { API_SUCCESS_CODE } from '@/types/api'
import {
  SYSTEM_GROUP_ORDER,
  countSystemsByGroup,
  registryGroupDomId,
  type SystemGroup,
} from '@/constants/systemGroup'
import {
  SSO_MODE_OPTIONS,
  createEmptySystem,
  type SsoMode,
  type SysSystem,
  type SystemQuery,
} from '@/types/system'
import { isCurrentUserSuperAdmin } from '@/utils/privilege'
import { LayoutGrid, List, Pencil, Plus, RefreshCw, Search, Trash2, Users } from 'lucide-vue-next'

const GROUP_VIEW_PAGE_SIZE = 200

const { t } = useI18n()
const router = useRouter()

const canManage = computed(() => isCurrentUserSuperAdmin())

const viewMode = ref<'group' | 'table'>('group')
const collapsedGroups = ref(new Set<string>())

const loading = ref(false)
const saving = ref(false)
const systemList = ref<SysSystem[]>([])
const total = ref(0)
const sidebarTotal = ref(0)
const sidebarGroupCounts = ref<Record<SystemGroup, number>>(
  Object.fromEntries(SYSTEM_GROUP_ORDER.map((key) => [key, 0])) as Record<SystemGroup, number>,
)
const selectedIds = ref(new Set<string>())
const modalOpen = ref(false)
const modalTitle = ref('')
const form = ref<SysSystem>(createEmptySystem())
const isEdit = computed(() => form.value.id != null)

const query = reactive({
  pageNum: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  systemName: '',
  systemCode: '',
  status: '' as SystemQuery['status'],
  systemGroup: '' as SystemQuery['systemGroup'],
})

const allSelected = computed(
  () => systemList.value.length > 0 && systemList.value.every((row) => selectedIds.value.has(String(row.id))),
)

const hasSelection = computed(() => selectedIds.value.size > 0)

async function refreshSidebarCounts() {
  try {
    const result = await listSystemApi({ pageNum: 1, pageSize: GROUP_VIEW_PAGE_SIZE })
    if (result.code !== API_SUCCESS_CODE || !result.data) return
    sidebarGroupCounts.value = countSystemsByGroup(result.data.list ?? [])
    sidebarTotal.value = result.data.total ?? 0
  } catch {
    /* sidebar counts are auxiliary */
  }
}

const activeGroupFilter = computed(() =>
  query.systemGroup === '' ? undefined : String(query.systemGroup),
)

const isExternalMode = computed(() => form.value.ssoMode === 'EXTERNAL')

function statusLabel(status?: number) {
  return status === 1 ? t('system.manage.statusOn') : t('system.manage.statusOff')
}

function ssoModeLabel(mode?: string) {
  if (mode === 'EXTERNAL') return t('system.manage.ssoModeExternal')
  if (mode === 'INTERNAL') return t('system.manage.ssoModeInternal')
  return mode || '-'
}

function systemGroupLabel(group?: string) {
  if (!group) return t('system.manage.systemGroupBusiness')
  const key = `system.portal.group.${group}`
  const label = t(key)
  return label === key ? group : label
}

function toggleSelectAll() {
  if (allSelected.value) {
    selectedIds.value = new Set()
    return
  }
  selectedIds.value = new Set(systemList.value.map((row) => String(row.id)))
}

function toggleSelect(id: number | string) {
  const key = String(id)
  const next = new Set(selectedIds.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  selectedIds.value = next
}

function openMembers(row: SysSystem) {
  if (!row.id) return
  router.push({ name: 'SystemUserAssign', query: { systemId: String(row.id) } })
}

async function loadSystems() {
  loading.value = true
  try {
    const useGroupView = viewMode.value === 'group'
    const result = await listSystemApi({
      pageNum: useGroupView ? 1 : query.pageNum,
      pageSize: useGroupView ? GROUP_VIEW_PAGE_SIZE : query.pageSize,
      systemName: query.systemName || undefined,
      systemCode: query.systemCode || undefined,
      status: query.status === '' ? undefined : query.status,
      systemGroup: query.systemGroup === '' ? undefined : query.systemGroup,
    })
    if (result.code !== API_SUCCESS_CODE || !result.data) {
      throw new Error(result.msg || t('system.manage.loadFailed'))
    }
    systemList.value = result.data.list ?? []
    total.value = result.data.total ?? 0
    selectedIds.value = new Set(
      [...selectedIds.value].filter((id) => systemList.value.some((row) => String(row.id) === id)),
    )
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.manage.loadFailed'))
  } finally {
    loading.value = false
  }
}

function searchSystems() {
  if (query.pageNum === 1) loadSystems()
  else query.pageNum = 1
}

function resetQuery() {
  query.systemName = ''
  query.systemCode = ''
  query.status = ''
  query.systemGroup = ''
  selectedIds.value = new Set()
  collapsedGroups.value = new Set()
  searchSystems()
}

function selectGroupFilter(group: SystemGroup | '') {
  query.systemGroup = group
  searchSystems()
}

function scrollToRegistryGroup(key: SystemGroup) {
  collapsedGroups.value = new Set([...collapsedGroups.value].filter((id) => id !== key))
  nextTick(() => {
    document.getElementById(registryGroupDomId(key))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

function toggleGroupCollapse(key: SystemGroup) {
  const next = new Set(collapsedGroups.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  collapsedGroups.value = next
}

function setViewMode(mode: 'group' | 'table') {
  if (viewMode.value === mode) return
  viewMode.value = mode
  query.pageNum = 1
  loadSystems()
}

function openCreate() {
  if (!guardAction(PERM.SYSTEM_ADD)) return
  if (!canManage.value) return
  form.value = createEmptySystem()
  modalTitle.value = t('system.manage.add')
  modalOpen.value = true
}

function openEdit(row: SysSystem) {
  if (!guardAction(PERM.SYSTEM_EDIT)) return
  if (!canManage.value) return
  form.value = {
    ...row,
    ssoMode: (row.ssoMode as SsoMode) || 'INTERNAL',
    entryPath: row.entryPath || '/sso/login',
  }
  modalTitle.value = t('system.manage.edit')
  modalOpen.value = true
}

function closeModal() {
  modalOpen.value = false
  form.value = createEmptySystem()
}

function validateForm() {
  if (!form.value.systemName?.trim()) return t('system.manage.systemNameRequired')
  if (!isEdit.value && !form.value.systemCode?.trim()) return t('system.manage.systemCodeRequired')
  if (form.value.ssoMode === 'EXTERNAL' && !form.value.baseUrl?.trim()) {
    return t('system.manage.baseUrlRequired')
  }
  if (form.value.sort == null || form.value.sort < 0) return t('system.manage.sortRequired')
  return null
}

async function submitForm() {
  if (!guardAction(isEdit.value ? PERM.SYSTEM_EDIT : PERM.SYSTEM_ADD)) return
  const error = validateForm()
  if (error) {
    showToast('error', error)
    return
  }

  saving.value = true
  try {
    const payload: SysSystem = {
      ...form.value,
      systemName: form.value.systemName!.trim(),
      systemCode: form.value.systemCode?.trim(),
      baseUrl: form.value.baseUrl?.trim() || undefined,
      icon: form.value.icon?.trim() || undefined,
      sort: Number(form.value.sort ?? 0),
      status: Number(form.value.status ?? 1),
      ssoMode: form.value.ssoMode || 'INTERNAL',
      entryPath:
        form.value.ssoMode === 'EXTERNAL'
          ? form.value.entryPath?.trim() || '/sso/login'
          : undefined,
      remark: form.value.remark?.trim() || undefined,
      systemGroup: (form.value.systemGroup as SystemGroup) || 'business',
    }

    const result = isEdit.value ? await updateSystemApi(payload) : await addSystemApi(payload)
    if (result.code !== API_SUCCESS_CODE) {
      throw new Error(result.msg || t('system.manage.saveFailed'))
    }

    showToast('success', isEdit.value ? t('system.manage.updateOk') : t('system.manage.createOk'))
    closeModal()
    await Promise.all([loadSystems(), refreshSidebarCounts()])
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.manage.saveFailed'))
  } finally {
    saving.value = false
  }
}

async function removeSystems(ids: Array<number | string>) {
  if (!guardAction(PERM.SYSTEM_REMOVE)) return
  if (!ids.length || !canManage.value) return
  try {
    const result = await deleteSystemApi(ids)
    if (result.code !== API_SUCCESS_CODE) {
      throw new Error(result.msg || t('system.manage.deleteFailed'))
    }
    showToast('success', t('system.manage.deleteOk'))
    selectedIds.value = new Set()
    await Promise.all([loadSystems(), refreshSidebarCounts()])
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.manage.deleteFailed'))
  }
}

async function removeOne(row: SysSystem) {
  if (!(await confirm({ message: t('system.manage.deleteConfirm', { name: row.systemName }) }))) return
  await removeSystems([row.id!])
}

async function removeSelected() {
  const ids = [...selectedIds.value]
  if (!ids.length) return
  if (!(await confirm({ message: t('system.manage.deleteBatchConfirm', { count: ids.length }) }))) return
  await removeSystems(ids)
}

watch(
  () => [query.pageNum, query.pageSize],
  () => loadSystems(),
)

onMounted(async () => {
  await Promise.all([loadSystems(), refreshSidebarCounts()])
})
</script>

<template>
  <div class="page-stack">
    <div class="card p-5">
      <div class="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="page-title text-lg">{{ t('system.manage.title') }}</h1>
          <p class="page-subtitle mt-1">{{ t('system.manage.subtitle') }}</p>
        </div>
        <p v-if="!canManage" class="text-sm text-amber-600 dark:text-amber-400">
          {{ t('system.manage.readonlyHint') }}
        </p>
      </div>

      <div class="mb-4 flex flex-wrap items-center gap-3">
        <form class="form-search-toolbar contents" @submit.prevent="searchSystems">
          <FormField :label="t('system.manage.systemName')" horizontal class="form-field-search">
            <input
              v-model="query.systemName"
              type="text"
              class="field-input"
              :placeholder="t('system.manage.systemNamePlaceholder')"
            />
          </FormField>
          <FormField :label="t('system.manage.systemCode')" horizontal class="form-field-search">
            <input
              v-model="query.systemCode"
              type="text"
              class="field-input"
              :placeholder="t('system.manage.systemCodePlaceholder')"
            />
          </FormField>
          <FormField :label="t('system.manage.status')" horizontal class="form-field-search">
            <select v-model="query.status" class="field-input">
              <option value="">{{ t('system.manage.statusAll') }}</option>
              <option :value="1">{{ t('system.manage.statusOn') }}</option>
              <option :value="0">{{ t('system.manage.statusOff') }}</option>
            </select>
          </FormField>
          <FormField :label="t('system.manage.systemGroup')" horizontal class="form-field-search">
            <select v-model="query.systemGroup" class="field-input">
              <option value="">{{ t('system.manage.systemGroupAll') }}</option>
              <option v-for="group in SYSTEM_GROUP_ORDER" :key="group" :value="group">
                {{ t(`system.portal.group.${group}`) }}
              </option>
            </select>
          </FormField>
          <button type="submit" class="btn-primary shrink-0">
            <Search class="h-4 w-4" /> {{ t('system.manage.search') }}
          </button>
          <button type="button" class="btn-ghost shrink-0" @click="resetQuery">
            <RefreshCw class="h-4 w-4" /> {{ t('system.manage.reset') }}
          </button>
        </form>
        <div class="toolbar-actions">
          <div class="inline-flex rounded-lg border border-gray-200 p-0.5 dark:border-white/10">
            <button
              type="button"
              class="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs transition"
              :class="viewMode === 'group' ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'"
              @click="setViewMode('group')"
            >
              <LayoutGrid class="h-3.5 w-3.5" />
              {{ t('system.manage.viewGroup') }}
            </button>
            <button
              type="button"
              class="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs transition"
              :class="viewMode === 'table' ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'"
              @click="setViewMode('table')"
            >
              <List class="h-3.5 w-3.5" />
              {{ t('system.manage.viewTable') }}
            </button>
          </div>
          <template v-if="canManage">
          <button type="button" class="btn-ghost shrink-0" :disabled="!hasSelection" @click="removeSelected">
            <Trash2 class="h-4 w-4" /> {{ t('system.manage.deleteBatch') }}
          </button>
          <button type="button" class="btn-primary shrink-0" @click="openCreate">
            <Plus class="h-4 w-4" /> {{ t('system.manage.add') }}
          </button>
          </template>
        </div>
      </div>

      <div v-if="viewMode === 'group'" class="flex flex-col gap-4 xl:flex-row xl:items-start">
        <aside class="w-full shrink-0 xl:w-56 xl:sticky xl:top-20 xl:self-start">
          <div class="rounded-xl border border-gray-100 bg-gray-50/50 p-3 dark:border-white/5 dark:bg-white/5">
            <p class="mb-2 px-1 text-xs font-medium text-gray-500 dark:text-gray-400">{{ t('system.manage.groupNav') }}</p>
            <ul class="space-y-1">
              <li>
                <button
                  type="button"
                  class="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm transition"
                  :class="!query.systemGroup ? 'bg-brand-100 font-medium text-brand-700 dark:bg-brand-500/20 dark:text-brand-300' : 'text-gray-600 hover:bg-white dark:text-gray-300 dark:hover:bg-white/5'"
                  @click="selectGroupFilter('')"
                >
                  <span>{{ t('system.manage.systemGroupAll') }}</span>
                  <span class="text-xs tabular-nums opacity-70">{{ sidebarTotal }}</span>
                </button>
              </li>
              <li v-for="group in SYSTEM_GROUP_ORDER" :key="group">
                <button
                  type="button"
                  class="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm transition"
                  :class="query.systemGroup === group ? 'bg-brand-100 font-medium text-brand-700 dark:bg-brand-500/20 dark:text-brand-300' : 'text-gray-600 hover:bg-white dark:text-gray-300 dark:hover:bg-white/5'"
                  @click="selectGroupFilter(group)"
                >
                  <span class="truncate">{{ t(`system.portal.group.${group}`) }}</span>
                  <span class="ml-2 shrink-0 text-xs tabular-nums opacity-70">{{ sidebarGroupCounts[group] }}</span>
                </button>
              </li>
            </ul>
            <p v-if="!query.systemGroup && sidebarTotal > GROUP_VIEW_PAGE_SIZE" class="mt-3 px-1 text-[11px] text-amber-600 dark:text-amber-400">
              {{ t('system.manage.groupViewLimit', { count: GROUP_VIEW_PAGE_SIZE }) }}
            </p>
          </div>
        </aside>

        <div class="min-w-0 flex-1">
          <div v-if="!query.systemGroup" class="mb-3 flex flex-wrap gap-1.5">
            <button
              v-for="group in SYSTEM_GROUP_ORDER.filter((key) => sidebarGroupCounts[key] > 0)"
              :key="group"
              type="button"
              class="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600 transition hover:bg-gray-200 dark:bg-white/10 dark:text-gray-300 dark:hover:bg-white/15"
              @click="scrollToRegistryGroup(group)"
            >
              {{ t(`system.portal.group.${group}`) }}
            </button>
          </div>
          <SystemRegistryGroupView
            :systems="systemList"
            :loading="loading"
            :can-manage="canManage"
            :selected-ids="selectedIds"
            :collapsed-groups="collapsedGroups"
            :filter-group="activeGroupFilter"
            @toggle-select="toggleSelect"
            @members="openMembers"
            @edit="openEdit"
            @delete="removeOne"
            @toggle-collapse="toggleGroupCollapse"
          />
        </div>
      </div>

      <div v-else class="overflow-x-auto rounded-lg border border-gray-100 dark:border-white/5">
        <table class="w-full min-w-[1080px] text-left text-sm">
          <thead class="bg-gray-50 text-xs uppercase tracking-wide text-gray-400 dark:bg-white/5">
            <tr>
              <th v-if="canManage" class="w-10 px-4 py-3">
                <input type="checkbox" :checked="allSelected" @change="toggleSelectAll" />
              </th>
              <th class="px-4 py-3">{{ t('system.manage.id') }}</th>
              <th class="px-4 py-3">{{ t('system.manage.systemName') }}</th>
              <th class="px-4 py-3">{{ t('system.manage.systemCode') }}</th>
              <th class="px-4 py-3">{{ t('system.manage.systemGroup') }}</th>
              <th class="px-4 py-3">{{ t('system.manage.ssoMode') }}</th>
              <th class="px-4 py-3">{{ t('system.manage.baseUrl') }}</th>
              <th class="px-4 py-3">{{ t('system.manage.sort') }}</th>
              <th class="px-4 py-3">{{ t('system.manage.status') }}</th>
              <th class="px-4 py-3 text-right">{{ t('system.manage.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td :colspan="canManage ? 10 : 9" class="px-4 py-10 text-center text-gray-400">
                {{ t('system.manage.loading') }}
              </td>
            </tr>
            <tr v-else-if="!systemList.length">
              <td :colspan="canManage ? 10 : 9" class="px-4 py-10 text-center text-gray-400">
                {{ t('system.manage.empty') }}
              </td>
            </tr>
            <tr
              v-for="row in systemList"
              v-else
              :key="String(row.id)"
              class="border-t border-gray-50 transition hover:bg-gray-50/80 dark:border-white/5 dark:hover:bg-white/5"
            >
              <td v-if="canManage" class="px-4 py-3">
                <input
                  type="checkbox"
                  :checked="selectedIds.has(String(row.id))"
                  @change="toggleSelect(row.id!)"
                />
              </td>
              <td class="px-4 py-3 tabular-nums text-gray-600 dark:text-gray-300">{{ row.id }}</td>
              <td class="px-4 py-3 font-medium text-gray-900 dark:text-white">{{ row.systemName }}</td>
              <td class="px-4 py-3 text-gray-600 dark:text-gray-300">{{ row.systemCode }}</td>
              <td class="px-4 py-3 text-gray-600 dark:text-gray-300">
                {{ systemGroupLabel(row.systemGroup) }}
              </td>
              <td class="px-4 py-3">
                <span class="badge bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300">
                  {{ ssoModeLabel(row.ssoMode) }}
                </span>
              </td>
              <td class="max-w-[200px] truncate px-4 py-3 text-gray-600 dark:text-gray-300">
                {{ row.baseUrl || '—' }}
              </td>
              <td class="px-4 py-3 tabular-nums text-gray-600 dark:text-gray-300">{{ row.sort ?? '-' }}</td>
              <td class="px-4 py-3">
                <span
                  :class="[
                    'badge',
                    row.status === 1
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                      : 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400',
                  ]"
                >
                  {{ statusLabel(row.status) }}
                </span>
              </td>
              <td class="px-4 py-3">
                <div class="btn-action-group">
                  <button type="button" class="btn-action-add" @click="openMembers(row)">
                    <Users class="h-3.5 w-3.5" />
                    {{ t('system.manage.members') }}
                  </button>
                  <button v-if="canManage" type="button" class="btn-action-edit" @click="openEdit(row)">
                    <Pencil class="h-3.5 w-3.5" />
                    {{ t('system.manage.edit') }}
                  </button>
                  <button v-if="canManage" type="button" class="btn-action-danger" @click="removeOne(row)">
                    <Trash2 class="h-3.5 w-3.5" />
                    {{ t('system.manage.delete') }}
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="viewMode === 'table' && total > 0" class="mt-4">
        <AppPagination v-model:page-num="query.pageNum" v-model:page-size="query.pageSize" :total="total" />
      </div>
      <p v-else-if="viewMode === 'group' && total > 0" class="mt-4 text-xs text-gray-400">
        {{ t('system.manage.groupViewSummary', { count: systemList.length, total }) }}
      </p>
    </div>

    <AppModal :open="modalOpen" :title="modalTitle" wide @close="closeModal">
      <form class="form-modal" @submit.prevent="submitForm">
        <div class="form-grid-pairs">
          <div class="form-grid-row">
            <FormField :label="t('system.manage.systemName')" horizontal required>
              <input v-model="form.systemName" type="text" class="field-input" />
            </FormField>
            <FormField :label="t('system.manage.systemCode')" horizontal :required="!isEdit">
              <input
                v-model="form.systemCode"
                type="text"
                class="field-input"
                :disabled="isEdit"
                :class="{ 'field-readonly': isEdit }"
              />
            </FormField>
          </div>
          <div class="form-grid-row">
            <FormField :label="t('system.manage.systemGroup')" horizontal required>
              <select v-model="form.systemGroup" class="field-input">
                <option v-for="group in SYSTEM_GROUP_ORDER" :key="group" :value="group">
                  {{ t(`system.portal.group.${group}`) }}
                </option>
              </select>
            </FormField>
            <FormField :label="t('system.manage.sort')" horizontal required>
              <input v-model.number="form.sort" type="number" min="0" class="field-input" />
            </FormField>
          </div>
          <div class="form-grid-row">
            <FormField :label="t('system.manage.ssoMode')" horizontal required class="form-field-span-2">
              <select v-model="form.ssoMode" class="field-input">
                <option v-for="mode in SSO_MODE_OPTIONS" :key="mode" :value="mode">
                  {{ ssoModeLabel(mode) }}
                </option>
              </select>
              <p class="form-hint mt-1">
                {{
                  form.ssoMode === 'EXTERNAL'
                    ? t('system.manage.ssoModeExternalHint')
                    : t('system.manage.ssoModeInternalHint')
                }}
              </p>
            </FormField>
          </div>
          <div class="form-grid-row">
            <FormField
              :label="t('system.manage.baseUrl')"
              horizontal
              :required="isExternalMode"
              class="form-field-span-2"
            >
              <input
                v-model="form.baseUrl"
                type="url"
                class="field-input"
                :placeholder="t('system.manage.baseUrlPlaceholder')"
              />
            </FormField>
          </div>
          <div v-if="isExternalMode" class="form-grid-row">
            <FormField :label="t('system.manage.entryPath')" horizontal class="form-field-span-2">
              <input v-model="form.entryPath" type="text" class="field-input" placeholder="/sso/login" />
            </FormField>
          </div>
          <div class="form-grid-row">
            <FormField :label="t('system.manage.icon')" horizontal class="form-field-span-2">
              <input v-model="form.icon" type="text" class="field-input" :placeholder="t('system.manage.iconPlaceholder')" />
            </FormField>
          </div>
          <div class="form-grid-row">
            <FormField :label="t('system.manage.status')" horizontal>
              <div class="form-row-inline">
                <label class="inline-flex items-center gap-2 text-sm">
                  <input v-model.number="form.status" type="radio" :value="1" />
                  {{ t('system.manage.statusOn') }}
                </label>
                <label class="inline-flex items-center gap-2 text-sm">
                  <input v-model.number="form.status" type="radio" :value="0" />
                  {{ t('system.manage.statusOff') }}
                </label>
              </div>
            </FormField>
          </div>
          <div class="form-grid-row">
            <FormField :label="t('system.manage.remark')" horizontal class="form-field-span-2">
              <textarea v-model="form.remark" rows="3" class="field-input resize-y" />
            </FormField>
          </div>
        </div>
      </form>

      <template #footer>
        <button type="button" class="btn-ghost" @click="closeModal">{{ t('system.manage.cancel') }}</button>
        <button type="button" class="btn-primary" :disabled="saving" @click="submitForm">
          {{ saving ? t('system.manage.saving') : t('system.manage.save') }}
        </button>
      </template>
    </AppModal>
  </div>
</template>
