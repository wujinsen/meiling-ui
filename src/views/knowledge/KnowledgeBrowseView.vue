<script setup lang="ts">
import { computed, nextTick, onMounted, ref, shallowRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ChevronDown, FileText, FoldVertical, Link2, Search, UnfoldVertical } from 'lucide-vue-next'
import KbAccessDenied from '@/components/knowledge/KbAccessDenied.vue'
import KbAttachmentsPanel from '@/components/knowledge/KbAttachmentsPanel.vue'
import KbSpaceSelector from '@/components/knowledge/KbSpaceSelector.vue'
import { getKbIndexApi, getKbPageApi } from '@/api/knowledge'
import { useKbSpace } from '@/composables/useKbSpace'
import { showToast } from '@/composables/useToast'
import { API_SUCCESS_CODE } from '@/types/api'
import { renderMarkdown } from '@/utils/markdown'
import type { KbIndex, KbPage } from '@/types/knowledge'

const LAST_SLUG_KEY = 'kb_last_active_slug'
const pageCache = new Map<string, KbPage>()
const inflightPages = new Map<string, Promise<KbPage | undefined>>()

const { t } = useI18n()
const route = useRoute()
const { selectedSpaceId, selectedSpace, spaces, loadError: spaceLoadError, loading: spaceLoading, ensureSpacesLoaded, kbQuerySpaceId, resolvePageSpaceId } = useKbSpace()

const noAccessibleSpaces = computed(
  () => !spaceLoading.value && spaces.value.length === 0 && !spaceLoadError.value,
)
const accessDeniedMessage = computed(() => {
  const msg = loadError.value || spaceLoadError.value
  if (msg && (msg.includes('无权') || msg.includes('access'))) return msg
  return ''
})

const canEdit = computed(() => selectedSpace.value?.canEdit === true)

const loading = ref(false)
const loadError = ref('')
const detailLoading = ref(false)
const index = ref<KbIndex>({ total: 0, groups: [] })
const keyword = ref('')
const page = ref<KbPage | null>(null)
const activeSlug = ref('')
const openGroups = ref<Record<string, boolean>>({})
const detailRef = ref<HTMLElement | null>(null)
const treeRef = ref<HTMLElement | null>(null)
const contentHtml = shallowRef('')
const attachmentsReady = ref(false)
const slugLookup = ref<Map<string, string>>(new Map())

let openSeq = 0

const filteredGroups = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return index.value.groups
  return index.value.groups
    .map((g) => ({
      ...g,
      items: g.items.filter((it) => {
        const title = it.title.toLowerCase()
        const summary = it.summary?.toLowerCase() ?? ''
        const slug = it.slug.toLowerCase()
        return title.includes(kw) || summary.includes(kw) || slug.includes(kw)
      }),
    }))
    .filter((g) => g.items.length)
})

function readLastActiveSlug() {
  try {
    return sessionStorage.getItem(LAST_SLUG_KEY) ?? ''
  } catch {
    return ''
  }
}

function saveLastActiveSlug(slug: string) {
  try {
    sessionStorage.setItem(LAST_SLUG_KEY, slug)
  } catch {
    /* ignore */
  }
}

function pageCacheKey(slug: string, spaceId?: string) {
  return `${spaceId ?? 'all'}::${slug}`
}

function rebuildSlugLookup(groups: KbIndex['groups']) {
  const map = new Map<string, string>()
  for (const g of groups) {
    for (const it of g.items) {
      map.set(it.slug, it.slug)
      const stem = it.slug.includes('/') ? it.slug.split('/').pop()! : it.slug
      if (!map.has(stem)) map.set(stem, it.slug)
    }
  }
  slugLookup.value = map
}

function resolveSlug(slug: string) {
  return slugLookup.value.get(slug) ?? slug
}

function firstIndexSlug() {
  return index.value.groups.find((g) => g.items.length)?.items[0]?.slug ?? ''
}

function preferredSlug(explicit?: string) {
  if (explicit) return explicit
  if (typeof route.query.slug === 'string' && route.query.slug) return route.query.slug
  return readLastActiveSlug()
}

function scheduleMarkdownRender(content?: string) {
  if (!content) {
    contentHtml.value = ''
    return
  }
  const run = () => {
    contentHtml.value = renderMarkdown(content)
  }
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(run, { timeout: 120 })
  } else {
    requestAnimationFrame(run)
  }
}

function scheduleAttachmentsMount() {
  attachmentsReady.value = false
  const run = () => {
    attachmentsReady.value = true
  }
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(run, { timeout: 240 })
  } else {
    setTimeout(run, 0)
  }
}

watch(
  () => page.value?.content,
  (content) => scheduleMarkdownRender(content),
  { immediate: true },
)

watch(
  () => page.value?.docId,
  (docId) => {
    attachmentsReady.value = false
    if (docId) scheduleAttachmentsMount()
  },
)

const visibleDocCount = computed(() =>
  filteredGroups.value.reduce((sum, g) => sum + g.items.length, 0),
)

const allCollapsed = computed(
  () =>
    filteredGroups.value.length > 0 &&
    filteredGroups.value.every((g) => openGroups.value[g.type] === false),
)

function isGroupOpen(type: string) {
  return openGroups.value[type] !== false
}

function toggleGroup(type: string) {
  openGroups.value[type] = !isGroupOpen(type)
}

function toggleAllGroups() {
  const collapse = !allCollapsed.value
  const next: Record<string, boolean> = { ...openGroups.value }
  for (const g of index.value.groups) next[g.type] = !collapse
  openGroups.value = next
}

/** 展开当前文档所在分组，避免激活项被折叠隐藏 */
function ensureGroupOpenFor(slug: string) {
  for (const g of index.value.groups) {
    if (g.items.some((it) => it.slug === slug)) {
      if (openGroups.value[g.type] === false) openGroups.value[g.type] = true
      return
    }
  }
}

/**
 * 把左侧激活项滚动到目录可视区内——只调整目录容器自身的 scrollTop，
 * 不用 el.scrollIntoView（它会连带滚动整页 window）。
 */
async function scrollActiveIntoView(slug: string) {
  if (!slug) return
  await nextTick()
  const container = treeRef.value
  if (!container) return
  const safeSlug = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(slug) : slug
  const el = container.querySelector(`[data-tree-slug="${safeSlug}"]`) as HTMLElement | null
  if (!el) return
  const cRect = container.getBoundingClientRect()
  const eRect = el.getBoundingClientRect()
  const pad = 8
  if (eRect.top < cRect.top + pad) {
    container.scrollTop += eRect.top - cRect.top - pad
  } else if (eRect.bottom > cRect.bottom - pad) {
    container.scrollTop += eRect.bottom - cRect.bottom + pad
  }
}

watch(activeSlug, (slug) => {
  if (!slug) return
  ensureGroupOpenFor(slug)
  void scrollActiveIntoView(slug)
})

function formatTime(value?: string) {
  return value || '-'
}

async function loadIndex(preferred?: string) {
  loading.value = true
  loadError.value = ''
  const spaceId = kbQuerySpaceId()
  const slugTarget = preferredSlug(preferred)

  try {
    const res = await getKbIndexApi(spaceId)
    if (res.code !== API_SUCCESS_CODE || !res.data) {
      if (res.code !== API_SUCCESS_CODE) loadError.value = res.msg || `接口异常(code=${res.code})`
      return
    }

    index.value = res.data
    rebuildSlugLookup(res.data.groups)

    const slug = slugTarget ? resolveSlug(slugTarget) : firstIndexSlug()
    if (slug && (activeSlug.value !== slug || !page.value)) {
      void openSlug(slug)
    }
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : '加载失败，请确认知识库服务(8090)与网关(21000)已启动'
  } finally {
    loading.value = false
  }
}

async function fetchPage(resolved: string, sid?: string) {
  const cacheKey = pageCacheKey(resolved, sid)
  const cached = pageCache.get(cacheKey)
  if (cached) return cached

  let pending = inflightPages.get(cacheKey)
  if (!pending) {
    pending = (async () => {
      const res = await getKbPageApi(resolved, sid)
      if (res.code === API_SUCCESS_CODE && res.data) {
        pageCache.set(cacheKey, res.data)
        return res.data
      }
      return undefined
    })().finally(() => {
      inflightPages.delete(cacheKey)
    })
    inflightPages.set(cacheKey, pending)
  }
  return pending
}

async function openSlug(slug: string, spaceId?: number | string, scroll = false) {
  if (!slug) return
  const resolved = resolveSlug(slug)
  const sid = resolvePageSpaceId(spaceId)
  const cacheKey = pageCacheKey(resolved, sid)
  const seq = ++openSeq

  activeSlug.value = resolved
  saveLastActiveSlug(resolved)

  const cached = pageCache.get(cacheKey)
  if (cached) {
    page.value = cached
  } else {
    detailLoading.value = true
  }

  try {
    const data = await fetchPage(resolved, sid)
    if (seq !== openSeq) return
    if (data) {
      page.value = data
      // 桌面端左右分栏，详情已在视口内，无需移动整页；
      // 仅窄屏（详情堆叠在目录下方）时滚动到详情顶部。
      if (scroll) {
        await nextTick()
        const stacked =
          typeof window.matchMedia !== 'function' || !window.matchMedia('(min-width: 1280px)').matches
        if (stacked) detailRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    } else if (!cached) {
      showToast('error', t('knowledge.browse.pageNotFound'))
    }
  } catch (e) {
    if (seq === openSeq && !cached) {
      showToast('error', e instanceof Error ? e.message : t('knowledge.browse.pageLoadFailed'))
    }
  } finally {
    if (seq === openSeq) detailLoading.value = false
  }
}

/** 委托点击：正文里的 [[slug]] 站内链接 */
function onContentClick(event: MouseEvent) {
  const target = (event.target as HTMLElement)?.closest('[data-slug]') as HTMLElement | null
  if (target?.dataset.slug) {
    event.preventDefault()
    void openSlug(target.dataset.slug, undefined, true)
  }
}

onMounted(() => {
  void ensureSpacesLoaded()
  const earlySlug = preferredSlug()
  if (earlySlug) {
    void openSlug(earlySlug)
  }
  void loadIndex(earlySlug)
})

watch(selectedSpaceId, () => {
  pageCache.clear()
  inflightPages.clear()
  page.value = null
  activeSlug.value = ''
  contentHtml.value = ''
  attachmentsReady.value = false
  void loadIndex()
})

watch(
  () => route.query.slug,
  (slug) => {
    if (typeof slug === 'string' && slug && slug !== activeSlug.value) void openSlug(slug)
  },
)
</script>

<template>
  <div class="page-stack">
    <div class="flex flex-wrap items-center gap-3">
      <KbSpaceSelector />
    </div>

    <KbAccessDenied
      v-if="noAccessibleSpaces"
      :title="t('knowledge.accessDenied.emptyTitle')"
      :message="t('knowledge.accessDenied.emptyMessage')"
      :hint="t('knowledge.accessDenied.emptyHint')"
    />

    <KbAccessDenied
      v-else-if="accessDeniedMessage"
      :title="t('knowledge.accessDenied.title')"
      :message="accessDeniedMessage"
    />

    <div v-else class="flex flex-col gap-4 xl:flex-row xl:items-start">
      <!-- 左：分组目录树 -->
      <aside class="card w-full p-4 xl:w-[22rem] xl:shrink-0 xl:sticky xl:top-6 xl:self-start">
        <div class="relative mb-2">
          <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input v-model="keyword" type="text" class="field-input pl-9" :placeholder="t('knowledge.browse.searchPlaceholder')" />
        </div>

        <div
          v-if="!loading && !loadError && filteredGroups.length"
          class="mb-2 flex items-center justify-between gap-2"
        >
          <span class="text-xs text-gray-400">{{ t('knowledge.browse.docCount', { count: visibleDocCount }) }}</span>
          <button type="button" class="btn-tree-toggle shrink-0" @click="toggleAllGroups">
            <UnfoldVertical v-if="allCollapsed" class="h-4 w-4 text-gray-400" />
            <FoldVertical v-else class="h-4 w-4 text-gray-400" />
            {{ allCollapsed ? t('common.expandAll') : t('common.collapseAll') }}
          </button>
        </div>

        <p v-if="loading" class="py-8 text-center text-sm text-gray-400">{{ t('common.loading') }}</p>
        <p v-else-if="loadError" class="py-8 text-center text-sm text-red-500">{{ loadError }}</p>
        <p v-else-if="!filteredGroups.length" class="py-8 text-center text-sm text-gray-400">
          {{ keyword.trim() ? t('knowledge.browse.noMatch') : t('knowledge.browse.empty') }}
        </p>

        <div v-else ref="treeRef" class="max-h-[calc(100vh-16rem)] space-y-1 overflow-y-auto pr-1">
          <div v-for="group in filteredGroups" :key="group.type">
            <button
              type="button"
              class="kb-tree-group-header sticky top-0 z-10 flex w-full items-center gap-2 rounded-lg bg-white px-2 py-1.5 text-left text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:bg-[#171a23] dark:text-gray-200 dark:hover:bg-white/5"
              @click="toggleGroup(group.type)"
            >
              <ChevronDown class="h-4 w-4 shrink-0 text-gray-400 transition" :class="!isGroupOpen(group.type) && '-rotate-90'" />
              <span class="flex-1 truncate">{{ group.label }}</span>
              <span class="badge bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400">{{ group.items.length }}</span>
            </button>
            <div v-show="isGroupOpen(group.type)" class="ml-2 space-y-0.5 border-l border-gray-100 pl-2 dark:border-white/10">
              <button
                v-for="item in group.items"
                :key="item.slug"
                type="button"
                :data-tree-slug="item.slug"
                :class="[
                  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition',
                  item.slug === activeSlug
                    ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300'
                    : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/5',
                ]"
                @click="openSlug(item.slug, item.spaceId, true)"
              >
                <FileText class="h-3.5 w-3.5 shrink-0 opacity-70" />
                <span class="truncate">{{ item.title }}</span>
              </button>
            </div>
          </div>
        </div>
      </aside>

      <!-- 右：单页详情 -->
      <div ref="detailRef" class="card relative min-w-0 flex-1 p-6">
        <div
          v-if="detailLoading && !page"
          class="animate-pulse space-y-4 py-2"
          aria-hidden="true"
        >
          <div class="h-7 w-2/3 rounded bg-gray-100 dark:bg-white/10" />
          <div class="h-4 w-1/3 rounded bg-gray-100 dark:bg-white/10" />
          <div class="space-y-2 pt-4">
            <div class="h-4 w-full rounded bg-gray-100 dark:bg-white/10" />
            <div class="h-4 w-full rounded bg-gray-100 dark:bg-white/10" />
            <div class="h-4 w-5/6 rounded bg-gray-100 dark:bg-white/10" />
          </div>
        </div>
        <div v-else-if="!page" class="flex flex-col items-center justify-center py-20 text-gray-400">
          <FileText class="mb-3 h-10 w-10 opacity-40" />
          <p class="text-sm">{{ t('knowledge.browse.detailEmpty') }}</p>
        </div>
        <article v-else :class="detailLoading && 'pointer-events-none opacity-70'">
          <div
            v-if="detailLoading"
            class="absolute inset-x-6 top-6 z-10 h-0.5 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10"
          >
            <div class="h-full w-1/3 animate-pulse rounded-full bg-brand-400" />
          </div>
          <header class="border-b border-gray-100 pb-4 dark:border-white/5">
            <h2 class="text-2xl font-semibold text-gray-900 dark:text-white">{{ page.title }}</h2>
            <div class="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <span class="font-mono text-xs">{{ page.slug }}</span>
              <span v-if="page.kbType">· {{ page.kbType }}</span>
              <span v-if="page.domain">· {{ page.domain }}</span>
              <span>· {{ formatTime(page.updateTime) }}</span>
            </div>
            <div v-if="page.tags?.length" class="mt-3 flex flex-wrap gap-1.5">
              <span v-for="tag in page.tags" :key="tag" class="user-role-tag">{{ tag }}</span>
            </div>
          </header>

          <!-- eslint-disable-next-line vue/no-v-html -->
          <div class="kb-markdown mt-4" @click="onContentClick" v-html="contentHtml" />

          <section
            v-if="page.outLinks?.length || page.backLinks?.length"
            class="mt-6 grid grid-cols-1 gap-4 border-t border-gray-100 pt-4 dark:border-white/5 sm:grid-cols-2"
          >
            <div v-if="page.outLinks?.length">
              <h3 class="mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-200">
                <Link2 class="h-4 w-4" /> {{ t('knowledge.browse.outLinks') }}
              </h3>
              <ul class="space-y-1.5">
                <li v-for="l in page.outLinks" :key="l.slug">
                  <button type="button" class="kb-linkrow" @click="openSlug(l.slug, page?.spaceId, true)">
                    <span class="truncate">{{ l.title }}</span>
                    <span v-if="l.relationType" class="badge bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400">{{ l.relationType }}</span>
                  </button>
                </li>
              </ul>
            </div>
            <div v-if="page.backLinks?.length">
              <h3 class="mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-200">
                <Link2 class="h-4 w-4 -scale-x-100" /> {{ t('knowledge.browse.backLinks') }}
              </h3>
              <ul class="space-y-1.5">
                <li v-for="l in page.backLinks" :key="l.slug">
                  <button type="button" class="kb-linkrow" @click="openSlug(l.slug, page?.spaceId, true)">
                    <span class="truncate">{{ l.title }}</span>
                    <span v-if="l.relationType" class="badge bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400">{{ l.relationType }}</span>
                  </button>
                </li>
              </ul>
            </div>
          </section>

          <KbAttachmentsPanel v-if="attachmentsReady" :document-id="page.docId" :can-edit="canEdit" />
        </article>
      </div>
    </div>
  </div>
</template>
