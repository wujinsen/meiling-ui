<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { CheckCircle2, XCircle } from 'lucide-vue-next'
import AppPagination from '@/components/ui/AppPagination.vue'
import { getKbSyncLogsApi, getKbSyncStatusApi, triggerKbSyncApi } from '@/api/knowledge'
import { useKbSpace } from '@/composables/useKbSpace'
import { assertAction, guardActionWithRefresh } from '@/composables/useActionPermissions'
import { showToast } from '@/composables/useToast'
import { API_SUCCESS_CODE } from '@/types/api'
import type { KbSyncLog, KbSyncStatus } from '@/types/knowledge'
import { PERM } from '@/constants/permissions'
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination'

const { t } = useI18n()
const { selectedSpace, kbQuerySpaceId, ensureSpacesLoaded } = useKbSpace()

const canSync = computed(() => assertAction(PERM.KB_SYNC_TRIGGER))

const statusLoading = ref(false)
const logsLoading = ref(false)
const triggering = ref(false)
const status = ref<KbSyncStatus | null>(null)
const logs = ref<KbSyncLog[]>([])
const total = ref(0)
const pageNum = ref(1)
const pageSize = ref(DEFAULT_PAGE_SIZE)
const showRawOutput = ref(false)

type SyncResult = {
  success: boolean
  output: string
}

const lastResult = ref<SyncResult | null>(null)

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

const STAT_BADGE: Record<string, string> = {
  insert: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  update: 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  skip: 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300',
  delete: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  fail: 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
}

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
      total.value = res.data.total ?? 0
    }
  } finally {
    logsLoading.value = false
  }
}

async function refreshAll() {
  await Promise.all([loadStatus(), loadLogs()])
}

const busy = computed(() => statusLoading.value || logsLoading.value)

async function trigger() {
  const allowed =
    assertAction(PERM.KB_SYNC_TRIGGER) ||
    (await guardActionWithRefresh(PERM.KB_SYNC_TRIGGER))
  if (!allowed) return
  triggering.value = true
  lastResult.value = null
  showRawOutput.value = false
  try {
    const params: { spaceId?: number | string; spaceCode?: string } = {}
    const sid = kbQuerySpaceId()
    if (sid != null) params.spaceId = sid
    else if (selectedSpace.value?.spaceCode) params.spaceCode = selectedSpace.value.spaceCode
    else params.spaceCode = 'enterprise-kb'

    const res = await triggerKbSyncApi(params)
    if (res.code === API_SUCCESS_CODE && res.data) {
      lastResult.value = { success: res.data.success, output: res.data.outputTail ?? '' }
      if (res.data.success) {
        showToast('success', t('knowledge.sync.triggerOk'))
      } else {
        showToast('error', t('knowledge.sync.triggerFailed', { code: res.data.exitCode }))
      }
      await refreshAll()
    } else {
      throw new Error(res.msg || t('knowledge.sync.triggerFailed', { code: '?' }))
    }
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('knowledge.sync.triggerFailed', { code: '?' }))
  } finally {
    triggering.value = false
  }
}

onMounted(async () => {
  await ensureSpacesLoaded()
  await refreshAll()
})

watch([pageNum, pageSize], () => loadLogs())

watch(() => kbQuerySpaceId(), () => {
  lastResult.value = null
  showRawOutput.value = false
})

defineExpose({ refreshAll, trigger, busy, triggering, canSync })
</script>

<template>
  <div class="space-y-4">
    <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('knowledge.sync.subtitle') }}</p>

    <div v-if="!canSync" class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
      {{ t('knowledge.sync.noPerm') }}
    </div>

    <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div class="card p-4">
        <p class="text-xs text-gray-500">{{ t('knowledge.sync.batchNo') }}</p>
        <p class="mt-1 truncate font-mono text-sm font-medium">{{ status?.batchNo || '-' }}</p>
      </div>
      <div class="card p-4">
        <p class="text-xs text-gray-500">{{ t('knowledge.sync.lastSync') }}</p>
        <p class="mt-1 text-sm font-medium">{{ status?.lastSyncTime || '-' }}</p>
      </div>
      <div class="card p-4">
        <p class="text-xs text-gray-500">{{ t('knowledge.sync.total') }}</p>
        <p class="mt-1 text-2xl font-semibold">{{ status?.total ?? 0 }}</p>
      </div>
      <div class="card p-4">
        <p class="text-xs text-gray-500">{{ t('knowledge.sync.failCount') }}</p>
        <p class="mt-1 text-2xl font-semibold text-rose-600">{{ status?.failCount ?? 0 }}</p>
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

    <div class="card overflow-hidden">
      <p v-if="logsLoading && !logs.length" class="p-8 text-center text-sm text-gray-400">{{ t('common.loading') }}</p>
      <div v-else class="overflow-x-auto">
        <table class="w-full min-w-[36rem] text-left text-sm">
          <thead class="border-b border-gray-100 bg-gray-50 text-xs text-gray-500 dark:border-white/5 dark:bg-white/5">
            <tr>
              <th class="px-3 py-2">{{ t('knowledge.sync.col.time') }}</th>
              <th class="px-3 py-2">{{ t('knowledge.sync.col.action') }}</th>
              <th class="px-3 py-2">{{ t('knowledge.sync.col.path') }}</th>
              <th class="px-3 py-2">{{ t('knowledge.sync.col.status') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!logs.length">
              <td colspan="4" class="px-3 py-8 text-center text-gray-400">{{ t('knowledge.sync.logsEmpty') }}</td>
            </tr>
            <tr
              v-for="row in logs"
              :key="row.id"
              class="border-b border-gray-50 dark:border-white/5"
            >
              <td class="whitespace-nowrap px-3 py-2 text-xs text-gray-500">{{ row.createTime || '-' }}</td>
              <td class="px-3 py-2"><span class="badge bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">{{ row.action }}</span></td>
              <td class="max-w-[14rem] truncate px-3 py-2 font-mono text-xs">{{ row.sourcePath || '-' }}</td>
              <td class="px-3 py-2 text-xs" :class="row.status === 'fail' ? 'text-rose-500' : 'text-gray-600'">{{ row.status }} {{ row.message ? `· ${row.message}` : '' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="border-t border-gray-100 p-3 dark:border-white/5">
        <AppPagination v-model:page-num="pageNum" v-model:page-size="pageSize" :total="total" />
      </div>
    </div>
  </div>
</template>
