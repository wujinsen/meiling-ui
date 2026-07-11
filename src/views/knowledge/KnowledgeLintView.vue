<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { FileWarning, Link2Off, Loader2, Play, RefreshCw, ScanLine } from 'lucide-vue-next'
import KbLintIssuesPanel from '@/components/knowledge/KbLintIssuesPanel.vue'
import KbSpaceSelector from '@/components/knowledge/KbSpaceSelector.vue'
import KbLintScanStatusBar from '@/components/knowledge/KbLintScanStatusBar.vue'
import KbSyncPanel from '@/components/knowledge/KbSyncPanel.vue'
import SegmentControl from '@/components/ui/SegmentControl.vue'
import { getKbLintApi, scanKbLintApi } from '@/api/knowledge'
import { useKbSpace } from '@/composables/useKbSpace'
import { assertAction, guardAction } from '@/composables/useActionPermissions'
import { API_SUCCESS_CODE } from '@/types/api'
import { showToast } from '@/composables/useToast'
import type { KbLintReport } from '@/types/knowledge'
import { PERM } from '@/constants/permissions'
import { resolveKbSyncParams } from '@/utils/kbSyncScope'

const { t } = useI18n()
const route = useRoute()
const { selectedSpaceId, selectedSpace, selectedSpaceCode, spaces, setSelectedSpaceId, setSelectedSpaceCode, ensureSpacesLoaded, kbQuerySpaceId, kbSpaceQuery } = useKbSpace()

const canScan = computed(() => assertAction(PERM.KB_LINT_SCAN))
const canSync = computed(() => assertAction(PERM.KB_SYNC_TRIGGER))
const canTriggerSync = computed(() => canSync.value && resolveKbSyncParams(kbSpaceQuery(), selectedSpace.value) != null)

const activeTab = ref<'lint' | 'sync'>('lint')
const syncPanelRef = ref<InstanceType<typeof KbSyncPanel> | null>(null)
const scanStatusBarRef = ref<InstanceType<typeof KbLintScanStatusBar> | null>(null)
const tabOptions = computed(() => {
  const options: { value: 'lint' | 'sync'; label: string }[] = [
    { value: 'lint', label: t('knowledge.lint.tabLint') },
  ]
  if (canSync.value) {
    options.push({ value: 'sync', label: t('knowledge.lint.tabSync') })
  }
  return options
})

const loading = ref(false)
const scanning = ref(false)
const report = ref<KbLintReport | null>(null)
const issuesPanelRef = ref<InstanceType<typeof KbLintIssuesPanel> | null>(null)

const counts = computed(() => report.value?.counts)

const healthScore = computed(() => {
  const c = report.value?.counts
  if (!c || !c.pages) return null
  const problems = c.broken + c.orphans + c.noSummary
  return Math.max(0, Math.round(100 - (problems / c.pages) * 100))
})

async function loadReport() {
  loading.value = true
  try {
    const res = await getKbLintApi(kbQuerySpaceId())
    if (res.code === API_SUCCESS_CODE) report.value = res.data ?? null
  } finally {
    loading.value = false
  }
}

async function scan() {
  if (!canScan.value) return
  if (!guardAction(PERM.KB_LINT_SCAN)) return
  scanning.value = true
  try {
    const res = await scanKbLintApi(kbQuerySpaceId())
    if (res.code === API_SUCCESS_CODE && res.data) {
      report.value = res.data
      showToast('success', t('knowledge.lint.scanOk'))
      await issuesPanelRef.value?.loadIssues()
      await scanStatusBarRef.value?.refresh()
    } else {
      throw new Error(res.msg || t('knowledge.lint.scanFailed'))
    }
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('knowledge.lint.scanFailed'))
  } finally {
    scanning.value = false
  }
}

function applyRouteQuery() {
  const qSpace = route.query.spaceId
  if (typeof qSpace === 'string' && qSpace.trim()) {
    setSelectedSpaceId(qSpace.trim())
  }
  if (route.query.tab === 'sync' && canSync.value) {
    activeTab.value = 'sync'
  }
}

onMounted(async () => {
  await ensureSpacesLoaded()
  applyRouteQuery()
  await loadReport()
})

watch(selectedSpaceId, async () => {
  if (activeTab.value !== 'lint') return
  await loadReport()
})

watch(canSync, (allowed) => {
  if (!allowed && activeTab.value === 'sync') activeTab.value = 'lint'
  else if (allowed && route.query.tab === 'sync') activeTab.value = 'sync'
})

watch(activeTab, async (tab) => {
  if (tab !== 'sync') return
  await ensureSpacesLoaded()
  if (!selectedSpaceCode.value && spaces.value.length > 0) {
    setSelectedSpaceCode(spaces.value[0].spaceCode)
  }
})
</script>

<template>
  <div class="page-stack">
    <nav class="kb-doc-manage-tabs" :aria-label="t('knowledge.lint.title')">
      <SegmentControl v-model="activeTab" :options="tabOptions" />
    </nav>

    <div class="kb-doc-manage-toolbar">
      <KbSpaceSelector :hide-all-option="activeTab === 'sync'" />
      <template v-if="activeTab === 'lint'">
        <button type="button" class="btn-ghost shrink-0" :disabled="loading" @click="loadReport">
          <RefreshCw class="h-4 w-4" :class="loading && 'animate-spin'" /> {{ t('knowledge.lint.recheck') }}
        </button>
        <button type="button" class="btn-primary shrink-0" :disabled="scanning || !canScan" @click="scan">
          <Loader2 v-if="scanning" class="h-4 w-4 animate-spin" />
          <ScanLine v-else class="h-4 w-4" />
          {{ t('knowledge.lint.scan') }}
        </button>
      </template>
      <template v-else>
        <button
          type="button"
          class="btn-ghost shrink-0"
          :disabled="syncPanelRef?.busy"
          @click="syncPanelRef?.refreshAll()"
        >
          <RefreshCw class="h-4 w-4" :class="syncPanelRef?.busy && 'animate-spin'" /> {{ t('knowledge.sync.refresh') }}
        </button>
        <button
          v-if="canSync"
          type="button"
          class="btn-primary shrink-0"
          :disabled="!canTriggerSync || syncPanelRef?.syncRunning"
          :title="!canTriggerSync ? t('knowledge.sync.needSpace') : syncPanelRef?.syncRunning ? t('knowledge.sync.statusRunning') : undefined"
          @click="syncPanelRef?.trigger()"
        >
          <Loader2 v-if="syncPanelRef?.syncRunning" class="h-4 w-4 animate-spin" />
          <Play v-else class="h-4 w-4" />
          {{ t('knowledge.sync.trigger') }}
        </button>
      </template>
    </div>

    <KbLintScanStatusBar
      v-if="activeTab === 'lint'"
      ref="scanStatusBarRef"
      :space-id="selectedSpaceId"
    />

    <KbSyncPanel v-if="activeTab === 'sync'" ref="syncPanelRef" />

    <template v-else>
    <p v-if="loading && !report" class="card p-16 text-center text-sm text-gray-400">{{ t('common.loading') }}</p>

    <template v-else-if="report">
      <!-- 概览卡片 -->
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div class="card p-4">
          <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('knowledge.lint.score') }}</p>
          <p class="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">{{ healthScore ?? '-' }}<span v-if="healthScore != null" class="text-sm text-gray-400">/100</span></p>
        </div>
        <div class="card p-4">
          <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('knowledge.lint.counts.pages') }}</p>
          <p class="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">{{ counts?.pages ?? 0 }}</p>
        </div>
        <div class="card p-4">
          <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('knowledge.lint.counts.broken') }}</p>
          <p class="mt-1 text-2xl font-semibold text-rose-600 dark:text-rose-400">{{ counts?.broken ?? 0 }}</p>
        </div>
        <div class="card p-4">
          <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('knowledge.lint.counts.orphans') }}</p>
          <p class="mt-1 text-2xl font-semibold text-amber-600 dark:text-amber-400">{{ counts?.orphans ?? 0 }}</p>
        </div>
      </div>

      <!-- 三类问题 -->
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section class="card flex max-h-[22rem] flex-col p-4">
          <h2 class="mb-3 flex items-center gap-1.5 text-sm font-semibold text-rose-600 dark:text-rose-400">
            <Link2Off class="h-4 w-4" /> {{ t('knowledge.lint.broken') }} ({{ report.broken.length }})
          </h2>
          <p v-if="!report.broken.length" class="py-4 text-center text-xs text-gray-400">{{ t('knowledge.lint.none') }}</p>
          <ul v-else class="-mr-1 flex-1 space-y-2 overflow-y-auto pr-1">
            <li v-for="(b, i) in report.broken" :key="i" class="rounded-lg bg-gray-50 px-3 py-2 text-sm dark:bg-white/5">
              <p class="truncate font-medium text-gray-800 dark:text-gray-100">{{ b.title }}</p>
              <p class="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">→ {{ b.target }}</p>
            </li>
          </ul>
        </section>

        <section class="card flex max-h-[22rem] flex-col p-4">
          <h2 class="mb-3 flex items-center gap-1.5 text-sm font-semibold text-amber-600 dark:text-amber-400">
            <FileWarning class="h-4 w-4" /> {{ t('knowledge.lint.orphans') }} ({{ report.orphans.length }})
          </h2>
          <p v-if="!report.orphans.length" class="py-4 text-center text-xs text-gray-400">{{ t('knowledge.lint.none') }}</p>
          <ul v-else class="-mr-1 flex-1 space-y-2 overflow-y-auto pr-1">
            <li v-for="(o, i) in report.orphans" :key="i" class="rounded-lg bg-gray-50 px-3 py-2 text-sm dark:bg-white/5">
              <p class="truncate font-medium text-gray-800 dark:text-gray-100">{{ o.title }}</p>
              <p class="mt-0.5 truncate font-mono text-xs text-gray-400">{{ o.slug }}</p>
            </li>
          </ul>
        </section>

        <section class="card flex max-h-[22rem] flex-col p-4">
          <h2 class="mb-3 flex items-center gap-1.5 text-sm font-semibold text-gray-600 dark:text-gray-300">
            <FileWarning class="h-4 w-4" /> {{ t('knowledge.lint.noSummary') }} ({{ report.noSummary.length }})
          </h2>
          <p v-if="!report.noSummary.length" class="py-4 text-center text-xs text-gray-400">{{ t('knowledge.lint.none') }}</p>
          <ul v-else class="-mr-1 flex-1 space-y-2 overflow-y-auto pr-1">
            <li v-for="(n, i) in report.noSummary" :key="i" class="rounded-lg bg-gray-50 px-3 py-2 text-sm dark:bg-white/5">
              <p class="truncate font-medium text-gray-800 dark:text-gray-100">{{ n.title }}</p>
              <p class="mt-0.5 truncate font-mono text-xs text-gray-400">{{ n.slug }}</p>
            </li>
          </ul>
        </section>
      </div>

      <KbLintIssuesPanel
        ref="issuesPanelRef"
        :space-id="kbQuerySpaceId()"
        :report="report"
      />
    </template>
    </template>
  </div>
</template>
