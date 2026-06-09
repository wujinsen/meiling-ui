<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { cleanLoginLogApi, deleteLoginLogApi, listLoginLogApi } from '@/api/loginlog'
import AppModal from '@/components/ui/AppModal.vue'
import FormField from '@/components/ui/FormField.vue'
import { confirm } from '@/composables/useConfirm'
import { showToast } from '@/composables/useToast'
import AppPagination from '@/components/ui/AppPagination.vue'
import { API_SUCCESS_CODE } from '@/types/api'
import type { LoginLogQuery, SysLoginLog } from '@/types/loginlog'
import { Eye, RefreshCw, Search, Trash2 } from 'lucide-vue-next'

const { t } = useI18n()

const loading = ref(false)
const logList = ref<SysLoginLog[]>([])
const total = ref(0)
const selectedIds = ref(new Set<string>())
const detailOpen = ref(false)
const detailRow = ref<SysLoginLog | null>(null)

const query = reactive({
  pageNum: 1,
  pageSize: 10,
  userName: '',
  status: '' as LoginLogQuery['status'],
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

function statusLabel(status?: number) {
  return status === 1 ? t('system.loginlog.statusOk') : t('system.loginlog.statusFail')
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
    const result = await listLoginLogApi({
      pageNum: query.pageNum,
      pageSize: query.pageSize,
      userName: query.userName || undefined,
      status: query.status === '' ? undefined : query.status,
    })
    if (result.code !== API_SUCCESS_CODE || !result.data) {
      throw new Error(result.msg || t('system.loginlog.loadFailed'))
    }
    logList.value = result.data.list ?? []
    total.value = result.data.total ?? 0
    selectedIds.value = new Set(
      [...selectedIds.value].filter((id) => logList.value.some((row) => String(row.id) === id)),
    )
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.loginlog.loadFailed'))
  } finally {
    loading.value = false
  }
}

function searchLogs() {
  if (query.pageNum === 1) loadLogs()
  else query.pageNum = 1
}

function resetQuery() {
  query.userName = ''
  query.status = ''
  selectedIds.value = new Set()
  searchLogs()
}

function openDetail(row: SysLoginLog) {
  detailRow.value = row
  detailOpen.value = true
}

function closeDetail() {
  detailOpen.value = false
  detailRow.value = null
}

async function removeLogs(ids: Array<number | string>) {
  if (!ids.length) return
  try {
    const result = await deleteLoginLogApi(ids)
    if (result.code !== API_SUCCESS_CODE) {
      throw new Error(result.msg || t('system.loginlog.deleteFailed'))
    }
    showToast('success', t('system.loginlog.deleteOk'))
    selectedIds.value = new Set()
    await loadLogs()
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.loginlog.deleteFailed'))
  }
}

async function removeOne(row: SysLoginLog) {
  if (!(await confirm({ message: t('system.loginlog.deleteConfirm', { userName: row.userName || row.id }) }))) return
  await removeLogs([row.id!])
}

async function removeSelected() {
  const ids = [...selectedIds.value]
  if (!ids.length) return
  if (!(await confirm({ message: t('system.loginlog.deleteBatchConfirm', { count: ids.length }) }))) return
  await removeLogs(ids)
}

async function cleanAll() {
  if (!(await confirm({ message: t('system.loginlog.cleanConfirm'), danger: true }))) return
  try {
    const result = await cleanLoginLogApi()
    if (result.code !== API_SUCCESS_CODE) {
      throw new Error(result.msg || t('system.loginlog.cleanFailed'))
    }
    showToast('success', t('system.loginlog.cleanOk'))
    selectedIds.value = new Set()
    await loadLogs()
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.loginlog.cleanFailed'))
  }
}

watch(
  () => query.pageNum,
  () => loadLogs(),
)

onMounted(loadLogs)
</script>

<template>
  <div class="page-stack">
    <div class="card p-5">
      <div class="mb-4 flex flex-wrap items-center gap-3">
        <form class="form-search-toolbar contents" @submit.prevent="searchLogs">
          <FormField :label="t('system.loginlog.userName')" horizontal class="form-field-search">
            <input
              v-model="query.userName"
              type="text"
              class="field-input"
              :placeholder="t('system.loginlog.userNamePlaceholder')"
            />
          </FormField>
          <FormField :label="t('system.loginlog.status')" horizontal class="form-field-search">
            <select v-model="query.status" class="field-input">
              <option value="">{{ t('system.loginlog.statusAll') }}</option>
              <option :value="1">{{ t('system.loginlog.statusOk') }}</option>
              <option :value="0">{{ t('system.loginlog.statusFail') }}</option>
            </select>
          </FormField>
          <button type="submit" class="btn-primary shrink-0">
            <Search class="h-4 w-4" /> {{ t('system.loginlog.search') }}
          </button>
          <button type="button" class="btn-ghost shrink-0" @click="resetQuery">
            <RefreshCw class="h-4 w-4" /> {{ t('system.loginlog.reset') }}
          </button>
        </form>
        <div class="toolbar-actions">
          <button type="button" class="btn-ghost shrink-0" :disabled="!hasSelection" @click="removeSelected">
            <Trash2 class="h-4 w-4" /> {{ t('system.loginlog.deleteBatch') }}
          </button>
          <button type="button" class="btn-ghost shrink-0 text-red-600 dark:text-red-400" @click="cleanAll">
            <Trash2 class="h-4 w-4" /> {{ t('system.loginlog.clean') }}
          </button>
        </div>
      </div>

      <div class="overflow-x-auto rounded-lg border border-gray-100 dark:border-white/5">
        <table class="w-full min-w-[960px] text-left text-sm">
          <thead class="bg-gray-50 text-xs uppercase tracking-wide text-gray-400 dark:bg-white/5">
            <tr>
              <th class="w-10 px-4 py-3">
                <input type="checkbox" :checked="allSelected" @change="toggleSelectAll" />
              </th>
              <th class="px-4 py-3">{{ t('system.loginlog.id') }}</th>
              <th class="px-4 py-3">{{ t('system.loginlog.userName') }}</th>
              <th class="px-4 py-3">{{ t('system.loginlog.ipAddress') }}</th>
              <th class="px-4 py-3">{{ t('system.loginlog.loginAddress') }}</th>
              <th class="px-4 py-3">{{ t('system.loginlog.browser') }}</th>
              <th class="px-4 py-3">{{ t('system.loginlog.os') }}</th>
              <th class="px-4 py-3">{{ t('system.loginlog.status') }}</th>
              <th class="px-4 py-3">{{ t('system.loginlog.loginTime') }}</th>
              <th class="px-4 py-3 text-right">{{ t('system.loginlog.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="10" class="px-4 py-10 text-center text-gray-400">{{ t('system.loginlog.loading') }}</td>
            </tr>
            <tr v-else-if="!logList.length">
              <td colspan="10" class="px-4 py-10 text-center text-gray-400">{{ t('system.loginlog.empty') }}</td>
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
              <td class="px-4 py-3 font-medium text-gray-900 dark:text-white">{{ row.userName || '-' }}</td>
              <td class="px-4 py-3 text-gray-600 dark:text-gray-300">{{ row.ipAddress || '-' }}</td>
              <td class="max-w-[160px] truncate px-4 py-3 text-gray-600 dark:text-gray-300">{{ row.loginAddress || '-' }}</td>
              <td class="max-w-[120px] truncate px-4 py-3 text-gray-600 dark:text-gray-300">{{ row.browser || '-' }}</td>
              <td class="max-w-[120px] truncate px-4 py-3 text-gray-600 dark:text-gray-300">{{ row.os || '-' }}</td>
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
              <td class="px-4 py-3 text-gray-600 dark:text-gray-300">{{ formatTime(row.loginTime) }}</td>
              <td class="px-4 py-3">
                <div class="btn-action-group">
                  <button type="button" class="btn-action-edit" @click="openDetail(row)">
                    <Eye class="h-3.5 w-3.5" />
                    {{ t('system.loginlog.detail') }}
                  </button>
                  <button type="button" class="btn-action-danger" @click="removeOne(row)">
                    <Trash2 class="h-3.5 w-3.5" />
                    {{ t('system.loginlog.delete') }}
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

    <AppModal :open="detailOpen" :title="t('system.loginlog.detailTitle')" wide @close="closeDetail">
      <div v-if="detailRow" class="form-modal">
        <div class="form-grid">
          <FormField :label="t('system.loginlog.userName')">
            <div class="field-readonly">{{ detailRow.userName || '-' }}</div>
          </FormField>
          <FormField :label="t('system.loginlog.status')">
            <div class="field-readonly">{{ statusLabel(detailRow.status) }}</div>
          </FormField>
          <FormField :label="t('system.loginlog.ipAddress')">
            <div class="field-readonly">{{ detailRow.ipAddress || '-' }}</div>
          </FormField>
          <FormField :label="t('system.loginlog.loginTime')">
            <div class="field-readonly">{{ formatTime(detailRow.loginTime) }}</div>
          </FormField>
          <FormField :label="t('system.loginlog.loginAddress')" class="sm:col-span-2">
            <div class="field-readonly">{{ detailRow.loginAddress || '-' }}</div>
          </FormField>
          <FormField :label="t('system.loginlog.browser')">
            <div class="field-readonly">{{ detailRow.browser || '-' }}</div>
          </FormField>
          <FormField :label="t('system.loginlog.os')">
            <div class="field-readonly">{{ detailRow.os || '-' }}</div>
          </FormField>
          <FormField :label="t('system.loginlog.remark')" class="sm:col-span-2">
            <div class="field-readonly">{{ detailRow.remark || '-' }}</div>
          </FormField>
        </div>
      </div>
      <template #footer>
        <button type="button" class="btn-primary" @click="closeDetail">{{ t('system.loginlog.close') }}</button>
      </template>
    </AppModal>
  </div>
</template>
