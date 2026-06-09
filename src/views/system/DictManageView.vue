<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  addDictDataApi,
  addDictTypeApi,
  deleteDictDataApi,
  deleteDictTypeApi,
  getDictDataApi,
  getDictTypeApi,
  listDictDataApi,
  listDictTypeApi,
  updateDictDataApi,
  updateDictTypeApi,
} from '@/api/dict'
import AppModal from '@/components/ui/AppModal.vue'
import FormField from '@/components/ui/FormField.vue'
import { confirm } from '@/composables/useConfirm'
import { showToast } from '@/composables/useToast'
import AppPagination from '@/components/ui/AppPagination.vue'
import { API_SUCCESS_CODE } from '@/types/api'
import {
  createEmptyDictData,
  createEmptyDictType,
  type DictDataQuery,
  type DictTypeQuery,
  type SysDictData,
  type SysDictType,
} from '@/types/dict'
import { List, Pencil, Plus, RefreshCw, Search, Trash2 } from 'lucide-vue-next'

const { t } = useI18n()

const loading = ref(false)
const saving = ref(false)
const typeList = ref<SysDictType[]>([])
const total = ref(0)
const typeModalOpen = ref(false)
const typeModalTitle = ref('')
const typeForm = ref<SysDictType>(createEmptyDictType())
const isTypeEdit = computed(() => typeForm.value.id != null)

const selectedType = ref<SysDictType | null>(null)
const dataModalOpen = ref(false)
const dataLoading = ref(false)
const dataSaving = ref(false)
const dataList = ref<SysDictData[]>([])
const dataTotal = ref(0)
const dataFormModalOpen = ref(false)
const dataFormTitle = ref('')
const dataForm = ref<SysDictData>(createEmptyDictData())
const isDataEdit = computed(() => dataForm.value.id != null)

const query = reactive({
  pageNum: 1,
  pageSize: 10,
  dictName: '',
  dictType: '',
  status: '' as DictTypeQuery['status'],
})

const dataQuery = reactive({
  pageNum: 1,
  pageSize: 10,
  dictType: '',
  dictValue: '',
  status: '' as DictDataQuery['status'],
})

function statusLabel(status?: number) {
  return status === 1 ? t('system.dict.statusOn') : t('system.dict.statusOff')
}

function formatTime(value?: string | number) {
  if (value == null || value === '') return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString()
}

function searchTypes() {
  if (query.pageNum === 1) loadTypes()
  else query.pageNum = 1
}

function resetQuery() {
  query.dictName = ''
  query.dictType = ''
  query.status = ''
  searchTypes()
}

async function loadTypes() {
  loading.value = true
  try {
    const result = await listDictTypeApi({
      pageNum: query.pageNum,
      pageSize: query.pageSize,
      dictName: query.dictName || undefined,
      dictType: query.dictType || undefined,
      status: query.status === '' ? undefined : query.status,
    })
    if (result.code !== API_SUCCESS_CODE || !result.data) {
      throw new Error(result.msg || t('system.dict.loadFailed'))
    }
    typeList.value = result.data.list ?? []
    total.value = result.data.total ?? 0
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.dict.loadFailed'))
  } finally {
    loading.value = false
  }
}

function openTypeCreate() {
  typeForm.value = createEmptyDictType()
  typeModalTitle.value = t('system.dict.addType')
  typeModalOpen.value = true
}

async function openTypeEdit(row: SysDictType) {
  try {
    const result = await getDictTypeApi(row.id!)
    if (result.code !== API_SUCCESS_CODE || !result.data) {
      throw new Error(result.msg || t('system.dict.loadFailed'))
    }
    typeForm.value = { ...result.data }
    typeModalTitle.value = t('system.dict.editType')
    typeModalOpen.value = true
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.dict.loadFailed'))
  }
}

function closeTypeModal() {
  typeModalOpen.value = false
  typeForm.value = createEmptyDictType()
}

function validateTypeForm() {
  if (!typeForm.value.dictName?.trim()) return t('system.dict.dictNameRequired')
  if (!typeForm.value.dictType?.trim()) return t('system.dict.dictTypeRequired')
  return null
}

async function submitTypeForm() {
  const error = validateTypeForm()
  if (error) {
    showToast('error', error)
    return
  }

  saving.value = true
  try {
    const payload: SysDictType = {
      ...typeForm.value,
      dictName: typeForm.value.dictName!.trim(),
      dictType: typeForm.value.dictType!.trim(),
      status: Number(typeForm.value.status ?? 1),
      remark: typeForm.value.remark?.trim() || undefined,
    }

    const result = isTypeEdit.value ? await updateDictTypeApi(payload) : await addDictTypeApi(payload)
    if (result.code !== API_SUCCESS_CODE) {
      throw new Error(result.msg || t('system.dict.saveFailed'))
    }

    showToast('success', isTypeEdit.value ? t('system.dict.updateOk') : t('system.dict.createOk'))
    closeTypeModal()
    await loadTypes()
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.dict.saveFailed'))
  } finally {
    saving.value = false
  }
}

async function removeType(row: SysDictType) {
  if (!(await confirm({ message: t('system.dict.deleteTypeConfirm', { name: row.dictName }) }))) return

  try {
    const result = await deleteDictTypeApi(row.id!)
    if (result.code !== API_SUCCESS_CODE) {
      throw new Error(result.msg || t('system.dict.deleteFailed'))
    }
    showToast('success', t('system.dict.deleteOk'))
    await loadTypes()
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.dict.deleteFailed'))
  }
}

function openDataManage(row: SysDictType) {
  selectedType.value = row
  dataQuery.dictType = row.dictType ?? ''
  dataQuery.dictValue = ''
  dataQuery.status = ''
  dataQuery.pageNum = 1
  dataModalOpen.value = true
  loadDataList()
}

function closeDataModal() {
  dataModalOpen.value = false
  selectedType.value = null
  dataList.value = []
  dataTotal.value = 0
}

function searchData() {
  if (dataQuery.pageNum === 1) loadDataList()
  else dataQuery.pageNum = 1
}

function resetDataQuery() {
  dataQuery.dictValue = ''
  dataQuery.status = ''
  searchData()
}

async function loadDataList() {
  if (!dataQuery.dictType) return
  dataLoading.value = true
  try {
    const result = await listDictDataApi({
      pageNum: dataQuery.pageNum,
      pageSize: dataQuery.pageSize,
      dictType: dataQuery.dictType,
      dictValue: dataQuery.dictValue || undefined,
      status: dataQuery.status === '' ? undefined : dataQuery.status,
    })
    if (result.code !== API_SUCCESS_CODE || !result.data) {
      throw new Error(result.msg || t('system.dict.dataLoadFailed'))
    }
    dataList.value = result.data.list ?? []
    dataTotal.value = result.data.total ?? 0
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.dict.dataLoadFailed'))
  } finally {
    dataLoading.value = false
  }
}

function openDataCreate() {
  dataForm.value = createEmptyDictData(dataQuery.dictType)
  dataFormTitle.value = t('system.dict.addData')
  dataFormModalOpen.value = true
}

async function openDataEdit(row: SysDictData) {
  try {
    const result = await getDictDataApi(row.id!)
    if (result.code !== API_SUCCESS_CODE || !result.data) {
      throw new Error(result.msg || t('system.dict.dataLoadFailed'))
    }
    dataForm.value = { ...result.data }
    dataFormTitle.value = t('system.dict.editData')
    dataFormModalOpen.value = true
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.dict.dataLoadFailed'))
  }
}

function closeDataFormModal() {
  dataFormModalOpen.value = false
  dataForm.value = createEmptyDictData(dataQuery.dictType)
}

function validateDataForm() {
  if (!dataForm.value.dictKey?.trim()) return t('system.dict.dictKeyRequired')
  if (!dataForm.value.dictValue?.trim()) return t('system.dict.dictValueRequired')
  if (dataForm.value.sort == null || dataForm.value.sort < 0) return t('system.dict.sortRequired')
  return null
}

async function submitDataForm() {
  const error = validateDataForm()
  if (error) {
    showToast('error', error)
    return
  }

  dataSaving.value = true
  try {
    const payload: SysDictData = {
      ...dataForm.value,
      dictType: dataQuery.dictType,
      dictKey: dataForm.value.dictKey!.trim(),
      dictValue: dataForm.value.dictValue!.trim(),
      dictValueEn: dataForm.value.dictValueEn?.trim() || undefined,
      dictValueJa: dataForm.value.dictValueJa?.trim() || undefined,
      sort: Number(dataForm.value.sort ?? 0),
      status: Number(dataForm.value.status ?? 1),
      remark: dataForm.value.remark?.trim() || undefined,
    }

    const result = isDataEdit.value ? await updateDictDataApi(payload) : await addDictDataApi(payload)
    if (result.code !== API_SUCCESS_CODE) {
      throw new Error(result.msg || t('system.dict.saveFailed'))
    }

    showToast('success', isDataEdit.value ? t('system.dict.updateOk') : t('system.dict.createOk'))
    closeDataFormModal()
    await loadDataList()
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.dict.saveFailed'))
  } finally {
    dataSaving.value = false
  }
}

async function removeData(row: SysDictData) {
  if (!(await confirm({ message: t('system.dict.deleteDataConfirm', { name: row.dictKey }) }))) return

  try {
    const result = await deleteDictDataApi(row.id!)
    if (result.code !== API_SUCCESS_CODE) {
      throw new Error(result.msg || t('system.dict.deleteFailed'))
    }
    showToast('success', t('system.dict.deleteOk'))
    await loadDataList()
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.dict.deleteFailed'))
  }
}

watch(
  () => query.pageNum,
  () => loadTypes(),
)

watch(
  () => dataQuery.pageNum,
  () => {
    if (dataModalOpen.value) loadDataList()
  },
)

onMounted(loadTypes)
</script>

<template>
  <div class="page-stack">
    <div class="card p-5">
      <div class="mb-4 flex flex-wrap items-center gap-3">
        <form class="form-search-toolbar contents" @submit.prevent="searchTypes">
          <FormField :label="t('system.dict.dictName')" horizontal class="form-field-search">
            <input v-model="query.dictName" type="text" class="field-input" :placeholder="t('system.dict.dictNamePlaceholder')" />
          </FormField>
          <FormField :label="t('system.dict.dictType')" horizontal class="form-field-search">
            <input v-model="query.dictType" type="text" class="field-input" :placeholder="t('system.dict.dictTypePlaceholder')" />
          </FormField>
          <FormField :label="t('system.dict.status')" horizontal class="form-field-search">
            <select v-model="query.status" class="field-input">
              <option value="">{{ t('system.dict.statusAll') }}</option>
              <option :value="1">{{ t('system.dict.statusOn') }}</option>
              <option :value="0">{{ t('system.dict.statusOff') }}</option>
            </select>
          </FormField>
          <button type="submit" class="btn-primary shrink-0">
            <Search class="h-4 w-4" /> {{ t('system.dict.search') }}
          </button>
          <button type="button" class="btn-ghost shrink-0" @click="resetQuery">
            <RefreshCw class="h-4 w-4" /> {{ t('system.dict.reset') }}
          </button>
        </form>
        <div class="toolbar-actions">
          <button type="button" class="btn-primary shrink-0" @click="openTypeCreate">
            <Plus class="h-4 w-4" /> {{ t('system.dict.addType') }}
          </button>
        </div>
      </div>

      <div class="overflow-x-auto rounded-lg border border-gray-100 dark:border-white/5">
        <table class="w-full min-w-[880px] text-left text-sm">
          <thead class="bg-gray-50 text-xs uppercase tracking-wide text-gray-400 dark:bg-white/5">
            <tr>
              <th class="px-4 py-3">{{ t('system.dict.dictName') }}</th>
              <th class="px-4 py-3">{{ t('system.dict.dictType') }}</th>
              <th class="px-4 py-3">{{ t('system.dict.status') }}</th>
              <th class="px-4 py-3">{{ t('system.dict.remark') }}</th>
              <th class="px-4 py-3">{{ t('system.dict.createTime') }}</th>
              <th class="px-4 py-3 text-right">{{ t('system.dict.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="6" class="px-4 py-10 text-center text-gray-400">{{ t('system.dict.loading') }}</td>
            </tr>
            <tr v-else-if="!typeList.length">
              <td colspan="6" class="px-4 py-10 text-center text-gray-400">{{ t('system.dict.empty') }}</td>
            </tr>
            <tr
              v-for="row in typeList"
              v-else
              :key="String(row.id)"
              class="border-t border-gray-50 transition hover:bg-gray-50/80 dark:border-white/5 dark:hover:bg-white/5"
            >
              <td class="px-4 py-3 font-medium text-gray-900 dark:text-white">{{ row.dictName }}</td>
              <td class="px-4 py-3">
                <button
                  type="button"
                  class="font-medium text-brand-600 hover:underline dark:text-brand-400"
                  @click="openDataManage(row)"
                >
                  {{ row.dictType }}
                </button>
              </td>
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
              <td class="max-w-[200px] truncate px-4 py-3 text-gray-600 dark:text-gray-300">{{ row.remark || '-' }}</td>
              <td class="px-4 py-3 text-gray-600 dark:text-gray-300">{{ formatTime(row.createTime) }}</td>
              <td class="px-4 py-3">
                <div class="btn-action-group">
                  <button type="button" class="btn-action-add" @click="openDataManage(row)">
                    <List class="h-3.5 w-3.5" />
                    {{ t('system.dict.manageData') }}
                  </button>
                  <button type="button" class="btn-action-edit" @click="openTypeEdit(row)">
                    <Pencil class="h-3.5 w-3.5" />
                    {{ t('system.dict.edit') }}
                  </button>
                  <button type="button" class="btn-action-danger" @click="removeType(row)">
                    <Trash2 class="h-3.5 w-3.5" />
                    {{ t('system.dict.delete') }}
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="total > 0" class="mt-4">
        <AppPagination v-model:page-num="query.pageNum" :page-size="query.pageSize" :total="total" />
      </div>
    </div>

    <AppModal :open="typeModalOpen" :title="typeModalTitle" wide @close="closeTypeModal">
      <form class="form-modal" @submit.prevent="submitTypeForm">
        <div class="form-grid-pairs">
          <div class="form-grid-row">
            <FormField :label="t('system.dict.dictName')" horizontal required>
              <input v-model="typeForm.dictName" type="text" class="field-input" />
            </FormField>
            <FormField :label="t('system.dict.dictType')" horizontal required>
              <input v-model="typeForm.dictType" type="text" class="field-input" :disabled="isTypeEdit" />
            </FormField>
          </div>
          <div class="form-grid-row">
            <FormField :label="t('system.dict.status')" horizontal class="form-field-span-2">
              <div class="form-row-inline">
                <label class="inline-flex items-center gap-2 text-sm">
                  <input v-model.number="typeForm.status" type="radio" :value="1" /> {{ t('system.dict.statusOn') }}
                </label>
                <label class="inline-flex items-center gap-2 text-sm">
                  <input v-model.number="typeForm.status" type="radio" :value="0" /> {{ t('system.dict.statusOff') }}
                </label>
              </div>
            </FormField>
          </div>
          <div class="form-grid-row">
            <FormField :label="t('system.dict.remark')" horizontal class="form-field-span-2">
              <textarea v-model="typeForm.remark" rows="3" class="field-input resize-y" />
            </FormField>
          </div>
        </div>
      </form>
      <template #footer>
        <button type="button" class="btn-ghost" @click="closeTypeModal">{{ t('system.dict.cancel') }}</button>
        <button type="button" class="btn-primary" :disabled="saving" @click="submitTypeForm">
          {{ saving ? t('system.dict.saving') : t('system.dict.save') }}
        </button>
      </template>
    </AppModal>

    <AppModal
      :open="dataModalOpen"
      :title="t('system.dict.dataTitle', { name: selectedType?.dictName, type: selectedType?.dictType })"
      wide
      @close="closeDataModal"
    >
      <form class="form-search-toolbar mb-4" @submit.prevent="searchData">
        <FormField :label="t('system.dict.dictValue')" horizontal class="form-field-search">
          <input v-model="dataQuery.dictValue" type="text" class="field-input" :placeholder="t('system.dict.dictValuePlaceholder')" />
        </FormField>
        <FormField :label="t('system.dict.status')" horizontal class="form-field-search">
          <select v-model="dataQuery.status" class="field-input">
            <option value="">{{ t('system.dict.statusAll') }}</option>
            <option :value="1">{{ t('system.dict.statusOn') }}</option>
            <option :value="0">{{ t('system.dict.statusOff') }}</option>
          </select>
        </FormField>
        <button type="submit" class="btn-primary shrink-0">
          <Search class="h-4 w-4" /> {{ t('system.dict.search') }}
        </button>
        <button type="button" class="btn-ghost shrink-0" @click="resetDataQuery">
          <RefreshCw class="h-4 w-4" /> {{ t('system.dict.reset') }}
        </button>
        <div class="toolbar-actions shrink-0">
          <button type="button" class="btn-primary" @click="openDataCreate">
            <Plus class="h-4 w-4" /> {{ t('system.dict.addData') }}
          </button>
        </div>
      </form>

      <div class="overflow-x-auto rounded-lg border border-gray-100 dark:border-white/5">
        <table class="w-full min-w-[760px] text-left text-sm">
          <thead class="bg-gray-50 text-xs uppercase tracking-wide text-gray-400 dark:bg-white/5">
            <tr>
              <th class="px-4 py-3">{{ t('system.dict.dictKey') }}</th>
              <th class="px-4 py-3">{{ t('system.dict.dictValue') }}</th>
              <th class="px-4 py-3">{{ t('system.dict.sort') }}</th>
              <th class="px-4 py-3">{{ t('system.dict.status') }}</th>
              <th class="px-4 py-3">{{ t('system.dict.createTime') }}</th>
              <th class="px-4 py-3 text-right">{{ t('system.dict.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="dataLoading">
              <td colspan="6" class="px-4 py-10 text-center text-gray-400">{{ t('system.dict.loading') }}</td>
            </tr>
            <tr v-else-if="!dataList.length">
              <td colspan="6" class="px-4 py-10 text-center text-gray-400">{{ t('system.dict.dataEmpty') }}</td>
            </tr>
            <tr
              v-for="row in dataList"
              v-else
              :key="String(row.id)"
              class="border-t border-gray-50 transition hover:bg-gray-50/80 dark:border-white/5 dark:hover:bg-white/5"
            >
              <td class="px-4 py-3 font-medium text-gray-900 dark:text-white">{{ row.dictKey }}</td>
              <td class="px-4 py-3 text-gray-600 dark:text-gray-300">{{ row.dictValue }}</td>
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
              <td class="px-4 py-3 text-gray-600 dark:text-gray-300">{{ formatTime(row.createTime) }}</td>
              <td class="px-4 py-3">
                <div class="btn-action-group">
                  <button type="button" class="btn-action-edit" @click="openDataEdit(row)">
                    <Pencil class="h-3.5 w-3.5" />
                    {{ t('system.dict.edit') }}
                  </button>
                  <button type="button" class="btn-action-danger" @click="removeData(row)">
                    <Trash2 class="h-3.5 w-3.5" />
                    {{ t('system.dict.delete') }}
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="dataTotal > 0" class="mt-4">
        <AppPagination v-model:page-num="dataQuery.pageNum" :page-size="dataQuery.pageSize" :total="dataTotal" />
      </div>
    </AppModal>

    <AppModal :open="dataFormModalOpen" :title="dataFormTitle" wide @close="closeDataFormModal">
      <form class="form-modal" @submit.prevent="submitDataForm">
        <div class="form-grid-pairs">
          <div class="form-grid-row">
            <FormField :label="t('system.dict.dictType')" horizontal class="form-field-span-2">
              <input :value="dataQuery.dictType" type="text" class="field-input" disabled />
            </FormField>
          </div>
          <div class="form-grid-row">
            <FormField :label="t('system.dict.dictKey')" horizontal required>
              <input v-model="dataForm.dictKey" type="text" class="field-input" />
            </FormField>
            <FormField :label="t('system.dict.dictValue')" horizontal required>
              <input v-model="dataForm.dictValue" type="text" class="field-input" />
            </FormField>
          </div>
          <div class="form-grid-row">
            <FormField :label="t('system.dict.dictValueEn')" horizontal>
              <input v-model="dataForm.dictValueEn" type="text" class="field-input" />
            </FormField>
            <FormField :label="t('system.dict.dictValueJa')" horizontal>
              <input v-model="dataForm.dictValueJa" type="text" class="field-input" />
            </FormField>
          </div>
          <div class="form-grid-row">
            <FormField :label="t('system.dict.sort')" horizontal required>
              <input v-model.number="dataForm.sort" type="number" min="0" class="field-input" />
            </FormField>
            <FormField :label="t('system.dict.status')" horizontal>
              <div class="form-row-inline">
                <label class="inline-flex items-center gap-2 text-sm">
                  <input v-model.number="dataForm.status" type="radio" :value="1" /> {{ t('system.dict.statusOn') }}
                </label>
                <label class="inline-flex items-center gap-2 text-sm">
                  <input v-model.number="dataForm.status" type="radio" :value="0" /> {{ t('system.dict.statusOff') }}
                </label>
              </div>
            </FormField>
          </div>
          <div class="form-grid-row">
            <FormField :label="t('system.dict.remark')" horizontal class="form-field-span-2">
              <textarea v-model="dataForm.remark" rows="3" class="field-input resize-y" />
            </FormField>
          </div>
        </div>
      </form>
      <template #footer>
        <button type="button" class="btn-ghost" @click="closeDataFormModal">{{ t('system.dict.cancel') }}</button>
        <button type="button" class="btn-primary" :disabled="dataSaving" @click="submitDataForm">
          {{ dataSaving ? t('system.dict.saving') : t('system.dict.save') }}
        </button>
      </template>
    </AppModal>
  </div>
</template>
