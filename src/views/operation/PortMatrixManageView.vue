<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  addPortMatrixApi,
  deletePortMatrixApi,
  getPortMatrixApi,
  listPortMatrixApi,
  updatePortMatrixApi,
} from '@/api/operation'
import OperationPageHeader from '@/components/operation/OperationPageHeader.vue'
import OperationPortMatrixAliasInput from '@/components/operation/OperationPortMatrixAliasInput.vue'
import AppModal from '@/components/ui/AppModal.vue'
import AppPagination from '@/components/ui/AppPagination.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import AppSwitch from '@/components/ui/AppSwitch.vue'
import FormField from '@/components/ui/FormField.vue'
import { assertAction, guardAction } from '@/composables/useActionPermissions'
import { confirm } from '@/composables/useConfirm'
import { formatDateTime, showToast } from '@/composables/useToast'
import { PERM } from '@/constants/permissions'
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination'
import { API_SUCCESS_CODE } from '@/types/api'
import { createEmptyPortMatrix, type OperationPortMatrix } from '@/types/operation'
import { ClipboardList, Pencil, Plus, RefreshCw, Search, Trash2 } from 'lucide-vue-next'
import PortAuditModal from '@/components/operation/PortAuditModal.vue'

const { t } = useI18n()

const loading = ref(false)
const saving = ref(false)
const list = ref<OperationPortMatrix[]>([])
const total = ref(0)
const modalOpen = ref(false)
const modalTitle = ref('')
const form = ref<OperationPortMatrix>(createEmptyPortMatrix())
const aliasList = ref<string[]>([])
const auditOpen = ref(false)
const isEdit = computed(() => form.value.id != null)

const canAdd = computed(() => assertAction(PERM.OP_PORT_MATRIX_ADD))
const canEdit = computed(() => assertAction(PERM.OP_PORT_MATRIX_EDIT))
const canRemove = computed(() => assertAction(PERM.OP_PORT_MATRIX_REMOVE))

function isValidPort(port: string) {
  const n = Number(port)
  return Number.isInteger(n) && n >= 1 && n <= 65535
}

const enabledFilterOptions = computed(() => [
  { value: '', label: t('operation.common.all') },
  { value: 'true', label: t('operation.portMatrix.enabledOn') },
  { value: 'false', label: t('operation.portMatrix.enabledOff') },
])

const query = reactive({
  pageNum: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  matrixKey: '',
  displayName: '',
  enabled: '' as '' | 'true' | 'false',
})

function search() {
  if (query.pageNum === 1) loadList()
  else query.pageNum = 1
}

function resetQuery() {
  query.matrixKey = ''
  query.displayName = ''
  query.enabled = ''
  search()
}

async function loadList() {
  loading.value = true
  try {
    const result = await listPortMatrixApi({
      pageNum: query.pageNum,
      pageSize: query.pageSize,
      matrixKey: query.matrixKey || undefined,
      displayName: query.displayName || undefined,
      enabled: query.enabled === '' ? undefined : query.enabled === 'true',
    })
    if (result.code !== API_SUCCESS_CODE || !result.data) throw new Error(result.msg || t('operation.portMatrix.loadFailed'))
    list.value = result.data.list ?? []
    total.value = result.data.total ?? 0
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('operation.portMatrix.loadFailed'))
  } finally {
    loading.value = false
  }
}

function openCreate() {
  if (!guardAction(PERM.OP_PORT_MATRIX_ADD)) return
  form.value = createEmptyPortMatrix()
  aliasList.value = []
  modalTitle.value = t('operation.common.add')
  modalOpen.value = true
}

async function openEdit(row: OperationPortMatrix) {
  if (!guardAction(PERM.OP_PORT_MATRIX_EDIT)) return
  try {
    const result = await getPortMatrixApi(row.id!)
    if (result.code !== API_SUCCESS_CODE || !result.data) throw new Error(result.msg || t('operation.portMatrix.loadFailed'))
    form.value = { ...result.data }
    aliasList.value = [...(result.data.aliases ?? [])]
    modalTitle.value = t('operation.common.edit')
    modalOpen.value = true
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('operation.portMatrix.loadFailed'))
  }
}

function closeModal() {
  modalOpen.value = false
  form.value = createEmptyPortMatrix()
  aliasList.value = []
}

async function submitForm() {
  if (!guardAction(isEdit.value ? PERM.OP_PORT_MATRIX_EDIT : PERM.OP_PORT_MATRIX_ADD)) return
  const matrixKey = form.value.matrixKey?.trim()
  const expectedPort = form.value.expectedPort?.trim()
  if (!matrixKey) {
    showToast('error', t('operation.portMatrix.keyRequired'))
    return
  }
  if (!expectedPort) {
    showToast('error', t('operation.portMatrix.portRequired'))
    return
  }
  if (!isValidPort(expectedPort)) {
    showToast('error', t('operation.portMatrix.portInvalid'))
    return
  }
  saving.value = true
  try {
    const payload = {
      id: form.value.id,
      matrixKey,
      displayName: form.value.displayName?.trim() || undefined,
      expectedPort,
      aliases: aliasList.value,
      sortOrder: Number(form.value.sortOrder ?? 0),
      enabled: form.value.enabled !== false,
      remark: form.value.remark?.trim() || undefined,
    }
    const result = isEdit.value ? await updatePortMatrixApi(payload) : await addPortMatrixApi(payload)
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

async function removeRow(row: OperationPortMatrix) {
  if (!guardAction(PERM.OP_PORT_MATRIX_REMOVE)) return
  const label = row.displayName || row.matrixKey
  if (!(await confirm({ message: t('operation.portMatrix.deleteConfirm', { name: label }) }))) return
  try {
    const result = await deletePortMatrixApi(row.id!)
    if (result.code !== API_SUCCESS_CODE) throw new Error(result.msg || t('operation.common.deleteFailed'))
    showToast('success', t('operation.common.deleteOk'))
    await loadList()
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('operation.common.deleteFailed'))
  }
}

watch(() => [query.pageNum, query.pageSize], loadList)
onMounted(loadList)
</script>

<template>
  <div class="page-stack">
    <OperationPageHeader :title="t('operation.portMatrix.title')" :subtitle="t('operation.portMatrix.subtitle')">
      <template #toolbar>
        <form class="operation-search-form" @submit.prevent="search">
          <label class="operation-filter-field">
            <span>{{ t('operation.portMatrix.matrixKey') }}</span>
            <input v-model="query.matrixKey" type="text" class="field-input" />
          </label>
          <label class="operation-filter-field">
            <span>{{ t('operation.portMatrix.displayName') }}</span>
            <input v-model="query.displayName" type="text" class="field-input" />
          </label>
          <div class="operation-filter-field">
            <span>{{ t('operation.portMatrix.enabled') }}</span>
            <AppSelect v-model="query.enabled" :options="enabledFilterOptions" />
          </div>
          <div class="operation-form-actions">
            <button type="submit" class="btn-primary shrink-0"><Search class="h-4 w-4" /> {{ t('operation.common.search') }}</button>
            <button type="button" class="btn-ghost shrink-0" @click="resetQuery"><RefreshCw class="h-4 w-4" /> {{ t('operation.common.reset') }}</button>
          </div>
        </form>
        <div class="toolbar-actions">
          <button type="button" class="btn-ghost shrink-0" @click="auditOpen = true">
            <ClipboardList class="h-4 w-4" /> {{ t('operation.port.audit') }}
          </button>
          <button v-if="canAdd" type="button" class="btn-primary shrink-0" @click="openCreate">
            <Plus class="h-4 w-4" /> {{ t('operation.common.add') }}
          </button>
        </div>
      </template>
    </OperationPageHeader>

    <div class="card p-5">
      <p class="mb-4 text-sm text-gray-500">{{ t('operation.portMatrix.cacheHint') }}</p>
      <div class="overflow-x-auto rounded-lg border border-gray-100 dark:border-white/5">
        <table class="w-full min-w-[960px] text-left text-sm">
          <thead class="bg-gray-50 text-xs uppercase text-gray-400 dark:bg-white/5">
            <tr>
              <th class="px-4 py-3">{{ t('operation.portMatrix.matrixKey') }}</th>
              <th class="px-4 py-3">{{ t('operation.portMatrix.displayName') }}</th>
              <th class="px-4 py-3">{{ t('operation.port.expected') }}</th>
              <th class="px-4 py-3">{{ t('operation.portMatrix.aliases') }}</th>
              <th class="px-4 py-3">{{ t('operation.portMatrix.sortOrder') }}</th>
              <th class="px-4 py-3">{{ t('operation.portMatrix.enabled') }}</th>
              <th class="px-4 py-3">{{ t('operation.portMatrix.source') }}</th>
              <th class="px-4 py-3">{{ t('operation.common.updateTime') }}</th>
              <th class="px-4 py-3 text-right">{{ t('operation.common.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading"><td colspan="9" class="px-4 py-10 text-center text-gray-400">{{ t('operation.common.loading') }}</td></tr>
            <tr v-else-if="!list.length"><td colspan="9" class="px-4 py-10 text-center text-gray-400">{{ t('operation.common.empty') }}</td></tr>
            <tr v-for="row in list" v-else :key="String(row.id)" class="border-t border-gray-50 dark:border-white/5 hover:bg-gray-50/80 dark:hover:bg-white/5">
              <td class="px-4 py-3 font-mono text-xs font-medium">{{ row.matrixKey }}</td>
              <td class="px-4 py-3">{{ row.displayName || '-' }}</td>
              <td class="px-4 py-3 font-medium">{{ row.expectedPort }}</td>
              <td class="px-4 py-3">
                <div v-if="row.aliases?.length" class="flex flex-wrap gap-1">
                  <span v-for="alias in row.aliases.slice(0, 4)" :key="alias" class="operation-alias-chip operation-alias-chip--compact">{{ alias }}</span>
                  <span v-if="row.aliases.length > 4" class="text-xs text-gray-400">+{{ row.aliases.length - 4 }}</span>
                </div>
                <span v-else class="text-gray-400">-</span>
              </td>
              <td class="px-4 py-3">{{ row.sortOrder ?? 0 }}</td>
              <td class="px-4 py-3">
                <span class="badge" :class="row.enabled !== false ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-gray-100 dark:bg-white/10'">
                  {{ row.enabled !== false ? t('operation.portMatrix.enabledOn') : t('operation.portMatrix.enabledOff') }}
                </span>
              </td>
              <td class="max-w-[140px] truncate px-4 py-3 text-xs text-gray-500" :title="row.source">{{ row.source || '-' }}</td>
              <td class="px-4 py-3">{{ formatDateTime(row.updateTime || row.createTime) }}</td>
              <td class="px-4 py-3">
                <div v-if="canEdit || canRemove" class="btn-action-group flex-wrap justify-end">
                  <button v-if="canEdit" type="button" class="btn-action-edit" @click="openEdit(row)">
                    <Pencil class="h-3.5 w-3.5" />{{ t('operation.common.edit') }}
                  </button>
                  <button v-if="canRemove" type="button" class="btn-action-danger" @click="removeRow(row)">
                    <Trash2 class="h-3.5 w-3.5" />{{ t('operation.common.delete') }}
                  </button>
                </div>
                <span v-else class="text-xs text-gray-400">—</span>
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
            <FormField :label="t('operation.portMatrix.matrixKey')" required>
              <input
                v-model="form.matrixKey"
                type="text"
                class="field-input font-mono"
                :readonly="isEdit"
                :class="isEdit && 'opacity-70'"
                :placeholder="t('operation.portMatrix.keyPlaceholder')"
              />
            </FormField>
            <FormField :label="t('operation.portMatrix.displayName')">
              <input v-model="form.displayName" type="text" class="field-input" />
            </FormField>
          </div>
          <div class="form-grid-row">
            <FormField :label="t('operation.port.expected')" required>
              <input v-model="form.expectedPort" type="text" class="field-input" inputmode="numeric" />
            </FormField>
            <FormField :label="t('operation.portMatrix.sortOrder')">
              <input v-model.number="form.sortOrder" type="number" class="field-input" min="0" />
            </FormField>
          </div>
          <FormField :label="t('operation.portMatrix.aliases')" class="col-span-full">
            <OperationPortMatrixAliasInput v-model="aliasList" />
          </FormField>
          <FormField :label="t('operation.portMatrix.enabled')">
            <AppSwitch v-model="form.enabled" :label="form.enabled !== false ? t('operation.portMatrix.enabledOn') : t('operation.portMatrix.enabledOff')" />
          </FormField>
          <FormField :label="t('operation.common.remark')">
            <input v-model="form.remark" type="text" class="field-input" />
          </FormField>
        </div>
        <div class="form-modal-actions">
          <button type="button" class="btn-ghost" @click="closeModal">{{ t('operation.common.cancel') }}</button>
          <button type="submit" class="btn-primary" :disabled="saving">{{ saving ? t('operation.common.saving') : t('operation.common.save') }}</button>
        </div>
      </form>
    </AppModal>

    <PortAuditModal :open="auditOpen" @close="auditOpen = false" />
  </div>
</template>
