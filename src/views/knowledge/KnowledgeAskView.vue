<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { History, Loader2, Send, Sparkles, ThumbsDown, ThumbsUp, User } from 'lucide-vue-next'
import KbAskScopePanel from '@/components/knowledge/KbAskScopePanel.vue'
import KbDocPreviewModal from '@/components/knowledge/KbDocPreviewModal.vue'
import KbSpaceSelector from '@/components/knowledge/KbSpaceSelector.vue'
import {
  askKbApi,
  feedbackKbAskApi,
  getKbAskHistoryApi,
} from '@/api/knowledge'
import { useKbSpace } from '@/composables/useKbSpace'
import { API_SUCCESS_CODE } from '@/types/api'
import { showToast } from '@/composables/useToast'
import { renderMarkdown } from '@/utils/markdown'
import type { KbAskResponse, KbCitation, KbQaHistory } from '@/types/knowledge'

type ChatTurn = {
  id: number
  question: string
  result?: KbAskResponse
  loading: boolean
  error?: string
  feedback?: number | null
}

const { t } = useI18n()
const router = useRouter()
const { selectedSpaceId, ensureSpacesLoaded, kbQuerySpaceId, resolvePageSpaceId } = useKbSpace()

const crossSpaceAsk = ref(false)
const askSpaceIds = ref<string[]>([])

const question = ref('')
const asking = ref(false)
const turns = ref<ChatTurn[]>([])
const listRef = ref<HTMLElement | null>(null)
let turnId = 0

const showHistory = ref(false)
const historyLoading = ref(false)
const historyItems = ref<KbQaHistory[]>([])

const previewOpen = ref(false)
const previewSlug = ref('')
const previewSpaceId = ref<number | string | undefined>()

const SUGGESTIONS = ['knowledge.ask.sample1', 'knowledge.ask.sample2', 'knowledge.ask.sample3']

async function scrollToBottom() {
  await nextTick()
  if (listRef.value) listRef.value.scrollTop = listRef.value.scrollHeight
}

async function loadHistory() {
  historyLoading.value = true
  try {
    const res = await getKbAskHistoryApi({ spaceId: kbQuerySpaceId(), pageNum: 1, pageSize: 20 })
    if (res.code === API_SUCCESS_CODE && res.data) historyItems.value = res.data.records ?? []
  } finally {
    historyLoading.value = false
  }
}

async function ask(text?: string) {
  const q = (text ?? question.value).trim()
  if (!q || asking.value) return

  const turn: ChatTurn = { id: ++turnId, question: q, loading: true }
  turns.value.push(turn)
  question.value = ''
  asking.value = true
  await scrollToBottom()

  try {
    const payload: import('@/types/knowledge').KbAskRequest = { question: q, topK: 8 }
    if (crossSpaceAsk.value) {
      if (!askSpaceIds.value.length) {
        throw new Error(t('knowledge.ask.crossSpaceEmpty'))
      }
      payload.spaceIds = [...askSpaceIds.value]
    } else {
      const sid = kbQuerySpaceId()
      if (sid != null) payload.spaceId = sid
    }
    const res = await askKbApi(payload)
    if (res.code === API_SUCCESS_CODE && res.data) {
      turn.result = res.data
      turn.feedback = null
      void loadHistory()
    } else {
      throw new Error(res.msg || t('knowledge.ask.failed'))
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : t('knowledge.ask.failed')
    turn.error = msg
    showToast('error', msg)
  } finally {
    turn.loading = false
    asking.value = false
    await scrollToBottom()
  }
}

function answerHtml(turn: ChatTurn) {
  return renderMarkdown(turn.result?.answer)
}

function onAnswerClick(event: MouseEvent) {
  const target = (event.target as HTMLElement)?.closest('[data-slug]') as HTMLElement | null
  if (target?.dataset.slug) {
    event.preventDefault()
    openPage(target.dataset.slug)
  }
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

async function submitFeedback(turn: ChatTurn, useful: 0 | 1) {
  const logId = turn.result?.qaLogId
  if (!logId) return
  try {
    const res = await feedbackKbAskApi(logId, useful)
    if (res.code !== API_SUCCESS_CODE) throw new Error(res.msg || t('knowledge.ask.feedbackFailed'))
    turn.feedback = useful
    showToast('success', t('knowledge.ask.feedbackOk'))
    void loadHistory()
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('knowledge.ask.feedbackFailed'))
  }
}

function restoreFromHistory(item: KbQaHistory) {
  const turn: ChatTurn = {
    id: ++turnId,
    question: item.question,
    loading: false,
    result: {
      answer: item.answer,
      mode: item.mode ?? 'retrieval',
      scope: item.scope,
      provider: item.provider,
      model: item.model,
      citations: item.citations ?? [],
      qaLogId: item.id,
    },
    feedback: item.useful ?? null,
  }
  turns.value.push(turn)
  showHistory.value = false
  void scrollToBottom()
}

function citationKey(c: KbCitation) {
  return `${c.docId}-${c.slug}`
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    void ask()
  }
}

onMounted(async () => {
  await ensureSpacesLoaded()
  await loadHistory()
})

watch(selectedSpaceId, () => loadHistory())
watch(showHistory, (open) => {
  if (open) void loadHistory()
})
</script>

<template>
  <div class="page-stack">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="page-title text-xl">{{ t('knowledge.ask.title') }}</h1>
        <p class="page-subtitle">{{ t('knowledge.ask.subtitle') }}</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button type="button" class="btn-ghost text-sm" @click="showHistory = !showHistory">
          <History class="h-4 w-4" /> {{ t('knowledge.ask.history') }}
        </button>
        <KbSpaceSelector />
      </div>
    </div>

    <div class="flex flex-col gap-4 xl:flex-row xl:items-start">
      <aside
        v-if="showHistory"
        class="card w-full p-4 xl:w-72 xl:shrink-0 xl:sticky xl:top-20 xl:self-start"
      >
        <h2 class="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-100">{{ t('knowledge.ask.history') }}</h2>
        <p v-if="historyLoading" class="py-6 text-center text-sm text-gray-400">{{ t('common.loading') }}</p>
        <p v-else-if="!historyItems.length" class="py-6 text-center text-sm text-gray-400">{{ t('knowledge.ask.historyEmpty') }}</p>
        <ul v-else class="max-h-[60vh] space-y-2 overflow-y-auto">
          <li v-for="item in historyItems" :key="item.id">
            <button
              type="button"
              class="w-full rounded-lg border border-gray-100 px-3 py-2 text-left text-sm transition hover:border-brand-300 dark:border-white/5 dark:hover:border-brand-500/40"
              @click="restoreFromHistory(item)"
            >
              <p class="line-clamp-2 font-medium text-gray-800 dark:text-gray-100">{{ item.question }}</p>
              <p class="mt-1 text-xs text-gray-400">{{ item.createTime }} · {{ item.mode }}</p>
            </button>
          </li>
        </ul>
      </aside>

      <div class="card flex min-h-[60vh] min-w-0 flex-1 flex-col p-0">
        <div ref="listRef" class="flex-1 space-y-6 overflow-y-auto px-6 py-6">
          <div v-if="!turns.length" class="flex h-full flex-col items-center justify-center py-12 text-center">
            <div class="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-500 dark:bg-brand-500/15">
              <Sparkles class="h-7 w-7" />
            </div>
            <p class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('knowledge.ask.emptyTitle') }}</p>
            <p class="mt-1 max-w-md text-sm text-gray-500 dark:text-gray-400">{{ t('knowledge.ask.emptyHint') }}</p>
            <div class="mt-5 flex flex-wrap justify-center gap-2">
              <button
                v-for="key in SUGGESTIONS"
                :key="key"
                type="button"
                class="rounded-full border border-gray-200 px-3 py-1.5 text-sm text-gray-600 transition hover:border-brand-300 hover:text-brand-600 dark:border-white/10 dark:text-gray-300 dark:hover:border-brand-500/40"
                @click="ask(t(key))"
              >
                {{ t(key) }}
              </button>
            </div>
          </div>

          <template v-for="turn in turns" :key="turn.id">
            <div class="flex justify-end">
              <div class="flex max-w-[80%] items-start gap-2">
                <div class="rounded-2xl rounded-tr-sm bg-brand-600 px-4 py-2.5 text-sm text-white">{{ turn.question }}</div>
                <div class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-200 text-gray-500 dark:bg-white/10">
                  <User class="h-4 w-4" />
                </div>
              </div>
            </div>

            <div class="flex justify-start">
              <div class="flex max-w-[88%] items-start gap-2">
                <div class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-500 dark:bg-brand-500/15">
                  <Sparkles class="h-4 w-4" />
                </div>
                <div class="min-w-0">
                  <div v-if="turn.result && !turn.loading" class="mb-1.5 flex flex-wrap items-center gap-1.5">
                    <span
                      class="badge"
                      :class="turn.result.mode === 'generative'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                        : 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'"
                    >{{ t(`knowledge.ask.mode.${turn.result.mode === 'generative' ? 'generative' : 'retrieval'}`) }}</span>
                    <span v-if="turn.result.scope" class="badge bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400">{{ turn.result.scope }}</span>
                    <span v-if="turn.result.model" class="text-[11px] text-gray-400">{{ turn.result.provider }} · {{ turn.result.model }}</span>
                  </div>

                  <div class="rounded-2xl rounded-tl-sm bg-gray-50 px-4 py-3 text-sm dark:bg-white/5">
                    <span v-if="turn.loading" class="inline-flex items-center gap-2 text-gray-400">
                      <Loader2 class="h-4 w-4 animate-spin" /> {{ t('knowledge.ask.thinking') }}
                    </span>
                    <p v-else-if="turn.error" class="text-rose-500">{{ turn.error }}</p>
                    <!-- eslint-disable-next-line vue/no-v-html -->
                    <div v-else class="kb-markdown" @click="onAnswerClick" v-html="answerHtml(turn)" />
                  </div>

                  <div
                    v-if="turn.result?.qaLogId && !turn.loading"
                    class="mt-2 flex items-center gap-2"
                  >
                    <span class="text-xs text-gray-400">{{ t('knowledge.ask.feedback') }}</span>
                    <button
                      type="button"
                      class="rounded-md p-1.5 transition"
                      :class="turn.feedback === 1 ? 'bg-emerald-100 text-emerald-700' : 'text-gray-400 hover:bg-gray-100'"
                      @click="submitFeedback(turn, 1)"
                    >
                      <ThumbsUp class="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      class="rounded-md p-1.5 transition"
                      :class="turn.feedback === 0 ? 'bg-rose-100 text-rose-600' : 'text-gray-400 hover:bg-gray-100'"
                      @click="submitFeedback(turn, 0)"
                    >
                      <ThumbsDown class="h-4 w-4" />
                    </button>
                  </div>

                  <p v-if="turn.result?.scopeReason && !turn.loading" class="mt-1 text-[11px] text-gray-400">
                    {{ turn.result.scopeReason }}
                  </p>

                  <div v-if="turn.result?.citations?.length" class="mt-2 space-y-1.5">
                    <p class="text-xs font-medium text-gray-400">{{ t('knowledge.ask.citations') }}</p>
                    <button
                      v-for="c in turn.result.citations"
                      :key="citationKey(c)"
                      type="button"
                      class="flex w-full items-center justify-between gap-3 rounded-lg border border-gray-100 px-3 py-2 text-left text-sm transition hover:border-brand-300 dark:border-white/5 dark:hover:border-brand-500/40"
                      @click="openPage(c.slug, c.spaceId)"
                    >
                      <div class="min-w-0">
                        <p class="truncate font-medium text-gray-800 dark:text-gray-100">{{ c.title }}</p>
                        <p v-if="c.snippet" class="truncate text-xs text-gray-500 dark:text-gray-400">{{ c.snippet }}</p>
                      </div>
                      <span v-if="c.kbType" class="badge shrink-0 bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">{{ c.kbType }}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>

        <div class="border-t border-gray-100 p-4 dark:border-white/5">
          <KbAskScopePanel v-model="askSpaceIds" v-model:enabled="crossSpaceAsk" class="mb-3" />
          <div class="flex items-end gap-2">
            <textarea
              v-model="question"
              rows="1"
              class="field-input max-h-32 min-h-[44px] flex-1 resize-none"
              :placeholder="t('knowledge.ask.inputPlaceholder')"
              @keydown="onKeydown"
            />
            <button type="button" class="btn-primary h-[44px] shrink-0" :disabled="asking || !question.trim()" @click="ask()">
              <Loader2 v-if="asking" class="h-4 w-4 animate-spin" />
              <Send v-else class="h-4 w-4" />
              {{ t('knowledge.ask.send') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <KbDocPreviewModal
      :open="previewOpen"
      :slug="previewSlug"
      :space-id="previewSpaceId"
      @close="previewOpen = false"
      @open-slug="openInBrowse"
    />
  </div>
</template>
