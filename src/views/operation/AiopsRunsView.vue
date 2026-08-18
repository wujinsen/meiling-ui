<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { listAiopsRunsApi } from '@/api/aiops'
import AiopsStatusBadge from '@/components/aiops/AiopsStatusBadge.vue'
import AiopsSubNav from '@/components/aiops/AiopsSubNav.vue'
import OperationPageHeader from '@/components/operation/OperationPageHeader.vue'
import { showToast } from '@/composables/useToast'
import type { AiopsRunSummary } from '@/types/aiops'
import { ExternalLink, History, RefreshCw, Search, Stethoscope } from 'lucide-vue-next'

const { t } = useI18n()
const router = useRouter()

const loading = ref(false)
const runs = ref<AiopsRunSummary[]>([])
const keyword = ref('')

const filteredRuns = computed(() => {
  const q = keyword.value.trim().toLowerCase()
  if (!q) return runs.value
  return runs.value.filter((run) => {
    const hay = [run.title, run.run_id, run.target, run.status, run.severity, run.created_at]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return hay.includes(q)
  })
})

async function loadRuns() {
  loading.value = true
  try {
    const res = await listAiopsRunsApi(100)
    runs.value = res.runs ?? []
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : String(e))
  } finally {
    loading.value = false
  }
}

function openDiagnosis(runId: string) {
  router.push({ name: 'OperationAiopsDiagnosis', query: { runId } })
}

function goDiagnosis() {
  router.push({ name: 'OperationAiopsDiagnosis' })
}

function severityClass(severity?: string) {
  const s = (severity ?? '').toLowerCase()
  if (s === 'critical' || s === 'high') return 'text-red-600 dark:text-red-400'
  if (s === 'medium' || s === 'warning') return 'text-amber-600 dark:text-amber-400'
  if (s === 'low' || s === 'info') return 'text-blue-600 dark:text-blue-400'
  return 'text-muted-foreground'
}

onMounted(() => {
  void loadRuns()
})
</script>

<template>
  <div class="operation-page space-y-4">
    <OperationPageHeader :title="t('operation.aiopsRuns.title')" :subtitle="t('operation.aiopsRuns.subtitle')">
      <template #toolbar>
        <AiopsSubNav active="history" />
      </template>
      <template #actions>
        <div class="toolbar-actions flex flex-wrap items-center gap-2">
          <button type="button" class="operation-toolbar-action" @click="goDiagnosis">
            <Stethoscope class="h-4 w-4" />
            {{ t('operation.aiopsRuns.openDiagnosis') }}
          </button>
          <button type="button" class="operation-toolbar-refresh" :disabled="loading" @click="loadRuns">
            <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': loading }" />
            {{ t('operation.common.refresh') }}
          </button>
        </div>
      </template>
    </OperationPageHeader>

    <section class="card p-4">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div class="relative min-w-[220px] flex-1 max-w-md">
          <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            v-model="keyword"
            type="search"
            class="form-input w-full pl-9"
            :placeholder="t('operation.aiopsRuns.searchPlaceholder')"
          />
        </div>
        <p class="text-sm text-muted-foreground">
          {{ t('operation.aiopsRuns.runCount', { count: filteredRuns.length }) }}
        </p>
      </div>

      <div v-if="loading" class="aiops-empty py-12">
        <RefreshCw class="h-8 w-8 animate-spin text-muted-foreground" />
        <p class="mt-3 text-sm text-muted-foreground">{{ t('operation.common.loading') }}</p>
      </div>

      <div v-else-if="!filteredRuns.length" class="aiops-empty py-12">
        <div class="aiops-empty-icon"><History class="h-6 w-6" /></div>
        <p class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('operation.aiops.noRuns') }}</p>
        <p class="mt-1 max-w-sm text-xs text-muted-foreground">{{ t('operation.aiopsRuns.emptyHint') }}</p>
        <button type="button" class="btn-primary mt-4 inline-flex items-center gap-2" @click="goDiagnosis">
          <Stethoscope class="h-4 w-4" />
          {{ t('operation.aiopsRuns.openDiagnosis') }}
        </button>
      </div>

      <div v-else class="overflow-x-auto rounded-lg border border-border">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-border bg-muted/30 text-left text-muted-foreground">
              <th class="px-4 py-3 font-medium">{{ t('operation.aiopsRuns.status') }}</th>
              <th class="px-4 py-3 font-medium">{{ t('operation.aiopsRuns.alertTitle') }}</th>
              <th class="px-4 py-3 font-medium">{{ t('operation.aiopsRuns.target') }}</th>
              <th class="px-4 py-3 font-medium">{{ t('operation.aiopsRuns.severity') }}</th>
              <th class="px-4 py-3 font-medium">{{ t('operation.aiopsRuns.createdAt') }}</th>
              <th class="px-4 py-3 font-medium">{{ t('operation.aiopsRuns.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="run in filteredRuns"
              :key="run.run_id"
              class="cursor-pointer border-b border-border/60 transition hover:bg-brand-50/30 dark:hover:bg-brand-500/5"
              @click="openDiagnosis(run.run_id)"
            >
              <td class="px-4 py-3">
                <AiopsStatusBadge :status="run.status" size="md" />
              </td>
              <td class="max-w-xs px-4 py-3">
                <p class="truncate font-medium text-gray-900 dark:text-white">{{ run.title || run.run_id }}</p>
                <p class="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">{{ run.run_id }}</p>
              </td>
              <td class="px-4 py-3 text-muted-foreground">{{ run.target || '—' }}</td>
              <td class="px-4 py-3">
                <span :class="severityClass(run.severity)">{{ run.severity || '—' }}</span>
              </td>
              <td class="px-4 py-3 whitespace-nowrap text-muted-foreground">{{ run.created_at }}</td>
              <td class="px-4 py-3" @click.stop>
                <button type="button" class="btn-action-edit" @click="openDiagnosis(run.run_id)">
                  <ExternalLink class="h-3.5 w-3.5" />
                  {{ t('operation.aiopsRuns.viewDetail') }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>
