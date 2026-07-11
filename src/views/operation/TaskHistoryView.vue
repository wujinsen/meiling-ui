<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { listTaskApi } from '@/api/operation'
import DeployTaskDrawer from '@/components/operation/DeployTaskDrawer.vue'
import OperationPageHeader from '@/components/operation/OperationPageHeader.vue'
import OperationServerSelect from '@/components/operation/OperationServerSelect.vue'
import OperationTaskStatusBadge from '@/components/operation/OperationTaskStatusBadge.vue'
import AppPagination from '@/components/ui/AppPagination.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import { useOperationTaskPoll } from '@/composables/useOperationTaskPoll'
import { formatDateTime, showToast } from '@/composables/useToast'
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination'
import { API_SUCCESS_CODE } from '@/types/api'
import { OPERATION_TASK_TYPES, type OperationTask } from '@/types/operation'
import { FileText, RefreshCw, Search } from 'lucide-vue-next'

const { t } = useI18n()
const route = useRoute()
const { drawerOpen, task, logText, polling, openTask, closeDrawer } = useOperationTaskPoll()

const loading = ref(false)
const list = ref<OperationTask[]>([])
const total = ref(0)
const autoRefresh = ref(false)
let refreshTimer: ReturnType<typeof setInterval> | null = null

const query = reactive({
  pageNum: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  taskType: '' as string,
  serverId: '' as string,
  projectId: '' as string,
})

const taskTypeOptions = computed(() => [
  { value: '', label: t('operation.common.all') },
  ...OPERATION_TASK_TYPES.map((type) => ({
    value: type,
    label: t(`operation.task.type.${type}`),
  })),
])

const hasRunningTasks = computed(() =>
  list.value.some((row) => row.status === 'pending' || row.status === 'running'),
)

function taskTypeLabel(type?: string | null) {
  if (!type) return '-'
  const key = `operation.task.type.${type}` as const
  return t(key)
}

function taskSummary(row: OperationTask) {
  const parts: string[] = []
  if (row.serviceKey) parts.push(row.serviceKey)
  if (row.action) parts.push(row.action)
  if (row.targetName) parts.push(row.targetName)
  return parts.length ? parts.join(' · ') : '-'
}

function search() {
  if (query.pageNum === 1) loadList()
  else query.pageNum = 1
}

function resetQuery() {
  query.taskType = ''
  query.serverId = ''
  query.projectId = ''
  search()
}

function parseQueryParams() {
  const taskType = route.query.taskType
  const serverId = route.query.serverId
  const projectId = route.query.projectId
  const taskId = route.query.taskId
  if (typeof taskType === 'string') query.taskType = taskType
  if (typeof serverId === 'string') query.serverId = serverId
  if (typeof projectId === 'string') query.projectId = projectId
  if (typeof taskId === 'string' && taskId) {
    openTask(taskId)
  }
}

async function loadList() {
  loading.value = true
  try {
    const result = await listTaskApi({
      pageNum: query.pageNum,
      pageSize: query.pageSize,
      taskType: query.taskType || undefined,
      serverId: query.serverId || undefined,
      projectId: query.projectId || undefined,
    })
    if (result.code !== API_SUCCESS_CODE || !result.data) throw new Error(result.msg || t('operation.taskHistory.loadFailed'))
    list.value = result.data.list ?? []
    total.value = result.data.total ?? 0
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('operation.taskHistory.loadFailed'))
  } finally {
    loading.value = false
  }
}

function viewLog(row: OperationTask) {
  if (row.id == null) return
  openTask(row.id, {
    onFinished: () => {
      if (autoRefresh.value) void loadList()
    },
  })
}

function stopAutoRefresh() {
  if (refreshTimer != null) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
}

function startAutoRefresh() {
  stopAutoRefresh()
  if (!autoRefresh.value) return
  refreshTimer = setInterval(() => {
    if (!loading.value) void loadList()
  }, 5000)
}

watch(autoRefresh, startAutoRefresh)
watch(hasRunningTasks, (running) => {
  if (running && !autoRefresh.value) autoRefresh.value = true
})

watch(() => [query.pageNum, query.pageSize], loadList)
onMounted(() => {
  parseQueryParams()
  loadList()
})
onUnmounted(stopAutoRefresh)
</script>

<template>
  <div class="page-stack">
    <OperationPageHeader :title="t('operation.taskHistory.title')" :subtitle="t('operation.taskHistory.subtitle')">
      <template #toolbar>
        <form class="operation-search-form" @submit.prevent="search">
          <div class="operation-filter-field">
            <span>{{ t('operation.taskHistory.taskType') }}</span>
            <AppSelect v-model="query.taskType" :options="taskTypeOptions" />
          </div>
          <div class="operation-filter-field operation-filter-field--wide">
            <span>{{ t('operation.taskHistory.server') }}</span>
            <OperationServerSelect v-model="query.serverId" :empty-label="t('operation.taskHistory.allServers')" />
          </div>
          <label class="operation-filter-field">
            <span>{{ t('operation.taskHistory.projectId') }}</span>
            <input v-model="query.projectId" type="text" class="field-input" inputmode="numeric" />
          </label>
          <div class="operation-form-actions">
            <button type="submit" class="btn-primary shrink-0"><Search class="h-4 w-4" /> {{ t('operation.common.search') }}</button>
            <button type="button" class="btn-ghost shrink-0" @click="resetQuery"><RefreshCw class="h-4 w-4" /> {{ t('operation.common.reset') }}</button>
          </div>
        </form>
        <div class="toolbar-actions">
          <label class="inline-flex items-center gap-2 text-sm text-gray-500">
            <input v-model="autoRefresh" type="checkbox" class="rounded border-gray-300" />
            {{ t('operation.taskHistory.autoRefresh') }}
          </label>
          <button type="button" class="btn-ghost shrink-0" :disabled="loading" @click="loadList">
            <RefreshCw class="h-4 w-4" :class="loading && 'animate-spin'" />
            {{ t('operation.taskHistory.refresh') }}
          </button>
        </div>
      </template>
    </OperationPageHeader>

    <div class="card p-5">
      <p class="mb-4 text-sm text-gray-500">{{ t('operation.taskHistory.hint') }}</p>
      <div class="overflow-x-auto rounded-lg border border-gray-100 dark:border-white/5">
        <table class="w-full min-w-[1040px] text-left text-sm">
          <thead class="bg-gray-50 text-xs uppercase text-gray-400 dark:bg-white/5">
            <tr>
              <th class="px-4 py-3">ID</th>
              <th class="px-4 py-3">{{ t('operation.taskHistory.taskType') }}</th>
              <th class="px-4 py-3">{{ t('operation.taskHistory.status') }}</th>
              <th class="px-4 py-3">{{ t('operation.task.progress') }}</th>
              <th class="px-4 py-3">{{ t('operation.taskHistory.target') }}</th>
              <th class="px-4 py-3">{{ t('operation.taskHistory.message') }}</th>
              <th class="px-4 py-3">{{ t('operation.common.createTime') }}</th>
              <th class="px-4 py-3">{{ t('operation.taskHistory.finishTime') }}</th>
              <th class="px-4 py-3 text-right">{{ t('operation.common.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading"><td colspan="9" class="px-4 py-10 text-center text-gray-400">{{ t('operation.common.loading') }}</td></tr>
            <tr v-else-if="!list.length"><td colspan="9" class="px-4 py-10 text-center text-gray-400">{{ t('operation.common.empty') }}</td></tr>
            <tr
              v-for="row in list"
              v-else
              :key="String(row.id)"
              class="border-t border-gray-50 dark:border-white/5 hover:bg-gray-50/80 dark:hover:bg-white/5"
              :class="(row.status === 'running' || row.status === 'pending') && 'operation-table-row--task-active'"
            >
              <td class="px-4 py-3 font-mono text-xs">{{ row.id }}</td>
              <td class="px-4 py-3">{{ taskTypeLabel(row.taskType) }}</td>
              <td class="px-4 py-3"><OperationTaskStatusBadge :status="row.status" /></td>
              <td class="px-4 py-3">
                <div class="flex items-center gap-2">
                  <div class="h-1.5 w-16 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                    <div class="h-full rounded-full bg-blue-500" :style="{ width: `${Math.min(100, row.progress ?? 0)}%` }" />
                  </div>
                  <span class="text-xs text-gray-500">{{ row.progress ?? 0 }}%</span>
                </div>
              </td>
              <td class="max-w-[220px] truncate px-4 py-3" :title="taskSummary(row)">
                <span v-if="row.serverId" class="text-xs text-gray-400">#{{ row.serverId }}</span>
                {{ taskSummary(row) }}
              </td>
              <td class="max-w-[200px] truncate px-4 py-3 text-gray-500" :title="row.message || ''">{{ row.message || '-' }}</td>
              <td class="px-4 py-3">{{ formatDateTime(row.createTime) }}</td>
              <td class="px-4 py-3">{{ row.finishTime ? formatDateTime(row.finishTime) : '-' }}</td>
              <td class="px-4 py-3">
                <div class="btn-action-group justify-end">
                  <button type="button" class="btn-action-edit" @click="viewLog(row)">
                    <FileText class="h-3.5 w-3.5" />{{ t('operation.taskHistory.viewLog') }}
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="total > 0" class="mt-4"><AppPagination v-model:page-num="query.pageNum" v-model:page-size="query.pageSize" :total="total" /></div>
    </div>

    <DeployTaskDrawer
      :open="drawerOpen"
      :task="task"
      :log-text="logText"
      :polling="polling"
      @close="closeDrawer"
    />
  </div>
</template>
