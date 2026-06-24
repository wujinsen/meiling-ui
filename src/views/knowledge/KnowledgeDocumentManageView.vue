<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ExternalLink, Loader2, Pencil, Plus, RefreshCw, Search } from 'lucide-vue-next'
import AppPagination from '@/components/ui/AppPagination.vue'
import SegmentControl from '@/components/ui/SegmentControl.vue'
import KbAccessDenied from '@/components/knowledge/KbAccessDenied.vue'
import KbCategoryManagePanel from '@/components/knowledge/KbCategoryManagePanel.vue'
import KbDocumentCreateModal from '@/components/knowledge/KbDocumentCreateModal.vue'
import KbDocumentEditDrawer from '@/components/knowledge/KbDocumentEditDrawer.vue'
import KbSpaceDropdown from '@/components/knowledge/KbSpaceDropdown.vue'
import KbCategorySelect from '@/components/knowledge/KbCategorySelect.vue'
import KbTagManagePanel from '@/components/knowledge/KbTagManagePanel.vue'
import { searchKbDocumentsApi } from '@/api/knowledge'
import { useKbSpace } from '@/composables/useKbSpace'
import { useKbDocMeta } from '@/composables/useKbDocMeta'
import { assertAction, guardAction } from '@/composables/useActionPermissions'
import { showToast } from '@/composables/useToast'
import { API_SUCCESS_CODE } from '@/types/api'
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination'
import type { KbDocStatus, KbDocumentListItem } from '@/types/knowledge'
import { PERM } from '@/constants/permissions'
import { toEntityId } from '@/utils/id'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { spaces, ensureSpacesLoaded, loading: spaceLoading } = useKbSpace()

const editableSpaces = computed(() => spaces.value.filter((s) => s.canEdit === true))
const hasEditableSpace = computed(() => editableSpaces.value.length > 0)

const docSpaceId = ref('')
const loading = ref(false)
const list = ref<KbDocumentListItem[]>([])
const total = ref(0)

const query = reactive({
  pageNum: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  keyword: '',
  status: '' as '' | KbDocStatus,
  categoryId: '',
  tagId: '',
})

const { flatCategories, tags, loading: metaLoading, reload: reloadMeta } = useKbDocMeta(docSpaceId)

const activeTab = ref<'documents' | 'categories' | 'tags'>('documents')

const tabOptions = computed(() => [
  { value: 'documents', label: t('knowledge.taxManage.tabDocuments') },
  { value: 'categories', label: t('knowledge.taxManage.tabCategories') },
  { value: 'tags', label: t('knowledge.taxManage.tabTags') },
])

function onTaxonomyChanged() {
  void reloadMeta()
}

const createOpen = ref(false)
const drawerOpen = ref(false)
const editingId = ref<string | null>(null)

const canCreate = computed(() => assertAction(PERM.KB_DOCUMENT_ADD))

const statusOptions = computed(() => [
  { value: '', label: t('knowledge.docManage.statusAll') },
  { value: '0', label: t('knowledge.docManage.statusDraft') },
  { value: '1', label: t('knowledge.docManage.statusPublished') },
  { value: '2', label: t('knowledge.docManage.statusArchived') },
])

function initDocSpace() {
  if (!editableSpaces.value.length) return
  const ok = editableSpaces.value.some((s) => toEntityId(s.id) === docSpaceId.value)
  if (!ok) docSpaceId.value = toEntityId(editableSpaces.value[0].id) ?? ''
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

function sourceLabel(source?: string) {
  return source === 'kb' ? t('knowledge.docManage.sourceKb') : t('knowledge.docManage.sourceManual')
}

async function loadList() {
  if (!docSpaceId.value) return
  loading.value = true
  try {
    const res = await searchKbDocumentsApi({
      spaceId: docSpaceId.value,
      keyword: query.keyword.trim() || undefined,
      status: query.status === '' ? '' : query.status,
      categoryId: query.categoryId || undefined,
      tagId: query.tagId || undefined,
      pageNum: query.pageNum,
      pageSize: query.pageSize,
    })
    if (res.code !== API_SUCCESS_CODE || !res.data) {
      throw new Error(res.msg || t('knowledge.docManage.loadFailed'))
    }
    list.value = res.data.records ?? []
    total.value = res.data.total ?? 0
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('knowledge.docManage.loadFailed'))
  } finally {
    loading.value = false
  }
}

function search() {
  if (query.pageNum === 1) void loadList()
  else query.pageNum = 1
}

function resetQuery() {
  query.keyword = ''
  query.status = ''
  query.categoryId = ''
  query.tagId = ''
  search()
}

function openCreate() {
  if (!guardAction(PERM.KB_DOCUMENT_ADD)) return
  createOpen.value = true
}

function openEdit(row: KbDocumentListItem) {
  const id = toEntityId(row.id)
  if (!id) return
  editingId.value = id
  drawerOpen.value = true
}

function openBrowse(row: KbDocumentListItem) {
  if (!row.slug) return
  const q: Record<string, string> = { slug: row.slug }
  if (row.spaceId != null) q.spaceId = String(row.spaceId)
  void router.push({ path: '/knowledge/browse', query: q })
}

function onCreated(id: string) {
  editingId.value = id
  drawerOpen.value = true
  void loadList()
}

function closeDrawer() {
  drawerOpen.value = false
  editingId.value = null
  const q = { ...route.query }
  if (q.editId) {
    delete q.editId
    void router.replace({ query: q })
  }
}

function openEditFromRoute() {
  const raw = route.query.editId
  if (typeof raw !== 'string' || !raw) return
  editingId.value = raw
  drawerOpen.value = true
}

onMounted(async () => {
  await ensureSpacesLoaded()
  initDocSpace()
  openEditFromRoute()
})

watch(editableSpaces, () => initDocSpace(), { deep: true })

watch(docSpaceId, () => {
  query.categoryId = ''
  query.tagId = ''
  if (query.pageNum === 1) void loadList()
  else query.pageNum = 1
})

watch(
  () => route.query.editId,
  (id) => {
    if (typeof id === 'string' && id) {
      editingId.value = id
      drawerOpen.value = true
    }
  },
)

watch(
  () => [query.pageNum, query.pageSize] as const,
  () => void loadList(),
)
</script>

<template>
  <div class="page-stack" :class="drawerOpen && 'kb-doc-manage-drawer-open'">
    <KbAccessDenied
      v-if="!spaceLoading && !hasEditableSpace"
      :title="t('knowledge.docManage.noEditableSpaceTitle')"
      :message="t('knowledge.docManage.noEditableSpace')"
      :hint="t('knowledge.docManage.noEditableSpaceHint')"
    />

    <template v-else>
      <div class="flex flex-wrap items-center gap-3">
        <KbSpaceDropdown v-model="docSpaceId" editable-only />
        <SegmentControl v-model="activeTab" :options="tabOptions" />
      </div>

      <template v-if="activeTab === 'documents'">
      <div class="flex flex-wrap items-center gap-2">
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
          <KbCategorySelect
            v-model="query.categoryId"
            class="w-auto min-w-[8rem]"
            :options="flatCategories"
            :loading="metaLoading"
            :empty-label="t('knowledge.docManage.categoryAll')"
          />
          <select v-model="query.tagId" class="field-input w-auto min-w-[8rem]" :disabled="metaLoading">
            <option value="">{{ t('knowledge.docManage.tagAll') }}</option>
            <option v-for="tag in tags" :key="String(tag.id)" :value="toEntityId(tag.id)">{{ tag.tagName }}</option>
          </select>
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

      <div class="card p-5">
        <p class="mb-4 text-xs text-gray-400">
          {{ t('knowledge.docManage.listSummary', { count: total }) }}
        </p>
        <div class="data-table-scroll overflow-x-auto rounded-lg border border-gray-100 dark:border-white/5">
          <table class="data-table w-full min-w-[880px] text-left text-sm">
            <thead>
              <tr>
                <th>{{ t('knowledge.docManage.colTitle') }}</th>
                <th>Slug</th>
                <th>{{ t('knowledge.docManage.colType') }}</th>
                <th>{{ t('knowledge.docManage.colSource') }}</th>
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
                class="cursor-pointer"
                @click="openEdit(row)"
              >
                <td class="max-w-[200px] truncate font-medium">{{ row.title }}</td>
                <td class="max-w-[180px] truncate font-mono text-xs text-gray-500">{{ row.slug || '—' }}</td>
                <td><span class="badge bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300">{{ row.kbType || '—' }}</span></td>
                <td><span class="badge bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400">{{ sourceLabel(row.source) }}</span></td>
                <td><span class="badge" :class="statusClass(row.status)">{{ statusLabel(row.status) }}</span></td>
                <td class="text-gray-500">{{ row.updateTime || row.publishTime || '—' }}</td>
                <td class="data-table-sticky-end text-right" @click.stop>
                  <div class="btn-action-group justify-end">
                    <button type="button" class="btn-action-edit" @click="openEdit(row)">
                      <Pencil class="h-3.5 w-3.5" />{{ t('knowledge.docManage.edit') }}
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
        v-else-if="activeTab === 'categories'"
        :space-id="docSpaceId"
        @changed="onTaxonomyChanged"
      />

      <KbTagManagePanel
        v-else
        :space-id="docSpaceId"
        @changed="onTaxonomyChanged"
      />
    </template>

    <KbDocumentCreateModal
      :open="createOpen"
      :default-space-id="docSpaceId"
      @close="createOpen = false"
      @created="onCreated"
    />

    <KbDocumentEditDrawer
      :open="drawerOpen"
      :document-id="editingId"
      @close="closeDrawer"
      @saved="loadList"
      @deleted="loadList"
    />
  </div>
</template>
