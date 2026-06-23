<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { cleanOperLogApi, deleteOperLogApi, listOperLogApi } from '@/api/operlog'
import AppModal from '@/components/ui/AppModal.vue'
import FormField from '@/components/ui/FormField.vue'
import { confirm } from '@/composables/useConfirm'
import { guardAction } from '@/composables/useActionPermissions'
import { showToast } from '@/composables/useToast'
import { PERM } from '@/constants/permissions'
import AppPagination from '@/components/ui/AppPagination.vue'
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination'
import { API_SUCCESS_CODE } from '@/types/api'
import { BUSINESS_TYPE_OPTIONS, type OperLogQuery, type SysOperationLog } from '@/types/operlog'
import { Eye, RefreshCw, Search, Trash2 } from 'lucide-vue-next'

const { t } = useI18n()

const loading = ref(false)
const logList = ref<SysOperationLog[]>([])
const total = ref(0)
const selectedIds = ref(new Set<string>())
const detailOpen = ref(false)
const detailRow = ref<SysOperationLog | null>(null)

const query = reactive({
  pageNum: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  title: '',
  userName: '',
  businessType: '' as OperLogQuery['businessType'],
  status: '' as OperLogQuery['status'],
})

const allSelected = computed(
  () => logList.value.length > 0 && logList.value.every((row) => selectedIds.value.has(String(row.id))),
)

const hasSelection = computed(() => selectedIds.value.size > 0)

function formatTime(value?: string | number) {
  if (value == null || value === '') return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString()
}

function businessTypeLabel(type?: number) {
  if (type == null) return '-'
  const key = `system.operlog.businessType${type}` as const
  return t(key)
}

function statusLabel(status?: number) {
  return status === 1 ? t('system.operlog.statusOk') : t('system.operlog.statusFail')
}

function formatJsonBlock(value?: string) {
  if (!value?.trim()) return '-'
  try {
    return JSON.stringify(JSON.parse(value), null, 2)
  } catch {
    return value
  }
}

function toggleSelectAll() {
  if (allSelected.value) {
    selectedIds.value = new Set()
    return
  }
  selectedIds.value = new Set(logList.value.map((row) => String(row.id)))
}

function toggleSelect(id: number | string) {
  const key = String(id)
  const next = new Set(selectedIds.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  selectedIds.value = next
}

async function loadLogs() {
  loading.value = true
  try {
    const result = await listOperLogApi({
      pageNum: query.pageNum,
      pageSize: query.pageSize,
      title: query.title || undefined,
      userName: query.userName || undefined,
      businessType: query.businessType === '' ? undefined : query.businessType,
      status: query.status === '' ? undefined : query.status,
    })
    if (result.code !== API_SUCCESS_CODE || !result.data) {
      throw new Error(result.msg || t('system.operlog.loadFailed'))
    }
    logList.value = result.data.list ?? []
    total.value = result.data.total ?? 0
    selectedIds.value = new Set(
      [...selectedIds.value].filter((id) => logList.value.some((row) => String(row.id) === id)),
    )
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.operlog.loadFailed'))
  } finally {
    loading.value = false
  }
}

function searchLogs() {
  if (query.pageNum === 1) loadLogs()
  else query.pageNum = 1
}

function resetQuery() {
  query.title = ''
  query.userName = ''
  query.businessType = ''
  query.status = ''
  selectedIds.value = new Set()
  searchLogs()
}

function openDetail(row: SysOperationLog) {
  detailRow.value = row
  detailOpen.value = true
}

function closeDetail() {
  detailOpen.value = false
  detailRow.value = null
}

async function removeLogs(ids: Array<number | string>) {
  if (!guardAction(PERM.OPERLOG_REMOVE)) return
  if (!ids.length) return
  try {
    const result = await deleteOperLogApi(ids)
    if (result.code !== API_SUCCESS_CODE) {
      throw new Error(result.msg || t('system.operlog.deleteFailed'))
    }
    showToast('success', t('system.operlog.deleteOk'))
    selectedIds.value = new Set()
    await loadLogs()
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.operlog.deleteFailed'))
  }
}

async function removeOne(row: SysOperationLog) {
  if (!(await confirm({ message: t('system.operlog.deleteConfirm', { title: row.title || row.id }) }))) return
  await removeLogs([row.id!])
}

async function removeSelected() {
  const ids = [...selectedIds.value]
  if (!ids.length) return
  if (!(await confirm({ message: t('system.operlog.deleteBatchConfirm', { count: ids.length }) }))) return
  await removeLogs(ids)
}

async function cleanAll() {
  if (!guardAction(PERM.OPERLOG_REMOVE)) return
  if (!(await confirm({ message: t('system.operlog.cleanConfirm'), danger: true }))) return
  try {
    const result = await cleanOperLogApi()
    if (result.code !== API_SUCCESS_CODE) {
      throw new Error(result.msg || t('system.operlog.cleanFailed'))
    }
    showToast('success', t('system.operlog.cleanOk'))
    selectedIds.value = new Set()
    await loadLogs()
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.operlog.cleanFailed'))
  }
}

watch(
  () => [query.pageNum, query.pageSize],
  () => loadLogs(),
)

onMounted(loadLogs)
</script>

<template>
  <div class="page-stack">
    <div class="card p-5">
      <div class="mb-4 flex flex-wrap items-center gap-3">
        <form class="form-search-toolbar contents" @submit.prevent="searchLogs">
          <FormField :label="t('system.operlog.title')" horizontal class="form-field-search">
            <input v-model="query.title" type="text" class="field-input" :placeholder="t('system.operlog.titlePlaceholder')" />
          </FormField>
          <FormField :label="t('system.operlog.userName')" horizontal class="form-field-search">
            <input v-model="query.userName" type="text" class="field-input" :placeholder="t('system.operlog.userNamePlaceholder')" />
          </FormField>
          <FormField :label="t('system.operlog.businessType')" horizontal class="form-field-search">
            <select v-model="query.businessType" class="field-input">
              <option value="">{{ t('system.operlog.businessTypeAll') }}</option>
              <option v-for="type in BUSINESS_TYPE_OPTIONS" :key="type" :value="type">
                {{ businessTypeLabel(type) }}
              </option>
            </select>
          </FormField>
          <FormField :label="t('system.operlog.status')" horizontal class="form-field-search">
            <select v-model="query.status" class="field-input">
              <option value="">{{ t('system.operlog.statusAll') }}</option>
              <option :value="1">{{ t('system.operlog.statusOk') }}</option>
              <option :value="0">{{ t('system.operlog.statusFail') }}</option>
            </select>
          </FormField>
          <button type="submit" class="btn-primary shrink-0">
            <Search class="h-4 w-4" /> {{ t('system.operlog.search') }}
          </button>
          <button type="button" class="btn-ghost shrink-0" @click="resetQuery">
            <RefreshCw class="h-4 w-4" /> {{ t('system.operlog.reset') }}
          </button>
        </form>
        <div class="toolbar-actions">
          <button type="button" class="btn-ghost shrink-0" :disabled="!hasSelection" @click="removeSelected">
            <Trash2 class="h-4 w-4" /> {{ t('system.operlog.deleteBatch') }}
          </button>
          <button type="button" class="btn-ghost shrink-0 text-red-600 dark:text-red-400" @click="cleanAll">
            <Trash2 class="h-4 w-4" /> {{ t('system.operlog.clean') }}
          </button>
        </div>
      </div>

      <div class="overflow-x-auto rounded-lg border border-gray-100 dark:border-white/5">
        <table class="w-full min-w-[1080px] text-left text-sm">
          <thead class="bg-gray-50 text-xs uppercase tracking-wide text-gray-400 dark:bg-white/5">
            <tr>
              <th class="w-10 px-4 py-3">
                <input type="checkbox" :checked="allSelected" @change="toggleSelectAll" />
              </th>
              <th class="px-4 py-3">{{ t('system.operlog.id') }}</th>
              <th class="px-4 py-3">{{ t('system.operlog.title') }}</th>
              <th class="px-4 py-3">{{ t('system.operlog.businessType') }}</th>
              <th class="px-4 py-3">{{ t('system.operlog.userName') }}</th>
              <th class="px-4 py-3">{{ t('system.operlog.requestIp') }}</th>
              <th class="px-4 py-3">{{ t('system.operlog.requestLocation') }}</th>
              <th class="px-4 py-3">{{ t('system.operlog.status') }}</th>
              <th class="px-4 py-3">{{ t('system.operlog.createTime') }}</th>
              <th class="px-4 py-3 text-right">{{ t('system.operlog.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="10" class="px-4 py-10 text-center text-gray-400">{{ t('system.operlog.loading') }}</td>
            </tr>
            <tr v-else-if="!logList.length">
              <td colspan="10" class="px-4 py-10 text-center text-gray-400">{{ t('system.operlog.empty') }}</td>
            </tr>
            <tr
              v-for="row in logList"
              v-else
              :key="String(row.id)"
              class="border-t border-gray-50 transition hover:bg-gray-50/80 dark:border-white/5 dark:hover:bg-white/5"
            >
              <td class="px-4 py-3">
                <input
                  type="checkbox"
                  :checked="selectedIds.has(String(row.id))"
                  @change="toggleSelect(row.id!)"
                />
              </td>
              <td class="px-4 py-3 tabular-nums text-gray-600 dark:text-gray-300">{{ row.id }}</td>
              <td class="max-w-[180px] truncate px-4 py-3 font-medium text-gray-900 dark:text-white">{{ row.title || '-' }}</td>
              <td class="px-4 py-3">
                <span class="badge bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300">
                  {{ businessTypeLabel(row.businessType) }}
                </span>
              </td>
              <td class="px-4 py-3 text-gray-600 dark:text-gray-300">{{ row.userName || '-' }}</td>
              <td class="px-4 py-3 text-gray-600 dark:text-gray-300">{{ row.requestIp || '-' }}</td>
              <td class="max-w-[160px] truncate px-4 py-3 text-gray-600 dark:text-gray-300">{{ row.requestLocation || '-' }}</td>
              <td class="px-4 py-3">
                <span
                  :class="[
                    'badge',
                    row.status === 1
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                      : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
                  ]"
                >
                  {{ statusLabel(row.status) }}
                </span>
              </td>
              <td class="px-4 py-3 text-gray-600 dark:text-gray-300">{{ formatTime(row.createTime) }}</td>
              <td class="px-4 py-3">
                <div class="btn-action-group">
                  <button type="button" class="btn-action-edit" @click="openDetail(row)">
                    <Eye class="h-3.5 w-3.5" />
                    {{ t('system.operlog.detail') }}
                  </button>
                  <button type="button" class="btn-action-danger" @click="removeOne(row)">
                    <Trash2 class="h-3.5 w-3.5" />
                    {{ t('system.operlog.delete') }}
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="total > 0" class="mt-4">
        <AppPagination v-model:page-num="query.pageNum" v-model:page-size="query.pageSize" :total="total" />
      </div>
    </div>

    <AppModal :open="detailOpen" :title="t('system.operlog.detailTitle')" wide @close="closeDetail">
      <div v-if="detailRow" class="form-modal">
        <div class="form-grid">
          <FormField :label="t('system.operlog.title')">
            <div class="field-readonly">{{ detailRow.title || '-' }}</div>
          </FormField>
          <FormField :label="t('system.operlog.businessType')">
            <div class="field-readonly">{{ businessTypeLabel(detailRow.businessType) }}</div>
          </FormField>
          <FormField :label="t('system.operlog.userName')">
            <div class="field-readonly">{{ detailRow.userName || '-' }}</div>
          </FormField>
          <FormField :label="t('system.operlog.status')">
            <div class="field-readonly">{{ statusLabel(detailRow.status) }}</div>
          </FormField>
          <FormField :label="t('system.operlog.requestIp')">
            <div class="field-readonly">{{ detailRow.requestIp || '-' }}</div>
          </FormField>
          <FormField :label="t('system.operlog.requestLocation')">
            <div class="field-readonly">{{ detailRow.requestLocation || '-' }}</div>
          </FormField>
          <FormField :label="t('system.operlog.createTime')">
            <div class="field-readonly">{{ formatTime(detailRow.createTime) }}</div>
          </FormField>
          <FormField :label="t('system.operlog.requestMethod')" class="sm:col-span-2">
            <div class="field-readonly">{{ detailRow.requestMethod || '-' }} {{ detailRow.methodName || '' }}</div>
          </FormField>
          <FormField :label="t('system.operlog.requestUrl')" class="sm:col-span-2">
            <div class="field-readonly break-all">{{ detailRow.requestUrl || '-' }}</div>
          </FormField>
          <FormField :label="t('system.operlog.requestParam')" class="sm:col-span-2">
            <pre class="log-code-block">{{ formatJsonBlock(detailRow.requestParam) }}</pre>
          </FormField>
          <FormField :label="t('system.operlog.responseResult')" class="sm:col-span-2">
            <pre class="log-code-block">{{ formatJsonBlock(detailRow.responseResult) }}</pre>
          </FormField>
        </div>
      </div>
      <template #footer>
        <button type="button" class="btn-primary" @click="closeDetail">{{ t('system.operlog.close') }}</button>
      </template>
    </AppModal>
  </div>
</template>
