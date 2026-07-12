<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { addComponentApi, checkComponentApi, deleteComponentApi, getComponentApi, getComponentLinksApi, listComponentApi, revealComponentSecretApi, saveComponentLinksApi, updateComponentApi } from '@/api/operation'
import EnvironmentSelect from '@/components/operation/EnvironmentSelect.vue'
import EnvironmentBadge from '@/components/operation/EnvironmentBadge.vue'
import HealthStatusBadge from '@/components/operation/HealthStatusBadge.vue'
import OperationLinkedServersFormSection from '@/components/operation/OperationLinkedServersFormSection.vue'
import OperationLinkedServersCell from '@/components/operation/OperationLinkedServersCell.vue'
import OperationOrphanBadge from '@/components/operation/OperationOrphanBadge.vue'
import OperationPageHeader from '@/components/operation/OperationPageHeader.vue'
import OperationRelationChips from '@/components/operation/OperationRelationChips.vue'
import OperationRelationFilterChips from '@/components/operation/OperationRelationFilterChips.vue'
import OperationServerLinksModal from '@/components/operation/OperationServerLinksModal.vue'
import RelationDrawer, { type RelationDrawerTab } from '@/components/operation/RelationDrawer.vue'
import ServerDetailModal from '@/components/operation/ServerDetailModal.vue'
import LinkedServersPickModal from '@/components/operation/LinkedServersPickModal.vue'
import PortAuditModal from '@/components/operation/PortAuditModal.vue'
import PortMatchBadge from '@/components/operation/PortMatchBadge.vue'
import SecretManageModal from '@/components/operation/SecretManageModal.vue'
import AppModal from '@/components/ui/AppModal.vue'
import FormField from '@/components/ui/FormField.vue'
import { useOperationServerLabelCache } from '@/composables/useOperationServerLabelCache'
import { useViewLinkedServer } from '@/composables/useViewLinkedServer'
import { confirm } from '@/composables/useConfirm'
import { assertOperationSecretEdit, guardAction, guardOperationSecretEdit } from '@/composables/useActionPermissions'
import { PERM } from '@/constants/permissions'
import AppPagination from '@/components/ui/AppPagination.vue'
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination'
import { showToast, formatDateTime } from '@/composables/useToast'
import { useOperationRelationListFilter } from '@/composables/useOperationRelationListFilter'
import { API_SUCCESS_CODE } from '@/types/api'
import { createEmptyComponent, type OperationComponent } from '@/types/operation'
import { applyServerIdsToLinkedRow, entityHasServer, normalizeServerIds, resolveEntityServerIds } from '@/utils/operationServerLinks'
import { Pencil, Plus, RefreshCw, Search, Trash2, Activity, ClipboardList, KeyRound, Link2 } from 'lucide-vue-next'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const loading = ref(false)
const saving = ref(false)
const list = ref<OperationComponent[]>([])
const total = ref(0)
const modalOpen = ref(false)
const modalTitle = ref('')
const form = ref<OperationComponent>(createEmptyComponent())
const passwordInput = ref('')
const isEdit = computed(() => form.value.id != null)
const checkingId = ref<string | number | null>(null)
const auditOpen = ref(false)
const secretOpen = ref(false)
const secretSaving = ref(false)
const secretRow = ref<OperationComponent | null>(null)
const linksOpen = ref(false)
const linksSaving = ref(false)
const linksRow = ref<OperationComponent | null>(null)
const linksServerIds = ref<string[]>([])
const relationOpen = ref(false)
const relationRow = ref<OperationComponent | null>(null)
const relationTab = ref<RelationDrawerTab>('servers')

const { serverCache, enrichRowsWithLinks, hydrateRows } = useOperationServerLabelCache()
const {
  detailOpen: serverDetailOpen,
  detailServerId,
  pickOpen: serverPickOpen,
  pickServerIds,
  openFromRow: openLinkedServerView,
  closeDetail: closeServerDetail,
  closePick: closeServerPick,
  onPickServer,
} = useViewLinkedServer(serverCache)

const canManagePassword = computed(() => assertOperationSecretEdit(PERM.OP_COMPONENT_EDIT))

const query = reactive({ pageNum: 1, pageSize: DEFAULT_PAGE_SIZE, componentName: '', serverIp: '', environment: '' as number | '', serverId: '', projectId: '' })

const { activeFilters, applyQueryFromRoute, clearFilter } = useOperationRelationListFilter('component', query, route, router, () => {
  if (query.pageNum !== 1) query.pageNum = 1
  else void loadList()
})

async function applyFormServerLinks(componentId: string | number, detail?: OperationComponent) {
  const linksRes = await getComponentLinksApi(componentId)
  const base = detail ?? form.value
  const serverIds = resolveEntityServerIds(
    linksRes.code === API_SUCCESS_CODE ? linksRes.data?.serverIds : undefined,
    base.serverId,
  )
  form.value = {
    ...base,
    serverIds: serverIds.length ? serverIds : undefined,
    serverId: serverIds[0] ?? base.serverId ?? '',
  }
  await hydrateRows([form.value])
}

function search() {
  if (query.pageNum === 1) loadList()
  else query.pageNum = 1
}

function resetQuery() {
  query.componentName = ''
  query.serverIp = ''
  query.environment = ''
  query.serverId = ''
  query.projectId = ''
  search()
}

async function loadList() {
  loading.value = true
  try {
    const result = await listComponentApi({
      pageNum: query.pageNum,
      pageSize: query.pageSize,
      componentName: query.componentName || undefined,
      serverIp: query.serverIp || undefined,
      environment: query.environment === '' ? undefined : (query.environment as 1 | 2 | 3 | 4),
      serverId: query.serverId || undefined,
      projectId: query.projectId || undefined,
    })
    if (result.code !== API_SUCCESS_CODE || !result.data) throw new Error(result.msg || t('operation.component.loadFailed'))
    const rows = result.data.list ?? []
    list.value = await enrichRowsWithLinks(rows, async (id) => {
      const linksRes = await getComponentLinksApi(id)
      return linksRes.code === API_SUCCESS_CODE ? (linksRes.data?.serverIds ?? []) : undefined
    })
    total.value = result.data.total ?? 0
    await hydrateRows(list.value)
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('operation.component.loadFailed'))
  } finally {
    loading.value = false
  }
}

function openCreate() {
  if (!guardAction(PERM.OP_COMPONENT_ADD)) return
  form.value = createEmptyComponent()
  passwordInput.value = ''
  modalTitle.value = t('operation.common.add')
  modalOpen.value = true
}

async function openEdit(row: OperationComponent) {
  if (!guardAction(PERM.OP_COMPONENT_EDIT)) return
  try {
    const [detailRes, linksRes] = await Promise.all([
      getComponentApi(row.id!),
      getComponentLinksApi(row.id!),
    ])
    if (detailRes.code !== API_SUCCESS_CODE || !detailRes.data) throw new Error(detailRes.msg || t('operation.component.loadFailed'))
    const data = detailRes.data
    const serverIds = resolveEntityServerIds(linksRes.data?.serverIds ?? data.serverIds, data.serverId)
    form.value = { ...data, serverIds, serverId: serverIds[0] ?? data.serverId ?? '' }
    passwordInput.value = ''
    modalTitle.value = t('operation.common.edit')
    modalOpen.value = true
    await hydrateRows([form.value])
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('operation.component.loadFailed'))
  }
}

function openFormLinks() {
  const perm = isEdit.value ? PERM.OP_COMPONENT_EDIT : PERM.OP_COMPONENT_ADD
  if (!guardAction(perm)) return
  linksRow.value = form.value.id != null ? { ...form.value } : null
  linksServerIds.value = resolveEntityServerIds(form.value.serverIds, form.value.serverId).map(String)
  linksOpen.value = true
}

function closeModal() {
  modalOpen.value = false
  form.value = createEmptyComponent()
  passwordInput.value = ''
}

async function openComponentLinks(row: OperationComponent) {
  if (!guardAction(PERM.OP_COMPONENT_EDIT) || row.id == null) return
  linksRow.value = row
  try {
    const [detailRes, linksRes] = await Promise.all([
      getComponentApi(row.id),
      getComponentLinksApi(row.id),
    ])
    if (detailRes.code !== API_SUCCESS_CODE || !detailRes.data) {
      throw new Error(detailRes.msg || t('operation.component.loadFailed'))
    }
    linksRow.value = detailRes.data
    const serverIds = resolveEntityServerIds(linksRes.data?.serverIds ?? detailRes.data.serverIds, detailRes.data.serverId)
    linksServerIds.value = serverIds.map(String)
    linksOpen.value = true
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('operation.component.linksLoadFailed'))
    linksRow.value = null
  }
}

function closeComponentLinks() {
  linksOpen.value = false
  linksRow.value = null
  linksServerIds.value = []
}

function openRelationDrawer(row: OperationComponent, tab: RelationDrawerTab = 'servers') {
  if (row.id == null) return
  relationRow.value = row
  relationTab.value = tab
  relationOpen.value = true
}

async function onRelationEditLinks() {
  relationOpen.value = false
  if (relationRow.value) await openComponentLinks(relationRow.value)
}

async function confirmComponentLinks(ids: string[]) {
  const serverIds = normalizeServerIds(ids) ?? []
  if (linksRow.value?.id != null) {
    await saveComponentLinks(ids)
    return
  }
  linksSaving.value = true
  try {
    form.value = applyServerIdsToLinkedRow(form.value, serverIds, serverCache.value)
    await hydrateRows([form.value])
    closeComponentLinks()
  } finally {
    linksSaving.value = false
  }
}

async function saveComponentLinks(ids: string[]) {
  if (!linksRow.value?.id) return
  if (!guardAction(PERM.OP_COMPONENT_EDIT)) return
  linksSaving.value = true
  try {
    const serverIds = normalizeServerIds(ids) ?? []
    const result = await saveComponentLinksApi(linksRow.value.id, {
      componentId: linksRow.value.id,
      serverIds,
    })
    if (result.code !== API_SUCCESS_CODE) throw new Error(result.msg || t('operation.component.linksSaveFailed'))
    showToast('success', t('operation.component.linksSaveOk'))
    closeComponentLinks()
    if (modalOpen.value && form.value.id != null && String(form.value.id) === String(linksRow.value.id)) {
      try {
        await applyFormServerLinks(form.value.id, form.value)
      } catch {
        /* 保存已成功；刷新表单关联失败不阻断关弹窗 */
      }
    }
    try {
      await loadList()
    } catch {
      /* loadList 内部已 toast */
    }
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('operation.component.linksSaveFailed'))
  } finally {
    linksSaving.value = false
  }
}

async function submitForm() {
  if (!guardAction(isEdit.value ? PERM.OP_COMPONENT_EDIT : PERM.OP_COMPONENT_ADD)) return
  if (!form.value.componentName?.trim()) {
    showToast('error', t('operation.component.nameRequired'))
    return
  }
  const serverIds = normalizeServerIds(form.value.serverIds)
  saving.value = true
  try {
    const primaryServerId = serverIds?.[0] ?? form.value.serverId
    const payload: OperationComponent = {
      ...form.value,
      componentName: form.value.componentName.trim(),
      serverId: primaryServerId === '' || primaryServerId == null ? undefined : primaryServerId,
      serverIds,
      serverIp: form.value.serverIp?.trim() || undefined,
      account: form.value.account?.trim() || undefined,
      deployPath: form.value.deployPath?.trim() || undefined,
      port: form.value.port?.trim() || undefined,
      version: form.value.version?.trim() || undefined,
      environment: Number(form.value.environment ?? 1) as 1 | 2 | 3 | 4,
      remark: form.value.remark?.trim() || undefined,
    }
    if (!isEdit.value && passwordInput.value.trim()) {
      payload.password = passwordInput.value.trim()
    }
    const result = isEdit.value ? await updateComponentApi(payload) : await addComponentApi(payload)
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

async function removeRow(row: OperationComponent) {
  if (!guardAction(PERM.OP_COMPONENT_REMOVE)) return
  if (!(await confirm({ message: t('operation.component.deleteConfirm', { name: row.componentName }) }))) return
  try {
    const result = await deleteComponentApi(row.id!)
    if (result.code !== API_SUCCESS_CODE) throw new Error(result.msg || t('operation.common.deleteFailed'))
    showToast('success', t('operation.common.deleteOk'))
    await loadList()
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('operation.common.deleteFailed'))
  }
}

async function checkRow(row: OperationComponent) {
  if (row.id == null) return
  checkingId.value = row.id
  try {
    const result = await checkComponentApi(row.id)
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

function openPasswordManage(row: OperationComponent) {
  if (!canManagePassword.value) return
  secretRow.value = row
  secretOpen.value = true
}

function closePasswordManage() {
  secretOpen.value = false
  secretRow.value = null
}

async function savePassword(password: string) {
  if (!secretRow.value?.id) return
  if (!(await guardOperationSecretEdit(PERM.OP_COMPONENT_EDIT))) return
  secretSaving.value = true
  try {
    const result = await updateComponentApi({ ...secretRow.value, password })
    if (result.code !== API_SUCCESS_CODE) throw new Error(result.msg || t('operation.common.saveFailed'))
    showToast('success', t('operation.common.passwordSaveOk'))
    closePasswordManage()
    await loadList()
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('operation.common.saveFailed'))
  } finally {
    secretSaving.value = false
  }
}

watch(() => [query.pageNum, query.pageSize], loadList)
onMounted(() => {
  applyQueryFromRoute()
  loadList()
})
</script>

<template>
  <div class="page-stack">
    <OperationPageHeader :title="t('operation.component.title')" :subtitle="t('operation.component.subtitle')">
      <template #toolbar>
        <form class="operation-search-form" @submit.prevent="search">
          <label class="operation-filter-field">
            <span>{{ t('operation.component.componentName') }}</span>
            <input v-model="query.componentName" type="text" class="field-input" />
          </label>
          <label class="operation-filter-field">
            <span>{{ t('operation.component.serverIp') }}</span>
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
          <button type="button" class="btn-ghost shrink-0" @click="auditOpen = true"><ClipboardList class="h-4 w-4" /> {{ t('operation.port.audit') }}</button>
          <button type="button" class="btn-primary shrink-0" @click="openCreate"><Plus class="h-4 w-4" /> {{ t('operation.common.add') }}</button>
        </div>
      </template>
    </OperationPageHeader>

    <div class="card p-5">
      <OperationRelationFilterChips :filters="activeFilters" @clear="clearFilter" />
      <div class="overflow-x-auto rounded-lg border border-gray-100 dark:border-white/5">
        <table class="w-full min-w-[1200px] text-left text-sm">
          <thead class="bg-gray-50 text-xs uppercase text-gray-400 dark:bg-white/5">
            <tr>
              <th class="px-4 py-3">{{ t('operation.component.componentName') }}</th>
              <th class="px-4 py-3">{{ t('operation.common.linkServer') }}</th>
              <th class="px-4 py-3">{{ t('operation.relations.column') }}</th>
              <th class="px-4 py-3">{{ t('operation.component.port') }}</th>
              <th class="px-4 py-3">{{ t('operation.port.status') }}</th>
              <th class="px-4 py-3">{{ t('operation.component.version') }}</th>
              <th class="px-4 py-3">{{ t('operation.component.deployPath') }}</th>
              <th class="px-4 py-3">{{ t('operation.health.status') }}</th>
              <th class="px-4 py-3 text-center">{{ t('operation.common.environment') }}</th>
              <th class="px-4 py-3">{{ t('operation.common.createTime') }}</th>
              <th class="px-4 py-3 text-right">{{ t('operation.common.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading"><td colspan="11" class="px-4 py-10 text-center text-gray-400">{{ t('operation.common.loading') }}</td></tr>
            <tr v-else-if="!list.length"><td colspan="11" class="px-4 py-10 text-center text-gray-400">{{ t('operation.common.empty') }}</td></tr>
            <tr
              v-for="row in list"
              v-else
              :key="String(row.id)"
              class="border-t border-gray-50 dark:border-white/5 hover:bg-gray-50/80 dark:hover:bg-white/5"
              :class="!entityHasServer(row) && 'operation-table-row--orphan'"
            >
              <td class="px-4 py-3 font-medium">
                <div class="flex min-w-0 items-center gap-2">
                  <span class="truncate">{{ row.componentName }}</span>
                  <OperationOrphanBadge :show="!entityHasServer(row)" />
                </div>
              </td>
              <td class="px-4 py-3">
                <OperationLinkedServersCell
                  :row="row"
                  :server-cache="serverCache"
                  clickable
                  @view-primary="openLinkedServerView(row, 'primary')"
                  @view-more="openLinkedServerView(row, 'all')"
                />
              </td>
              <td class="px-4 py-3">
                <OperationRelationChips
                  :server-count="row.serverCount"
                  :project-count="row.projectCount"
                  @open-servers="openRelationDrawer(row, 'servers')"
                  @open-projects="openRelationDrawer(row, 'projects')"
                />
              </td>
              <td class="px-4 py-3">{{ row.port || '-' }}</td>
              <td class="px-4 py-3"><PortMatchBadge :status="row.portMatchStatus" :expected-port="row.expectedPort" /></td>
              <td class="px-4 py-3">{{ row.version || '-' }}</td>
              <td class="max-w-[160px] truncate px-4 py-3">{{ row.deployPath || '-' }}</td>
              <td class="px-4 py-3">
                <HealthStatusBadge :status="row.status" :last-check-time="formatDateTime(row.lastCheckTime ?? undefined)" show-time />
              </td>
              <td class="px-4 py-3 text-center">
                <EnvironmentBadge :environment="row.environment" />
              </td>
              <td class="px-4 py-3">{{ formatDateTime(row.createTime) }}</td>
              <td class="px-4 py-3">
                <div class="btn-action-group flex-wrap justify-end">
                  <button type="button" class="btn-action-edit" :disabled="checkingId === row.id" @click="checkRow(row)">
                    <Activity class="h-3.5 w-3.5" />{{ checkingId === row.id ? t('operation.health.checking') : t('operation.health.check') }}
                  </button>
                  <button
                    v-if="canManagePassword"
                    type="button"
                    class="btn-action-edit"
                    @click="openPasswordManage(row)"
                  >
                    <KeyRound class="h-3.5 w-3.5" />{{ t('operation.common.passwordManage') }}
                  </button>
                  <button type="button" class="btn-action-edit" @click="openComponentLinks(row)">
                    <Link2 class="h-3.5 w-3.5" />{{ t('operation.component.linkServers') }}
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
            <FormField :label="t('operation.component.componentName')" horizontal required class="form-field-span-2">
              <input v-model="form.componentName" class="field-input" />
            </FormField>
          </div>
          <div class="form-grid-row">
            <FormField :label="t('operation.common.linkServer')" horizontal class="form-field-span-2">
              <OperationLinkedServersFormSection
                :row="form"
                :server-cache="serverCache"
                entity-type="component"
                v-model:server-ip="form.serverIp"
                @manage-links="openFormLinks"
                @view-primary="openLinkedServerView(form, 'primary')"
                @view-more="openLinkedServerView(form, 'all')"
              />
            </FormField>
          </div>
          <div class="form-grid-row">
            <FormField :label="t('operation.component.port')" horizontal class="form-field-span-2">
              <input v-model="form.port" class="field-input" />
            </FormField>
          </div>
          <div class="form-grid-row">
            <FormField :label="t('operation.component.account')" horizontal class="form-field-span-2">
              <input v-model="form.account" class="field-input" />
            </FormField>
          </div>
          <div v-if="!isEdit" class="form-grid-row">
            <FormField :label="t('operation.component.password')" horizontal class="form-field-span-2">
              <input
                v-model="passwordInput"
                type="password"
                class="field-input"
                :placeholder="t('operation.common.passwordPlaceholderEmpty')"
                autocomplete="new-password"
              />
              <p class="mt-1.5 text-xs text-gray-400">{{ t('operation.common.passwordCreateHint') }}</p>
            </FormField>
          </div>
          <div class="form-grid-row">
            <FormField :label="t('operation.component.version')" horizontal>
              <input v-model="form.version" class="field-input" />
            </FormField>
            <FormField :label="t('operation.component.deployPath')" horizontal>
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
      :entity-name="linksRow?.componentName ?? form.componentName"
      entity-type="component"
      :saving="linksSaving"
      @confirm="confirmComponentLinks"
      @close="closeComponentLinks"
    />

    <SecretManageModal
      :open="secretOpen"
      :saving="secretSaving"
      :password-configured="secretRow?.passwordConfigured"
      :password-mask="secretRow?.passwordMask"
      :record-id="secretRow?.id"
      :entity-name="secretRow?.componentName"
      :reveal-api="revealComponentSecretApi"
      @save="savePassword"
      @close="closePasswordManage"
    />

    <ServerDetailModal :open="serverDetailOpen" :server-id="detailServerId" @close="closeServerDetail" />
    <LinkedServersPickModal
      :open="serverPickOpen"
      :server-ids="pickServerIds"
      :server-cache="serverCache"
      @select="onPickServer"
      @close="closeServerPick"
    />

    <RelationDrawer
      :open="relationOpen"
      entity-type="component"
      :entity-id="relationRow?.id ?? null"
      :entity-name="relationRow?.componentName"
      :initial-tab="relationTab"
      @close="relationOpen = false"
      @edit-links="onRelationEditLinks"
    />
  </div>
</template>
