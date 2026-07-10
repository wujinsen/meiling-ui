<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { addServerApi, checkServerApi, deleteServerApi, getServerApi, getServerLinksApi, getServerTopologyApi, listComponentApi, listProjectApi, listServerApi, probeAllHealthApi, saveServerLinksApi, updateServerApi } from '@/api/operation'
import EnvironmentSelect from '@/components/operation/EnvironmentSelect.vue'
import HealthStatusBadge from '@/components/operation/HealthStatusBadge.vue'
import OperationPageHeader from '@/components/operation/OperationPageHeader.vue'
import ServerSshModal from '@/components/operation/ServerSshModal.vue'
import AppModal from '@/components/ui/AppModal.vue'
import FormField from '@/components/ui/FormField.vue'
import { confirm } from '@/composables/useConfirm'
import { guardAction, assertAction } from '@/composables/useActionPermissions'
import { PERM } from '@/constants/permissions'
import AppPagination from '@/components/ui/AppPagination.vue'
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination'
import { showToast, formatDateTime } from '@/composables/useToast'
import { API_SUCCESS_CODE } from '@/types/api'
import { createEmptyServer, type OperationComponent, type OperationProject, type OperationServer, type OperationServerTopology } from '@/types/operation'
import { environmentI18nKey } from '@/utils/operationEnv'
import { Activity, GitBranch, KeyRound, Link2, Pencil, Plus, RefreshCw, Search, Trash2 } from 'lucide-vue-next'

const { t } = useI18n()

const loading = ref(false)
const saving = ref(false)
const list = ref<OperationServer[]>([])
const total = ref(0)
const modalOpen = ref(false)
const modalTitle = ref('')
const form = ref<OperationServer>(createEmptyServer())
const isEdit = computed(() => form.value.id != null)
const checkingId = ref<string | number | null>(null)
const topologyOpen = ref(false)
const topologyLoading = ref(false)
const topologyTitle = ref('')
const topology = ref<OperationServerTopology | null>(null)
const topologyServerId = ref<string | number | null>(null)
const linksEditing = ref(false)
const linksLoading = ref(false)
const linksSaving = ref(false)
const linkProjectIds = ref<string[]>([])
const linkComponentIds = ref<string[]>([])
const allProjects = ref<OperationProject[]>([])
const allComponents = ref<OperationComponent[]>([])
const linkProjectSearch = ref('')
const linkComponentSearch = ref('')
const probingAll = ref(false)
const sshModalOpen = ref(false)
const sshServerId = ref<string | number | null>(null)
const sshServerName = ref('')

const canEditLinks = computed(() => assertAction(PERM.OP_SERVER_EDIT))
const canSshManage = computed(() => assertAction(PERM.OP_SSH_MANAGE))

function matchesLinkSearch(keyword: string, ...fields: Array<string | undefined | null>) {
  const q = keyword.trim().toLowerCase()
  if (!q) return true
  return fields.some((field) => field?.toLowerCase().includes(q))
}

const filteredLinkProjects = computed(() => {
  const selected = new Set(linkProjectIds.value)
  return allProjects.value.filter((item) => {
    const id = item.id != null ? String(item.id) : ''
    if (selected.has(id)) return true
    return matchesLinkSearch(linkProjectSearch.value, item.projectName, item.serverIp, item.port)
  })
})

const filteredLinkComponents = computed(() => {
  const selected = new Set(linkComponentIds.value)
  return allComponents.value.filter((item) => {
    const id = item.id != null ? String(item.id) : ''
    if (selected.has(id)) return true
    return matchesLinkSearch(linkComponentSearch.value, item.componentName, item.serverIp, item.port)
  })
})

const query = reactive({ pageNum: 1, pageSize: DEFAULT_PAGE_SIZE, serverName: '', ip: '', environment: '' as number | '' })

function envLabel(env?: number) {
  return t(environmentI18nKey(env))
}

function openSsh(row: OperationServer) {
  if (!guardAction(PERM.OP_SSH_MANAGE)) return
  sshServerId.value = row.id ?? null
  sshServerName.value = row.serverName ?? ''
  sshModalOpen.value = true
}

function closeSshModal() {
  sshModalOpen.value = false
  sshServerId.value = null
  sshServerName.value = ''
}

async function onSshSaved() {
  await loadList()
}

function search() {
  if (query.pageNum === 1) loadList()
  else query.pageNum = 1
}

function resetQuery() {
  query.serverName = ''
  query.ip = ''
  query.environment = ''
  search()
}

async function loadList() {
  loading.value = true
  try {
    const result = await listServerApi({
      pageNum: query.pageNum,
      pageSize: query.pageSize,
      serverName: query.serverName || undefined,
      ip: query.ip || undefined,
      environment: query.environment === '' ? undefined : (query.environment as 1 | 2 | 3 | 4),
    })
    if (result.code !== API_SUCCESS_CODE || !result.data) throw new Error(result.msg || t('operation.server.loadFailed'))
    list.value = result.data.list ?? []
    total.value = result.data.total ?? 0
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('operation.server.loadFailed'))
  } finally {
    loading.value = false
  }
}

function openCreate() {
  if (!guardAction(PERM.OP_SERVER_ADD)) return
  form.value = createEmptyServer()
  modalTitle.value = t('operation.common.add')
  modalOpen.value = true
}

async function openEdit(row: OperationServer) {
  if (!guardAction(PERM.OP_SERVER_EDIT)) return
  try {
    const result = await getServerApi(row.id!)
    if (result.code !== API_SUCCESS_CODE || !result.data) throw new Error(result.msg || t('operation.server.loadFailed'))
    form.value = { ...result.data }
    modalTitle.value = t('operation.common.edit')
    modalOpen.value = true
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('operation.server.loadFailed'))
  }
}

function closeModal() {
  modalOpen.value = false
  form.value = createEmptyServer()
}

async function submitForm() {
  if (!guardAction(isEdit.value ? PERM.OP_SERVER_EDIT : PERM.OP_SERVER_ADD)) return
  if (!form.value.serverName?.trim()) {
    showToast('error', t('operation.server.nameRequired'))
    return
  }
  saving.value = true
  try {
    const payload: OperationServer = {
      ...form.value,
      serverName: form.value.serverName.trim(),
      ip: form.value.ip?.trim() || undefined,
      innerIp: form.value.innerIp?.trim() || undefined,
      port: form.value.port?.trim() || undefined,
      environment: Number(form.value.environment ?? 1) as 1 | 2 | 3 | 4,
      remark: form.value.remark?.trim() || undefined,
    }
    const result = isEdit.value ? await updateServerApi(payload) : await addServerApi(payload)
    if (result.code !== API_SUCCESS_CODE) throw new Error(result.msg || t('operation.common.saveFailed'))
    showToast('success', isEdit.value ? t('operation.common.updateOk') : t('operation.common.createOk'))
    closeModal()
    await loadList()
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('operation.common.saveFailed'))
  } finally {
    saving.value = false
  }
}

async function removeRow(row: OperationServer) {
  if (!guardAction(PERM.OP_SERVER_REMOVE)) return
  if (!(await confirm({ message: t('operation.server.deleteConfirm', { name: row.serverName }) }))) return
  try {
    const result = await deleteServerApi(row.id!)
    if (result.code !== API_SUCCESS_CODE) throw new Error(result.msg || t('operation.common.deleteFailed'))
    showToast('success', t('operation.common.deleteOk'))
    await loadList()
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('operation.common.deleteFailed'))
  }
}

async function checkRow(row: OperationServer) {
  if (row.id == null) return
  checkingId.value = row.id
  try {
    const result = await checkServerApi(row.id)
    if (result.code !== API_SUCCESS_CODE || !result.data) throw new Error(result.msg || t('operation.health.checkFailed'))
    const idx = list.value.findIndex((item) => String(item.id) === String(row.id))
    if (idx >= 0) list.value[idx] = { ...list.value[idx], ...result.data }
    showToast('success', t('operation.health.checkOk'))
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('operation.health.checkFailed'))
  } finally {
    checkingId.value = null
  }
}

async function openTopology(row: OperationServer) {
  if (row.id == null) return
  topologyOpen.value = true
  topologyLoading.value = true
  topologyTitle.value = row.serverName || String(row.id)
  topologyServerId.value = row.id
  linksEditing.value = false
  topology.value = null
  try {
    const result = await getServerTopologyApi(row.id)
    if (result.code !== API_SUCCESS_CODE || !result.data) throw new Error(result.msg || t('operation.server.topologyFailed'))
    topology.value = result.data
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('operation.server.topologyFailed'))
    topologyOpen.value = false
    topologyServerId.value = null
  } finally {
    topologyLoading.value = false
  }
}

async function reloadTopology() {
  if (topologyServerId.value == null) return
  topologyLoading.value = true
  try {
    const result = await getServerTopologyApi(topologyServerId.value)
    if (result.code !== API_SUCCESS_CODE || !result.data) throw new Error(result.msg || t('operation.server.topologyFailed'))
    topology.value = result.data
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('operation.server.topologyFailed'))
  } finally {
    topologyLoading.value = false
  }
}

function toggleLinkId(ids: string[], id: string | number | undefined, checked: boolean) {
  if (id == null) return
  const key = String(id)
  if (checked) {
    if (!ids.includes(key)) ids.push(key)
  } else {
    const idx = ids.indexOf(key)
    if (idx >= 0) ids.splice(idx, 1)
  }
}

function isLinkSelected(ids: string[], id: string | number | undefined) {
  return id != null && ids.includes(String(id))
}

async function startEditLinks() {
  if (!guardAction(PERM.OP_SERVER_EDIT) || topologyServerId.value == null) return
  linksEditing.value = true
  linksLoading.value = true
  linkProjectSearch.value = ''
  linkComponentSearch.value = ''
  linkProjectIds.value = []
  linkComponentIds.value = []
  allProjects.value = []
  allComponents.value = []
  try {
    const [linksRes, projectsRes, componentsRes] = await Promise.all([
      getServerLinksApi(topologyServerId.value),
      listProjectApi({ pageNum: 1, pageSize: 500 }),
      listComponentApi({ pageNum: 1, pageSize: 500 }),
    ])
    if (linksRes.code !== API_SUCCESS_CODE || !linksRes.data) throw new Error(linksRes.msg || t('operation.server.linksLoadFailed'))
    if (projectsRes.code !== API_SUCCESS_CODE || !projectsRes.data) throw new Error(projectsRes.msg || t('operation.project.loadFailed'))
    if (componentsRes.code !== API_SUCCESS_CODE || !componentsRes.data) throw new Error(componentsRes.msg || t('operation.component.loadFailed'))
    linkProjectIds.value = (linksRes.data.projectIds ?? []).map(String)
    linkComponentIds.value = (linksRes.data.componentIds ?? []).map(String)
    allProjects.value = projectsRes.data.list ?? []
    allComponents.value = componentsRes.data.list ?? []
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('operation.server.linksLoadFailed'))
    linksEditing.value = false
  } finally {
    linksLoading.value = false
  }
}

function cancelEditLinks() {
  linksEditing.value = false
  linkProjectSearch.value = ''
  linkComponentSearch.value = ''
}

async function saveLinks() {
  if (!guardAction(PERM.OP_SERVER_EDIT) || topologyServerId.value == null) return
  linksSaving.value = true
  try {
    const result = await saveServerLinksApi(topologyServerId.value, {
      serverId: topologyServerId.value,
      projectIds: linkProjectIds.value,
      componentIds: linkComponentIds.value,
    })
    if (result.code !== API_SUCCESS_CODE) throw new Error(result.msg || t('operation.server.linksSaveFailed'))
    showToast('success', t('operation.server.linksSaveOk'))
    linksEditing.value = false
    await reloadTopology()
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('operation.server.linksSaveFailed'))
  } finally {
    linksSaving.value = false
  }
}

async function probeAll() {
  probingAll.value = true
  try {
    const result = await probeAllHealthApi()
    if (result.code !== API_SUCCESS_CODE || !result.data) throw new Error(result.msg || t('operation.health.probeAllFailed'))
    const data = result.data
    showToast('success', t('operation.health.probeAllOk', {
      servers: data.serversProbed ?? 0,
      components: data.componentsProbed ?? 0,
      deploys: data.deployStatusesSynced ?? 0,
    }))
    await loadList()
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('operation.health.probeAllFailed'))
  } finally {
    probingAll.value = false
  }
}

function closeTopology() {
  topologyOpen.value = false
  topology.value = null
  topologyServerId.value = null
  linksEditing.value = false
  linkProjectSearch.value = ''
  linkComponentSearch.value = ''
}

watch(() => [query.pageNum, query.pageSize], loadList)
onMounted(loadList)
</script>

<template>
  <div class="page-stack">
    <OperationPageHeader :title="t('operation.server.title')" :subtitle="t('operation.server.subtitle')">
      <template #toolbar>
        <form class="operation-search-form" @submit.prevent="search">
          <label class="operation-filter-field">
            <span>{{ t('operation.server.serverName') }}</span>
            <input v-model="query.serverName" type="text" class="field-input" />
          </label>
          <label class="operation-filter-field">
            <span>IP</span>
            <input v-model="query.ip" type="text" class="field-input" />
          </label>
          <div class="operation-filter-field">
            <span>{{ t('operation.common.environment') }}</span>
            <EnvironmentSelect v-model="query.environment" include-all />
          </div>
          <button type="submit" class="btn-primary shrink-0"><Search class="h-4 w-4" /> {{ t('operation.common.search') }}</button>
          <button type="button" class="btn-ghost shrink-0" @click="resetQuery"><RefreshCw class="h-4 w-4" /> {{ t('operation.common.reset') }}</button>
        </form>
        <div class="toolbar-actions">
          <button type="button" class="btn-ghost shrink-0" :disabled="probingAll" @click="probeAll">
            <Activity class="h-4 w-4" :class="{ 'animate-pulse': probingAll }" />
            {{ probingAll ? t('operation.health.probeAllRunning') : t('operation.health.probeAll') }}
          </button>
          <button type="button" class="btn-primary shrink-0" @click="openCreate"><Plus class="h-4 w-4" /> {{ t('operation.common.add') }}</button>
        </div>
      </template>
    </OperationPageHeader>

    <div class="card p-5">
      <div class="overflow-x-auto rounded-lg border border-gray-100 dark:border-white/5">
        <table class="w-full min-w-[1040px] text-left text-sm">
          <thead class="bg-gray-50 text-xs uppercase text-gray-400 dark:bg-white/5">
            <tr>
              <th class="px-4 py-3">{{ t('operation.server.serverName') }}</th>
              <th class="px-4 py-3">IP</th>
              <th class="px-4 py-3">{{ t('operation.server.innerIp') }}</th>
              <th class="px-4 py-3">{{ t('operation.server.port') }}</th>
              <th class="px-4 py-3">{{ t('operation.health.status') }}</th>
              <th class="px-4 py-3">{{ t('operation.common.environment') }}</th>
              <th class="px-4 py-3">{{ t('operation.common.remark') }}</th>
              <th class="px-4 py-3">{{ t('operation.common.createTime') }}</th>
              <th class="px-4 py-3 text-right">{{ t('operation.common.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading"><td colspan="9" class="px-4 py-10 text-center text-gray-400">{{ t('operation.common.loading') }}</td></tr>
            <tr v-else-if="!list.length"><td colspan="9" class="px-4 py-10 text-center text-gray-400">{{ t('operation.common.empty') }}</td></tr>
            <tr v-for="row in list" v-else :key="String(row.id)" class="border-t border-gray-50 dark:border-white/5 hover:bg-gray-50/80 dark:hover:bg-white/5">
              <td class="px-4 py-3 font-medium">{{ row.serverName }}</td>
              <td class="px-4 py-3">{{ row.ip || '-' }}</td>
              <td class="px-4 py-3">{{ row.innerIp || '-' }}</td>
              <td class="px-4 py-3">{{ row.port || '-' }}</td>
              <td class="px-4 py-3">
                <HealthStatusBadge :status="row.status" :last-check-time="formatDateTime(row.lastCheckTime ?? undefined)" show-time />
              </td>
              <td class="px-4 py-3"><span class="badge bg-gray-100 dark:bg-white/10">{{ envLabel(row.environment) }}</span></td>
              <td class="max-w-[160px] truncate px-4 py-3">{{ row.remark || '-' }}</td>
              <td class="px-4 py-3">{{ formatDateTime(row.createTime) }}</td>
              <td class="px-4 py-3">
                <div class="btn-action-group flex-wrap justify-end">
                  <button type="button" class="btn-action-edit" :disabled="checkingId === row.id" @click="checkRow(row)">
                    <Activity class="h-3.5 w-3.5" />{{ checkingId === row.id ? t('operation.health.checking') : t('operation.health.check') }}
                  </button>
                  <button type="button" class="btn-action-edit" @click="openTopology(row)"><GitBranch class="h-3.5 w-3.5" />{{ t('operation.server.topology') }}</button>
                  <button v-if="canSshManage" type="button" class="btn-action-edit" @click="openSsh(row)">
                    <KeyRound class="h-3.5 w-3.5" />{{ t('operation.ssh.configure') }}
                  </button>
                  <button type="button" class="btn-action-edit" @click="openEdit(row)"><Pencil class="h-3.5 w-3.5" />{{ t('operation.common.edit') }}</button>
                  <button type="button" class="btn-action-danger" @click="removeRow(row)"><Trash2 class="h-3.5 w-3.5" />{{ t('operation.common.delete') }}</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="total > 0" class="mt-4"><AppPagination v-model:page-num="query.pageNum" v-model:page-size="query.pageSize" :total="total" /></div>
    </div>
    <AppModal :open="modalOpen" :title="modalTitle" wide @close="closeModal">
      <form class="form-modal" novalidate @submit.prevent="submitForm">
        <div class="form-grid-pairs">
          <div class="form-grid-row">
            <FormField :label="t('operation.server.serverName')" horizontal required class="form-field-span-2">
              <input v-model="form.serverName" class="field-input" />
            </FormField>
          </div>
          <div class="form-grid-row">
            <FormField label="IP" horizontal>
              <input v-model="form.ip" class="field-input" />
            </FormField>
            <FormField :label="t('operation.server.innerIp')" horizontal>
              <input v-model="form.innerIp" class="field-input" />
            </FormField>
          </div>
          <div class="form-grid-row">
            <FormField :label="t('operation.server.port')" horizontal>
              <input v-model="form.port" class="field-input" />
            </FormField>
            <FormField :label="t('operation.common.environment')" horizontal>
              <EnvironmentSelect v-model="form.environment" />
            </FormField>
          </div>
          <div class="form-grid-row">
            <FormField :label="t('operation.common.remark')" horizontal class="form-field-span-2">
              <textarea v-model="form.remark" rows="3" class="field-input resize-y" />
            </FormField>
          </div>
        </div>
      </form>
      <template #footer>
        <button type="button" class="btn-ghost" @click="closeModal">{{ t('operation.common.cancel') }}</button>
        <button type="button" class="btn-primary" :disabled="saving" @click="submitForm">{{ saving ? t('operation.common.saving') : t('operation.common.save') }}</button>
      </template>
    </AppModal>

    <AppModal :open="topologyOpen" :title="t('operation.server.topologyTitle', { name: topologyTitle })" wide @close="closeTopology">
      <div v-if="topologyLoading" class="py-10 text-center text-gray-400">{{ t('operation.common.loading') }}</div>
      <div v-else-if="linksEditing" class="space-y-6">
        <p class="text-sm text-gray-500">{{ t('operation.server.editLinksHint') }}</p>
        <div v-if="linksLoading" class="py-8 text-center text-gray-400">{{ t('operation.common.loading') }}</div>
        <template v-else>
          <section>
            <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 class="text-sm font-semibold">
                {{ t('operation.server.topologyProjects') }}
                <span class="font-normal text-gray-400">({{ linkProjectIds.length }}/{{ allProjects.length }})</span>
              </h3>
              <input
                v-model="linkProjectSearch"
                type="search"
                class="field-input max-w-xs text-sm"
                :placeholder="t('operation.server.linkSearchPlaceholder')"
              />
            </div>
            <div v-if="!allProjects.length" class="text-sm text-gray-400">{{ t('operation.common.empty') }}</div>
            <div v-else-if="!filteredLinkProjects.length" class="text-sm text-gray-400">{{ t('operation.server.linkSearchEmpty') }}</div>
            <div v-else class="max-h-48 space-y-2 overflow-y-auto rounded border border-gray-100 p-3 dark:border-white/10">
              <label v-for="p in filteredLinkProjects" :key="String(p.id)" class="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  :checked="isLinkSelected(linkProjectIds, p.id)"
                  @change="toggleLinkId(linkProjectIds, p.id, ($event.target as HTMLInputElement).checked)"
                />
                <span>{{ p.projectName }}</span>
                <span class="text-gray-400">· {{ p.serverIp || '-' }} · {{ p.port || '-' }}</span>
              </label>
            </div>
          </section>
          <section>
            <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 class="text-sm font-semibold">
                {{ t('operation.server.topologyComponents') }}
                <span class="font-normal text-gray-400">({{ linkComponentIds.length }}/{{ allComponents.length }})</span>
              </h3>
              <input
                v-model="linkComponentSearch"
                type="search"
                class="field-input max-w-xs text-sm"
                :placeholder="t('operation.server.linkSearchPlaceholder')"
              />
            </div>
            <div v-if="!allComponents.length" class="text-sm text-gray-400">{{ t('operation.common.empty') }}</div>
            <div v-else-if="!filteredLinkComponents.length" class="text-sm text-gray-400">{{ t('operation.server.linkSearchEmpty') }}</div>
            <div v-else class="max-h-48 space-y-2 overflow-y-auto rounded border border-gray-100 p-3 dark:border-white/10">
              <label v-for="c in filteredLinkComponents" :key="String(c.id)" class="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  :checked="isLinkSelected(linkComponentIds, c.id)"
                  @change="toggleLinkId(linkComponentIds, c.id, ($event.target as HTMLInputElement).checked)"
                />
                <span>{{ c.componentName }}</span>
                <span class="text-gray-400">· {{ c.serverIp || '-' }} · {{ c.port || '-' }}</span>
              </label>
            </div>
          </section>
        </template>
      </div>
      <div v-else-if="topology" class="space-y-6">
        <div class="rounded-lg border border-gray-100 p-4 dark:border-white/10">
          <HealthStatusBadge :status="topology.server?.status" />
          <p class="mt-2 text-sm text-gray-500">{{ topology.server?.ip }} · {{ topology.server?.port || '-' }}</p>
        </div>
        <section>
          <h3 class="mb-2 text-sm font-semibold">{{ t('operation.server.topologyProjects') }} ({{ topology.projects?.length ?? 0 }})</h3>
          <div v-if="!topology.projects?.length" class="text-sm text-gray-400">{{ t('operation.common.empty') }}</div>
          <ul v-else class="space-y-2 text-sm">
            <li v-for="p in topology.projects" :key="String(p.id)" class="rounded border border-gray-100 px-3 py-2 dark:border-white/10">
              <span class="font-medium">{{ p.projectName }}</span>
              <span class="text-gray-400"> · {{ p.port || '-' }} · {{ p.deployPath || '-' }}</span>
            </li>
          </ul>
        </section>
        <section>
          <h3 class="mb-2 text-sm font-semibold">{{ t('operation.server.topologyComponents') }} ({{ topology.components?.length ?? 0 }})</h3>
          <div v-if="!topology.components?.length" class="text-sm text-gray-400">{{ t('operation.common.empty') }}</div>
          <ul v-else class="space-y-2 text-sm">
            <li v-for="c in topology.components" :key="String(c.id)" class="flex items-center justify-between rounded border border-gray-100 px-3 py-2 dark:border-white/10">
              <span><span class="font-medium">{{ c.componentName }}</span> · {{ c.port || '-' }} · v{{ c.version || '-' }}</span>
              <HealthStatusBadge :status="c.status" />
            </li>
          </ul>
        </section>
      </div>
      <template #footer>
        <template v-if="linksEditing">
          <button type="button" class="btn-ghost" :disabled="linksSaving" @click="cancelEditLinks">{{ t('operation.common.cancel') }}</button>
          <button type="button" class="btn-primary" :disabled="linksSaving || linksLoading" @click="saveLinks">
            {{ linksSaving ? t('operation.common.saving') : t('operation.common.save') }}
          </button>
        </template>
        <template v-else>
          <button v-if="canEditLinks" type="button" class="btn-ghost" @click="startEditLinks">
            <Link2 class="h-4 w-4" /> {{ t('operation.server.editLinks') }}
          </button>
          <button type="button" class="btn-ghost" @click="closeTopology">{{ t('operation.common.cancel') }}</button>
        </template>
      </template>
    </AppModal>

    <ServerSshModal
      :open="sshModalOpen"
      :server-id="sshServerId"
      :server-name="sshServerName"
      @close="closeSshModal"
      @saved="onSshSaved"
    />
  </div>
</template>
