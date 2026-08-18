<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import {
  approveAiopsRunApi,
  getAiopsHealthApi,
  getAiopsRunApi,
  listAiopsRunsApi,
  rejectAiopsRunApi,
  startAiopsDiagnoseApi,
  subscribeAiopsStream,
} from '@/api/aiops'
import { listServerApi } from '@/api/operation'
import AiopsHealthChips from '@/components/aiops/AiopsHealthChips.vue'
import AiopsRiskBadge from '@/components/aiops/AiopsRiskBadge.vue'
import AiopsStatusBadge from '@/components/aiops/AiopsStatusBadge.vue'
import AiopsSubNav from '@/components/aiops/AiopsSubNav.vue'
import OperationPageHeader from '@/components/operation/OperationPageHeader.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import FormField from '@/components/ui/FormField.vue'
import { assertAction } from '@/composables/useActionPermissions'
import { showToast } from '@/composables/useToast'
import { PERM } from '@/constants/permissions'
import type {
  AiopsApprovalPayload,
  AiopsHealthStatus,
  AiopsPlanStep,
  AiopsProgressEvent,
  AiopsRunSummary,
  AiopsTraceRow,
} from '@/types/aiops'
import { getStoredUser } from '@/utils/authSession'
import {
  Activity,
  ClipboardList,
  FileText,
  History,
  Play,
  RefreshCw,
  Server,
  Sparkles,
} from 'lucide-vue-next'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const canDiagnose = computed(() => assertAction(PERM.OP_AIOPS_DIAGNOSE))
const canApprove = computed(() => assertAction(PERM.OP_AIOPS_APPROVE))

const flowSteps = computed(() => [
  t('operation.aiops.flowEvidence'),
  t('operation.aiops.flowRootCause'),
  t('operation.aiops.flowPlan'),
  t('operation.aiops.flowApproval'),
  t('operation.aiops.flowExecute'),
  t('operation.aiops.flowReport'),
])

const health = ref<AiopsHealthStatus | null>(null)
const healthLoading = ref(false)
const runs = ref<AiopsRunSummary[]>([])
const runsLoading = ref(false)

const form = reactive({
  title: '',
  target: '',
  service: '',
  description: '',
})

const targetOptions = ref<Array<{ value: string; label: string }>>([])
const diagnosing = ref(false)
const currentRunId = ref('')
const runStatus = ref('idle')
const progressPct = ref(0)
const timeline = ref<Array<{ ts?: string; node?: string; message: string }>>([])

const approvalVisible = ref(false)
const approvalPayload = ref<AiopsApprovalPayload | null>(null)
const pendingSteps = ref<AiopsPlanStep[]>([])
const pickedStepIds = ref<string[]>([])
const approver = ref('')

const reportMarkdown = ref('')
const traceRows = ref<AiopsTraceRow[]>([])
const traceSummary = ref<Record<string, number | undefined>>({})

let streamAbort: AbortController | null = null

const hasActiveRun = computed(() => Boolean(currentRunId.value) || timeline.value.length > 0)

function resetTimeline() {
  timeline.value = []
  progressPct.value = 0
}

function pushTimeline(ev: AiopsProgressEvent) {
  timeline.value.push({
    ts: ev.ts,
    node: ev.node ?? ev.type,
    message: ev.message ?? ev.type,
  })
}

async function loadHealth() {
  healthLoading.value = true
  try {
    health.value = await getAiopsHealthApi()
    const inventory = health.value.inventory_targets ?? []
    const fromInventory = inventory.map((id) => ({ value: id, label: id }))
    if (!form.target && fromInventory.length) {
      form.target = fromInventory[0].value
    }
    if (fromInventory.length) {
      targetOptions.value = fromInventory
    }
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : String(e))
  } finally {
    healthLoading.value = false
  }
}

async function loadTargetsFromServers() {
  try {
    const res = await listServerApi({ pageNum: 1, pageSize: 200 })
    const rows = res.data?.list ?? []
    if (!rows.length) return
    const mapped = rows.map((row) => ({
      value: String(row.serverName ?? row.id ?? ''),
      label: row.serverName ? `${row.serverName} (#${row.id})` : `#${row.id}`,
    }))
    targetOptions.value = mapped
    if (!form.target && mapped.length) form.target = mapped[0].value
  } catch {
    /* inventory fallback already loaded */
  }
}

async function loadRuns() {
  runsLoading.value = true
  try {
    const res = await listAiopsRunsApi(30)
    runs.value = res.runs ?? []
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : String(e))
  } finally {
    runsLoading.value = false
  }
}

function applyApprovalPayload(payload: AiopsApprovalPayload) {
  approvalPayload.value = payload
  pendingSteps.value = payload.steps ?? []
  pickedStepIds.value = pendingSteps.value.map((s) => s.id)
  approvalVisible.value = true
  const user = getStoredUser()
  if (!approver.value && user?.nickName) approver.value = user.nickName
  else if (!approver.value && user?.userName) approver.value = user.userName
}

function applyRunDetail(detail: Awaited<ReturnType<typeof getAiopsRunApi>>, keepTimeline = false) {
  runStatus.value = detail.run?.status ?? 'unknown'
  reportMarkdown.value = detail.values?.report?.markdown ?? ''
  traceRows.value = detail.trace ?? []
  traceSummary.value = (detail.trace_summary ?? {}) as Record<string, number | undefined>
  if (!keepTimeline && detail.values?.progress?.length) {
    timeline.value = (detail.values.progress as Array<{ phase?: string; message?: string; pct?: number }>).map(
      (p) => ({ node: p.phase, message: p.message ?? '', ts: '' }),
    )
    const lastPct = [...(detail.values.progress as Array<{ pct?: number }>)].reverse().find((p) => p.pct)?.pct
    if (lastPct) progressPct.value = lastPct
  }
  if (detail.interrupts?.length) {
    applyApprovalPayload(detail.interrupts[0].value ?? {})
  } else if (!keepTimeline) {
    approvalVisible.value = false
  }
}

async function openRun(runId: string, keepTimeline = false) {
  currentRunId.value = runId
  if (!keepTimeline) {
    resetTimeline()
    approvalVisible.value = false
    reportMarkdown.value = ''
    traceRows.value = []
  }
  try {
    const detail = await getAiopsRunApi(runId)
    applyRunDetail(detail, keepTimeline)
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : String(e))
  }
}

function stopStream() {
  streamAbort?.abort()
  streamAbort = null
}

async function listenRun(runId: string) {
  stopStream()
  streamAbort = new AbortController()
  try {
    await subscribeAiopsStream(
      runId,
      {
        onEvent: (ev) => {
          if (ev.type === 'node') {
            pushTimeline(ev)
            if (ev.pct) progressPct.value = ev.pct
          } else if (ev.type === 'approval_required') {
            runStatus.value = 'awaiting_approval'
            pushTimeline({ ...ev, message: t('operation.aiops.awaitingApproval') })
            if (ev.payload) applyApprovalPayload(ev.payload)
          } else if (ev.type === 'phase_done') {
            runStatus.value = ev.status ?? runStatus.value
            if (ev.status !== 'awaiting_approval') {
              approvalVisible.value = false
              void openRun(runId, true)
            }
          } else if (ev.type === 'error') {
            pushTimeline(ev)
            runStatus.value = 'failed'
          } else {
            pushTimeline(ev)
          }
        },
        onDone: () => {
          void loadRuns()
          void openRun(runId, true)
        },
        onError: (msg) => {
          showToast('error', msg)
          runStatus.value = 'failed'
          void openRun(runId, true)
        },
      },
      streamAbort.signal,
    )
  } catch (e) {
    if ((e as Error).name !== 'AbortError') {
      showToast('error', e instanceof Error ? e.message : String(e))
    }
    await openRun(runId, true)
  }
}

async function startDiagnose() {
  if (!canDiagnose.value) {
    showToast('error', t('operation.aiops.noDiagnosePerm'))
    return
  }
  if (!form.target) {
    showToast('error', t('operation.aiops.targetRequired'))
    return
  }
  diagnosing.value = true
  resetTimeline()
  approvalVisible.value = false
  reportMarkdown.value = ''
  traceRows.value = []
  try {
    const res = await startAiopsDiagnoseApi({
      title: form.title.trim() || t('operation.aiops.defaultTitle'),
      target: form.target,
      service: form.service.trim(),
      description: form.description.trim(),
    })
    currentRunId.value = res.run_id
    runStatus.value = 'running'
    pushTimeline({ type: 'started', message: t('operation.aiops.started', { title: form.title || res.run_id }) })
    await listenRun(res.run_id)
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : String(e))
  } finally {
    diagnosing.value = false
  }
}

async function submitApprove() {
  if (!canApprove.value) {
    showToast('error', t('operation.aiops.noApprovePerm'))
    return
  }
  if (!approver.value.trim()) {
    showToast('error', t('operation.aiops.approverRequired'))
    return
  }
  if (!pickedStepIds.value.length) {
    showToast('error', t('operation.aiops.pickAtLeastOne'))
    return
  }
  approvalVisible.value = false
  runStatus.value = 'executing'
  try {
    await approveAiopsRunApi(currentRunId.value, {
      approver: approver.value.trim(),
      approved_step_ids: [...pickedStepIds.value],
    })
    await listenRun(currentRunId.value)
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : String(e))
    approvalVisible.value = true
  }
}

async function submitReject() {
  if (!canApprove.value) {
    showToast('error', t('operation.aiops.noApprovePerm'))
    return
  }
  approvalVisible.value = false
  try {
    await rejectAiopsRunApi(currentRunId.value, {
      approver: approver.value.trim() || t('operation.aiops.anonymousApprover'),
      comment: t('operation.aiops.rejectedComment'),
    })
    await listenRun(currentRunId.value)
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : String(e))
  }
}

function goHistory() {
  router.push({ name: 'OperationAiopsRuns' })
}

function toggleStep(id: string, checked: boolean) {
  if (checked) {
    if (!pickedStepIds.value.includes(id)) pickedStepIds.value.push(id)
  } else {
    pickedStepIds.value = pickedStepIds.value.filter((x) => x !== id)
  }
}

function applyPrefillFromRoute() {
  const { target, service, title, description } = route.query
  if (typeof target === 'string' && target.trim()) {
    form.target = target.trim()
    if (!targetOptions.value.some((o) => o.value === form.target)) {
      targetOptions.value = [{ value: form.target, label: form.target }, ...targetOptions.value]
    }
  }
  if (typeof service === 'string' && service.trim()) form.service = service.trim()
  if (typeof title === 'string' && title.trim()) form.title = title.trim()
  if (typeof description === 'string' && description.trim()) form.description = description.trim()
}

onMounted(async () => {
  await Promise.all([loadHealth(), loadRuns()])
  await loadTargetsFromServers()
  applyPrefillFromRoute()
  const qRun = route.query.runId
  if (typeof qRun === 'string' && qRun) {
    await openRun(qRun)
  }
})

watch(
  () => [route.query.runId, route.query.target, route.query.service, route.query.title, route.query.description],
  () => {
    applyPrefillFromRoute()
    const runId = route.query.runId
    if (typeof runId === 'string' && runId) void openRun(runId)
  },
)

onBeforeUnmount(() => stopStream())
</script>

<template>
  <div class="operation-page space-y-4">
    <OperationPageHeader :title="t('operation.aiops.title')" :subtitle="t('operation.aiops.subtitle')">
      <template #toolbar>
        <AiopsSubNav active="diagnosis" />
      </template>
      <template #actions>
        <div class="toolbar-actions flex flex-wrap items-center gap-2">
          <AiopsHealthChips :health="health" />
          <button type="button" class="operation-toolbar-action" @click="goHistory">
            <History class="h-4 w-4" />
            {{ t('operation.aiops.openHistory') }}
          </button>
          <button type="button" class="operation-toolbar-refresh" :disabled="healthLoading" @click="loadHealth">
            <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': healthLoading }" />
            {{ t('operation.common.refresh') }}
          </button>
        </div>
      </template>
    </OperationPageHeader>

    <div class="aiops-flow-steps px-1">
      <span v-for="(step, idx) in flowSteps" :key="idx" class="aiops-flow-step">{{ step }}</span>
    </div>

    <div class="grid gap-4 xl:grid-cols-[minmax(280px,340px)_1fr]">
      <div class="space-y-4">
        <section class="card p-4">
          <div class="aiops-section-head">
            <span class="aiops-section-icon"><Sparkles class="h-4 w-4" /></span>
            <span>{{ t('operation.aiops.formTitle') }}</span>
          </div>
          <div class="space-y-3">
            <FormField :label="t('operation.aiops.alertTitle')">
              <input
                v-model="form.title"
                class="form-input w-full"
                :placeholder="t('operation.aiops.alertTitlePlaceholder')"
              />
            </FormField>
            <FormField :label="t('operation.aiops.target')">
              <AppSelect
                v-model="form.target"
                :options="targetOptions"
                :placeholder="t('operation.aiops.targetPlaceholder')"
              />
            </FormField>
            <FormField :label="t('operation.aiops.service')">
              <input v-model="form.service" class="form-input w-full" :placeholder="t('operation.aiops.servicePlaceholder')" />
            </FormField>
            <FormField :label="t('operation.aiops.description')">
              <textarea v-model="form.description" class="form-input min-h-[84px] w-full" rows="3" />
            </FormField>
          </div>
          <button
            type="button"
            class="btn-primary mt-4 inline-flex w-full items-center justify-center gap-2"
            :disabled="diagnosing || !canDiagnose"
            @click="startDiagnose"
          >
            <Play class="h-4 w-4" />
            {{ t('operation.aiops.start') }}
          </button>
        </section>

        <section class="card p-4">
          <div class="mb-3 flex items-center justify-between gap-2">
            <div class="aiops-section-head mb-0">
              <span class="aiops-section-icon"><History class="h-4 w-4" /></span>
              <span>{{ t('operation.aiops.recentRuns') }}</span>
            </div>
            <button type="button" class="operation-toolbar-action" :disabled="runsLoading" @click="loadRuns">
              <RefreshCw class="h-3.5 w-3.5" :class="{ 'animate-spin': runsLoading }" />
            </button>
          </div>
          <ul v-if="runs.length" class="space-y-1">
            <li
              v-for="run in runs"
              :key="run.run_id"
              class="aiops-run-card"
              :class="currentRunId === run.run_id && 'aiops-run-card--active'"
              @click="openRun(run.run_id)"
            >
              <div class="flex items-start justify-between gap-2">
                <p class="min-w-0 flex-1 truncate text-sm font-medium text-gray-900 dark:text-white">
                  {{ run.title || run.run_id }}
                </p>
                <AiopsStatusBadge :status="run.status" />
              </div>
              <div class="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <Server class="h-3 w-3 shrink-0" />
                <span class="truncate">{{ run.target || '—' }}</span>
              </div>
              <p class="mt-0.5 text-[11px] text-muted-foreground">{{ run.created_at }}</p>
            </li>
          </ul>
          <div v-else class="aiops-empty py-8">
            <div class="aiops-empty-icon"><Activity class="h-6 w-6" /></div>
            <p class="text-sm text-muted-foreground">{{ t('operation.aiops.noRuns') }}</p>
          </div>
        </section>
      </div>

      <div class="space-y-4">
        <section class="card p-4">
          <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div class="aiops-section-head mb-0">
              <span class="aiops-section-icon"><Activity class="h-4 w-4" /></span>
              <span>{{ t('operation.aiops.progressTitle') }}</span>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <AiopsStatusBadge :status="runStatus" size="md" />
              <span v-if="currentRunId" class="max-w-[220px] truncate font-mono text-xs text-muted-foreground">{{ currentRunId }}</span>
            </div>
          </div>
          <div class="aiops-progress-track mb-4">
            <div class="aiops-progress-bar" :style="{ width: `${progressPct || (hasActiveRun ? 8 : 0)}%` }" />
          </div>
          <div v-if="timeline.length" class="aiops-timeline max-h-80 overflow-y-auto pr-1">
            <div v-for="(item, idx) in timeline" :key="idx" class="aiops-timeline-item">
              <span class="aiops-timeline-dot" />
              <div class="text-xs text-muted-foreground">
                <span v-if="item.ts">{{ item.ts }}</span>
                <span v-if="item.node" class="ml-2 font-medium text-brand-600 dark:text-brand-400">{{ item.node }}</span>
              </div>
              <p class="mt-0.5 text-sm text-gray-800 dark:text-gray-200">{{ item.message }}</p>
            </div>
          </div>
          <div v-else class="aiops-empty py-10">
            <div class="aiops-empty-icon"><ClipboardList class="h-6 w-6" /></div>
            <p class="max-w-sm text-sm text-muted-foreground">{{ t('operation.aiops.progressEmpty') }}</p>
          </div>
        </section>

        <section v-if="approvalVisible" class="card space-y-4 border-amber-200/80 p-4 dark:border-amber-500/30">
          <div class="aiops-section-head mb-0">
            <span class="aiops-section-icon bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
              <ClipboardList class="h-4 w-4" />
            </span>
            <span>{{ t('operation.aiops.approvalTitle') }}</span>
          </div>
          <div v-if="approvalPayload" class="rounded-lg bg-muted/30 p-3 text-sm text-muted-foreground">
            <p class="mb-1"><strong class="text-foreground">{{ t('operation.aiops.rootCause') }}：</strong>{{ approvalPayload.root_cause || '—' }}</p>
            <p><strong class="text-foreground">{{ t('operation.aiops.planSummary') }}：</strong>{{ approvalPayload.summary || '—' }}</p>
          </div>
          <div v-for="step in pendingSteps" :key="step.id" class="rounded-lg border border-border bg-background p-3">
            <div class="flex flex-wrap items-center gap-2">
              <input
                type="checkbox"
                class="h-4 w-4 cursor-pointer"
                :checked="pickedStepIds.includes(step.id)"
                @change="toggleStep(step.id, ($event.target as HTMLInputElement).checked)"
              />
              <span class="font-medium">{{ step.order }}. {{ step.intent }}</span>
              <AiopsRiskBadge :risk="step.risk" :requires-approval="step.requires_approval" />
            </div>
            <pre class="mt-2 overflow-x-auto rounded bg-muted/40 p-2 text-xs">{{ step.command || `${step.action} ${step.service}` }}</pre>
          </div>
          <div class="flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <input v-model="approver" class="form-input max-w-[200px]" :placeholder="t('operation.aiops.approverPlaceholder')" />
            <button type="button" class="btn-primary" :disabled="!canApprove" @click="submitApprove">
              {{ t('operation.aiops.approve') }}
            </button>
            <button type="button" class="btn-secondary" :disabled="!canApprove" @click="submitReject">
              {{ t('operation.aiops.reject') }}
            </button>
          </div>
        </section>

        <section v-if="reportMarkdown" class="card p-4">
          <div class="aiops-section-head mb-3">
            <span class="aiops-section-icon"><FileText class="h-4 w-4" /></span>
            <span>{{ t('operation.aiops.reportTitle') }}</span>
          </div>
          <pre class="max-h-[460px] overflow-y-auto whitespace-pre-wrap rounded-lg border border-border bg-muted/20 p-4 text-xs leading-relaxed">{{ reportMarkdown }}</pre>
        </section>

        <section v-if="traceRows.length" class="card overflow-x-auto p-4">
          <div class="aiops-section-head mb-3">
            <span class="aiops-section-icon"><Activity class="h-4 w-4" /></span>
            <span>{{ t('operation.aiops.traceTitle') }}</span>
          </div>
          <table class="w-full text-xs">
            <thead>
              <tr class="border-b border-border text-muted-foreground">
                <th class="px-3 py-2 text-left font-medium">{{ t('operation.aiops.trace.node') }}</th>
                <th class="px-3 py-2 text-left font-medium">{{ t('operation.aiops.trace.duration') }}</th>
                <th class="px-3 py-2 text-left font-medium">{{ t('operation.aiops.trace.status') }}</th>
                <th class="px-3 py-2 text-left font-medium">{{ t('operation.aiops.trace.model') }}</th>
                <th class="px-3 py-2 text-left font-medium">{{ t('operation.aiops.trace.tokens') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, idx) in traceRows" :key="idx" class="border-b border-border/60 hover:bg-muted/20">
                <td class="px-3 py-2">{{ row.node }}</td>
                <td class="px-3 py-2 tabular-nums">{{ row.duration_ms ?? 0 }} ms</td>
                <td class="px-3 py-2">{{ row.status }}</td>
                <td class="px-3 py-2">{{ row.provider ? `${row.provider}/${row.model}` : t('operation.aiops.ruleFallback') }}</td>
                <td class="px-3 py-2 tabular-nums">{{ (row.prompt_tokens ?? 0) + (row.completion_tokens ?? 0) }}</td>
              </tr>
            </tbody>
          </table>
        </section>
      </div>
    </div>
  </div>
</template>
