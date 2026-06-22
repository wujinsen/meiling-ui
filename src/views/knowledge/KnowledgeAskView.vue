<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Loader2, Send, Sparkles, User } from 'lucide-vue-next'
import AppModal from '@/components/ui/AppModal.vue'
import { askKbApi, getKbPageApi } from '@/api/knowledge'
import { API_SUCCESS_CODE } from '@/types/api'
import { showToast } from '@/composables/useToast'
import { renderMarkdown } from '@/utils/markdown'
import type { KbAskResponse, KbCitation, KbPage } from '@/types/knowledge'

type ChatTurn = {
  id: number
  question: string
  result?: KbAskResponse
  loading: boolean
  error?: string
}

const { t } = useI18n()

const question = ref('')
const asking = ref(false)
const turns = ref<ChatTurn[]>([])
const listRef = ref<HTMLElement | null>(null)
let turnId = 0

const previewOpen = ref(false)
const previewLoading = ref(false)
const previewPage = ref<KbPage | null>(null)

const SUGGESTIONS = ['knowledge.ask.sample1', 'knowledge.ask.sample2', 'knowledge.ask.sample3']

async function scrollToBottom() {
  await nextTick()
  if (listRef.value) listRef.value.scrollTop = listRef.value.scrollHeight
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
    const res = await askKbApi({ question: q, topK: 8 })
    if (res.code === API_SUCCESS_CODE && res.data) {
      turn.result = res.data
    } else {
      throw new Error(res.msg || t('knowledge.ask.failed'))
    }
  } catch (e) {
    turn.error = e instanceof Error ? e.message : t('knowledge.ask.failed')
    showToast('error', t('knowledge.ask.failed'))
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
    void openPage(target.dataset.slug)
  }
}

async function openPage(slug: string) {
  previewOpen.value = true
  previewLoading.value = true
  previewPage.value = null
  try {
    const res = await getKbPageApi(slug)
    if (res.code === API_SUCCESS_CODE) previewPage.value = res.data ?? null
  } finally {
    previewLoading.value = false
  }
}

const previewHtml = computed(() => renderMarkdown(previewPage.value?.content))

function citationKey(c: KbCitation) {
  return `${c.docId}-${c.slug}`
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    void ask()
  }
}
</script>

<template>
  <div class="page-stack">
    <div>
      <h1 class="page-title text-xl">{{ t('knowledge.ask.title') }}</h1>
      <p class="page-subtitle">{{ t('knowledge.ask.subtitle') }}</p>
    </div>

    <div class="card flex min-h-[60vh] flex-col p-0">
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
          <!-- 提问 -->
          <div class="flex justify-end">
            <div class="flex max-w-[80%] items-start gap-2">
              <div class="rounded-2xl rounded-tr-sm bg-brand-600 px-4 py-2.5 text-sm text-white">{{ turn.question }}</div>
              <div class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-200 text-gray-500 dark:bg-white/10">
                <User class="h-4 w-4" />
              </div>
            </div>
          </div>

          <!-- 回答 -->
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
                    @click="openPage(c.slug)"
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

    <!-- 引用页预览 -->
    <AppModal :open="previewOpen" :title="previewPage?.title || t('knowledge.ask.citations')" wide @close="previewOpen = false">
      <p v-if="previewLoading" class="py-10 text-center text-sm text-gray-400">{{ t('common.loading') }}</p>
      <div v-else-if="previewPage">
        <p class="mb-2 font-mono text-xs text-gray-400">{{ previewPage.slug }}</p>
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div class="kb-markdown" v-html="previewHtml" />
      </div>
      <p v-else class="py-10 text-center text-sm text-gray-400">{{ t('knowledge.browse.detailEmpty') }}</p>
    </AppModal>
  </div>
</template>
