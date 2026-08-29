<script setup lang="ts">
import { computed, nextTick, onMounted, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ChevronDown, ExternalLink, FileText, FoldVertical, Link2, Loader2, Paperclip, Pencil, Search, UnfoldVertical } from 'lucide-vue-next'
import KbAccessDenied from '@/components/knowledge/KbAccessDenied.vue'
import KbAttachmentsPanel from '@/components/knowledge/KbAttachmentsPanel.vue'
import KbDocFilterTabs from '@/components/knowledge/KbDocFilterTabs.vue'
import KbSpaceScopePicker from '@/components/knowledge/KbSpaceScopePicker.vue'
import {
  getKbPageApi,
  locateKbIndexApi,
  normalizeKbPageRecords,
  searchKbDocumentsApi,
  searchKbIndexApi,
} from '@/api/knowledge'
import { assertAction } from '@/composables/useActionPermissions'
import { useKbDocFilter, type KbCategoryFilterId } from '@/composables/useKbDocFilter'
import { useKbMarkdownRender } from '@/composables/useKbMarkdownRender'
import { useKbSpaceScope } from '@/composables/useKbSpaceScope'
import { useKbSpace } from '@/composables/useKbSpace'
import { showToast } from '@/composables/useToast'
import { API_SUCCESS_CODE } from '@/types/api'
import { renderMarkdown } from '@/utils/markdown'
import { toEntityId } from '@/utils/id'
import { toKbSpaceScopeParams } from '@/utils/kbSpaceScope'
import { kbWikiEditPath } from '@/router/knowledgeSupplementRoutes'
import { PERM } from '@/constants/permissions'
import type { KbDocumentListItem, KbIndexGroup, KbIndexItem, KbPage } from '@/types/knowledge'

const LAST_SLUG_KEY = 'kb_last_active_slug'
const GROUP_ITEM_BATCH = 40
const GROUP_FETCH_SIZE = 50
const SEARCH_DEBOUNCE_MS = 300
const pageCache = new Map<string, KbPage>()
const inflightPages = new Map<string, Promise<KbPage | undefined>>()

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { selectedSpace, spaces, loadError: spaceLoadError, loading: spaceLoading, resolvePageSpaceId } = useKbSpace()
const { scopeSpaceIds, ensureScopeReady } = useKbSpaceScope()

const noAccessibleSpaces = computed(
  () => !spaceLoading.value && spaces.value.length === 0 && !spaceLoadError.value,
)
const accessDeniedMessage = computed(() => {
  const msg = loadError.value || spaceLoadError.value
  if (msg && (msg.includes('无权') || msg.includes('access'))) return msg
  return ''
})

/** 附件上传/删除：按当前文档所属空间的 canEdit 判断（「全部空间」时从 page.spaceId 解析） */
const canEditAttachments = computed(() => {
  const pageSpaceId = toEntityId(page.value?.spaceId)
  if (pageSpaceId) {
    const space = spaces.value.find((s) => toEntityId(s.id) === pageSpaceId)
    return space?.canEdit === true
  }
  return selectedSpace.value?.canEdit === true
})

/** Wiki 编辑：需空间 editor + kb:wiki:edit（不再走 MySQL 正文编辑） */
const canWikiEdit = computed(
  () => canEditAttachments.value && assertAction(PERM.KB_WIKI_EDIT) && Boolean(page.value?.slug),
)

const loading = ref(false)
const loadError = ref('')
const detailLoading = ref(false)
const searchIndex = shallowRef<import('@/types/knowledge').KbIndex | null>(null)
const searchLoading = ref(false)
const keyword = ref('')
const docFilter = useKbDocFilter(scopeSpaceIds)
const {
  kbTypeFilters,
  categoryFilters,
  kbTypeChipsMerged,
  kbTypeLoading,
  categoryChipsMerged,
  indexTotal,
  indexLoading,
  hasActiveFilter,
  applySearchParams,
  setKbTypeFilters,
  setCategoryFilters,
  resetFilters,
  reloadFilters,
} = docFilter
const browseItems = ref<KbIndexItem[]>([])
const browseTotal = ref(0)
const browsePageNum = ref(0)
const browseLoading = ref(false)
const browseVisibleLimit = ref(GROUP_ITEM_BATCH)
/** 关键词搜索模式下分组折叠 */
const openGroups = ref<Record<string, boolean>>({})
const groupVisibleLimit = ref<Record<string, number>>({})
const page = ref<KbPage | null>(null)
const activeSlug = ref('')
const detailRef = ref<HTMLElement | null>(null)
const treeRef = ref<HTMLElement | null>(null)
const markdownRootRef = ref<HTMLElement | null>(null)
const contentHtml = shallowRef('')
const slugLookup = ref<Map<string, string>>(new Map())
/** 初次进入恢复上次文档时，不自动把分类锁定到该文档所属分类 */
const suppressAutoCategory = ref(false)

let openSeq = 0
let groupGrowSeq = 0
let fetchBrowseSeq = 0
let searchTimer: ReturnType<typeof setTimeout> | undefined

function groupCount(group: KbIndexGroup) {
  return group.count ?? group.items.length
}

const displayGroups = computed((): KbIndexGroup[] => {
  if (keyword.value.trim() && searchIndex.value) {
    return searchIndex.value.groups
  }
  return []
})

const filteredGroups = computed(() => displayGroups.value.filter((g) => groupCount(g) > 0))

const inSearchMode = computed(() => Boolean(keyword.value.trim() && searchIndex.value))

const visibleBrowseItems = computed(() => browseItems.value.slice(0, browseVisibleLimit.value))

function rebuildSlugLookupFromBrowse() {
  const groups: KbIndexGroup[] = inSearchMode.value
    ? (searchIndex.value?.groups ?? [])
    : [{ type: 'browse', label: '', items: browseItems.value }]
  rebuildSlugLookup(groups)
}

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

function clearLastActiveSlug() {
  try {
    sessionStorage.removeItem(LAST_SLUG_KEY)
  } catch {
    /* ignore */
  }
}

function pageCacheKey(slug: string, spaceId?: string) {
  return `${spaceId ?? 'all'}::${slug}`
}

function rebuildSlugLookup(groups: KbIndexGroup[]) {
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

function registerSlugAliases(slug: string, title?: string) {
  if (!slug) return
  const map = new Map(slugLookup.value)
  map.set(slug, slug)
  const stem = slug.includes('/') ? slug.split('/').pop()! : slug
  if (!map.has(stem)) map.set(stem, slug)
  if (title?.trim() && !map.has(title.trim())) map.set(title.trim(), slug)
  slugLookup.value = map
}

function registerPageLinkAliases(detail?: KbPage | null) {
  if (!detail) return
  registerSlugAliases(detail.slug, detail.title)
  for (const ref of [...(detail.outLinks ?? []), ...(detail.backLinks ?? [])]) {
    registerSlugAliases(ref.slug, ref.title)
  }
}

function firstIndexSlug() {
  if (browseItems.value.length) return browseItems.value[0].slug
  return ''
}

function resolveSlug(slug: string) {
  const direct = slugLookup.value.get(slug)
  if (direct) return direct
  for (const ref of [...(page.value?.outLinks ?? []), ...(page.value?.backLinks ?? [])]) {
    if (ref.slug === slug) return ref.slug
    const stem = ref.slug.includes('/') ? ref.slug.split('/').pop()! : ref.slug
    if (stem === slug || ref.title === slug) return ref.slug
  }
  return slug
}

function preferredSlug(explicit?: string) {
  if (explicit) return explicit
  if (typeof route.query.slug === 'string' && route.query.slug) return route.query.slug
  return readLastActiveSlug()
}

function preferredSpaceId() {
  const q = route.query.spaceId
  if (typeof q === 'string' && q) return q
  if (scopeSpaceIds.value.length === 1) return scopeSpaceIds.value[0]
  return undefined
}

function browseScopeParams() {
  return toKbSpaceScopeParams(scopeSpaceIds.value)
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

watch(
  () => page.value?.content,
  (content) => scheduleMarkdownRender(content),
  { immediate: true },
)

watch(
  () => page.value,
  (detail) => registerPageLinkAliases(detail),
  { immediate: true, deep: true },
)

const visibleDocCount = computed(() => {
  if (keyword.value.trim() && searchIndex.value) return searchIndex.value.total
  if (browseLoading.value) {
    return browseTotal.value || selectedFacetCount.value
  }
  return browseTotal.value
})

/** 加载中占位：以列表 total 为准，不用 facet 求和 */
const selectedFacetCount = computed(() => browseTotal.value || indexTotal.value)

/** 分类为单空间概念：仅在锁定单个空间时可用（跨空间分类会重名/对不上） */
const isSingleSpaceScope = computed(() => {
  if (scopeSpaceIds.value.length === 1) return true
  return scopeSpaceIds.value.length === 0 && spaces.value.length === 1
})

const showFilterAndEmpty = computed(
  () =>
    !browseLoading.value
    && !browseItems.value.length
    && hasActiveFilter.value
    && selectedFacetCount.value > 0,
)

const allCollapsed = computed(
  () =>
    inSearchMode.value &&
    filteredGroups.value.length > 0 &&
    filteredGroups.value.every((g) => openGroups.value[g.type] !== true),
)

function isGroupOpen(type: string) {
  return openGroups.value[type] === true
}

function resetBrowseState() {
  groupGrowSeq++
  resetFilters()
  browseItems.value = []
  browseTotal.value = 0
  browsePageNum.value = 0
  browseVisibleLimit.value = GROUP_ITEM_BATCH
  browseLoading.value = false
  openGroups.value = {}
  groupVisibleLimit.value = {}
  searchIndex.value = null
}

async function onKbTypeFilterChange(value: string[]) {
  setKbTypeFilters(value)
  await reloadBrowseList()
}

async function onCategoryFilterChange(value: KbCategoryFilterId[]) {
  setCategoryFilters(value)
  await reloadBrowseList()
}

async function reloadBrowseList() {
  browsePageNum.value = 0
  browseVisibleLimit.value = GROUP_ITEM_BATCH
  await fetchBrowseList(1)
}

function listItemToIndexItem(doc: KbDocumentListItem): KbIndexItem {
  return {
    id: doc.id,
    slug: doc.slug ?? '',
    title: doc.title,
    summary: doc.summary,
    spaceId: doc.spaceId,
    kbType: doc.kbType,
  }
}

function ensureBrowseItemsRendered(total: number) {
  if (total <= 0) return
  const seq = ++groupGrowSeq
  browseVisibleLimit.value = Math.min(GROUP_ITEM_BATCH, total)
  if (total <= GROUP_ITEM_BATCH) return
  const grow = () => {
    if (seq !== groupGrowSeq) return
    if (browseVisibleLimit.value >= total) return
    browseVisibleLimit.value = Math.min(browseVisibleLimit.value + GROUP_ITEM_BATCH, total)
    if (browseVisibleLimit.value < total) requestAnimationFrame(grow)
  }
  requestAnimationFrame(grow)
}

function hasMoreBrowseItems() {
  if (browseVisibleLimit.value < browseItems.value.length) return true
  return browseItems.value.length < browseTotal.value
}

function loadMoreBrowseItems() {
  if (browseVisibleLimit.value < browseItems.value.length) {
    browseVisibleLimit.value = Math.min(browseVisibleLimit.value + GROUP_ITEM_BATCH, browseItems.value.length)
    return
  }
  if (browseItems.value.length < browseTotal.value) {
    void fetchBrowseList(browsePageNum.value + 1)
  }
}

async function fetchBrowseList(pageNum: number) {
  const seq = ++fetchBrowseSeq
  browseLoading.value = true
  try {
    const params = applySearchParams({
      source: 'kb',
      status: 1,
      pageNum,
      pageSize: GROUP_FETCH_SIZE,
    })
    const res = await searchKbDocumentsApi(params)
    if (seq !== fetchBrowseSeq) return
    if (res.code !== API_SUCCESS_CODE || !res.data) {
      throw new Error(res.msg || t('knowledge.browse.groupLoadFailed'))
    }
    const page = normalizeKbPageRecords<KbDocumentListItem>(res.data)
    const items = page.records.map(listItemToIndexItem)
    const total = page.total

    if (pageNum === 1) {
      browseItems.value = items
    } else {
      const seen = new Set(browseItems.value.map((it) => it.slug))
      for (const it of items) {
        if (!seen.has(it.slug)) browseItems.value.push(it)
      }
    }
    browseTotal.value = total
    browsePageNum.value = pageNum
    rebuildSlugLookupFromBrowse()
    ensureBrowseItemsRendered(browseTotal.value)
  } catch (e) {
    if (seq !== fetchBrowseSeq) return
    if (pageNum === 1) {
      browseItems.value = []
      browseTotal.value = 0
    }
    showToast('error', e instanceof Error ? e.message : t('knowledge.browse.groupLoadFailed'))
  } finally {
    if (seq === fetchBrowseSeq) browseLoading.value = false
  }
}

function visibleGroupItems(group: KbIndexGroup) {
  const limit = groupVisibleLimit.value[group.type] ?? GROUP_ITEM_BATCH
  return group.items.slice(0, limit)
}

function hasMoreGroupItems(group: KbIndexGroup) {
  const limit = groupVisibleLimit.value[group.type] ?? GROUP_ITEM_BATCH
  return limit < group.items.length
}

function loadMoreGroupItems(group: KbIndexGroup) {
  const cur = groupVisibleLimit.value[group.type] ?? GROUP_ITEM_BATCH
  groupVisibleLimit.value[group.type] = Math.min(cur + GROUP_ITEM_BATCH, group.items.length)
}

function toggleGroup(type: string) {
  openGroups.value[type] = !openGroups.value[type]
}

function toggleAllGroups() {
  const collapse = !allCollapsed.value
  if (collapse) {
    openGroups.value = {}
    groupVisibleLimit.value = {}
    return
  }
  const next: Record<string, boolean> = {}
  for (const g of filteredGroups.value) {
    next[g.type] = true
    ensureGroupItemsRendered(g.type, g.items.length)
  }
  openGroups.value = next
}

function ensureGroupItemsRendered(type: string, total: number) {
  if (total <= 0) return
  groupVisibleLimit.value[type] = Math.min(GROUP_ITEM_BATCH, total)
}

/** 定位文档所在分类并加载列表 */
async function ensureCategoryForSlug(slug: string) {
  if (inSearchMode.value) {
    for (const g of searchIndex.value?.groups ?? []) {
      if (g.items.some((it) => it.slug === slug) && !isGroupOpen(g.type)) {
        openGroups.value = { ...openGroups.value, [g.type]: true }
      }
    }
    return
  }
  // 初次进入（恢复上次文档）不自动锁定分类，保持「全部」
  if (suppressAutoCategory.value) return
  // 体裁筛选模式下不因正文链接自动改分类，避免与 kbType AND 冲突
  if (kbTypeFilters.value.length > 0) return
  try {
    const res = await locateKbIndexApi(slug, browseScopeParams())
    if (res.code === API_SUCCESS_CODE && res.data) {
      const located = res.data
      const cat: KbCategoryFilterId =
        located.type === 'uncategorized' ? 'uncategorized' : located.type
      const next = [cat]
      if (JSON.stringify(categoryFilters.value) !== JSON.stringify(next)) {
        setCategoryFilters(next)
        await fetchBrowseList(1)
      }
      if (!browseItems.value.some((it) => it.slug === located.item.slug)) {
        browseItems.value = [located.item, ...browseItems.value]
        rebuildSlugLookupFromBrowse()
      }
    }
  } catch {
    /* ignore */
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
  void ensureCategoryForSlug(slug)
  void scrollActiveIntoView(slug)
})

watch(keyword, (kw) => {
  if (searchTimer) clearTimeout(searchTimer)
  const trimmed = kw.trim()
  if (!trimmed) {
    searchIndex.value = null
    searchLoading.value = false
    return
  }
  searchTimer = setTimeout(() => {
    void runIndexSearch(trimmed)
  }, SEARCH_DEBOUNCE_MS)
})

async function runIndexSearch(q: string) {
  searchLoading.value = true
  try {
    const res = await searchKbIndexApi(q, browseScopeParams(), 200)
    if (res.code !== API_SUCCESS_CODE || !res.data) return
    if (keyword.value.trim() !== q) return
    searchIndex.value = res.data
    rebuildSlugLookup(res.data.groups)
    const next = { ...openGroups.value }
    let changed = false
    for (const g of res.data.groups) {
      if (g.items.length && !isGroupOpen(g.type)) {
        next[g.type] = true
        changed = true
        ensureGroupItemsRendered(g.type, g.items.length)
      }
    }
    if (changed) openGroups.value = next
  } finally {
    searchLoading.value = false
  }
}

function formatTime(value?: string) {
  return value || '-'
}

async function resolveInitialSlug(slugTarget: string, explicitSpaceId?: string) {
  const scope = explicitSpaceId
    ? { spaceId: explicitSpaceId }
    : browseScopeParams()
  const pageSpaceId = explicitSpaceId ?? preferredSpaceId()
  if (slugTarget) {
    const resolved = resolveSlug(slugTarget)
    try {
      const res = await locateKbIndexApi(slugTarget, scope)
      if (res.code === API_SUCCESS_CODE && res.data) {
        const located = res.data
        const cat: KbCategoryFilterId =
          located.type === 'uncategorized' ? 'uncategorized' : located.type
        if (!suppressAutoCategory.value) {
          setCategoryFilters([cat])
        }
        await fetchBrowseList(1)
        if (!browseItems.value.some((it) => it.slug === located.item.slug)) {
          browseItems.value = [located.item, ...browseItems.value]
          rebuildSlugLookupFromBrowse()
        }
      }
    } catch {
      /* ignore */
    }
    const pageData = await fetchPage(resolved, pageSpaceId)
    if (pageData) return resolved
    clearLastActiveSlug()
  }
  if (!browseItems.value.length) {
    await fetchBrowseList(1)
  }
  return firstIndexSlug()
}

async function loadIndex(preferred?: string) {
  loading.value = true
  loadError.value = ''
  const slugTarget = preferredSlug(preferred)
  const spaceId = preferredSpaceId()
  const explicitSlug =
    !!preferred || (typeof route.query.slug === 'string' && !!route.query.slug)
  suppressAutoCategory.value = !!slugTarget && !explicitSlug

  try {
    resetBrowseState()
    await reloadFilters()

    const slug = await resolveInitialSlug(slugTarget, spaceId)
    if (slug && (activeSlug.value !== slug || !page.value)) {
      await openSlug(slug, spaceId, false, { silent: true })
    }
    if (!inSearchMode.value && !browseItems.value.length) {
      await fetchBrowseList(1)
    }
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : '加载失败，请确认知识库服务(28104)与网关(28100)已启动'
  } finally {
    suppressAutoCategory.value = false
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
        pageCache.set(pageCacheKey(res.data.slug, sid), res.data)
        if (resolved !== res.data.slug) {
          pageCache.set(pageCacheKey(resolved, sid), res.data)
        }
        registerPageLinkAliases(res.data)
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

type OpenSlugOptions = { silent?: boolean }

async function openSlug(
  slug: string,
  spaceId?: number | string,
  scroll = false,
  options?: OpenSlugOptions,
) {
  if (!slug) return false
  const resolved = resolveSlug(slug)
  const sid = resolvePageSpaceId(spaceId)
  const cacheKey = pageCacheKey(resolved, sid)
  const seq = ++openSeq

  activeSlug.value = resolved

  const cached = pageCache.get(cacheKey)
  if (cached) {
    page.value = cached
    saveLastActiveSlug(resolved)
  } else {
    detailLoading.value = true
  }

  try {
    const data = await fetchPage(resolved, sid)
    if (seq !== openSeq) return false
    if (data) {
      page.value = data
      saveLastActiveSlug(resolved)
      // 桌面端左右分栏，详情已在视口内，无需移动整页；
      // 仅窄屏（详情堆叠在目录下方）时滚动到详情顶部。
      if (scroll) {
        await nextTick()
        const stacked =
          typeof window.matchMedia !== 'function' || !window.matchMedia('(min-width: 1280px)').matches
        if (stacked) detailRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
      return true
    }
    if (!cached) {
      activeSlug.value = ''
      page.value = null
      if (resolved === readLastActiveSlug()) clearLastActiveSlug()
      if (!options?.silent) {
        showToast('error', t('knowledge.browse.pageNotFound'))
      }
    }
    return false
  } catch (e) {
    if (seq === openSeq && !cached) {
      activeSlug.value = ''
      page.value = null
      if (!options?.silent) {
        showToast('error', e instanceof Error ? e.message : t('knowledge.browse.pageLoadFailed'))
      }
    }
    return false
  } finally {
    if (seq === openSeq) detailLoading.value = false
  }
}

/** 委托点击：正文里的 [[slug]] 站内链接 */
function onContentClick(event: MouseEvent) {
  const target = (event.target as HTMLElement)?.closest('[data-slug]') as HTMLElement | null
  if (target?.dataset.slug) {
    event.preventDefault()
    void openSlug(target.dataset.slug, page.value?.spaceId ?? preferredSpaceId(), true)
  }
}

function openWikiEdit() {
  const slug = page.value?.slug
  if (!slug) return
  void router.push(kbWikiEditPath(slug, page.value?.spaceId, { documentId: page.value?.docId }))
}

function openWikiEditAttachments() {
  openWikiEdit()
}

const browseReady = ref(false)

const markdownAssetCtx = computed(() => ({
  documentSlug: page.value?.slug ?? activeSlug.value,
  spaceId: page.value?.spaceId,
}))

useKbMarkdownRender(markdownRootRef, markdownAssetCtx, contentHtml)

onMounted(async () => {
  await ensureScopeReady()
  browseReady.value = true
  void loadIndex()
})

watch(scopeSpaceIds, () => {
  if (!browseReady.value) return
  pageCache.clear()
  inflightPages.clear()
  page.value = null
  activeSlug.value = ''
  contentHtml.value = ''
  resetBrowseState()
  loadError.value = ''
  void loadIndex()
}, { deep: true })

watch(
  () => [route.query.slug, route.query.spaceId] as const,
  ([slug]) => {
    if (typeof slug === 'string' && slug && slug !== activeSlug.value) {
      void openSlug(slug, preferredSpaceId(), true)
    }
  },
)
</script>

<template>
  <div class="page-stack">
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
      <aside
        ref="treeRef"
        class="card flex w-full flex-col p-4 xl:w-[22rem] xl:shrink-0 xl:sticky xl:top-6 xl:max-h-[calc(100vh-3rem)] xl:min-h-[calc(100vh-3rem)]"
      >
        <div v-if="!noAccessibleSpaces && !accessDeniedMessage" class="kb-browse-sidebar-head">
          <KbSpaceScopePicker show-label block compact />
        </div>
        <div class="relative mb-2 shrink-0">
          <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input v-model="keyword" type="text" class="field-input pl-9 pr-9" :placeholder="t('knowledge.browse.searchPlaceholder')" />
          <Loader2 v-if="searchLoading" class="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />
        </div>

        <p v-if="loading" class="py-8 text-center text-sm text-gray-400">{{ t('common.loading') }}</p>
        <p v-else-if="loadError" class="py-8 text-center text-sm text-red-500">{{ loadError }}</p>

        <div v-else-if="!inSearchMode" class="flex min-h-0 flex-1 flex-col">
          <div class="kb-browse-filter-panel shrink-0">
            <KbDocFilterTabs
              layout="dropdown"
              :category-enabled="isSingleSpaceScope"
              :kb-type-chips="kbTypeChipsMerged"
              :kb-type-filters="kbTypeFilters"
              :kb-type-loading="kbTypeLoading"
              :category-chips="categoryChipsMerged"
              :category-filters="categoryFilters"
              :category-loading="indexLoading"
              @update:kb-type-filters="onKbTypeFilterChange"
              @update:category-filters="onCategoryFilterChange"
            />
          </div>
          <div class="kb-browse-doc-list mt-3 flex min-h-0 flex-1 flex-col border-t border-gray-100 pt-3 dark:border-white/5">
            <div class="min-h-0 flex-1 space-y-0.5 overflow-y-auto pr-0.5">
            <p v-if="browseLoading && !browseItems.length" class="px-2 py-2 text-xs text-gray-400">
              {{ t('common.loading') }}
            </p>
            <button
              v-for="item in visibleBrowseItems"
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
              <span class="min-w-0 flex-1 truncate">{{ item.title }}</span>
            </button>
            <button
              v-if="hasMoreBrowseItems()"
              type="button"
              class="w-full rounded-md px-2 py-1 text-left text-xs text-gray-400 transition hover:bg-gray-50 hover:text-gray-600 dark:hover:bg-white/5 dark:hover:text-gray-300"
              @click="loadMoreBrowseItems()"
            >
              {{ t('knowledge.browse.loadMore', { count: browseTotal - visibleBrowseItems.length }) }}
            </button>
            <p v-if="!browseLoading && !browseItems.length && showFilterAndEmpty" class="px-2 py-2 text-xs leading-relaxed text-amber-600 dark:text-amber-400">
              {{ t('knowledge.browse.filterAndEmpty') }}
            </p>
            <p v-else-if="!browseLoading && !browseItems.length" class="px-2 py-3 text-center text-xs text-gray-400">
              {{ t('knowledge.browse.empty') }}
            </p>
            </div>
            <p class="mt-auto shrink-0 pt-2 text-xs text-gray-400">
              {{ t('knowledge.browse.docCount', { count: visibleDocCount }) }}
            </p>
          </div>
        </div>

        <div v-else class="flex min-h-0 flex-1 flex-col">
          <div
            v-if="filteredGroups.length"
            class="mb-2 flex shrink-0 items-center justify-between gap-2"
          >
            <span class="text-xs text-gray-400">{{ t('knowledge.browse.docCount', { count: visibleDocCount }) }}</span>
            <button type="button" class="btn-tree-toggle shrink-0" @click="toggleAllGroups">
              <UnfoldVertical v-if="allCollapsed" class="h-4 w-4 text-gray-400" />
              <FoldVertical v-else class="h-4 w-4 text-gray-400" />
              {{ allCollapsed ? t('common.expandAll') : t('common.collapseAll') }}
            </button>
          </div>
          <p v-if="!filteredGroups.length" class="py-8 text-center text-sm text-gray-400">
            {{ t('knowledge.browse.noMatch') }}
          </p>
          <div v-else class="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
            <div v-for="group in filteredGroups" :key="group.type">
              <button
                type="button"
                class="kb-tree-group-header sticky top-0 z-10 flex w-full items-center gap-2 rounded-lg bg-white px-2 py-1.5 text-left text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:bg-[#171a23] dark:text-gray-200 dark:hover:bg-white/5"
                @click="toggleGroup(group.type)"
              >
                <ChevronDown class="h-4 w-4 shrink-0 text-gray-400 transition" :class="!isGroupOpen(group.type) && '-rotate-90'" />
                <span class="flex-1 truncate">{{ group.label }}</span>
                <span class="badge bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400">{{ groupCount(group) }}</span>
              </button>
              <div v-if="isGroupOpen(group.type)" class="ml-2 space-y-0.5 border-l border-gray-100 pl-2 dark:border-white/10">
                <button
                  v-for="item in visibleGroupItems(group)"
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
                  <span class="min-w-0 flex-1 truncate">{{ item.title }}</span>
                </button>
                <button
                  v-if="hasMoreGroupItems(group)"
                  type="button"
                  class="w-full rounded-md px-2 py-1 text-left text-xs text-gray-400 transition hover:bg-gray-50 hover:text-gray-600 dark:hover:bg-white/5 dark:hover:text-gray-300"
                  @click="loadMoreGroupItems(group)"
                >
                  {{ t('knowledge.browse.loadMore', { count: group.items.length - visibleGroupItems(group).length }) }}
                </button>
              </div>
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
            <div class="flex flex-wrap items-start justify-between gap-3">
              <h2 class="text-2xl font-semibold text-gray-900 dark:text-white">{{ page.title }}</h2>
              <div class="flex shrink-0 flex-wrap items-center gap-2">
                <KbAttachmentsPanel variant="browse" :document-id="page?.docId" />
                <button
                  v-if="canWikiEdit && page?.docId"
                  type="button"
                  class="btn-ghost shrink-0 text-sm"
                  :title="t('knowledge.attachments.manageInEdit')"
                  @click="openWikiEditAttachments"
                >
                  <Paperclip class="h-4 w-4" /> {{ t('knowledge.attachments.manageInEdit') }}
                  <ExternalLink class="h-3.5 w-3.5 opacity-60" />
                </button>
                <button
                  v-if="canWikiEdit"
                  type="button"
                  class="btn-ghost shrink-0 text-sm"
                  :title="t('knowledge.browse.editWiki')"
                  @click="openWikiEdit"
                >
                  <Pencil class="h-4 w-4" /> {{ t('knowledge.browse.editWiki') }}
                  <ExternalLink class="h-3.5 w-3.5 opacity-60" />
                </button>
              </div>
            </div>
            <div class="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <span class="font-mono text-xs">{{ page.slug }}</span>
              <span v-if="page.domain">· {{ page.domain }}</span>
              <span>· {{ formatTime(page.updateTime) }}</span>
            </div>
            <div v-if="page.tags?.length" class="mt-3 flex flex-wrap gap-1.5">
              <span v-for="tag in page.tags" :key="tag" class="user-role-tag">{{ tag }}</span>
            </div>
          </header>

          <!-- eslint-disable-next-line vue/no-v-html -->
          <div ref="markdownRootRef" class="kb-markdown mt-4" @click="onContentClick" v-html="contentHtml" />

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
        </article>
      </div>
    </div>
  </div>
</template>
