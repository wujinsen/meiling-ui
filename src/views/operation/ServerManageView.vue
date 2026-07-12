<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { addServerApi, checkServerApi, deleteServerApi, getServerApi, getServerTagOptionsApi, listServerApi, updateServerApi } from '@/api/operation'
import DeployTaskDrawer from '@/components/operation/DeployTaskDrawer.vue'
import EnvironmentSelect from '@/components/operation/EnvironmentSelect.vue'
import EnvironmentBadge from '@/components/operation/EnvironmentBadge.vue'
import ServerRoleSelect from '@/components/operation/ServerRoleSelect.vue'
import ServerRoleBadge from '@/components/operation/ServerRoleBadge.vue'
import ServerTagsInput from '@/components/operation/ServerTagsInput.vue'
import ServerTagsBadges from '@/components/operation/ServerTagsBadges.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import HealthStatusBadge from '@/components/operation/HealthStatusBadge.vue'
import OperationPageHeader from '@/components/operation/OperationPageHeader.vue'
import OperationRelationChips from '@/components/operation/OperationRelationChips.vue'
import OperationRelationFilterChips from '@/components/operation/OperationRelationFilterChips.vue'
import OperationServerRelationLinksModal from '@/components/operation/OperationServerRelationLinksModal.vue'
import RelationDrawer, { type RelationDrawerTab } from '@/components/operation/RelationDrawer.vue'
import ServerSshModal from '@/components/operation/ServerSshModal.vue'
import AppModal from '@/components/ui/AppModal.vue'
import FormField from '@/components/ui/FormField.vue'
import { useProbeAllHealth } from '@/composables/useProbeAllHealth'
import { confirm } from '@/composables/useConfirm'
import { guardAction, assertAction } from '@/composables/useActionPermissions'
import { PERM } from '@/constants/permissions'
import AppPagination from '@/components/ui/AppPagination.vue'
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination'
import { showToast, formatDateTime } from '@/composables/useToast'
import { useOperationRelationListFilter } from '@/composables/useOperationRelationListFilter'
import { API_SUCCESS_CODE } from '@/types/api'
import { OPERATION_ERR_SERVER_TASK_RUNNING } from '@/constants/operationErrors'
import { createEmptyServer, type OperationServer } from '@/types/operation'
import { Activity, GitBranch, KeyRound, Pencil, Plus, RefreshCw, Search, Trash2 } from 'lucide-vue-next'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()

const loading = ref(false)
const saving = ref(false)
const list = ref<OperationServer[]>([])
const total = ref(0)
const modalOpen = ref(false)
const modalTitle = ref('')
const form = ref<OperationServer>(createEmptyServer())
const isEdit = computed(() => form.value.id != null)
const checkingId = ref<string | number | null>(null)
const relationOpen = ref(false)
const relationRow = ref<OperationServer | null>(null)
const relationTab = ref<RelationDrawerTab>('projects')
const linksModalOpen = ref(false)
const linksServerId = ref<string | number | null>(null)
const linksServerName = ref('')
const sshModalOpen = ref(false)
const sshServerId = ref<string | number | null>(null)
const sshServerName = ref('')
const tagOptions = ref<string[]>([])

const canSshManage = computed(() => assertAction(PERM.OP_SSH_MANAGE))

const query = reactive({ pageNum: 1, pageSize: DEFAULT_PAGE_SIZE, serverName: '', ip: '', environment: '' as number | '', serverRole: '' as string, tag: '' as string, projectId: '', componentId: '' })

const { activeFilters, applyQueryFromRoute, clearFilter } = useOperationRelationListFilter('server', query, route, router, () => {
  if (query.pageNum !== 1) query.pageNum = 1
  else void loadList()
})

const tagFilterOptions = computed(() => [
  { value: '', label: t('operation.serverTags.all') },
  ...tagOptions.value.map((tag) => ({ value: tag, label: tag })),
])

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
  query.serverRole = ''
  query.tag = ''
  query.projectId = ''
  query.componentId = ''
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
      serverRole: query.serverRole || undefined,
      tag: query.tag || undefined,
      projectId: query.projectId || undefined,
      componentId: query.componentId || undefined,
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

const {
  drawerOpen: taskDrawerOpen,
  task: taskDetail,
  logText: taskLogText,
  polling: taskPolling,
  openTask,
  closeDrawer: closeTaskDrawer,
  probeAll,
  busy: probingAll,
  resolveErrorMessage,
} = useProbeAllHealth({ onFinished: loadList })

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
    form.value = { ...result.data, tags: result.data.tags ?? [] }
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
      serverRole: form.value.serverRole || 'app',
      tags: form.value.tags ?? [],
      remark: form.value.remark?.trim() || undefined,
    }
    const result = isEdit.value ? await updateServerApi(payload) : await addServerApi(payload)
    if (result.code !== API_SUCCESS_CODE) throw new Error(result.msg || t('operation.common.saveFailed'))
    showToast('success', isEdit.value ? t('operation.common.updateOk') : t('operation.common.createOk'))
    closeModal()
    await Promise.all([loadList(), loadTagOptions()])
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
    if (result.code === OPERATION_ERR_SERVER_TASK_RUNNING) {
      showToast('error', resolveErrorMessage(result.code, result.msg))
      if (
        row.id != null
        && (await confirm({ message: t('operation.server.gotoTaskListConfirm') }))
      ) {
        router.push({ path: '/operation/task', query: { serverId: String(row.id) } })
      }
      return
    }
    if (result.code !== API_SUCCESS_CODE) throw new Error(resolveErrorMessage(result.code, result.msg) || t('operation.common.deleteFailed'))
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
    if (result.code === OPERATION_ERR_SERVER_TASK_RUNNING) {
      showToast('error', resolveErrorMessage(result.code, result.msg))
      const taskRef = result.data
      if (typeof taskRef === 'number' || typeof taskRef === 'string') openTask(taskRef)
      return
    }
    if (result.code !== API_SUCCESS_CODE || !result.data || typeof result.data !== 'object') {
      throw new Error(resolveErrorMessage(result.code, result.msg) || t('operation.health.checkFailed'))
    }
    const idx = list.value.findIndex((item) => String(item.id) === String(row.id))
    if (idx >= 0) list.value[idx] = { ...list.value[idx], ...result.data }
    showToast('success', t('operation.health.checkOk'))
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('operation.health.checkFailed'))
  } finally {
    checkingId.value = null
  }
}

async function openRelationDrawer(row: OperationServer, tab: RelationDrawerTab = 'projects') {
  if (row.id == null) return
  relationRow.value = row
  relationTab.value = tab
  relationOpen.value = true
}

function onRelationEditLinks() {
  relationOpen.value = false
  if (relationRow.value?.id == null) return
  linksServerId.value = relationRow.value.id
  linksServerName.value = relationRow.value.serverName || String(relationRow.value.id)
  linksModalOpen.value = true
}

function onLinksSaved() {
  void loadList()
}

async function openTopology(row: OperationServer) {
  await openRelationDrawer(row, 'projects')
}

async function loadTagOptions() {
  try {
    const result = await getServerTagOptionsApi()
    if (result.code === API_SUCCESS_CODE && Array.isArray(result.data)) {
      tagOptions.value = result.data
    }
  } catch {
    tagOptions.value = []
  }
}

watch(() => [query.pageNum, query.pageSize], loadList)
onMounted(() => {
  applyQueryFromRoute()
  loadTagOptions()
  loadList()
})
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
          <div class="operation-filter-field">
            <span>{{ t('operation.serverRole.label') }}</span>
            <ServerRoleSelect v-model="query.serverRole" include-all />
          </div>
          <div class="operation-filter-field">
            <span>{{ t('operation.serverTags.label') }}</span>
            <AppSelect v-model="query.tag" :options="tagFilterOptions" />
          </div>
          <div class="operation-form-actions">
            <button type="submit" class="btn-primary shrink-0"><Search class="h-4 w-4" /> {{ t('operation.common.search') }}</button>
            <button type="button" class="btn-ghost shrink-0" @click="resetQuery"><RefreshCw class="h-4 w-4" /> {{ t('operation.common.reset') }}</button>
          </div>
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
      <OperationRelationFilterChips :filters="activeFilters" @clear="clearFilter" />
      <div class="overflow-x-auto rounded-lg border border-gray-100 dark:border-white/5">
        <table class="w-full min-w-[1180px] text-left text-sm">
          <thead class="bg-gray-50 text-xs uppercase text-gray-400 dark:bg-white/5">
            <tr>
              <th class="px-4 py-3">{{ t('operation.server.serverName') }}</th>
              <th class="px-4 py-3">IP</th>
              <th class="px-4 py-3">{{ t('operation.server.innerIp') }}</th>
              <th class="px-4 py-3">{{ t('operation.server.port') }}</th>
              <th class="px-4 py-3">{{ t('operation.health.status') }}</th>
              <th class="px-4 py-3">{{ t('operation.serverRole.label') }}</th>
              <th class="px-4 py-3">{{ t('operation.serverTags.label') }}</th>
              <th class="px-4 py-3">{{ t('operation.relations.column') }}</th>
              <th class="px-4 py-3 text-center">{{ t('operation.common.environment') }}</th>
              <th class="px-4 py-3">{{ t('operation.common.remark') }}</th>
              <th class="px-4 py-3">{{ t('operation.common.createTime') }}</th>
              <th class="px-4 py-3 text-right">{{ t('operation.common.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading"><td colspan="12" class="px-4 py-10 text-center text-gray-400">{{ t('operation.common.loading') }}</td></tr>
            <tr v-else-if="!list.length"><td colspan="12" class="px-4 py-10 text-center text-gray-400">{{ t('operation.common.empty') }}</td></tr>
            <tr v-for="row in list" v-else :key="String(row.id)" class="border-t border-gray-50 dark:border-white/5 hover:bg-gray-50/80 dark:hover:bg-white/5">
              <td class="px-4 py-3 font-medium">{{ row.serverName }}</td>
              <td class="px-4 py-3">{{ row.ip || '-' }}</td>
              <td class="px-4 py-3">{{ row.innerIp || '-' }}</td>
              <td class="px-4 py-3">{{ row.port || '-' }}</td>
              <td class="px-4 py-3">
                <HealthStatusBadge :status="row.status" :last-check-time="formatDateTime(row.lastCheckTime ?? undefined)" show-time />
              </td>
              <td class="px-4 py-3"><ServerRoleBadge :server-role="row.serverRole" /></td>
              <td class="px-4 py-3"><ServerTagsBadges :tags="row.tags" size="sm" /></td>
              <td class="px-4 py-3">
                <OperationRelationChips
                  :project-count="row.projectCount"
                  :component-count="row.componentCount"
                  @open-projects="openRelationDrawer(row, 'projects')"
                  @open-components="openRelationDrawer(row, 'components')"
                />
              </td>
              <td class="px-4 py-3 text-center">
                <EnvironmentBadge :environment="row.environment" />
              </td>
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
            <FormField :label="t('operation.serverRole.label')" horizontal class="form-field-span-2">
              <ServerRoleSelect v-model="form.serverRole" />
            </FormField>
          </div>
          <div class="form-grid-row">
            <FormField
              :label="t('operation.serverTags.label')"
              horizontal
              class="form-field-span-2"
              :hint="t('operation.serverTags.hint')"
            >
              <ServerTagsInput v-model="form.tags" :suggestions="tagOptions" :show-hint="false" :show-suggestions="false" />
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

    <OperationServerRelationLinksModal
      :open="linksModalOpen"
      :server-id="linksServerId"
      :server-name="linksServerName"
      @close="linksModalOpen = false"
      @saved="onLinksSaved"
    />

    <RelationDrawer
      :open="relationOpen"
      entity-type="server"
      :entity-id="relationRow?.id ?? null"
      :entity-name="relationRow?.serverName"
      :initial-tab="relationTab"
      @close="relationOpen = false"
      @edit-links="onRelationEditLinks"
    />

    <ServerSshModal
      :open="sshModalOpen"
      :server-id="sshServerId"
      :server-name="sshServerName"
      @close="closeSshModal"
      @saved="onSshSaved"
    />

    <DeployTaskDrawer
      :open="taskDrawerOpen"
      :task="taskDetail"
      :log-text="taskLogText"
      :polling="taskPolling"
      @close="closeTaskDrawer"
    />
  </div>
</template>
