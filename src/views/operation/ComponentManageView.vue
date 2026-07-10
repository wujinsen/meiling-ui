<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { addComponentApi, checkComponentApi, deleteComponentApi, getComponentApi, listComponentApi, revealComponentSecretApi, updateComponentApi } from '@/api/operation'
import EnvironmentSelect from '@/components/operation/EnvironmentSelect.vue'
import HealthStatusBadge from '@/components/operation/HealthStatusBadge.vue'
import OperationPageHeader from '@/components/operation/OperationPageHeader.vue'
import PortAuditModal from '@/components/operation/PortAuditModal.vue'
import PortMatchBadge from '@/components/operation/PortMatchBadge.vue'
import SecretManageModal from '@/components/operation/SecretManageModal.vue'
import AppModal from '@/components/ui/AppModal.vue'
import FormField from '@/components/ui/FormField.vue'
import { confirm } from '@/composables/useConfirm'
import { assertOperationSecretEdit, guardAction, guardOperationSecretEdit } from '@/composables/useActionPermissions'
import { PERM } from '@/constants/permissions'
import AppPagination from '@/components/ui/AppPagination.vue'
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination'
import { showToast, formatDateTime } from '@/composables/useToast'
import { API_SUCCESS_CODE } from '@/types/api'
import { createEmptyComponent, type OperationComponent } from '@/types/operation'
import { environmentI18nKey } from '@/utils/operationEnv'
import { Pencil, Plus, RefreshCw, Search, Trash2, Activity, ClipboardList, KeyRound } from 'lucide-vue-next'

const { t } = useI18n()

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

const canManagePassword = computed(() => assertOperationSecretEdit(PERM.OP_COMPONENT_EDIT))

const query = reactive({ pageNum: 1, pageSize: DEFAULT_PAGE_SIZE, componentName: '', serverIp: '', environment: '' as number | '' })

function envLabel(env?: number) {
  return t(environmentI18nKey(env))
}

function search() {
  if (query.pageNum === 1) loadList()
  else query.pageNum = 1
}

function resetQuery() {
  query.componentName = ''
  query.serverIp = ''
  query.environment = ''
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
    })
    if (result.code !== API_SUCCESS_CODE || !result.data) throw new Error(result.msg || t('operation.component.loadFailed'))
    list.value = result.data.list ?? []
    total.value = result.data.total ?? 0
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
    const result = await getComponentApi(row.id!)
    if (result.code !== API_SUCCESS_CODE || !result.data) throw new Error(result.msg || t('operation.component.loadFailed'))
    form.value = { ...result.data }
    passwordInput.value = ''
    modalTitle.value = t('operation.common.edit')
    modalOpen.value = true
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('operation.component.loadFailed'))
  }
}

function closeModal() {
  modalOpen.value = false
  form.value = createEmptyComponent()
  passwordInput.value = ''
}

async function submitForm() {
  if (!guardAction(isEdit.value ? PERM.OP_COMPONENT_EDIT : PERM.OP_COMPONENT_ADD)) return
  if (!form.value.componentName?.trim()) {
    showToast('error', t('operation.component.nameRequired'))
    return
  }
  saving.value = true
  try {
    const payload: OperationComponent = {
      ...form.value,
      componentName: form.value.componentName.trim(),
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
onMounted(loadList)
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
          <button type="submit" class="btn-primary shrink-0"><Search class="h-4 w-4" /> {{ t('operation.common.search') }}</button>
          <button type="button" class="btn-ghost shrink-0" @click="resetQuery"><RefreshCw class="h-4 w-4" /> {{ t('operation.common.reset') }}</button>
        </form>
        <div class="toolbar-actions">
          <button type="button" class="btn-ghost shrink-0" @click="auditOpen = true"><ClipboardList class="h-4 w-4" /> {{ t('operation.port.audit') }}</button>
          <button type="button" class="btn-primary shrink-0" @click="openCreate"><Plus class="h-4 w-4" /> {{ t('operation.common.add') }}</button>
        </div>
      </template>
    </OperationPageHeader>

    <div class="card p-5">
      <div class="overflow-x-auto rounded-lg border border-gray-100 dark:border-white/5">
        <table class="w-full min-w-[1200px] text-left text-sm">
          <thead class="bg-gray-50 text-xs uppercase text-gray-400 dark:bg-white/5">
            <tr>
              <th class="px-4 py-3">{{ t('operation.component.componentName') }}</th>
              <th class="px-4 py-3">{{ t('operation.component.serverIp') }}</th>
              <th class="px-4 py-3">{{ t('operation.component.port') }}</th>
              <th class="px-4 py-3">{{ t('operation.port.status') }}</th>
              <th class="px-4 py-3">{{ t('operation.component.version') }}</th>
              <th class="px-4 py-3">{{ t('operation.component.deployPath') }}</th>
              <th class="px-4 py-3">{{ t('operation.health.status') }}</th>
              <th class="px-4 py-3">{{ t('operation.common.environment') }}</th>
              <th class="px-4 py-3">{{ t('operation.common.createTime') }}</th>
              <th class="px-4 py-3 text-right">{{ t('operation.common.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading"><td colspan="10" class="px-4 py-10 text-center text-gray-400">{{ t('operation.common.loading') }}</td></tr>
            <tr v-else-if="!list.length"><td colspan="10" class="px-4 py-10 text-center text-gray-400">{{ t('operation.common.empty') }}</td></tr>
            <tr v-for="row in list" v-else :key="String(row.id)" class="border-t border-gray-50 dark:border-white/5 hover:bg-gray-50/80 dark:hover:bg-white/5">
              <td class="px-4 py-3 font-medium">{{ row.componentName }}</td>
              <td class="px-4 py-3">{{ row.serverIp || '-' }}</td>
              <td class="px-4 py-3">{{ row.port || '-' }}</td>
              <td class="px-4 py-3"><PortMatchBadge :status="row.portMatchStatus" :expected-port="row.expectedPort" /></td>
              <td class="px-4 py-3">{{ row.version || '-' }}</td>
              <td class="max-w-[160px] truncate px-4 py-3">{{ row.deployPath || '-' }}</td>
              <td class="px-4 py-3">
                <HealthStatusBadge :status="row.status" :last-check-time="formatDateTime(row.lastCheckTime ?? undefined)" show-time />
              </td>
              <td class="px-4 py-3"><span class="badge bg-gray-100 dark:bg-white/10">{{ envLabel(row.environment) }}</span></td>
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
            <FormField :label="t('operation.component.serverIp')" horizontal>
              <input v-model="form.serverIp" class="field-input" />
            </FormField>
            <FormField :label="t('operation.component.port')" horizontal>
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
  </div>
</template>
