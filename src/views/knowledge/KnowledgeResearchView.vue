<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { FileSearch, Loader2, Sparkles, Square } from 'lucide-vue-next'
import KbSpaceScopePicker from '@/components/knowledge/KbSpaceScopePicker.vue'
import KbDocPreviewModal from '@/components/knowledge/KbDocPreviewModal.vue'
import AppSwitch from '@/components/ui/AppSwitch.vue'
import {
  getKbResearchApi,
  startKbResearchApi,
  subscribeKbResearchStream,
} from '@/api/knowledge'
import { buildKbAskScopePayload } from '@/composables/useKbAskScope'
import { useKbSpaceScope } from '@/composables/useKbSpaceScope'
import { useKbSpace } from '@/composables/useKbSpace'
import { useActionPermissions } from '@/composables/useActionPermissions'
import { PERM } from '@/constants/permissions'
import { API_SUCCESS_CODE } from '@/types/api'
import { showToast } from '@/composables/useToast'
import { renderMarkdown } from '@/utils/markdown'
import { useKbMarkdownRender } from '@/composables/useKbMarkdownRender'
import type { KbResearchProgress, KbResearchResult } from '@/types/knowledge'

const { t } = useI18n()
const router = useRouter()
const { resolvePageSpaceId } = useKbSpace()
const { scopeSpaceIds, ensureScopeReady } = useKbSpaceScope()
const { assertAction } = useActionPermissions()

const topic = ref('')
const writeback = ref(false)
const running = ref(false)
const progress = ref<KbResearchProgress | null>(null)
const result = ref<KbResearchResult | null>(null)
const errorMessage = ref('')

const previewOpen = ref(false)
const previewSlug = ref('')
const previewSpaceId = ref<number | string | undefined>()

const reportRef = ref<HTMLElement | null>(null)
const markdownAssetCtx = computed(() => ({
  spaceId: scopeSpaceIds.value[0] ?? '',
  documentSlug: result.value?.slug ?? '',
}))

const reportBody = computed(() => stripFrontmatter(result.value?.reportMd ?? ''))
const reportHtml = computed(() => (reportBody.value ? renderMarkdown(reportBody.value) : ''))
useKbMarkdownRender(reportRef, markdownAssetCtx, reportHtml)

const canWriteback = computed(
  () => assertAction(PERM.KB_INGEST_JOB) && assertAction(PERM.KB_INGEST_COMMIT),
)

const progressPct = computed(() => Math.min(100, Math.max(0, progress.value?.pct ?? 0)))
const showEmpty = computed(() => !running.value && !result.value && !errorMessage.value && !progress.value)

const SAMPLES = [
  'knowledge.research.sample1',
  'knowledge.research.sample2',
  'knowledge.research.sample3',
]

let streamAbort: AbortController | null = null

function stripFrontmatter(md: string): string {
  if (!md.startsWith('---')) return md
  const end = md.indexOf('\n---', 3)
  if (end < 0) return md
  return md.slice(end + 4).trimStart()
}

function phaseLabel(phase?: string) {
  if (!phase) return ''
  const key = `knowledge.research.phase.${phase}`
  const translated = t(key)
  return translated === key ? phase : translated
}

function statusBadgeClass(status?: string) {
  if (status === 'SUCCEEDED') return 'badge-success'
  if (status === 'DEGRADED') return 'badge-warn'
  if (status === 'FAILED') return 'badge-danger'
  return 'badge-muted'
}

function openPage(slug: string, spaceId?: number | string) {
  previewSlug.value = slug
  previewSpaceId.value = resolvePageSpaceId(spaceId)
  previewOpen.value = true
}

function openInBrowse(slug: string, spaceId?: number | string) {
  previewOpen.value = false
  const query: Record<string, string> = { slug }
  if (spaceId != null) query.spaceId = String(spaceId)
  void router.push({ path: '/knowledge/browse', query })
}

function openIngestJob(jobId: number | string) {
  void router.push({ path: '/knowledge/ingest', query: { jobId: String(jobId) } })
}

function onReportClick(event: MouseEvent) {
  const target = (event.target as HTMLElement)?.closest('[data-slug]') as HTMLElement | null
  if (target?.dataset.slug) {
    event.preventDefault()
    openPage(target.dataset.slug)
  }
}

function stopListening() {
  if (!streamAbort) return
  streamAbort.abort()
  streamAbort = null
  running.value = false
  showToast('success', t('knowledge.research.stopped'))
}

async function pollResult(runId: string): Promise<KbResearchResult | null> {
  const res = await getKbResearchApi(runId)
  if (res.code === API_SUCCESS_CODE && res.data?.reportMd) {
    return res.data
  }
  return null
}

async function startResearch(text?: string) {
  const q = (text ?? topic.value).trim()
  if (!q || running.value) return
  if (scopeSpaceIds.value.length === 0) {
    errorMessage.value = t('knowledge.research.needSpace')
    showToast('error', t('knowledge.research.needSpace'))
    return
  }

  topic.value = q
  running.value = true
  errorMessage.value = ''
  progress.value = { phase: 'planner', message: t('knowledge.research.starting'), pct: 0 }
  result.value = null
  streamAbort?.abort()
  streamAbort = new AbortController()

  try {
    const payload = {
      topic: q,
      writeback: canWriteback.value ? writeback.value : false,
      topK: 8,
      ...buildKbAskScopePayload(scopeSpaceIds.value),
    }
    const startRes = await startKbResearchApi(payload)
    if (startRes.code !== API_SUCCESS_CODE || !startRes.data?.runId) {
      throw new Error(startRes.msg || t('knowledge.research.failed'))
    }

    const runId = startRes.data.runId
    let finished = false

    try {
      await subscribeKbResearchStream(
        runId,
        {
          onProgress: (evt) => {
            progress.value = evt
          },
          onComplete: (vo) => {
            finished = true
            result.value = vo
            progress.value = { phase: 'done', message: t('knowledge.research.done'), pct: 100 }
          },
          onError: (msg) => {
            errorMessage.value = msg
          },
        },
        streamAbort.signal,
      )
    } catch (sseErr) {
      if (streamAbort.signal.aborted) return
      const polled = await pollResult(runId)
      if (polled) {
        finished = true
        result.value = polled
        progress.value = { phase: 'done', message: t('knowledge.research.done'), pct: 100 }
      } else {
        throw sseErr
      }
    }

    if (!finished && !streamAbort.signal.aborted) {
      const polled = await pollResult(runId)
      if (polled) {
        result.value = polled
        progress.value = { phase: 'done', message: t('knowledge.research.done'), pct: 100 }
      }
    }

    if (result.value && result.value.status === 'FAILED') {
      throw new Error(
        (result.value.degradeReason === 'GUARD_BLOCK'
          ? result.value.degradeReason
          : null) || t('knowledge.research.failed'),
      )
    }
  } catch (e) {
    if (streamAbort?.signal.aborted) return
    const msg = e instanceof Error ? e.message : t('knowledge.research.failed')
    errorMessage.value = msg
    showToast('error', msg)
  } finally {
    if (!streamAbort?.signal.aborted) {
      running.value = false
    }
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    void startResearch()
  }
}

onMounted(async () => {
  await ensureScopeReady()
})

onBeforeUnmount(() => {
  streamAbort?.abort()
})
</script>

<template>
  <div class="page-stack">
    <header class="mb-1">
      <h1 class="page-title flex items-center gap-2">
        <FileSearch class="h-6 w-6 text-primary-600" />
        {{ t('knowledge.research.title') }}
      </h1>
      <p class="page-subtitle">{{ t('knowledge.research.subtitle') }}</p>
    </header>

    <div class="card space-y-4 p-4">
      <div class="flex flex-wrap items-center gap-3">
        <KbSpaceScopePicker />
        <div
          class="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 dark:border-white/10"
          :title="canWriteback ? undefined : t('knowledge.research.writebackHint')"
        >
          <span class="text-xs text-gray-600 dark:text-gray-300">{{ t('knowledge.research.writeback') }}</span>
          <AppSwitch
            v-model="writeback"
            :disabled="!canWriteback || running"
            :label="t('knowledge.research.writeback')"
          />
        </div>
      </div>

      <textarea
        v-model="topic"
        class="input min-h-[88px] w-full resize-y"
        :placeholder="t('knowledge.research.inputPlaceholder')"
        :disabled="running"
        @keydown="onKeydown"
      />

      <div class="flex flex-wrap items-center gap-2">
        <button type="button" class="btn-primary" :disabled="running || !topic.trim()" @click="startResearch()">
          <Loader2 v-if="running" class="h-4 w-4 animate-spin" />
          <Sparkles v-else class="h-4 w-4" />
          {{ running ? t('knowledge.research.running') : t('knowledge.research.start') }}
        </button>
        <button
          v-if="running"
          type="button"
          class="btn-ghost"
          @click="stopListening"
        >
          <Square class="h-4 w-4" />
          {{ t('knowledge.research.stop') }}
        </button>
        <button
          v-for="key in SAMPLES"
          :key="key"
          type="button"
          class="btn-ghost text-xs"
          :disabled="running"
          @click="startResearch(t(key))"
        >
          {{ t(key) }}
        </button>
      </div>
    </div>

    <div v-if="showEmpty" class="card flex flex-col items-center px-6 py-14 text-center">
      <FileSearch class="mb-3 h-10 w-10 text-gray-300 dark:text-gray-600" />
      <p class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('knowledge.research.emptyTitle') }}</p>
      <p class="mt-1 max-w-md text-sm text-gray-500 dark:text-gray-400">{{ t('knowledge.research.emptyHint') }}</p>
    </div>

    <div v-if="running || progress" class="card p-4">
      <div class="mb-2 flex items-center justify-between gap-2 text-sm">
        <span class="font-medium text-gray-800 dark:text-gray-100">
          {{ phaseLabel(progress?.phase) || t('knowledge.research.progress') }}
          <span v-if="progress?.sectionId" class="ml-2 text-xs font-normal text-gray-500">
            {{ progress.sectionId }}
          </span>
        </span>
        <span class="text-gray-500">{{ progressPct }}%</span>
      </div>
      <div class="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
        <div
          class="h-full rounded-full bg-primary-500 transition-all duration-300"
          :style="{ width: `${progressPct}%` }"
        />
      </div>
      <p v-if="progress?.message" class="mt-2 text-xs text-gray-500 dark:text-gray-400">
        {{ progress.message }}
      </p>
    </div>

    <div
      v-if="errorMessage && !running"
      class="card border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
    >
      {{ errorMessage }}
    </div>

    <div v-if="result" class="grid gap-4 xl:grid-cols-[1fr_280px]">
      <article class="card p-5">
        <div class="mb-4 flex flex-wrap items-center gap-2">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-50">
            {{ result.title || result.topic }}
          </h2>
          <span v-if="result.status" class="badge" :class="statusBadgeClass(result.status)">
            {{ result.status }}
          </span>
          <span v-if="result.degraded" class="badge badge-warn">
            {{ t('knowledge.research.degraded') }}
            <template v-if="result.degradeReason"> · {{ result.degradeReason }}</template>
          </span>
        </div>

        <div
          v-if="reportHtml"
          ref="reportRef"
          class="kb-markdown prose prose-sm max-w-none dark:prose-invert"
          v-html="reportHtml"
          @click="onReportClick"
        />
        <p v-else class="text-sm text-gray-500">{{ t('knowledge.research.noReport') }}</p>

        <div
          v-if="result.unsupportedStatements?.length"
          class="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/40 dark:bg-amber-950/20"
        >
          <h3 class="mb-2 text-sm font-semibold text-amber-900 dark:text-amber-200">
            {{ t('knowledge.research.unsupported') }}
          </h3>
          <ul class="list-disc space-y-1 pl-5 text-xs text-amber-900/90 dark:text-amber-100/90">
            <li v-for="(line, idx) in result.unsupportedStatements" :key="idx">{{ line }}</li>
          </ul>
        </div>
      </article>

      <aside class="card space-y-4 p-4 xl:sticky xl:top-6 xl:self-start">
        <div v-if="result.coverage != null">
          <h3 class="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
            {{ t('knowledge.research.coverage') }}
          </h3>
          <p class="text-2xl font-semibold text-gray-900 dark:text-gray-50">
            {{ Math.round(result.coverage * 100) }}%
          </p>
        </div>

        <div v-if="result.latencyMs">
          <h3 class="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
            {{ t('knowledge.research.latency') }}
          </h3>
          <p class="text-sm text-gray-700 dark:text-gray-200">{{ (result.latencyMs / 1000).toFixed(1) }}s</p>
        </div>

        <div v-if="result.ingestJobId">
          <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            {{ t('knowledge.research.writebackResult') }}
          </h3>
          <button type="button" class="btn-ghost w-full text-left text-sm" @click="openIngestJob(result.ingestJobId!)">
            {{ t('knowledge.research.openIngestJob', { id: result.ingestJobId }) }}
          </button>
          <p v-if="result.outputPath" class="mt-1 break-all text-xs text-gray-500">{{ result.outputPath }}</p>
        </div>

        <div v-if="result.citations?.length">
          <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            {{ t('knowledge.research.citations') }}
          </h3>
          <ul class="max-h-64 space-y-2 overflow-y-auto">
            <li v-for="c in result.citations" :key="c.slug">
              <button
                type="button"
                class="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-white/5"
                @click="openPage(c.slug)"
              >
                <span class="font-medium text-primary-700 dark:text-primary-300">{{ c.title || c.slug }}</span>
                <span class="mt-0.5 block truncate text-xs text-gray-500">{{ c.slug }}</span>
              </button>
            </li>
          </ul>
        </div>
      </aside>
    </div>

    <KbDocPreviewModal
      v-model:open="previewOpen"
      :slug="previewSlug"
      :space-id="previewSpaceId"
      @open-in-browse="openInBrowse"
    />
  </div>
</template>
