<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { getBiReportPreviewApi, getBiReportsApi } from '@/api/bi'
import { API_SUCCESS_CODE } from '@/types/api'
import type { BiReport, BiReportPreview } from '@/types/bi'
import { showToast, formatDateTime } from '@/composables/useToast'
import { Download, FileSpreadsheet, BarChart3, Layers } from 'lucide-vue-next'

const { t } = useI18n()

const loading = ref(false)
const previewLoading = ref(false)
const reports = ref<BiReport[]>([])
const selectedId = ref('')
const preview = ref<BiReportPreview | null>(null)

const categories = computed(() => {
  const map = new Map<string, BiReport[]>()
  for (const r of reports.value) {
    const cat = r.categoryKey
    if (!map.has(cat)) map.set(cat, [])
    map.get(cat)!.push(r)
  }
  return [...map.entries()]
})

const selectedReport = computed(() => reports.value.find((r) => r.id === selectedId.value))

const formatIcon = (format: BiReport['format']) => {
  if (format === 'chart') return BarChart3
  if (format === 'mixed') return Layers
  return FileSpreadsheet
}

async function loadReports() {
  loading.value = true
  try {
    const result = await getBiReportsApi()
    if (result.code === API_SUCCESS_CODE && result.data?.length) {
      reports.value = result.data
      selectedId.value = result.data[0].id
      await loadPreview(result.data[0].id)
    }
  } finally {
    loading.value = false
  }
}

async function loadPreview(id: string) {
  selectedId.value = id
  previewLoading.value = true
  try {
    const result = await getBiReportPreviewApi(id)
    preview.value = result.data ?? null
  } finally {
    previewLoading.value = false
  }
}

function exportReport() {
  if (!selectedReport.value) return
  showToast('success', t('reports.exportSuccess', { name: t(selectedReport.value.titleKey) }))
}

onMounted(loadReports)
</script>

<template>
  <div class="page-stack">
    <div class="card flex flex-wrap items-center justify-between gap-3 p-5">
      <div>
        <h1 class="page-title text-xl">{{ t('reports.title') }}</h1>
        <p class="page-subtitle mt-1">{{ t('reports.subtitle') }}</p>
      </div>
      <button type="button" class="btn-primary" :disabled="!selectedReport" @click="exportReport">
        <Download class="h-4 w-4" />
        {{ t('reports.export') }}
      </button>
    </div>

    <div class="grid gap-4 xl:grid-cols-12">
      <div class="card p-4 xl:col-span-4">
        <h2 class="page-title mb-3 text-base">{{ t('reports.catalog') }}</h2>
        <div v-if="loading" class="py-8 text-center text-sm text-gray-500">{{ t('bi.loading') }}</div>
        <div v-else class="space-y-4">
          <div v-for="[catKey, items] in categories" :key="catKey">
            <p class="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">{{ t(catKey) }}</p>
            <div class="space-y-1">
              <button
                v-for="item in items"
                :key="item.id"
                type="button"
                :class="[
                  'flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition',
                  selectedId === item.id
                    ? 'border-brand-300 bg-brand-50 dark:border-brand-500/40 dark:bg-brand-500/10'
                    : 'border-transparent hover:bg-gray-50 dark:hover:bg-white/5',
                ]"
                @click="loadPreview(item.id)"
              >
                <component :is="formatIcon(item.format)" class="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                <div class="min-w-0 flex-1">
                  <p class="truncate font-medium text-gray-900 dark:text-white">{{ t(item.titleKey) }}</p>
                  <p class="truncate text-xs text-gray-500 dark:text-gray-400">{{ t(item.periodKey) }}</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="card p-5 xl:col-span-8">
        <template v-if="selectedReport">
          <div class="mb-4 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 class="page-title">{{ t(selectedReport.titleKey) }}</h2>
              <p class="page-subtitle">{{ t(selectedReport.descKey) }}</p>
            </div>
            <span class="text-xs text-gray-400">
              {{ t('reports.updatedAt', { time: formatDateTime(selectedReport.updatedAt) }) }}
            </span>
          </div>

          <div v-if="previewLoading" class="py-16 text-center text-gray-500">{{ t('bi.loading') }}</div>
          <template v-else-if="preview">
            <p v-if="preview.summary" class="mb-4 rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-600 dark:bg-white/5 dark:text-gray-300">
              {{ t(preview.summary) }}
            </p>
            <div class="overflow-x-auto rounded-lg border border-gray-100 dark:border-white/10">
              <table class="w-full min-w-[480px] text-left text-sm">
                <thead>
                  <tr class="border-b border-gray-100 bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-400 dark:border-white/5 dark:bg-white/5">
                    <th v-for="col in preview.columns" :key="col" class="px-4 py-3">{{ col }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(row, idx) in preview.rows"
                    :key="idx"
                    class="border-b border-gray-50 dark:border-white/5"
                  >
                    <td v-for="col in preview.columns" :key="col" class="px-4 py-2.5 text-gray-700 dark:text-gray-200">
                      {{ row[col] }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>
        </template>
      </div>
    </div>
  </div>
</template>
