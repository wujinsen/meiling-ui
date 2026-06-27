<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronDown, ChevronRight, FileWarning, Loader2 } from 'lucide-vue-next'
import type { KbWikiLintIssue, KbWikiSpaceLintResult } from '@/types/knowledge'
import {
  groupWikiLintIssues,
  isWikiGovernEnrichable,
  isWikiGovernManualOnly,
  isWikiGovernReviseKind,
  wikiGovernIssueKey,
  type WikiGovernIssueGroup,
} from '@/utils/kbWikiGovern'

const props = defineProps<{
  result: KbWikiSpaceLintResult | null
  loading: boolean
  selectedKeys: Set<string>
}>()

const emit = defineEmits<{
  'update:selectedKeys': [value: Set<string>]
}>()

const { t } = useI18n()

const levelFilter = ref<'all' | 'error' | 'warn' | 'info'>('all')
const groups = ref<WikiGovernIssueGroup[]>([])
const outputOpen = ref(false)

watch(
  () => props.result?.issues,
  (issues) => {
    groups.value = issues?.length ? groupWikiLintIssues(issues) : []
  },
  { immediate: true },
)

const stats = computed(() => props.result?.stats)

const filteredGroups = computed(() => {
  if (levelFilter.value === 'all') return groups.value
  return groups.value
    .map((g) => ({
      ...g,
      issues: g.issues.filter((i) => i.level === levelFilter.value),
    }))
    .filter((g) => g.issues.length > 0)
})

const allVisibleKeys = computed(() => {
  const keys: string[] = []
  for (const g of filteredGroups.value) {
    for (const issue of g.issues) keys.push(wikiGovernIssueKey(issue))
  }
  return keys
})

const allSelected = computed(
  () => allVisibleKeys.value.length > 0 && allVisibleKeys.value.every((k) => props.selectedKeys.has(k)),
)

const selectedCount = computed(() => props.selectedKeys.size)

function toggleGroupOpen(kind: string) {
  const g = groups.value.find((x) => x.kind === kind)
  if (g) g.open = !g.open
}

function isSelected(issue: KbWikiLintIssue) {
  return props.selectedKeys.has(wikiGovernIssueKey(issue))
}

function setSelected(keys: Set<string>) {
  emit('update:selectedKeys', keys)
}

function toggleIssue(issue: KbWikiLintIssue) {
  const key = wikiGovernIssueKey(issue)
  const next = new Set(props.selectedKeys)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  setSelected(next)
}

function toggleGroupSelect(group: WikiGovernIssueGroup) {
  const keys = group.issues.map(wikiGovernIssueKey)
  const allIn = keys.every((k) => props.selectedKeys.has(k))
  const next = new Set(props.selectedKeys)
  if (allIn) keys.forEach((k) => next.delete(k))
  else keys.forEach((k) => next.add(k))
  setSelected(next)
}

function toggleSelectAll() {
  if (allSelected.value) {
    const next = new Set(props.selectedKeys)
    allVisibleKeys.value.forEach((k) => next.delete(k))
    setSelected(next)
    return
  }
  const next = new Set(props.selectedKeys)
  allVisibleKeys.value.forEach((k) => next.add(k))
  setSelected(next)
}

function levelClass(level: KbWikiLintIssue['level']) {
  if (level === 'error') return 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300'
  if (level === 'warn') return 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
  return 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300'
}

function fixHintKind(issue: KbWikiLintIssue) {
  if (isWikiGovernEnrichable(issue)) return 'enrich'
  if (isWikiGovernManualOnly(issue)) return 'manual'
  if (isWikiGovernReviseKind(issue)) return 'revise'
  return 'other'
}
</script>

<template>
  <section class="rounded-xl border border-gray-200 bg-white dark:border-white/10 dark:bg-gray-900/40">
    <header class="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 dark:border-white/5">
      <div>
        <h2 class="text-sm font-semibold text-gray-900 dark:text-white">
          {{ t('knowledge.wikiGovern.lintPanelTitle') }}
        </h2>
        <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
          {{ t('knowledge.wikiGovern.lintPanelHint') }}
        </p>
      </div>
      <div v-if="stats" class="flex flex-wrap gap-2 text-xs">
        <span class="badge bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300">
          {{ t('knowledge.wikiGovern.statsPages', { count: stats.pages ?? 0 }) }}
        </span>
        <span class="badge bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
          {{ t('knowledge.wikiGovern.statsErrors', { count: stats.errors ?? 0 }) }}
        </span>
        <span class="badge bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
          {{ t('knowledge.wikiGovern.statsWarnings', { count: stats.warnings ?? 0 }) }}
        </span>
        <span class="badge bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
          {{ t('knowledge.wikiGovern.statsInfos', { count: stats.infos ?? 0 }) }}
        </span>
      </div>
    </header>

    <div v-if="loading" class="flex items-center justify-center gap-2 py-16 text-sm text-gray-400">
      <Loader2 class="h-5 w-5 animate-spin" /> {{ t('knowledge.wikiGovern.lintRunning') }}
    </div>

    <div v-else-if="!result" class="py-12 text-center text-sm text-gray-400">
      {{ t('knowledge.wikiGovern.lintEmpty') }}
    </div>

    <div v-else-if="!result.issues.length" class="py-12 text-center text-sm text-emerald-600 dark:text-emerald-400">
      {{ t('knowledge.wikiGovern.lintClean') }}
    </div>

    <template v-else>
      <div class="flex flex-wrap items-center gap-3 border-b border-gray-100 px-4 py-2 dark:border-white/5">
        <label class="flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
          <input type="checkbox" class="h-4 w-4 rounded" :checked="allSelected" @change="toggleSelectAll" />
          {{ t('knowledge.wikiGovern.selectAll') }}
        </label>
        <span class="text-xs text-gray-400">{{ t('knowledge.wikiGovern.selectedCount', { count: selectedCount }) }}</span>
        <div class="ml-auto flex flex-wrap gap-1">
          <button
            v-for="opt in (['all', 'error', 'warn', 'info'] as const)"
            :key="opt"
            type="button"
            class="rounded-md px-2 py-0.5 text-xs transition"
            :class="levelFilter === opt ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5'"
            @click="levelFilter = opt"
          >
            {{ t(`knowledge.wikiGovern.level.${opt}`) }}
          </button>
        </div>
      </div>

      <div class="max-h-[28rem] overflow-y-auto divide-y divide-gray-100 dark:divide-white/5">
        <div v-for="group in filteredGroups" :key="group.kind">
          <button
            type="button"
            class="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-white/5"
            @click="toggleGroupOpen(group.kind)"
          >
            <component :is="group.open ? ChevronDown : ChevronRight" class="h-4 w-4 shrink-0 text-gray-400" />
            <span class="font-mono text-xs font-medium text-gray-800 dark:text-gray-100">{{ group.kind }}</span>
            <span class="badge bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300">{{ group.issues.length }}</span>
            <label
              class="ml-auto flex cursor-pointer items-center gap-1.5 text-xs text-gray-500"
              @click.stop
            >
              <input
                type="checkbox"
                class="h-3.5 w-3.5 rounded"
                :checked="group.issues.every((i) => isSelected(i))"
                @change="toggleGroupSelect(group)"
              />
              {{ t('knowledge.wikiGovern.selectGroup') }}
            </label>
          </button>

          <ul v-show="group.open" class="pb-2">
            <li
              v-for="issue in group.issues"
              :key="wikiGovernIssueKey(issue)"
              class="flex items-start gap-3 px-4 py-2 pl-10 hover:bg-gray-50/80 dark:hover:bg-white/[0.02]"
            >
              <input
                type="checkbox"
                class="mt-1 h-4 w-4 shrink-0 rounded"
                :checked="isSelected(issue)"
                @change="toggleIssue(issue)"
              />
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="font-mono text-xs text-indigo-700 dark:text-indigo-300">{{ issue.page }}</span>
                  <span class="badge text-[10px]" :class="levelClass(issue.level)">{{ issue.level }}</span>
                  <span
                    v-if="fixHintKind(issue) === 'enrich'"
                    class="badge bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"
                  >
                    enrich
                  </span>
                  <span
                    v-else-if="fixHintKind(issue) === 'revise'"
                    class="badge bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400"
                  >
                    ai-revise
                  </span>
                  <span
                    v-else-if="fixHintKind(issue) === 'manual'"
                    class="badge bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400"
                  >
                    {{ t('knowledge.wikiGovern.manualOnly') }}
                  </span>
                </div>
                <p v-if="issue.detail" class="mt-0.5 text-xs text-gray-600 dark:text-gray-400">{{ issue.detail }}</p>
                <p v-if="issue.suggest" class="mt-0.5 text-xs text-gray-400">{{ issue.suggest }}</p>
              </div>
            </li>
          </ul>
        </div>
      </div>

      <div
        v-if="result.exitCode != null && result.exitCode !== 0"
        class="border-t border-amber-100 bg-amber-50/60 px-4 py-2 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200"
      >
        <FileWarning class="mr-1 inline h-3.5 w-3.5" />
        {{ t('knowledge.wikiGovern.exitCodeHint', { code: result.exitCode }) }}
      </div>

      <div v-if="result.outputTail" class="border-t border-gray-100 dark:border-white/5">
        <button
          type="button"
          class="flex w-full items-center gap-2 px-4 py-2 text-left text-xs text-gray-500 hover:bg-gray-50 dark:hover:bg-white/5"
          @click="outputOpen = !outputOpen"
        >
          <component :is="outputOpen ? ChevronDown : ChevronRight" class="h-3.5 w-3.5" />
          {{ t('knowledge.wikiGovern.outputTail') }}
        </button>
        <pre
          v-if="outputOpen"
          class="max-h-32 overflow-auto whitespace-pre-wrap border-t border-gray-100 bg-gray-50 px-4 py-2 font-mono text-[11px] text-gray-600 dark:border-white/5 dark:bg-black/20 dark:text-gray-400"
        >{{ result.outputTail }}</pre>
      </div>
    </template>
  </section>
</template>
