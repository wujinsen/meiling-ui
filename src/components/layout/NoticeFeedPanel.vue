<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  getNoticeFeedApi,
  getNoticeFeedDetailApi,
  markNoticeFeedReadApi,
} from '@/api/notice'
import { showToast } from '@/composables/useToast'
import { API_SUCCESS_CODE } from '@/types/api'
import type { NoticeBrief, SysNotice } from '@/types/notice'
import { renderMarkdown } from '@/utils/markdown'
import { ArrowLeft, Bell, Loader2 } from 'lucide-vue-next'

const { t } = useI18n()

const rootRef = ref<HTMLElement | null>(null)
const open = ref(false)
const loading = ref(false)
const detailLoading = ref(false)
const items = ref<NoticeBrief[]>([])
const unreadCount = ref(0)
const selectedId = ref<number | string | null>(null)
const detail = ref<SysNotice | null>(null)
const detailHtml = ref('')

const badgeText = computed(() => {
  if (unreadCount.value <= 0) return ''
  return unreadCount.value > 99 ? '99+' : String(unreadCount.value)
})

function formatTime(value?: string | number | null) {
  if (value == null || value === '') return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString()
}

async function refreshFeed(silent = false) {
  if (!silent) loading.value = true
  try {
    const result = await getNoticeFeedApi()
    if (result.code !== API_SUCCESS_CODE || !result.data) {
      throw new Error(result.msg || t('system.noticeFeed.loadFailed'))
    }
    items.value = result.data.list ?? []
    unreadCount.value = result.data.unreadCount ?? 0
  } catch (e) {
    if (!silent) {
      showToast('error', e instanceof Error ? e.message : t('system.noticeFeed.loadFailed'))
    }
  } finally {
    if (!silent) loading.value = false
  }
}

async function openPanel() {
  open.value = true
  selectedId.value = null
  detail.value = null
  detailHtml.value = ''
  await refreshFeed()
  try {
    const result = await markNoticeFeedReadApi()
    if (result.code === API_SUCCESS_CODE) unreadCount.value = 0
  } catch {
    /* non-blocking */
  }
}

function closePanel() {
  open.value = false
  selectedId.value = null
  detail.value = null
  detailHtml.value = ''
}

function togglePanel() {
  if (open.value) closePanel()
  else void openPanel()
}

async function openDetail(item: NoticeBrief) {
  selectedId.value = item.id
  detailLoading.value = true
  try {
    const result = await getNoticeFeedDetailApi(item.id)
    if (result.code !== API_SUCCESS_CODE || !result.data) {
      throw new Error(result.msg || t('system.noticeFeed.loadFailed'))
    }
    detail.value = result.data
    detailHtml.value = renderMarkdown(result.data.noticeContent)
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('system.noticeFeed.loadFailed'))
    selectedId.value = null
  } finally {
    detailLoading.value = false
  }
}

function backToList() {
  selectedId.value = null
  detail.value = null
  detailHtml.value = ''
}

function onDocClick(e: MouseEvent) {
  if (!open.value || !rootRef.value) return
  if (!rootRef.value.contains(e.target as Node)) closePanel()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') closePanel()
}

watch(open, (value) => {
  if (value) document.addEventListener('keydown', onKeydown)
  else document.removeEventListener('keydown', onKeydown)
})

onMounted(async () => {
  document.addEventListener('click', onDocClick)
  await refreshFeed(true)
})

onUnmounted(() => {
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onKeydown)
})

defineExpose({ refreshFeed })
</script>

<template>
  <div ref="rootRef" class="relative">
    <button
      type="button"
      class="relative rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5"
      :aria-expanded="open"
      :aria-label="t('system.noticeFeed.title')"
      @click.stop="togglePanel"
    >
      <Bell class="h-5 w-5" />
      <span
        v-if="badgeText"
        class="absolute -right-0.5 -top-0.5 inline-flex min-h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold leading-none text-white"
      >
        {{ badgeText }}
      </span>
    </button>

    <Transition name="palette">
      <div
        v-if="open"
        class="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-white/10 dark:bg-surface-dark-card"
        @click.stop
      >
        <div class="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-white/5">
          <div class="flex items-center gap-2">
            <button
              v-if="selectedId != null"
              type="button"
              class="rounded p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5"
              :aria-label="t('system.noticeFeed.back')"
              @click="backToList"
            >
              <ArrowLeft class="h-4 w-4" />
            </button>
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
              {{ selectedId != null ? detail?.noticeTitle || t('system.noticeFeed.detail') : t('system.noticeFeed.title') }}
            </h3>
          </div>
        </div>

        <div v-if="selectedId == null" class="max-h-[24rem] overflow-y-auto">
          <div v-if="loading" class="flex items-center justify-center gap-2 px-4 py-10 text-sm text-gray-400">
            <Loader2 class="h-4 w-4 animate-spin" />
            {{ t('system.noticeFeed.loading') }}
          </div>
          <div v-else-if="!items.length" class="px-4 py-10 text-center text-sm text-gray-400">
            {{ t('system.noticeFeed.empty') }}
          </div>
          <ul v-else class="divide-y divide-gray-100 dark:divide-white/5">
            <li v-for="item in items" :key="String(item.id)">
              <button
                type="button"
                class="flex w-full flex-col gap-1 px-4 py-3 text-left transition hover:bg-gray-50 dark:hover:bg-white/5"
                @click="openDetail(item)"
              >
                <div class="flex items-start gap-2">
                  <span
                    v-if="item.unread"
                    class="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500"
                    aria-hidden="true"
                  />
                  <span class="min-w-0 flex-1">
                    <span class="line-clamp-2 text-sm font-medium text-gray-900 dark:text-white">
                      {{ item.noticeTitle }}
                    </span>
                    <span class="mt-1 block text-xs text-gray-500 dark:text-gray-400">
                      {{ formatTime(item.publishTime) }}
                    </span>
                  </span>
                  <span
                    v-if="item.topFlag === 1"
                    class="badge shrink-0 bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300"
                  >
                    {{ t('system.noticeFeed.top') }}
                  </span>
                </div>
              </button>
            </li>
          </ul>
        </div>

        <div v-else class="max-h-[24rem] overflow-y-auto px-4 py-4">
          <div v-if="detailLoading" class="flex items-center justify-center gap-2 py-10 text-sm text-gray-400">
            <Loader2 class="h-4 w-4 animate-spin" />
            {{ t('system.noticeFeed.loading') }}
          </div>
          <template v-else-if="detail">
            <p class="mb-3 text-xs text-gray-500 dark:text-gray-400">{{ formatTime(detail.publishTime) }}</p>
            <div class="kb-markdown" v-html="detailHtml" />
          </template>
        </div>
      </div>
    </Transition>
  </div>
</template>
