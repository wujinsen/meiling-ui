<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Clock, Info, Loader2 } from 'lucide-vue-next'
import { getKbLintScanStatusApi } from '@/api/knowledge'
import { API_SUCCESS_CODE } from '@/types/api'
import type { KbLintScanStatus } from '@/types/knowledge'

const props = defineProps<{
  spaceId?: number | string | null
}>()

const { t, locale } = useI18n()

const loading = ref(false)
const status = ref<KbLintScanStatus | null>(null)

const scheduleBadgeClass = computed(() =>
  status.value?.scheduleEnabled
    ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200'
    : 'border-gray-200 bg-gray-50 text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-400',
)

const scheduleLabel = computed(() =>
  status.value?.scheduleEnabled
    ? t('knowledge.lint.scanStatus.scheduleOn')
    : t('knowledge.lint.scanStatus.scheduleOff'),
)

const scheduleTooltip = computed(() => {
  if (!status.value?.scheduleEnabled) return t('knowledge.lint.scanStatus.scheduleOffHint')
  const cron = status.value.scheduleCron?.trim()
  return cron
    ? t('knowledge.lint.scanStatus.scheduleOnHint', { cron })
    : t('knowledge.lint.scanStatus.scheduleOnHintNoCron')
})

const lastScanLabel = computed(() => {
  const raw = status.value?.lastScanTime?.trim()
  if (!raw) return t('knowledge.lint.scanStatus.neverScanned')
  const d = new Date(raw.includes('T') ? raw : raw.replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) return raw
  const localeTag = locale.value === 'ja' ? 'ja-JP' : locale.value === 'en' ? 'en-US' : 'zh-CN'
  return d.toLocaleString(localeTag, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
})

async function load() {
  loading.value = true
  try {
    const res = await getKbLintScanStatusApi(props.spaceId ?? undefined)
    if (res.code === API_SUCCESS_CODE) status.value = res.data ?? null
  } finally {
    loading.value = false
  }
}

onMounted(() => load())

watch(
  () => props.spaceId,
  () => load(),
)

defineExpose({ refresh: load })
</script>

<template>
  <div
    class="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-blue-200 bg-blue-50/80 px-3 py-2 text-xs text-blue-900 dark:border-blue-500/25 dark:bg-blue-500/10 dark:text-blue-100"
  >
    <Info class="h-4 w-4 shrink-0 opacity-70" />
    <span
      class="inline-flex items-center rounded-full border px-2 py-0.5 font-medium"
      :class="scheduleBadgeClass"
      :title="scheduleTooltip"
    >
      {{ scheduleLabel }}
    </span>
    <span class="inline-flex items-center gap-1 text-blue-800/90 dark:text-blue-100/90">
      <Clock class="h-3.5 w-3.5 shrink-0 opacity-70" />
      {{ t('knowledge.lint.scanStatus.lastScan') }}：{{ lastScanLabel }}
    </span>
    <span
      v-if="status && (status.openIssueCount ?? 0) > 0"
      class="text-blue-800/80 dark:text-blue-100/80"
    >
      {{ t('knowledge.lint.scanStatus.openIssues', { count: status.openIssueCount }) }}
    </span>
    <span class="text-blue-700/70 dark:text-blue-200/60">
      {{ t('knowledge.lint.scanStatus.dbSnapshotHint') }}
    </span>
    <Loader2 v-if="loading" class="ml-auto h-3.5 w-3.5 animate-spin opacity-60" />
  </div>
</template>
