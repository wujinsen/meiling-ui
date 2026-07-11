<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { addProjectApi, deleteProjectApi, execDeployApi, getDeployStatusApi, getProjectApi, getProjectLinksApi, listProjectApi, saveProjectLinksApi, updateProjectApi } from '@/api/operation'
import EnvironmentSelect from '@/components/operation/EnvironmentSelect.vue'
import OperationOrphanBadge from '@/components/operation/OperationOrphanBadge.vue'
import OperationPageHeader from '@/components/operation/OperationPageHeader.vue'
import OperationServerLinksModal from '@/components/operation/OperationServerLinksModal.vue'
import PortAuditModal from '@/components/operation/PortAuditModal.vue'
import PortMatchBadge from '@/components/operation/PortMatchBadge.vue'
import AppModal from '@/components/ui/AppModal.vue'
import FormField from '@/components/ui/FormField.vue'
import { confirm } from '@/composables/useConfirm'
import { assertAction, guardAction, guardActionWithRefresh } from '@/composables/useActionPermissions'
import { PERM } from '@/constants/permissions'
import AppPagination from '@/components/ui/AppPagination.vue'
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination'
import { showToast, formatDateTime } from '@/composables/useToast'
import { API_SUCCESS_CODE } from '@/types/api'
import { createEmptyProject, type DeployExecAction, type OperationDeployStatus, type OperationProject } from '@/types/operation'
import { environmentI18nKey } from '@/utils/operationEnv'
import { isOperationOrphan } from '@/utils/operationOrphan'
import { entityHasServer, linkedServerCount, normalizeServerIds, resolveEntityServerIds } from '@/utils/operationServerLinks'
import { resolveDeployServiceKey } from '@/utils/operationPort'
import { ClipboardList, Link2, Pencil, Play, Plus, RefreshCw, RotateCcw, Search, Server, Square, Trash2 } from 'lucide-vue-next'

const { t } = useI18n()

const loading = ref(false)
const saving = ref(false)
const list = ref<OperationProject[]>([])
const total = ref(0)
const modalOpen = ref(false)
const modalTitle = ref('')
const form = ref<OperationProject>(createEmptyProject())
const isEdit = computed(() => form.value.id != null)
const auditOpen = ref(false)
const deployOpen = ref(false)
const deployLoading = ref(false)
const deployExecuting = ref(false)
const deployTitle = ref('')
const deployServiceKey = ref<string | null>(null)
const deployServerId = ref<string | number | null>(null)
const deployStatus = ref<OperationDeployStatus | null>(null)
const linksOpen = ref(false)
const linksSaving = ref(false)
const linksRow = ref<OperationProject | null>(null)
const linksServerIds = ref<string[]>([])

const canDeployExec = computed(() => assertAction(PERM.OP_DEPLOY_EXEC))
const deployExecAvailable = computed(() => deployStatus.value?.available !== false)

const serverIpLocked = computed(() => !isOperationOrphan(form.value.serverId))

const query = reactive({ pageNum: 1, pageSize: DEFAULT_PAGE_SIZE, projectName: '', serverIp: '', environment: '' as number | '' })

function envLabel(env?: number) {
  return t(environmentI18nKey(env))
}

function search() {
  if (query.pageNum === 1) loadList()
  else query.pageNum = 1
}

function resetQuery() {
  query.projectName = ''
  query.serverIp = ''
  query.environment = ''
  search()
}

async function loadList() {
  loading.value = true
  try {
    const result = await listProjectApi({
      pageNum: query.pageNum,
      pageSize: query.pageSize,
      projectName: query.projectName || undefined,
      serverIp: query.serverIp || undefined,
      environment: query.environment === '' ? undefined : (query.environment as 1 | 2 | 3 | 4),
    })
    if (result.code !== API_SUCCESS_CODE || !result.data) throw new Error(result.msg || t('operation.project.loadFailed'))
    list.value = result.data.list ?? []
    total.value = result.data.total ?? 0
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('operation.project.loadFailed'))
  } finally {
    loading.value = false
  }
}

function openCreate() {
  if (!guardAction(PERM.OP_PROJECT_ADD)) return
  form.value = createEmptyProject()
  modalTitle.value = t('operation.common.add')
  modalOpen.value = true
}

async function openEdit(row: OperationProject) {
  if (!guardAction(PERM.OP_PROJECT_EDIT)) return
  try {
    const result = await getProjectApi(row.id!)
    if (result.code !== API_SUCCESS_CODE || !result.data) throw new Error(result.msg || t('operation.project.loadFailed'))
    const data = result.data
    const serverIds = resolveEntityServerIds(data.serverIds, data.serverId)
    form.value = { ...data, serverIds, serverId: serverIds[0] ?? data.serverId ?? '' }
    modalTitle.value = t('operation.common.edit')
    modalOpen.value = true
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('operation.project.loadFailed'))
  }
}

function closeModal() {
  modalOpen.value = false
  form.value = createEmptyProject()
}

async function openProjectLinks(row: OperationProject) {
  if (!guardAction(PERM.OP_PROJECT_EDIT) || row.id == null) return
  linksRow.value = row
  try {
    const [detailRes, linksRes] = await Promise.all([
      getProjectApi(row.id),
      getProjectLinksApi(row.id),
    ])
    if (detailRes.code !== API_SUCCESS_CODE || !detailRes.data) {
      throw new Error(detailRes.msg || t('operation.project.loadFailed'))
    }
    linksRow.value = detailRes.data
    const serverIds = resolveEntityServerIds(linksRes.data?.serverIds ?? detailRes.data.serverIds, detailRes.data.serverId)
    linksServerIds.value = serverIds.map(String)
    linksOpen.value = true
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('operation.project.linksLoadFailed'))
    linksRow.value = null
  }
}

function closeProjectLinks() {
  linksOpen.value = false
  linksRow.value = null
  linksServerIds.value = []
}

async function saveProjectLinks(ids: string[]) {
  if (!linksRow.value?.id) return
  if (!guardAction(PERM.OP_PROJECT_EDIT)) return
  linksSaving.value = true
  try {
    const serverIds = normalizeServerIds(ids) ?? []
    const result = await saveProjectLinksApi(linksRow.value.id, {
      projectId: linksRow.value.id,
      serverIds,
    })
    if (result.code !== API_SUCCESS_CODE) throw new Error(result.msg || t('operation.project.linksSaveFailed'))
    showToast('success', t('operation.project.linksSaveOk'))
    closeProjectLinks()
    await loadList()
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('operation.project.linksSaveFailed'))
  } finally {
    linksSaving.value = false
  }
}

async function submitForm() {
  if (!guardAction(isEdit.value ? PERM.OP_PROJECT_EDIT : PERM.OP_PROJECT_ADD)) return
  if (!form.value.projectName?.trim()) {
    showToast('error', t('operation.project.nameRequired'))
    return
  }
  const serverIds = normalizeServerIds(form.value.serverIds)
  saving.value = true
  try {
    const primaryServerId = serverIds?.[0] ?? form.value.serverId
    const payload: OperationProject = {
      ...form.value,
      projectName: form.value.projectName.trim(),
      serverId: primaryServerId === '' || primaryServerId == null ? undefined : primaryServerId,
      serverIds: isEdit.value ? serverIds : undefined,
      url: form.value.url?.trim() || undefined,
      serverIp: form.value.serverIp?.trim() || undefined,
      innerIp: form.value.innerIp?.trim() || undefined,
      port: form.value.port?.trim() || undefined,
      deployPath: form.value.deployPath?.trim() || undefined,
      environment: Number(form.value.environment ?? 1) as 1 | 2 | 3 | 4,
      remark: form.value.remark?.trim() || undefined,
    }
    const result = isEdit.value ? await updateProjectApi(payload) : await addProjectApi(payload)
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

async function removeRow(row: OperationProject) {
  if (!guardAction(PERM.OP_PROJECT_REMOVE)) return
  if (!(await confirm({ message: t('operation.project.deleteConfirm', { name: row.projectName }) }))) return
  try {
    const result = await deleteProjectApi(row.id!)
    if (result.code !== API_SUCCESS_CODE) throw new Error(result.msg || t('operation.common.deleteFailed'))
    showToast('success', t('operation.common.deleteOk'))
    await loadList()
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('operation.common.deleteFailed'))
  }
}

function openPortAudit() {
  auditOpen.value = true
}

async function loadDeployStatus(serviceKey: string, serverId?: string | number | null) {
  const result = await getDeployStatusApi(serviceKey, serverId ?? undefined)
  if (result.code !== API_SUCCESS_CODE || !result.data) {
    throw new Error(result.msg || t('operation.deploy.statusFailed'))
  }
  deployStatus.value = result.data
}

async function openDeployStatus(row: OperationProject) {
  const serviceKey = resolveDeployServiceKey(row.projectName)
  if (!serviceKey) return
  if (row.serverId == null || row.serverId === '') {
    showToast('error', t('operation.project.deployNeedsServerId'))
    return
  }
  deployOpen.value = true
  deployLoading.value = true
  deployTitle.value = row.projectName || serviceKey
  deployServiceKey.value = serviceKey
  deployServerId.value = row.serverId
  deployStatus.value = null
  try {
    await loadDeployStatus(serviceKey, deployServerId.value)
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('operation.deploy.statusFailed'))
    deployOpen.value = false
    deployServiceKey.value = null
    deployServerId.value = null
  } finally {
    deployLoading.value = false
  }
}

function closeDeployModal() {
  deployOpen.value = false
  deployServiceKey.value = null
  deployServerId.value = null
  deployStatus.value = null
}

async function refreshDeployStatus() {
  if (!deployServiceKey.value) return
  deployLoading.value = true
  try {
    await loadDeployStatus(deployServiceKey.value, deployServerId.value)
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('operation.deploy.statusFailed'))
  } finally {
    deployLoading.value = false
  }
}

function deployActionLabel(action: DeployExecAction) {
  return t(`operation.deploy.action.${action}`)
}

async function execDeploy(action: DeployExecAction) {
  if (!deployServiceKey.value || !deployExecAvailable.value) return
  if (!assertAction(PERM.OP_DEPLOY_EXEC) && !(await guardActionWithRefresh(PERM.OP_DEPLOY_EXEC))) return
  if (!(await confirm({
    message: t('operation.deploy.execConfirm', {
      name: deployTitle.value,
      action: deployActionLabel(action),
    }),
    danger: action !== 'start',
  }))) return

  deployExecuting.value = true
  try {
    const result = await execDeployApi(deployServiceKey.value, action, deployServerId.value ?? undefined)
    if (result.code !== API_SUCCESS_CODE || !result.data) {
      throw new Error(result.msg || t('operation.deploy.execFailed'))
    }
    deployStatus.value = result.data
    showToast('success', t('operation.deploy.execOk'))
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('operation.deploy.execFailed'))
  } finally {
    deployExecuting.value = false
  }
}

function deployRunningLabel(row: OperationProject) {
  if (!resolveDeployServiceKey(row.projectName)) return null
  if (row.deployRunning == null) return t('operation.deploy.unknown')
  return row.deployRunning ? t('operation.deploy.running') : t('operation.deploy.stopped')
}

function deployRunningClass(row: OperationProject) {
  if (row.deployRunning == null) return 'border-gray-200 bg-gray-50 text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300'
  return row.deployRunning
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300'
    : 'border-gray-200 bg-gray-50 text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300'
}

watch(() => [query.pageNum, query.pageSize], loadList)
onMounted(loadList)
</script>

<template>
  <div class="page-stack">
    <OperationPageHeader :title="t('operation.project.title')" :subtitle="t('operation.project.subtitle')">
      <template #toolbar>
        <form class="operation-search-form" @submit.prevent="search">
          <label class="operation-filter-field">
            <span>{{ t('operation.project.projectName') }}</span>
            <input v-model="query.projectName" type="text" class="field-input" />
          </label>
          <label class="operation-filter-field">
            <span>{{ t('operation.project.serverIp') }}</span>
            <input v-model="query.serverIp" type="text" class="field-input" />
          </label>
          <div class="operation-filter-field">
            <span>{{ t('operation.common.environment') }}</span>
            <EnvironmentSelect v-model="query.environment" include-all />
          </div>
          <div class="operation-form-actions">
            <button type="submit" class="btn-primary shrink-0"><Search class="h-4 w-4" /> {{ t('operation.common.search') }}</button>
            <button type="button" class="btn-ghost shrink-0" @click="resetQuery"><RefreshCw class="h-4 w-4" /> {{ t('operation.common.reset') }}</button>
          </div>
        </form>
        <div class="toolbar-actions">
          <button type="button" class="btn-ghost shrink-0" @click="openPortAudit"><ClipboardList class="h-4 w-4" /> {{ t('operation.port.audit') }}</button>
          <button type="button" class="btn-primary shrink-0" @click="openCreate"><Plus class="h-4 w-4" /> {{ t('operation.common.add') }}</button>
        </div>
      </template>
    </OperationPageHeader>

    <div class="card p-5">
      <div class="overflow-x-auto rounded-lg border border-gray-100 dark:border-white/5">
        <table class="w-full min-w-[1180px] text-left text-sm">
          <thead class="bg-gray-50 text-xs uppercase text-gray-400 dark:bg-white/5">
            <tr>
              <th class="px-4 py-3">{{ t('operation.project.projectName') }}</th>
              <th class="px-4 py-3">URL</th>
              <th class="px-4 py-3">{{ t('operation.project.serverIp') }}</th>
              <th class="px-4 py-3">{{ t('operation.project.port') }}</th>
              <th class="px-4 py-3">{{ t('operation.port.status') }}</th>
              <th class="px-4 py-3">{{ t('operation.deploy.status') }}</th>
              <th class="px-4 py-3">{{ t('operation.project.deployPath') }}</th>
              <th class="px-4 py-3">{{ t('operation.common.environment') }}</th>
              <th class="px-4 py-3">{{ t('operation.common.createTime') }}</th>
              <th class="px-4 py-3 text-right">{{ t('operation.common.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading"><td colspan="10" class="px-4 py-10 text-center text-gray-400">{{ t('operation.common.loading') }}</td></tr>
            <tr v-else-if="!list.length"><td colspan="10" class="px-4 py-10 text-center text-gray-400">{{ t('operation.common.empty') }}</td></tr>
            <tr
              v-for="row in list"
              v-else
              :key="String(row.id)"
              class="border-t border-gray-50 dark:border-white/5 hover:bg-gray-50/80 dark:hover:bg-white/5"
              :class="!entityHasServer(row) && 'operation-table-row--orphan'"
            >
              <td class="px-4 py-3 font-medium">
                <div class="flex min-w-0 items-center gap-2">
                  <span class="truncate">{{ row.projectName }}</span>
                  <OperationOrphanBadge :show="!entityHasServer(row)" />
                </div>
              </td>
              <td class="px-4 py-3"><a v-if="row.url" :href="row.url" target="_blank" class="text-brand-600 hover:underline">{{ row.url }}</a><span v-else>-</span></td>
              <td class="px-4 py-3">
                <div class="flex flex-wrap items-center gap-1.5">
                  <span>{{ row.serverIp || '-' }}</span>
                  <span v-if="linkedServerCount(row) > 1" class="operation-alias-chip operation-alias-chip--compact text-[10px]">
                    +{{ linkedServerCount(row) - 1 }}
                  </span>
                </div>
              </td>
              <td class="px-4 py-3">{{ row.port || '-' }}</td>
              <td class="px-4 py-3"><PortMatchBadge :status="row.portMatchStatus" :expected-port="row.expectedPort" /></td>
              <td class="px-4 py-3">
                <span v-if="deployRunningLabel(row)" class="badge" :class="deployRunningClass(row)">
                  {{ deployRunningLabel(row) }}
                </span>
                <span v-else class="text-gray-400">-</span>
                <p v-if="row.lastDeployCheckTime && resolveDeployServiceKey(row.projectName)" class="mt-1 text-[10px] text-gray-400">
                  {{ formatDateTime(row.lastDeployCheckTime) }}
                </p>
              </td>
              <td class="max-w-[160px] truncate px-4 py-3">{{ row.deployPath || '-' }}</td>
              <td class="px-4 py-3"><span class="badge bg-gray-100 dark:bg-white/10">{{ envLabel(row.environment) }}</span></td>
              <td class="px-4 py-3">{{ formatDateTime(row.createTime) }}</td>
              <td class="px-4 py-3">
                <div class="btn-action-group flex-wrap justify-end">
                  <button
                    v-if="resolveDeployServiceKey(row.projectName)"
                    type="button"
                    class="btn-action-edit"
                    :disabled="!entityHasServer(row)"
                    :title="!entityHasServer(row) ? t('operation.project.deployNeedsServerId') : undefined"
                    @click="openDeployStatus(row)"
                  >
                    <Server class="h-3.5 w-3.5" />{{ t('operation.deploy.status') }}
                  </button>
                  <button type="button" class="btn-action-edit" @click="openProjectLinks(row)">
                    <Link2 class="h-3.5 w-3.5" />{{ t('operation.project.linkServers') }}
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
            <FormField :label="t('operation.project.projectName')" horizontal required class="form-field-span-2">
              <input v-model="form.projectName" class="field-input" />
            </FormField>
          </div>
          <div class="form-grid-row">
            <FormField label="URL" horizontal class="form-field-span-2">
              <input v-model="form.url" class="field-input" />
            </FormField>
          </div>
          <div class="form-grid-row">
            <FormField :label="t('operation.project.serverIp')" horizontal>
              <input v-model="form.serverIp" class="field-input" :readonly="serverIpLocked" />
              <p class="mt-1 text-xs text-gray-400">{{ t('operation.project.linkServersEditHint') }}</p>
            </FormField>
            <FormField :label="t('operation.project.innerIp')" horizontal>
              <input v-model="form.innerIp" class="field-input" :readonly="serverIpLocked" />
            </FormField>
          </div>
          <div class="form-grid-row">
            <FormField :label="t('operation.project.port')" horizontal>
              <input v-model="form.port" class="field-input" />
            </FormField>
            <FormField :label="t('operation.project.deployPath')" horizontal>
              <input v-model="form.deployPath" class="field-input" />
            </FormField>
          </div>
          <div class="form-grid-row">
            <FormField :label="t('operation.common.environment')" horizontal class="form-field-span-2">
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

    <PortAuditModal :open="auditOpen" @close="auditOpen = false" />

    <OperationServerLinksModal
      :open="linksOpen"
      :model-value="linksServerIds"
      :entity-name="linksRow?.projectName"
      :default-environment="linksRow?.environment"
      :saving="linksSaving"
      @confirm="saveProjectLinks"
      @close="closeProjectLinks"
    />

    <AppModal :open="deployOpen" :title="t('operation.deploy.statusTitle', { name: deployTitle })" wide @close="closeDeployModal">
      <div v-if="deployLoading" class="py-10 text-center text-gray-400">{{ t('operation.common.loading') }}</div>
      <div v-else-if="deployStatus" class="space-y-4 text-sm">
        <div class="flex flex-wrap items-center gap-2">
          <p>
            <span class="text-gray-400">{{ t('operation.deploy.service') }}:</span>
            {{ deployStatus.serviceKey }}
          </p>
          <span
            class="badge"
            :class="deployStatus.running
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300'
              : 'border-gray-200 bg-gray-50 text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300'"
          >
            {{ deployStatus.running ? t('operation.deploy.running') : t('operation.deploy.stopped') }}
          </span>
        </div>

        <p v-if="deployStatus.available === false" class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
          {{ deployStatus.message || t('operation.deploy.execDisabled') }}
        </p>
        <p v-else-if="deployStatus.message" class="text-gray-500">{{ deployStatus.message }}</p>

        <div
          v-if="canDeployExec && deployExecAvailable"
          class="flex flex-wrap items-center gap-2 rounded-lg border border-gray-100 bg-gray-50/80 p-3 dark:border-white/10 dark:bg-white/5"
        >
          <span class="mr-1 text-xs text-gray-500">{{ t('operation.deploy.exec') }}:</span>
          <button
            type="button"
            class="btn-primary text-xs"
            :disabled="deployExecuting"
            @click="execDeploy('start')"
          >
            <Play class="h-3.5 w-3.5" />
            {{ t('operation.deploy.action.start') }}
          </button>
          <button
            type="button"
            class="btn-ghost text-xs text-red-600 hover:text-red-700 dark:text-red-400"
            :disabled="deployExecuting"
            @click="execDeploy('stop')"
          >
            <Square class="h-3.5 w-3.5" />
            {{ t('operation.deploy.action.stop') }}
          </button>
          <button
            type="button"
            class="btn-ghost text-xs"
            :disabled="deployExecuting"
            @click="execDeploy('restart')"
          >
            <RotateCcw class="h-3.5 w-3.5" />
            {{ t('operation.deploy.action.restart') }}
          </button>
        </div>
        <p v-else-if="!canDeployExec && deployExecAvailable" class="text-xs text-gray-400">
          {{ t('operation.deploy.noExecPermission') }}
        </p>

        <pre v-if="deployStatus.output" class="max-h-64 overflow-auto rounded bg-gray-50 p-3 text-xs dark:bg-white/5">{{ deployStatus.output }}</pre>
      </div>
      <template #footer>
        <button
          type="button"
          class="btn-ghost"
          :disabled="deployLoading || deployExecuting"
          @click="refreshDeployStatus"
        >
          <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': deployLoading }" />
          {{ t('operation.deploy.refresh') }}
        </button>
        <button type="button" class="btn-ghost" @click="closeDeployModal">{{ t('operation.common.cancel') }}</button>
      </template>
    </AppModal>
  </div>
</template>
