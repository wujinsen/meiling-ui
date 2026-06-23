<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { CheckCircle2, FileWarning, Link2Off, Loader2, RefreshCw, ScanLine } from 'lucide-vue-next'
import KbSpaceSelector from '@/components/knowledge/KbSpaceSelector.vue'
import KbSyncPanel from '@/components/knowledge/KbSyncPanel.vue'
import SegmentControl from '@/components/ui/SegmentControl.vue'
import { getKbLintApi, getKbLintIssuesApi, scanKbLintApi, updateKbLintIssueApi } from '@/api/knowledge'
import { useKbSpace } from '@/composables/useKbSpace'
import { API_SUCCESS_CODE } from '@/types/api'
import { showToast } from '@/composables/useToast'
import type { KbLintIssue, KbLintIssueStatus, KbLintReport } from '@/types/knowledge'

const { t } = useI18n()
const { selectedSpaceId, ensureSpacesLoaded, kbQuerySpaceId } = useKbSpace()

const activeTab = ref<'lint' | 'sync'>('lint')
const tabOptions = computed(() => [
  { value: 'lint', label: t('knowledge.lint.tabLint') },
  { value: 'sync', label: t('knowledge.lint.tabSync') },
])

const loading = ref(false)
const scanning = ref(false)
const report = ref<KbLintReport | null>(null)

const issuesLoading = ref(false)
const issues = ref<KbLintIssue[]>([])
const statusFilter = ref<'' | KbLintIssueStatus>('')

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
  scanning.value = true
  try {
    const res = await scanKbLintApi(kbQuerySpaceId())
    if (res.code === API_SUCCESS_CODE && res.data) {
      report.value = res.data
      showToast('success', t('knowledge.lint.scanOk'))
      await loadIssues()
    } else {
      throw new Error(res.msg || t('knowledge.lint.scanFailed'))
    }
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('knowledge.lint.scanFailed'))
  } finally {
    scanning.value = false
  }
}

async function loadIssues() {
  issuesLoading.value = true
  try {
    const res = await getKbLintIssuesApi({
      spaceId: kbQuerySpaceId(),
      status: statusFilter.value === '' ? undefined : statusFilter.value,
    })
    if (res.code === API_SUCCESS_CODE) issues.value = res.data ?? []
  } finally {
    issuesLoading.value = false
  }
}

async function setIssueStatus(issue: KbLintIssue, status: KbLintIssueStatus) {
  try {
    const res = await updateKbLintIssueApi(issue.id, status)
    if (res.code !== API_SUCCESS_CODE) throw new Error(res.msg || t('knowledge.lint.updateFailed'))
    showToast('success', t('knowledge.lint.updateOk'))
    await loadIssues()
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('knowledge.lint.updateFailed'))
  }
}

const STATUS_BADGE: Record<KbLintIssueStatus, string> = {
  0: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  1: 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400',
  2: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
}

function statusLabel(status: KbLintIssueStatus) {
  return t(`knowledge.lint.issueStatus.${status}`)
}

onMounted(async () => {
  await ensureSpacesLoaded()
  await loadReport()
  await loadIssues()
})

watch(selectedSpaceId, async () => {
  if (activeTab.value !== 'lint') return
  await loadReport()
  await loadIssues()
})
</script>

<template>
  <div class="page-stack">
    <div class="flex flex-wrap items-end gap-2">
      <KbSpaceSelector />
      <template v-if="activeTab === 'lint'">
        <button type="button" class="btn-ghost shrink-0" :disabled="loading" @click="loadReport">
          <RefreshCw class="h-4 w-4" :class="loading && 'animate-spin'" /> {{ t('knowledge.lint.recheck') }}
        </button>
        <button type="button" class="btn-primary shrink-0" :disabled="scanning" @click="scan">
          <Loader2 v-if="scanning" class="h-4 w-4 animate-spin" />
          <ScanLine v-else class="h-4 w-4" />
          {{ t('knowledge.lint.scan') }}
        </button>
      </template>
    </div>

    <SegmentControl
      :model-value="activeTab"
      :options="tabOptions"
      @update:model-value="activeTab = $event as 'lint' | 'sync'"
    />

    <KbSyncPanel v-if="activeTab === 'sync'" />

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
        <section class="card p-4">
          <h2 class="mb-3 flex items-center gap-1.5 text-sm font-semibold text-rose-600 dark:text-rose-400">
            <Link2Off class="h-4 w-4" /> {{ t('knowledge.lint.broken') }} ({{ report.broken.length }})
          </h2>
          <p v-if="!report.broken.length" class="py-4 text-center text-xs text-gray-400">{{ t('knowledge.lint.none') }}</p>
          <ul v-else class="space-y-2">
            <li v-for="(b, i) in report.broken" :key="i" class="rounded-lg bg-gray-50 px-3 py-2 text-sm dark:bg-white/5">
              <p class="font-medium text-gray-800 dark:text-gray-100">{{ b.title }}</p>
              <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">→ {{ b.target }}</p>
            </li>
          </ul>
        </section>

        <section class="card p-4">
          <h2 class="mb-3 flex items-center gap-1.5 text-sm font-semibold text-amber-600 dark:text-amber-400">
            <FileWarning class="h-4 w-4" /> {{ t('knowledge.lint.orphans') }} ({{ report.orphans.length }})
          </h2>
          <p v-if="!report.orphans.length" class="py-4 text-center text-xs text-gray-400">{{ t('knowledge.lint.none') }}</p>
          <ul v-else class="space-y-2">
            <li v-for="(o, i) in report.orphans" :key="i" class="rounded-lg bg-gray-50 px-3 py-2 text-sm dark:bg-white/5">
              <p class="font-medium text-gray-800 dark:text-gray-100">{{ o.title }}</p>
              <p class="mt-0.5 font-mono text-xs text-gray-400">{{ o.slug }}</p>
            </li>
          </ul>
        </section>

        <section class="card p-4">
          <h2 class="mb-3 flex items-center gap-1.5 text-sm font-semibold text-gray-600 dark:text-gray-300">
            <FileWarning class="h-4 w-4" /> {{ t('knowledge.lint.noSummary') }} ({{ report.noSummary.length }})
          </h2>
          <p v-if="!report.noSummary.length" class="py-4 text-center text-xs text-gray-400">{{ t('knowledge.lint.none') }}</p>
          <ul v-else class="space-y-2">
            <li v-for="(n, i) in report.noSummary" :key="i" class="rounded-lg bg-gray-50 px-3 py-2 text-sm dark:bg-white/5">
              <p class="font-medium text-gray-800 dark:text-gray-100">{{ n.title }}</p>
              <p class="mt-0.5 font-mono text-xs text-gray-400">{{ n.slug }}</p>
            </li>
          </ul>
        </section>
      </div>

      <!-- 已落库问题清单 -->
      <div class="card p-5">
        <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 class="text-sm font-semibold text-gray-700 dark:text-gray-200">{{ t('knowledge.lint.issues') }}</h2>
          <select v-model="statusFilter" class="field-input w-auto py-1 text-sm" @change="loadIssues">
            <option value="">{{ t('knowledge.lint.statusAll') }}</option>
            <option :value="0">{{ t('knowledge.lint.issueStatus.0') }}</option>
            <option :value="1">{{ t('knowledge.lint.issueStatus.1') }}</option>
            <option :value="2">{{ t('knowledge.lint.issueStatus.2') }}</option>
          </select>
        </div>

        <p v-if="issuesLoading" class="py-8 text-center text-sm text-gray-400">{{ t('common.loading') }}</p>
        <p v-else-if="!issues.length" class="py-8 text-center text-sm text-gray-400">{{ t('knowledge.lint.none') }}</p>
        <div v-else class="overflow-x-auto rounded-lg border border-gray-100 dark:border-white/5">
          <table class="w-full min-w-[40rem] text-left text-sm">
            <thead class="bg-gray-50 text-xs uppercase tracking-wide text-gray-400 dark:bg-white/5">
              <tr>
                <th class="px-4 py-3">{{ t('knowledge.lint.col.type') }}</th>
                <th class="px-4 py-3">{{ t('knowledge.lint.col.detail') }}</th>
                <th class="px-4 py-3">{{ t('knowledge.lint.col.status') }}</th>
                <th class="px-4 py-3 text-right">{{ t('knowledge.lint.col.actions') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-white/5">
              <tr v-for="issue in issues" :key="issue.id">
                <td class="px-4 py-3 font-mono text-xs text-gray-500">{{ issue.issueType }}</td>
                <td class="px-4 py-3 text-gray-700 dark:text-gray-200">{{ issue.detail }}</td>
                <td class="px-4 py-3">
                  <span :class="['badge', STATUS_BADGE[issue.status]]">{{ statusLabel(issue.status) }}</span>
                </td>
                <td class="px-4 py-3">
                  <div class="flex justify-end gap-2">
                    <button
                      type="button"
                      class="btn-ghost px-2 py-1 text-xs"
                      :disabled="issue.status === 1"
                      @click="setIssueStatus(issue, 1)"
                    >
                      {{ t('knowledge.lint.ignore') }}
                    </button>
                    <button
                      type="button"
                      class="btn-ghost px-2 py-1 text-xs text-emerald-600 dark:text-emerald-400"
                      :disabled="issue.status === 2"
                      @click="setIssueStatus(issue, 2)"
                    >
                      <CheckCircle2 class="h-3.5 w-3.5" /> {{ t('knowledge.lint.markFixed') }}
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
    </template>
  </div>
</template>
