<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ExternalLink, FolderInput, Loader2, Pencil, Plus, RefreshCw, Search } from 'lucide-vue-next'
import AppModal from '@/components/ui/AppModal.vue'
import FormField from '@/components/ui/FormField.vue'
import AppPagination from '@/components/ui/AppPagination.vue'
import SegmentControl from '@/components/ui/SegmentControl.vue'
import KbAccessDenied from '@/components/knowledge/KbAccessDenied.vue'
import KbCategoryManagePanel from '@/components/knowledge/KbCategoryManagePanel.vue'
import KbCategorySelect from '@/components/knowledge/KbCategorySelect.vue'
import KbDocFilterTabs from '@/components/knowledge/KbDocFilterTabs.vue'
import KbDocumentCreateModal from '@/components/knowledge/KbDocumentCreateModal.vue'
import KbSpaceScopePicker from '@/components/knowledge/KbSpaceScopePicker.vue'
import KbTagManagePanel from '@/components/knowledge/KbTagManagePanel.vue'
import { getKbCategoryTreeApi, getKbDocumentApi, moveKbDocumentApi, searchKbDocumentsApi } from '@/api/knowledge'
import { useKbSpaceScope } from '@/composables/useKbSpaceScope'
import { useKbSpace } from '@/composables/useKbSpace'
import { useKbDocFilter, type KbCategoryFilterId } from '@/composables/useKbDocFilter'
import { useKbDocMeta } from '@/composables/useKbDocMeta'
import { useKbMetaKbTypes } from '@/composables/useKbMetaKbTypes'
import { assertAction, guardAction, useActionPermissions } from '@/composables/useActionPermissions'
import { showToast } from '@/composables/useToast'
import { API_SUCCESS_CODE } from '@/types/api'
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination'
import type { KbDocStatus, KbDocumentListItem } from '@/types/knowledge'
import type { WikiCreatePayload } from '@/components/knowledge/KbDocumentCreateModal.vue'
import { PERM } from '@/constants/permissions'
import { kbWikiEditPath } from '@/router/knowledgeSupplementRoutes'
import { toEntityId } from '@/utils/id'
import { findKbCategoryName, flattenKbCategoryTree } from '@/utils/kbCategoryTree'
import type { KbCategoryTree } from '@/types/knowledge'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { spaces, loading: spaceLoading } = useKbSpace()
const { scopeSpaceIds, ensureScopeReady } = useKbSpaceScope()
const { fullPermission } = useActionPermissions()

const editableSpaces = computed(() =>
  spaces.value.filter((s) => s.canEdit === true || fullPermission.value),
)
const hasAccessibleSpace = computed(() => spaces.value.length > 0)

/** 分类/标签管理、新建文档需单空间；列表查询支持全部/多选 */
const metaSpaceId = computed(() => {
  if (scopeSpaceIds.value.length === 1) return scopeSpaceIds.value[0]
  const preferred = editableSpaces.value[0] ?? spaces.value[0]
  return preferred ? toEntityId(preferred.id) ?? '' : ''
})

const taxonomySingleSpace = computed(() => scopeSpaceIds.value.length === 1)

const canEditScopedSpace = computed(() => {
  if (scopeSpaceIds.value.length !== 1) return false
  const space = spaces.value.find((s) => toEntityId(s.id) === scopeSpaceIds.value[0])
  return fullPermission.value || space?.canEdit === true
})

function canEditRowSpace(row: KbDocumentListItem) {
  const sid = toEntityId(row.spaceId)
  const space = spaces.value.find((s) => toEntityId(s.id) === sid)
  return fullPermission.value || space?.canEdit === true
}

const loading = ref(false)
const list = ref<KbDocumentListItem[]>([])
const total = ref(0)

const query = reactive({
  pageNum: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  keyword: '',
  status: 1 as KbDocStatus | '',
  tagId: '',
})

const docScopeIds = scopeSpaceIds

const {
  kbTypeFilters,
  kbTypeChips,
  kbTypeLoading,
  categoryChips,
  categoryFilters,
  indexLoading,
  applySearchParams,
  setKbTypeFilters,
  setCategoryFilters,
  resetFilters,
  reloadFilters,
} = useKbDocFilter(docScopeIds)

const { categories, tags, loading: metaLoading, reload: reloadMeta } = useKbDocMeta(metaSpaceId)
const { kbTypeLabel, ensureLoaded: ensureKbTypeLabels } = useKbMetaKbTypes()

const activeTab = ref<'documents' | 'categories' | 'tags'>('documents')

const tabOptions = computed(() => [
  { value: 'documents', label: t('knowledge.taxManage.tabDocuments') },
  { value: 'categories', label: t('knowledge.taxManage.tabCategories') },
  { value: 'tags', label: t('knowledge.taxManage.tabTags') },
])

function onTaxonomyChanged() {
  void reloadMeta()
  void reloadFilters()
}

function switchTaxTab(tab: 'documents' | 'categories' | 'tags') {
  activeTab.value = tab
}

const showTagManageLink = computed(
  () => taxonomySingleSpace.value && canEditScopedSpace.value && !metaLoading.value && tags.value.length === 0,
)

const createOpen = ref(false)

const canCreate = computed(() => assertAction(PERM.KB_WIKI_EDIT))

const statusOptions = computed(() => [
  { value: '', label: t('knowledge.docManage.statusAll') },
  { value: '0', label: t('knowledge.docManage.statusDraft') },
  { value: '1', label: t('knowledge.docManage.statusPublished') },
  { value: '2', label: t('knowledge.docManage.statusArchived') },
])

async function loadList() {
  loading.value = true
  try {
    const params = applySearchParams({
      source: 'kb',
      keyword: query.keyword.trim() || undefined,
      status: query.status === '' ? '' : query.status,
      tagId: taxonomySingleSpace.value && query.tagId ? query.tagId : undefined,
      pageNum: query.pageNum,
      pageSize: query.pageSize,
    })
    const res = await searchKbDocumentsApi(params)
    if (res.code !== API_SUCCESS_CODE || !res.data) {
      throw new Error(res.msg || t('knowledge.docManage.loadFailed'))
    }
    list.value = res.data.records ?? []
    total.value = Number(res.data.total ?? 0) || 0
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('knowledge.docManage.loadFailed'))
  } finally {
    loading.value = false
  }
}

function statusLabel(status?: KbDocStatus) {
  if (status === 0) return t('knowledge.docManage.statusDraft')
  if (status === 2) return t('knowledge.docManage.statusArchived')
  return t('knowledge.docManage.statusPublished')
}

function statusClass(status?: KbDocStatus) {
  if (status === 0) return 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
  if (status === 2) return 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400'
  return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
}

function canWikiEdit(row: KbDocumentListItem) {
  return Boolean(row.slug)
}

function categoryLabel(row: KbDocumentListItem): string {
  if (row.categoryName) return row.categoryName
  const id = toEntityId(row.categoryId)
  if (!id) return t('knowledge.docManage.uncategorized')
  return findKbCategoryName(categories.value, id) ?? t('knowledge.docManage.categoryNone')
}

function search() {
  if (query.pageNum === 1) void loadList()
  else query.pageNum = 1
}

function resetQuery() {
  query.keyword = ''
  query.status = 1
  resetFilters()
  query.tagId = ''
  search()
}

function onKbTypeFilterSelect(value: string[]) {
  setKbTypeFilters(value)
  search()
}

function onCategoryFilterSelect(value: KbCategoryFilterId[]) {
  setCategoryFilters(value)
  search()
}

function openCreate() {
  if (!guardAction(PERM.KB_WIKI_EDIT)) return
  createOpen.value = true
}

function openEdit(row: KbDocumentListItem) {
  if (!guardAction(PERM.KB_WIKI_EDIT)) return
  if (!canWikiEdit(row)) {
    showToast('error', t('knowledge.docManage.wikiEditOnly'))
    return
  }
  void router.push(kbWikiEditPath(row.slug!, row.spaceId ?? metaSpaceId.value))
}

function openBrowse(row: KbDocumentListItem) {
  if (!row.slug) return
  const q: Record<string, string> = { slug: row.slug }
  if (row.spaceId != null) q.spaceId = String(row.spaceId)
  void router.push({ path: '/knowledge/browse', query: q })
}

// 移动分类（=目录）：移 wiki 文件 + 改引用 + 触发 Sync
const moveOpen = ref(false)
const moving = ref(false)
const moveRow = ref<KbDocumentListItem | null>(null)
const moveTargetCategoryId = ref('')
const moveCategories = ref<KbCategoryTree[]>([])
const moveMetaLoading = ref(false)
const moveFlatCategories = computed(() => flattenKbCategoryTree(moveCategories.value))

async function openMove(row: KbDocumentListItem) {
  if (!guardAction(PERM.KB_DOCUMENT_EDIT)) return
  if (!canEditRowSpace(row)) {
    showToast('error', t('knowledge.docManage.readOnlySpaceHint'))
    return
  }
  if (!row.slug) {
    showToast('error', t('knowledge.docManage.wikiEditOnly'))
    return
  }
  moveRow.value = row
  moveTargetCategoryId.value = toEntityId(row.categoryId) ?? ''
  moveCategories.value = []
  moveOpen.value = true
  const sid = toEntityId(row.spaceId)
  if (!sid) return
  moveMetaLoading.value = true
  try {
    const res = await getKbCategoryTreeApi(sid, true)
    if (res.code === API_SUCCESS_CODE && res.data) moveCategories.value = res.data
  } finally {
    moveMetaLoading.value = false
  }
}

async function submitMove() {
  const row = moveRow.value
  if (!row || !moveTargetCategoryId.value) {
    showToast('error', t('knowledge.docManage.moveNeedCategory'))
    return
  }
  moving.value = true
  try {
    const res = await moveKbDocumentApi(row.id, moveTargetCategoryId.value)
    if (res.code !== API_SUCCESS_CODE || !res.data) throw new Error(res.msg || t('knowledge.docManage.moveFailed'))
    const slug = res.data.toSlug
    showToast(
      'success',
      res.data.syncSuccess
        ? t('knowledge.docManage.moveOk', { slug })
        : t('knowledge.docManage.moveOkSyncPending', { slug }),
    )
    moveOpen.value = false
    await loadList()
    void reloadMeta()
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('knowledge.docManage.moveFailed'))
  } finally {
    moving.value = false
  }
}

function onWikiCreated(payload: WikiCreatePayload) {
  void router.push(kbWikiEditPath(payload.slug, payload.spaceId, { fromCreate: true }))
}

async function redirectLegacyEditQuery() {
  const raw = route.query.editId
  if (typeof raw !== 'string' || !raw) return
  const id = toEntityId(raw)
  if (!id) return
  const q = { ...route.query }
  delete q.editId
  void router.replace({ path: '/knowledge/documents', query: q })
  try {
    const detail = await getKbDocumentApi(id)
    if (detail.code === API_SUCCESS_CODE && detail.data?.slug) {
      void router.push(kbWikiEditPath(detail.data.slug, detail.data.spaceId))
    } else {
      showToast('error', t('knowledge.docManage.wikiEditOnly'))
    }
  } catch {
    showToast('error', t('knowledge.docManage.wikiEditOnly'))
  }
}

onMounted(async () => {
  await ensureScopeReady()
  void ensureKbTypeLabels()
  void loadList()
  redirectLegacyEditQuery()
})

watch(scopeSpaceIds, () => {
  resetFilters()
  query.tagId = ''
  if (query.pageNum === 1) void loadList()
  else query.pageNum = 1
}, { deep: true })

watch(
  () => route.query.editId,
  (id) => {
    if (typeof id === 'string' && id) redirectLegacyEditQuery()
  },
)

watch(
  () => [query.pageNum, query.pageSize] as const,
  () => void loadList(),
)
</script>

<template>
  <div class="page-stack">
    <KbAccessDenied
      v-if="!spaceLoading && !hasAccessibleSpace"
      :title="t('knowledge.docManage.noAccessibleSpaceTitle')"
      :message="t('knowledge.docManage.noAccessibleSpace')"
      :hint="t('knowledge.docManage.noAccessibleSpaceHint')"
    />

    <template v-else>
      <div class="kb-doc-manage-toolbar">
        <KbSpaceScopePicker />
        <nav class="kb-doc-manage-tabs" :aria-label="t('knowledge.docManage.title')">
          <SegmentControl v-model="activeTab" :options="tabOptions" />
        </nav>
      </div>
      <p v-if="!taxonomySingleSpace && activeTab !== 'documents'" class="text-xs text-amber-600 dark:text-amber-400">
        {{ t('knowledge.docManage.taxonomyNeedSingleSpace') }}
      </p>
      <p v-else-if="activeTab === 'documents' && !taxonomySingleSpace" class="text-xs text-gray-500 dark:text-gray-400">
        {{ t('knowledge.docManage.multiSpaceListHint') }}
      </p>

      <template v-if="activeTab === 'documents'">
      <div class="card p-4 space-y-4">
        <KbDocFilterTabs
          layout="chips"
          show-both-rows
          :category-enabled="taxonomySingleSpace"
          :kb-type-chips="kbTypeChips"
          :kb-type-filters="kbTypeFilters"
          :kb-type-loading="kbTypeLoading"
          :category-chips="categoryChips"
          :category-filters="categoryFilters"
          :category-loading="indexLoading"
          @update:kb-type-filters="onKbTypeFilterSelect"
          @update:category-filters="onCategoryFilterSelect"
          @clear="search"
        />
        <div class="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4 dark:border-white/5">
        <form class="flex min-w-0 flex-1 flex-wrap items-center gap-2" @submit.prevent="search">
          <div class="relative min-w-[12rem] flex-1">
            <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              v-model="query.keyword"
              type="search"
              class="field-input w-full pl-9"
              :placeholder="t('knowledge.docManage.searchPlaceholder')"
            />
          </div>
          <select v-model="query.status" class="field-input w-auto min-w-[7rem]">
            <option v-for="opt in statusOptions" :key="String(opt.value)" :value="opt.value">{{ opt.label }}</option>
          </select>
          <div class="kb-doc-manage-filter-wrap">
            <select
              v-model="query.tagId"
              class="field-input w-auto min-w-[8rem]"
              :disabled="metaLoading || !taxonomySingleSpace"
              :title="!taxonomySingleSpace ? t('knowledge.docManage.tagFilterMultiSpace') : undefined"
            >
              <option value="">{{ t('knowledge.docManage.tagAll') }}</option>
              <option v-for="tag in tags" :key="String(tag.id)" :value="toEntityId(tag.id)">{{ tag.tagName }}</option>
            </select>
            <button
              v-if="showTagManageLink"
              type="button"
              class="kb-doc-manage-tax-link"
              @click="switchTaxTab('tags')"
            >
              {{ t('knowledge.taxManage.manageTags') }}
            </button>
          </div>
          <button type="submit" class="btn-primary shrink-0">
            <Search class="h-4 w-4" /> {{ t('knowledge.docManage.search') }}
          </button>
          <button type="button" class="btn-ghost shrink-0" @click="resetQuery">
            <RefreshCw class="h-4 w-4" /> {{ t('knowledge.docManage.reset') }}
          </button>
        </form>
        <button v-if="canCreate" type="button" class="btn-primary shrink-0" @click="openCreate">
          <Plus class="h-4 w-4" /> {{ t('knowledge.docManage.create') }}
        </button>
        <button type="button" class="btn-ghost shrink-0" :disabled="loading" @click="loadList">
          <Loader2 v-if="loading" class="h-4 w-4 animate-spin" />
          <RefreshCw v-else class="h-4 w-4" />
        </button>
        </div>
      </div>

      <div class="card p-5">
        <p class="mb-1 text-xs text-gray-400">
          {{ t('knowledge.docManage.listSummary', { count: total }) }}
        </p>
        <p class="mb-4 text-xs text-gray-400">{{ t('knowledge.docManage.listWikiHint') }}</p>
        <div class="data-table-scroll overflow-x-auto rounded-lg border border-gray-100 dark:border-white/5">
          <table class="data-table w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr>
                <th>{{ t('knowledge.docManage.colTitle') }}</th>
                <th>Slug</th>
                <th>{{ t('knowledge.docManage.colCategory') }}</th>
                <th>{{ t('knowledge.docManage.colKbType') }}</th>
                <th>{{ t('knowledge.docManage.colStatus') }}</th>
                <th>{{ t('knowledge.docManage.colUpdated') }}</th>
                <th class="data-table-sticky-end text-right">{{ t('knowledge.docManage.colActions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td colspan="7" class="px-4 py-12 text-center text-gray-400">{{ t('common.loading') }}</td>
              </tr>
              <tr v-else-if="!list.length">
                <td colspan="7" class="px-4 py-12 text-center text-gray-400">{{ t('knowledge.docManage.empty') }}</td>
              </tr>
              <tr
                v-for="row in list"
                v-else
                :key="String(row.id)"
                :class="canWikiEdit(row) && 'cursor-pointer'"
                @click="canWikiEdit(row) && openEdit(row)"
              >
                <td class="max-w-[200px] truncate font-medium">{{ row.title }}</td>
                <td class="max-w-[180px] truncate font-mono text-xs text-gray-500">{{ row.slug || '—' }}</td>
                <td><span class="badge bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300">{{ categoryLabel(row) }}</span></td>
                <td>
                  <span
                    v-if="row.kbType"
                    class="badge bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300"
                    :title="kbTypeLabel(row.kbType)"
                  >
                    {{ kbTypeLabel(row.kbType) }}
                  </span>
                  <span v-else class="text-gray-400">—</span>
                </td>
                <td><span class="badge" :class="statusClass(row.status)">{{ statusLabel(row.status) }}</span></td>
                <td class="text-gray-500">{{ row.updateTime || row.publishTime || '—' }}</td>
                <td class="data-table-sticky-end text-right" @click.stop>
                  <div class="btn-action-group justify-end">
                    <button
                      v-if="canWikiEdit(row)"
                      type="button"
                      class="btn-action-edit"
                      @click="openEdit(row)"
                    >
                      <Pencil class="h-3.5 w-3.5" />{{ t('knowledge.docManage.edit') }}
                    </button>
                    <button
                      v-if="canEditRowSpace(row) && row.slug"
                      type="button"
                      class="btn-action-edit"
                      @click="openMove(row)"
                    >
                      <FolderInput class="h-3.5 w-3.5" />{{ t('knowledge.docManage.move') }}
                    </button>
                    <button
                      v-if="row.slug"
                      type="button"
                      class="btn-action-edit"
                      @click="openBrowse(row)"
                    >
                      <ExternalLink class="h-3.5 w-3.5" />{{ t('knowledge.docManage.browse') }}
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="total > 0" class="mt-4">
          <AppPagination v-model:page-num="query.pageNum" v-model:page-size="query.pageSize" :total="total" />
        </div>
      </div>
      </template>

      <KbCategoryManagePanel
        v-else-if="activeTab === 'categories' && taxonomySingleSpace"
        :space-id="metaSpaceId"
        @changed="onTaxonomyChanged"
      />

      <KbTagManagePanel
        v-else-if="activeTab === 'tags' && taxonomySingleSpace"
        :space-id="metaSpaceId"
        @changed="onTaxonomyChanged"
      />
    </template>

    <KbDocumentCreateModal
      :open="createOpen"
      :default-space-id="metaSpaceId"
      @close="createOpen = false"
      @wiki-created="onWikiCreated"
    />

    <AppModal :open="moveOpen" :title="t('knowledge.docManage.moveTitle')" wide @close="moveOpen = false">
      <form class="form-modal" novalidate @submit.prevent="submitMove">
        <p class="mb-3 text-sm text-gray-500 dark:text-gray-400">
          {{ t('knowledge.docManage.moveDesc', { title: moveRow?.title ?? '' }) }}
        </p>
        <div class="form-grid-pairs">
          <div class="form-grid-row">
            <FormField :label="t('knowledge.docManage.fieldCategory')" horizontal required class="form-field-span-2">
              <KbCategorySelect
                v-model="moveTargetCategoryId"
                :options="moveFlatCategories"
                :loading="moveMetaLoading"
                :empty-label="t('knowledge.docManage.moveTargetPlaceholder')"
              />
            </FormField>
          </div>
        </div>
        <p class="mt-3 text-xs text-amber-600 dark:text-amber-400">
          {{ t('knowledge.docManage.moveWarning') }}
        </p>
      </form>
      <template #footer>
        <button type="button" class="btn-ghost" @click="moveOpen = false">{{ t('confirm.cancel') }}</button>
        <button type="button" class="btn-primary" :disabled="moving" @click="submitMove">
          {{ moving ? t('common.loading') : t('confirm.ok') }}
        </button>
      </template>
    </AppModal>
  </div>
</template>
