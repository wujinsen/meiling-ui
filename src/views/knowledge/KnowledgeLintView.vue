<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { CheckCircle2, FileWarning, Link2Off, Loader2, Play, RefreshCw, ScanLine, Wrench } from 'lucide-vue-next'
import KbSpaceSelector from '@/components/knowledge/KbSpaceSelector.vue'
import KbSyncPanel from '@/components/knowledge/KbSyncPanel.vue'
import SegmentControl from '@/components/ui/SegmentControl.vue'
import AppPagination from '@/components/ui/AppPagination.vue'
import { getKbDocumentApi, getKbLintApi, getKbLintIssuesApi, scanKbLintApi, updateKbLintIssueApi } from '@/api/knowledge'
import { kbWikiEditPath } from '@/router/knowledgeSupplementRoutes'
import { useKbSpace } from '@/composables/useKbSpace'
import { assertAction, guardAction } from '@/composables/useActionPermissions'
import { API_SUCCESS_CODE } from '@/types/api'
import { showToast } from '@/composables/useToast'
import type { KbLintIssue, KbLintIssueStatus, KbLintReport } from '@/types/knowledge'
import { PERM } from '@/constants/permissions'
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination'
import { resolveKbSyncParams } from '@/utils/kbSyncScope'

const { t } = useI18n()
const router = useRouter()
const { selectedSpaceId, selectedSpace, selectedSpaceCode, spaces, setSelectedSpaceCode, ensureSpacesLoaded, kbQuerySpaceId, kbSpaceQuery } = useKbSpace()

const canScan = computed(() => assertAction(PERM.KB_LINT_SCAN))
const canSync = computed(() => assertAction(PERM.KB_SYNC_TRIGGER))
const canTriggerSync = computed(() => canSync.value && resolveKbSyncParams(kbSpaceQuery(), selectedSpace.value) != null)

const activeTab = ref<'lint' | 'sync'>('lint')
const syncPanelRef = ref<InstanceType<typeof KbSyncPanel> | null>(null)
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

const issuesLoading = ref(false)
const issues = ref<KbLintIssue[]>([])
const statusFilter = ref<'' | KbLintIssueStatus>('')
const issuePageNum = ref(1)
const issuePageSize = ref(DEFAULT_PAGE_SIZE)

const pagedIssues = computed(() => {
  const start = (issuePageNum.value - 1) * issuePageSize.value
  return issues.value.slice(start, start + issuePageSize.value)
})

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
    if (res.code === API_SUCCESS_CODE) {
      issues.value = res.data ?? []
      const maxPage = Math.max(1, Math.ceil(issues.value.length / issuePageSize.value))
      if (issuePageNum.value > maxPage) issuePageNum.value = maxPage
    }
  } finally {
    issuesLoading.value = false
  }
}

function onStatusFilterChange() {
  issuePageNum.value = 1
  void loadIssues()
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

const fixingIssueId = ref<string | number | null>(null)

async function fixIssue(issue: KbLintIssue) {
  if (issue.status === 2 || fixingIssueId.value != null) return
  fixingIssueId.value = issue.id
  try {
    let slug = ''
    let spaceId = issue.spaceId ?? kbQuerySpaceId()
    if (issue.documentId != null) {
      const res = await getKbDocumentApi(issue.documentId)
      if (res.code === API_SUCCESS_CODE && res.data?.slug) {
        slug = res.data.slug
        spaceId = res.data.spaceId ?? spaceId
      }
    }
    if (!slug && report.value && issue.detail) {
      const candidates = [...report.value.orphans, ...report.value.noSummary]
      const matched = candidates.find(
        (item) => issue.detail!.includes(item.slug) || issue.detail!.includes(item.title),
      )
      if (matched) slug = matched.slug
    }
    if (!slug) {
      showToast('error', t('knowledge.lint.fixNoSlug'))
      return
    }
    void router.push(kbWikiEditPath(slug, spaceId, {
      issueId: issue.id,
      issueType: issue.issueType,
      issueDetail: issue.detail,
    }))
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('knowledge.lint.fixFailed'))
  } finally {
    fixingIssueId.value = null
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

watch(canSync, (allowed) => {
  if (!allowed && activeTab.value === 'sync') activeTab.value = 'lint'
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
          :disabled="!canTriggerSync || syncPanelRef?.triggering"
          :title="!canTriggerSync ? t('knowledge.sync.needSpace') : undefined"
          @click="syncPanelRef?.trigger()"
        >
          <Loader2 v-if="syncPanelRef?.triggering" class="h-4 w-4 animate-spin" />
          <Play v-else class="h-4 w-4" />
          {{ t('knowledge.sync.trigger') }}
        </button>
      </template>
    </div>

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

      <!-- 已落库问题清单 -->
      <div class="card p-5">
        <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 class="text-sm font-semibold text-gray-700 dark:text-gray-200">{{ t('knowledge.lint.issues') }}</h2>
          <select v-model="statusFilter" class="field-input w-auto py-1 text-sm" @change="onStatusFilterChange">
            <option value="">{{ t('knowledge.lint.statusAll') }}</option>
            <option :value="0">{{ t('knowledge.lint.issueStatus.0') }}</option>
            <option :value="1">{{ t('knowledge.lint.issueStatus.1') }}</option>
            <option :value="2">{{ t('knowledge.lint.issueStatus.2') }}</option>
          </select>
        </div>

        <p v-if="issuesLoading" class="py-8 text-center text-sm text-gray-400">{{ t('common.loading') }}</p>
        <div v-else-if="!issues.length" class="py-8 text-center text-sm text-gray-400">
          <p>{{ t('knowledge.lint.none') }}</p>
          <p
            v-if="report && ((counts?.broken ?? 0) + (counts?.orphans ?? 0) + (counts?.noSummary ?? 0) > 0)"
            class="mt-2 text-xs text-amber-600 dark:text-amber-400"
          >
            {{ t('knowledge.lint.issuesEmptyHint') }}
          </p>
        </div>
        <template v-else>
          <div class="overflow-x-auto rounded-lg border border-gray-100 dark:border-white/5">
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
                <tr v-for="issue in pagedIssues" :key="issue.id">
                  <td class="px-4 py-3 font-mono text-xs text-gray-500">{{ issue.issueType }}</td>
                  <td class="px-4 py-3 text-gray-700 dark:text-gray-200">{{ issue.detail }}</td>
                  <td class="px-4 py-3">
                    <span :class="['badge', STATUS_BADGE[issue.status]]">{{ statusLabel(issue.status) }}</span>
                  </td>
                  <td class="px-4 py-3">
                    <div class="flex justify-end gap-2">
                      <button
                        v-if="issue.status === 0 && issue.documentId != null"
                        type="button"
                        class="btn-ghost px-2 py-1 text-xs text-brand-600 dark:text-brand-400"
                        :disabled="fixingIssueId === issue.id"
                        @click="fixIssue(issue)"
                      >
                        <Loader2 v-if="fixingIssueId === issue.id" class="h-3.5 w-3.5 animate-spin" />
                        <Wrench v-else class="h-3.5 w-3.5" />
                        {{ t('knowledge.lint.fix') }}
                      </button>
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
          <div class="mt-3">
            <AppPagination v-model:page-num="issuePageNum" v-model:page-size="issuePageSize" :total="issues.length" />
          </div>
        </template>
      </div>
    </template>
    </template>
  </div>
</template>
