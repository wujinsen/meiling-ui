<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Loader2, XCircle } from 'lucide-vue-next'
import AppPagination from '@/components/ui/AppPagination.vue'
import KbWorkflowNextSteps from '@/components/knowledge/KbWorkflowNextSteps.vue'
import { getKbSyncLogsApi, getKbSyncStatusApi, triggerKbSyncApi } from '@/api/knowledge'
import { useKbSpace } from '@/composables/useKbSpace'
import { assertAction, guardActionWithRefresh } from '@/composables/useActionPermissions'
import { confirm } from '@/composables/useConfirm'
import { showToast } from '@/composables/useToast'
import { API_SUCCESS_CODE } from '@/types/api'
import type { KbSyncLog, KbSyncStatus, KbWorkflowHintVo } from '@/types/knowledge'
import { PERM } from '@/constants/permissions'
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination'
import { kbSyncTargetLabel, resolveKbSyncParams } from '@/utils/kbSyncScope'
import {
  deriveKbSyncBatchStatus,
  isKbSyncLogFailed,
  isKbSyncRunningLockedMessage,
  pickKbSyncLastMessage,
  type KbSyncBatchStatus,
} from '@/utils/kbSyncStatus'

const { t } = useI18n()
const { selectedSpace, kbQuerySpaceId, kbSpaceQuery, ensureSpacesLoaded } = useKbSpace()

const canSync = computed(() => assertAction(PERM.KB_SYNC_TRIGGER))
const syncParams = computed(() => resolveKbSyncParams(kbSpaceQuery(), selectedSpace.value))
const syncTargetLabel = computed(() => kbSyncTargetLabel(selectedSpace.value))
const canTrigger = computed(() => canSync.value && syncParams.value != null && !syncRunning.value)

const statusLoading = ref(false)
const logsLoading = ref(false)
const triggering = ref(false)
const status = ref<KbSyncStatus | null>(null)
const logs = ref<KbSyncLog[]>([])
const total = ref(0)
const pageNum = ref(1)
const pageSize = ref(DEFAULT_PAGE_SIZE)
const showRawOutput = ref(false)
const expandedLogIds = ref(new Set<string>())
const failOnlyLogs = ref(false)
const nextSteps = ref<KbWorkflowHintVo[]>([])

type SyncResult = {
  success: boolean
  output: string
}

const lastResult = ref<SyncResult | null>(null)

let pollTimer: ReturnType<typeof setInterval> | null = null

const batchStatus = computed<KbSyncBatchStatus>(() =>
  deriveKbSyncBatchStatus(status.value, logs.value, triggering.value),
)

const syncRunning = computed(() => batchStatus.value === 'running')

const lastMessage = computed(() => pickKbSyncLastMessage(status.value, logs.value))

const displayBatchNo = computed(
  () => status.value?.lastBatchNo || status.value?.batchNo || '-',
)

const parsedOutput = computed(() => {
  const output = lastResult.value?.output?.trim()
  if (!output) return null
  const lines = output.split('\n').map((l) => l.trim()).filter(Boolean)
  const target = lines.find((l) => l.includes('目标空间') || l.includes('space_id'))
  const summary = lines.find((l) => /insert=\d+/.test(l) || l.includes('同步完成'))
  const stats: Record<string, number> = {}
  if (summary) {
    for (const key of ['insert', 'update', 'skip', 'delete', 'fail'] as const) {
      const m = summary.match(new RegExp(`${key}=(\\d+)`))
      if (m) stats[key] = Number(m[1])
    }
  }
  return { target, summary, stats, raw: output }
})

const STATUS_BANNER: Record<KbSyncBatchStatus, string> = {
  idle: 'border-gray-200 bg-gray-50 dark:border-white/10 dark:bg-white/5',
  running: 'border-sky-200 bg-sky-50/90 dark:border-sky-500/30 dark:bg-sky-500/10',
  success: 'border-emerald-200 bg-emerald-50/90 dark:border-emerald-500/30 dark:bg-emerald-500/10',
  fail: 'border-rose-200 bg-rose-50/90 dark:border-rose-500/30 dark:bg-rose-500/10',
}

const STAT_BADGE: Record<string, string> = {
  insert: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  update: 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  skip: 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300',
  delete: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  fail: 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
}

function startPolling() {
  stopPolling()
  pollTimer = setInterval(() => {
    void loadStatus()
    if (pageNum.value === 1) void loadLogs()
  }, 4000)
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

function toggleLogExpand(id: string | number) {
  const key = String(id)
  const next = new Set(expandedLogIds.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  expandedLogIds.value = next
}

function logRowClass(row: KbSyncLog) {
  return isKbSyncLogFailed(row.status)
    ? 'bg-rose-50/70 dark:bg-rose-500/10'
    : ''
}

function statusLabel(row: KbSyncLog) {
  if (!row.status) return '-'
  if (isKbSyncLogFailed(row.status)) return t('knowledge.sync.statusFail')
  if (row.status.toLowerCase() === 'success' || row.status.toLowerCase() === 'ok') {
    return t('knowledge.sync.statusSuccess')
  }
  return row.status
}

const displayLogs = computed(() =>
  failOnlyLogs.value ? logs.value.filter((row) => isKbSyncLogFailed(row.status)) : logs.value,
)

const failOnlyEmpty = computed(
  () => failOnlyLogs.value && logs.value.length > 0 && displayLogs.value.length === 0,
)

async function loadStatus() {
  statusLoading.value = true
  try {
    const res = await getKbSyncStatusApi(kbQuerySpaceId())
    if (res.code === API_SUCCESS_CODE) status.value = res.data ?? null
  } finally {
    statusLoading.value = false
  }
}

async function loadLogs() {
  logsLoading.value = true
  try {
    const res = await getKbSyncLogsApi({
      spaceId: kbQuerySpaceId(),
      pageNum: pageNum.value,
      pageSize: pageSize.value,
    })
    if (res.code === API_SUCCESS_CODE && res.data) {
      logs.value = res.data.records ?? []
      const n = Number(res.data.total)
      total.value = Number.isFinite(n) && n >= 0 ? n : 0
    }
  } finally {
    logsLoading.value = false
  }
}

async function refreshAll() {
  await Promise.all([loadStatus(), loadLogs()])
}

const busy = computed(() => statusLoading.value || logsLoading.value)

async function trigger(options?: { skipConfirm?: boolean }) {
  if (syncRunning.value) return

  const allowed =
    assertAction(PERM.KB_SYNC_TRIGGER) ||
    (await guardActionWithRefresh(PERM.KB_SYNC_TRIGGER))
  if (!allowed) return

  const params = syncParams.value
  if (!params) {
    showToast('error', t('knowledge.sync.needSpace'))
    return
  }

  if (!options?.skipConfirm) {
    const label = syncTargetLabel.value || params.spaceCode || params.spaceId || '-'
    const ok = await confirm({
      title: t('knowledge.sync.confirmTitle'),
      message: t('knowledge.sync.confirmMessage', { target: label }),
      confirmText: t('knowledge.sync.trigger'),
      danger: true,
    })
    if (!ok) return
  }

  triggering.value = true
  lastResult.value = null
  showRawOutput.value = false
  nextSteps.value = []
  startPolling()

  try {
    const res = await triggerKbSyncApi({ ...params, async: true })
    await refreshAll()

    if (res.code === API_SUCCESS_CODE && res.data) {
      const data = res.data
      const stillRunning =
        syncRunning.value
        || status.value?.running
        || String(data.status ?? '').toLowerCase() === 'running'

      if (stillRunning) {
        showToast('success', t('knowledge.sync.triggerAsync'))
        startPolling()
        return
      }

      const output = data.outputTail ?? data.stdoutTail ?? data.message ?? ''
      lastResult.value = { success: data.success, output }
      if (data.nextSteps?.length) nextSteps.value = data.nextSteps

      if (data.success) {
        showToast('success', t('knowledge.sync.triggerOk'))
      } else {
        showToast('error', t('knowledge.sync.failCheckLogs'))
      }
    } else if (isKbSyncRunningLockedMessage(res.msg)) {
      showToast('error', t('knowledge.sync.runningLocked'))
      startPolling()
      await refreshAll()
    } else {
      throw new Error(res.msg || t('knowledge.sync.triggerFailed', { code: '?' }))
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : t('knowledge.sync.triggerFailed', { code: '?' })
    if (isKbSyncRunningLockedMessage(msg)) {
      showToast('error', t('knowledge.sync.runningLocked'))
      startPolling()
      await refreshAll()
    } else {
      showToast('error', msg)
    }
  } finally {
    triggering.value = false
    if (!syncRunning.value) stopPolling()
  }
}

onMounted(async () => {
  await ensureSpacesLoaded()
  await refreshAll()
})

onUnmounted(stopPolling)

watch([pageNum, pageSize], () => loadLogs())

watch(() => kbQuerySpaceId(), () => {
  lastResult.value = null
  showRawOutput.value = false
  nextSteps.value = []
  expandedLogIds.value = new Set()
  pageNum.value = 1
  stopPolling()
  void refreshAll()
})

watch(syncRunning, (running) => {
  if (running) startPolling()
  else stopPolling()
})

defineExpose({
  refreshAll,
  trigger,
  busy,
  triggering,
  syncRunning,
  canSync,
  canTrigger,
})
</script>

<template>
  <div class="space-y-4">
    <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('knowledge.sync.subtitle') }}</p>

    <div
      class="rounded-xl border px-4 py-3"
      :class="canTrigger
        ? 'border-brand-200 bg-brand-50/80 dark:border-brand-500/30 dark:bg-brand-500/10'
        : 'border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10'"
    >
      <p class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {{ t('knowledge.sync.targetSpace') }}
      </p>
      <p
        v-if="syncParams"
        class="mt-1 text-base font-semibold text-gray-900 dark:text-white"
      >
        {{ syncTargetLabel }}
      </p>
      <p v-else class="mt-1 text-sm text-amber-800 dark:text-amber-200">
        {{ t('knowledge.sync.needSpace') }}
      </p>
      <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
        {{ t('knowledge.sync.targetSpaceHint') }}
      </p>
    </div>

    <div v-if="!canSync" class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
      {{ t('knowledge.sync.noPerm') }}
    </div>

    <!-- O1: 批次状态卡片 -->
    <div class="rounded-xl border px-4 py-3" :class="STATUS_BANNER[batchStatus]">
      <div class="flex items-start gap-3">
        <Loader2 v-if="batchStatus === 'running'" class="mt-0.5 h-5 w-5 shrink-0 animate-spin text-sky-600" />
        <CheckCircle2 v-else-if="batchStatus === 'success'" class="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
        <XCircle v-else-if="batchStatus === 'fail'" class="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
        <AlertTriangle v-else class="mt-0.5 h-5 w-5 shrink-0 text-gray-400" />
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold text-gray-900 dark:text-white">
            <template v-if="batchStatus === 'running'">{{ t('knowledge.sync.statusRunning') }}</template>
            <template v-else-if="batchStatus === 'success'">{{ t('knowledge.sync.statusSuccess') }}</template>
            <template v-else-if="batchStatus === 'fail'">{{ t('knowledge.sync.statusFail') }}</template>
            <template v-else>{{ t('knowledge.sync.statusIdle') }}</template>
          </p>
          <p v-if="batchStatus !== 'idle'" class="mt-1 font-mono text-xs text-gray-600 dark:text-gray-300">
            {{ t('knowledge.sync.batchNo') }}: {{ displayBatchNo }}
            <span v-if="status?.lastSyncTime || status?.lastFinishTime" class="ml-2 text-gray-500">
              · {{ status?.lastFinishTime || status?.lastSyncTime }}
            </span>
          </p>
          <p
            v-if="lastMessage && batchStatus === 'fail'"
            class="mt-2 text-xs text-rose-700 dark:text-rose-300"
          >
            {{ lastMessage }}
          </p>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div class="card p-4">
        <p class="text-xs text-gray-500">{{ t('knowledge.sync.batchNo') }}</p>
        <p class="mt-1 truncate font-mono text-sm font-medium">{{ displayBatchNo }}</p>
      </div>
      <div class="card p-4">
        <p class="text-xs text-gray-500">{{ t('knowledge.sync.lastSync') }}</p>
        <p class="mt-1 text-sm font-medium">{{ status?.lastSyncTime || status?.lastFinishTime || '-' }}</p>
      </div>
      <div class="card p-4">
        <p class="text-xs text-gray-500">{{ t('knowledge.sync.total') }}</p>
        <p class="mt-1 text-2xl font-semibold">{{ status?.total ?? 0 }}</p>
      </div>
      <div class="card p-4">
        <p class="text-xs text-gray-500">{{ t('knowledge.sync.failCount') }}</p>
        <p
          class="mt-1 text-2xl font-semibold"
          :class="(status?.failCount ?? 0) > 0 ? 'text-rose-600' : 'text-gray-900 dark:text-white'"
        >
          {{ status?.failCount ?? 0 }}
        </p>
      </div>
    </div>

    <div v-if="status?.actionCounts && Object.keys(status.actionCounts).length" class="card p-4">
      <p class="mb-2 text-sm font-medium text-gray-700 dark:text-gray-200">{{ t('knowledge.sync.actionCounts') }}</p>
      <div class="flex flex-wrap gap-2">
        <span
          v-for="(count, action) in status.actionCounts"
          :key="action"
          class="badge bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300"
        >{{ action }}: {{ count }}</span>
      </div>
    </div>

    <KbWorkflowNextSteps
      v-if="nextSteps.length"
      :steps="nextSteps"
      :title="t('knowledge.sync.nextStepsTitle')"
    />

    <Transition name="kb-sync-result">
      <div
        v-if="lastResult && parsedOutput"
        class="card kb-sync-result"
        :class="lastResult.success ? 'kb-sync-result-ok' : 'kb-sync-result-fail'"
      >
        <div class="flex items-start gap-3">
          <CheckCircle2 v-if="lastResult.success" class="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
          <XCircle v-else class="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold text-gray-900 dark:text-white">
              {{ lastResult.success ? t('knowledge.sync.outputSuccess') : t('knowledge.sync.outputFailed') }}
            </p>
            <p v-if="parsedOutput.target" class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ parsedOutput.target }}</p>
            <div v-if="Object.keys(parsedOutput.stats).length" class="mt-3 flex flex-wrap gap-2">
              <span
                v-for="(count, key) in parsedOutput.stats"
                :key="key"
                class="badge"
                :class="STAT_BADGE[key] ?? 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300'"
              >{{ key }}: {{ count }}</span>
            </div>
            <button
              v-if="parsedOutput.raw"
              type="button"
              class="mt-3 text-xs text-brand-600 hover:underline dark:text-brand-400"
              @click="showRawOutput = !showRawOutput"
            >
              {{ showRawOutput ? t('knowledge.sync.hideRaw') : t('knowledge.sync.viewRaw') }}
            </button>
            <pre v-if="showRawOutput" class="kb-sync-result-raw mt-2">{{ parsedOutput.raw }}</pre>
          </div>
          <button type="button" class="btn-ghost shrink-0 p-1.5 text-gray-400" :aria-label="t('common.dismiss')" @click="lastResult = null">
            ×
          </button>
        </div>
      </div>
    </Transition>

    <!-- O3/O4: 日志表 -->
    <div class="card overflow-hidden">
      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3 dark:border-white/5">
        <p class="text-sm font-medium text-gray-700 dark:text-gray-200">{{ t('knowledge.sync.logsTitle') }}</p>
        <label class="flex cursor-pointer items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
          <input
            v-model="failOnlyLogs"
            type="checkbox"
            class="h-3.5 w-3.5 rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-white/20"
          />
          {{ t('knowledge.sync.failOnlyFilter') }}
        </label>
      </div>
      <p
        v-if="failOnlyEmpty"
        class="border-b border-amber-100 bg-amber-50/80 px-4 py-2 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200"
      >
        {{ t('knowledge.sync.failOnlyEmpty') }}
      </p>
      <p v-if="logsLoading && !logs.length" class="p-8 text-center text-sm text-gray-400">{{ t('common.loading') }}</p>
      <div v-else class="overflow-x-auto">
        <table class="w-full min-w-[40rem] text-left text-sm">
          <thead class="border-b border-gray-100 bg-gray-50 text-xs text-gray-500 dark:border-white/5 dark:bg-white/5">
            <tr>
              <th class="w-8 px-2 py-2" />
              <th class="px-3 py-2">{{ t('knowledge.sync.col.time') }}</th>
              <th class="px-3 py-2">{{ t('knowledge.sync.col.batchNo') }}</th>
              <th class="px-3 py-2">{{ t('knowledge.sync.col.action') }}</th>
              <th class="px-3 py-2">{{ t('knowledge.sync.col.path') }}</th>
              <th class="px-3 py-2">{{ t('knowledge.sync.col.status') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!displayLogs.length">
              <td colspan="6" class="px-3 py-8 text-center text-gray-400">{{ t('knowledge.sync.logsEmpty') }}</td>
            </tr>
            <template v-for="row in displayLogs" :key="row.id">
              <tr
                class="border-b border-gray-50 dark:border-white/5"
                :class="logRowClass(row)"
              >
                <td class="px-2 py-2">
                  <button
                    v-if="row.message"
                    type="button"
                    class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    :aria-label="expandedLogIds.has(String(row.id)) ? t('knowledge.sync.collapseMessage') : t('knowledge.sync.expandMessage')"
                    @click="toggleLogExpand(row.id)"
                  >
                    <ChevronDown v-if="expandedLogIds.has(String(row.id))" class="h-4 w-4" />
                    <ChevronRight v-else class="h-4 w-4" />
                  </button>
                </td>
                <td class="whitespace-nowrap px-3 py-2 text-xs text-gray-500">{{ row.createTime || '-' }}</td>
                <td class="max-w-[8rem] truncate px-3 py-2 font-mono text-xs">{{ row.batchNo || '-' }}</td>
                <td class="px-3 py-2">
                  <span class="badge bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">{{ row.action || '-' }}</span>
                </td>
                <td class="max-w-[12rem] truncate px-3 py-2 font-mono text-xs">{{ row.sourcePath || '-' }}</td>
                <td class="px-3 py-2 text-xs font-medium" :class="isKbSyncLogFailed(row.status) ? 'text-rose-600' : 'text-emerald-700 dark:text-emerald-400'">
                  {{ statusLabel(row) }}
                </td>
              </tr>
              <tr
                v-if="row.message && expandedLogIds.has(String(row.id))"
                class="border-b border-gray-50 dark:border-white/5"
                :class="logRowClass(row)"
              >
                <td />
                <td colspan="5" class="px-3 py-2 text-xs text-gray-600 dark:text-gray-300">
                  <span class="font-medium text-gray-500">{{ t('knowledge.sync.col.message') }}:</span>
                  {{ row.message }}
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
      <div class="border-t border-gray-100 p-3 dark:border-white/5">
        <AppPagination v-model:page-num="pageNum" v-model:page-size="pageSize" :total="total" />
      </div>
    </div>
  </div>
</template>
