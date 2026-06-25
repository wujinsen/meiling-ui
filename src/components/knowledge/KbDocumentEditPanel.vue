<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ArrowLeft, ExternalLink, Loader2, X } from 'lucide-vue-next'
import SegmentControl from '@/components/ui/SegmentControl.vue'
import KbCategorySelect from '@/components/knowledge/KbCategorySelect.vue'
import KbTagMultiSelect from '@/components/knowledge/KbTagMultiSelect.vue'
import {
  archiveKbDocumentApi,
  deleteKbDocumentApi,
  getKbDocumentApi,
  publishKbDocumentApi,
  saveKbDocumentApi,
} from '@/api/knowledge'
import { useKbDocMeta } from '@/composables/useKbDocMeta'
import { confirm } from '@/composables/useConfirm'
import { assertAction, guardAction } from '@/composables/useActionPermissions'
import { showToast } from '@/composables/useToast'
import { API_SUCCESS_CODE } from '@/types/api'
import { renderMarkdown } from '@/utils/markdown'
import type { KbDocStatus, KbDocumentDetail, KbType } from '@/types/knowledge'
import { PERM } from '@/constants/permissions'
import { toEntityId, toEntityIdList } from '@/utils/id'

const props = withDefaults(
  defineProps<{
    documentId: string
    variant?: 'drawer' | 'page'
  }>(),
  { variant: 'page' },
)

const emit = defineEmits<{
  close: []
  saved: []
  deleted: []
}>()

const { t } = useI18n()
const router = useRouter()

const loading = ref(false)
const saving = ref(false)
const publishing = ref(false)
const contentTab = ref<'write' | 'preview'>('write')
const detail = ref<KbDocumentDetail | null>(null)
const contentHtml = shallowRef('')

const form = ref({
  title: '',
  summary: '',
  kbType: 'article' as KbType,
  domain: '',
  content: '',
  changeLog: '',
  categoryId: '',
  tagIds: [] as string[],
})

const spaceId = computed(() => toEntityId(detail.value?.spaceId) ?? '')
const { flatCategories, tags, loading: metaLoading, loadError: metaLoadError } = useKbDocMeta(spaceId)

const contentTabOptions = computed(() => [
  { value: 'write', label: t('knowledge.docManage.tabWrite') },
  { value: 'preview', label: t('knowledge.docManage.tabPreview') },
])

const isWiki = computed(() => detail.value?.source === 'kb')
const docId = computed(() => props.documentId || detail.value?.id)

const statusLabel = computed(() => {
  const s = detail.value?.status
  if (s === 0) return t('knowledge.docManage.statusDraft')
  if (s === 2) return t('knowledge.docManage.statusArchived')
  return t('knowledge.docManage.statusPublished')
})

const statusBadgeClass = computed(() => {
  const s = detail.value?.status
  if (s === 0) return 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
  if (s === 2) return 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400'
  return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
})

const sourceBadgeClass = 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300'
const isPage = computed(() => props.variant === 'page')

watch(
  () => form.value.content,
  (content) => {
    contentHtml.value = renderMarkdown(content)
  },
  { immediate: true },
)

watch(
  () => props.documentId,
  (id) => {
    if (id) void loadDetail(id)
    else {
      detail.value = null
      contentTab.value = 'write'
    }
  },
  { immediate: true },
)

async function loadDetail(id: string) {
  loading.value = true
  try {
    const res = await getKbDocumentApi(id)
    if (res.code !== API_SUCCESS_CODE || !res.data) {
      throw new Error(res.msg || t('knowledge.docManage.loadFailed'))
    }
    detail.value = res.data
    form.value = {
      title: res.data.title ?? '',
      summary: res.data.summary ?? '',
      kbType: (res.data.kbType ?? 'article') as KbType,
      domain: res.data.domain ?? '',
      content: res.data.content ?? '',
      changeLog: '',
      categoryId: toEntityId(res.data.categoryId) ?? '',
      tagIds: toEntityIdList(res.data.tagIds),
    }
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('knowledge.docManage.loadFailed'))
    if (isPage.value) void router.replace({ path: '/knowledge/documents' })
    else emit('close')
  } finally {
    loading.value = false
  }
}

function buildSavePayload(status?: KbDocStatus) {
  if (!detail.value?.spaceId) throw new Error(t('knowledge.docManage.loadFailed'))
  return {
    id: docId.value,
    spaceId: detail.value.spaceId,
    categoryId: form.value.categoryId || undefined,
    title: form.value.title.trim(),
    summary: form.value.summary.trim() || undefined,
    content: form.value.content,
    docType: 'markdown',
    status: status ?? detail.value.status ?? 0,
    tagIds: form.value.tagIds.length ? form.value.tagIds : [],
    changeLog: form.value.changeLog.trim() || undefined,
  }
}

async function saveDraft() {
  if (!guardAction(PERM.KB_DOCUMENT_EDIT)) return
  if (!form.value.title.trim()) {
    showToast('error', t('knowledge.docManage.titleRequired'))
    return
  }
  saving.value = true
  try {
    const res = await saveKbDocumentApi(buildSavePayload())
    if (res.code !== API_SUCCESS_CODE) throw new Error(res.msg || t('knowledge.docManage.saveFailed'))
    showToast('success', t('knowledge.docManage.saveOk'))
    if (props.documentId) await loadDetail(String(props.documentId))
    emit('saved')
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('knowledge.docManage.saveFailed'))
  } finally {
    saving.value = false
  }
}

async function saveDraftSilent() {
  const res = await saveKbDocumentApi(buildSavePayload())
  if (res.code !== API_SUCCESS_CODE) throw new Error(res.msg || t('knowledge.docManage.saveFailed'))
}

async function publish() {
  if (!assertAction(PERM.KB_DOCUMENT_PUBLISH) && !guardAction(PERM.KB_DOCUMENT_PUBLISH)) return
  if (!docId.value) return
  publishing.value = true
  try {
    await saveDraftSilent()
    const res = await publishKbDocumentApi(docId.value)
    if (res.code !== API_SUCCESS_CODE) throw new Error(res.msg || t('knowledge.docManage.publishFailed'))
    showToast('success', t('knowledge.docManage.publishOk'))
    await loadDetail(String(docId.value))
    emit('saved')
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('knowledge.docManage.publishFailed'))
  } finally {
    publishing.value = false
  }
}

async function archiveDoc() {
  if (!guardAction(PERM.KB_DOCUMENT_ARCHIVE) || !docId.value) return
  const ok = await confirm({
    title: t('knowledge.docManage.archiveConfirmTitle'),
    message: t('knowledge.docManage.archiveConfirmMessage'),
    confirmText: t('confirm.ok'),
    cancelText: t('confirm.cancel'),
  })
  if (!ok) return
  try {
    const res = await archiveKbDocumentApi(docId.value)
    if (res.code !== API_SUCCESS_CODE) throw new Error(res.msg || t('knowledge.docManage.archiveFailed'))
    showToast('success', t('knowledge.docManage.archiveOk'))
    await loadDetail(String(docId.value))
    emit('saved')
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('knowledge.docManage.archiveFailed'))
  }
}

async function removeDoc() {
  if (!guardAction(PERM.KB_DOCUMENT_REMOVE) || !docId.value || isWiki.value) return
  const ok = await confirm({
    title: t('confirm.deleteTitle'),
    message: t('knowledge.docManage.deleteConfirm'),
    confirmText: t('confirm.confirm'),
    cancelText: t('confirm.cancel'),
    danger: true,
  })
  if (!ok) return
  try {
    const res = await deleteKbDocumentApi(docId.value)
    if (res.code !== API_SUCCESS_CODE) throw new Error(res.msg || t('knowledge.docManage.deleteFailed'))
    showToast('success', t('knowledge.docManage.deleteOk'))
    emit('deleted')
    if (isPage.value) void router.replace({ path: '/knowledge/documents' })
    else emit('close')
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('knowledge.docManage.deleteFailed'))
  }
}

function openInBrowse() {
  if (!detail.value?.slug) return
  const query: Record<string, string> = { slug: detail.value.slug }
  if (detail.value.spaceId != null) query.spaceId = String(detail.value.spaceId)
  void router.push({ path: '/knowledge/browse', query })
}

function goBack() {
  if (isPage.value) void router.push({ path: '/knowledge/documents' })
  else emit('close')
}
</script>

<template>
  <div :class="isPage ? 'kb-doc-edit-page' : 'kb-doc-edit-panel'">
    <header :class="isPage ? 'kb-doc-edit-page-header' : 'kb-doc-drawer-header'">
      <button
        type="button"
        :class="isPage ? 'btn-ghost shrink-0 text-sm' : 'kb-doc-drawer-close'"
        :aria-label="isPage ? t('knowledge.docManage.backToList') : t('confirm.cancel')"
        @click="goBack"
      >
        <ArrowLeft v-if="isPage" class="h-4 w-4" />
        <X v-else class="h-5 w-5" />
        <span v-if="isPage" class="ml-1">{{ t('knowledge.docManage.backToList') }}</span>
      </button>
      <div class="min-w-0 flex-1">
        <p v-if="loading" class="text-sm text-gray-400">{{ t('common.loading') }}</p>
        <template v-else-if="detail">
          <h2 class="truncate text-base font-semibold text-gray-900 dark:text-white">{{ form.title || detail.title }}</h2>
          <div class="mt-1 flex flex-wrap items-center gap-2">
            <span class="badge" :class="statusBadgeClass">{{ statusLabel }}</span>
            <span class="badge" :class="sourceBadgeClass">
              {{ isWiki ? t('knowledge.docManage.sourceKb') : t('knowledge.docManage.sourceManual') }}
            </span>
            <span v-if="detail.versionNo" class="text-xs text-gray-400">v{{ detail.versionNo }}</span>
          </div>
        </template>
      </div>
      <div class="flex shrink-0 flex-wrap items-center gap-2">
        <button
          v-if="detail?.slug"
          type="button"
          class="btn-ghost shrink-0 text-sm"
          @click="openInBrowse"
        >
          <ExternalLink class="h-4 w-4" /> {{ t('knowledge.docManage.openInBrowse') }}
        </button>
        <button type="button" class="btn-ghost shrink-0 text-sm" :disabled="saving || loading" @click="saveDraft">
          <Loader2 v-if="saving" class="h-4 w-4 animate-spin" />
          {{ t('knowledge.docManage.saveDraft') }}
        </button>
        <button
          type="button"
          class="btn-primary shrink-0 text-sm"
          :disabled="publishing || saving || loading"
          @click="isWiki || detail?.status === 1 ? saveDraft() : publish()"
        >
          <Loader2 v-if="publishing || saving" class="h-4 w-4 animate-spin" />
          {{ isWiki || detail?.status === 1 ? t('knowledge.docManage.save') : t('knowledge.docManage.publish') }}
        </button>
      </div>
    </header>

    <div v-if="loading" class="flex flex-1 items-center justify-center p-8 text-sm text-gray-400">
      {{ t('common.loading') }}
    </div>
    <div v-else-if="detail" :class="isPage ? 'kb-doc-edit-page-body' : 'kb-doc-drawer-body'">
      <div class="kb-doc-drawer-meta">
        <label class="kb-doc-field">
          <span>{{ t('knowledge.docManage.fieldTitle') }} *</span>
          <input v-model="form.title" type="text" class="field-input" />
        </label>
        <label class="kb-doc-field">
          <span>{{ t('knowledge.docManage.fieldSummary') }}</span>
          <textarea v-model="form.summary" rows="3" class="field-input resize-y" />
        </label>
        <label class="kb-doc-field">
          <span>Slug</span>
          <input :value="detail.slug ?? ''" type="text" class="field-input" disabled />
          <span v-if="isWiki" class="text-xs text-gray-400">{{ t('knowledge.docManage.slugReadonly') }}</span>
        </label>
        <div class="grid grid-cols-2 gap-2">
          <label class="kb-doc-field">
            <span>{{ t('knowledge.docManage.fieldKbType') }}</span>
            <input :value="form.kbType" type="text" class="field-input" disabled />
          </label>
          <label class="kb-doc-field">
            <span>{{ t('knowledge.docManage.fieldDomain') }}</span>
            <input :value="form.domain" type="text" class="field-input" disabled />
          </label>
        </div>
        <label class="kb-doc-field">
          <span>{{ t('knowledge.docManage.fieldCategory') }}</span>
          <KbCategorySelect
            v-model="form.categoryId"
            :options="flatCategories"
            :loading="metaLoading"
          />
          <span v-if="metaLoadError" class="text-xs text-rose-500">{{ t('knowledge.docManage.metaLoadFailed') }}</span>
        </label>
        <div class="kb-doc-field">
          <span>{{ t('knowledge.docManage.fieldTags') }}</span>
          <KbTagMultiSelect
            v-model="form.tagIds"
            :tags="tags"
            :loading="metaLoading"
          />
        </div>
        <label class="kb-doc-field">
          <span>{{ t('knowledge.docManage.fieldChangeLog') }}</span>
          <input v-model="form.changeLog" type="text" class="field-input" :placeholder="t('knowledge.docManage.changeLogPlaceholder')" />
        </label>
        <div v-if="!isWiki" class="flex flex-wrap gap-2 border-t border-gray-100 pt-3 dark:border-white/5">
          <button type="button" class="btn-ghost text-sm" @click="archiveDoc">{{ t('knowledge.docManage.archive') }}</button>
          <button type="button" class="btn-ghost text-sm text-red-600 dark:text-red-400" @click="removeDoc">
            {{ t('knowledge.docManage.delete') }}
          </button>
        </div>
        <p v-else class="text-xs text-gray-400">{{ t('knowledge.docManage.wikiNoDelete') }}</p>
      </div>

      <div class="kb-doc-drawer-editor">
        <SegmentControl v-model="contentTab" :options="contentTabOptions" />
        <textarea
          v-if="contentTab === 'write'"
          v-model="form.content"
          class="field-input mt-3 min-h-[320px] flex-1 resize-y font-mono text-sm leading-relaxed"
          :placeholder="t('knowledge.docManage.contentPlaceholder')"
        />
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div
          v-else
          class="kb-markdown mt-3 min-h-[320px] flex-1 overflow-y-auto rounded-lg border border-gray-100 bg-gray-50/50 p-4 dark:border-white/5 dark:bg-white/[0.02]"
          v-html="contentHtml"
        />
      </div>
    </div>
  </div>
</template>
