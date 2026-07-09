<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { FileArchive, FileText, Loader2, Upload, X } from 'lucide-vue-next'
import FormField from '@/components/ui/FormField.vue'
import AppCheckbox from '@/components/ui/AppCheckbox.vue'
import KbCategorySelect from '@/components/knowledge/KbCategorySelect.vue'
import KbWorkflowNextSteps from '@/components/knowledge/KbWorkflowNextSteps.vue'
import { getKbCategoryTreeApi, importWikiPageApi } from '@/api/knowledge'
import { showToast } from '@/composables/useToast'
import { API_SUCCESS_CODE } from '@/types/api'
import type { KbCategoryTree, KbWorkflowHintVo } from '@/types/knowledge'
import type { WikiImportConflict, WikiImportResultVo } from '@/types/kbImport'
import { isWikiImportConflictMessage } from '@/utils/kbImport'
import { flattenKbCategoryTree } from '@/utils/kbCategoryTree'
import { buildCategoryIndex, wikiDirForSpace } from '@/utils/ingestPlanPath'

const props = defineProps<{
  spaceId?: string
  spaceCode?: string
  canImport: boolean
  canSync?: boolean
}>()

const { t } = useI18n()

const categoryId = ref('')
const categories = ref<KbCategoryTree[]>([])
const categoriesLoading = ref(false)
const file = ref<File | null>(null)
const assetsZip = ref<File | null>(null)
const slug = ref('')
const title = ref('')
const slugTouched = ref(false)
const onConflict = ref<WikiImportConflict>('FAIL')
const lintPreview = ref(false)
const syncAfter = ref(true)
const importing = ref(false)
const result = ref<WikiImportResultVo | null>(null)
const nextSteps = ref<KbWorkflowHintVo[]>([])

const flatCategories = computed(() => flattenKbCategoryTree(categories.value))
const categoryIndex = computed(() => buildCategoryIndex(categories.value))
const selectedCategory = computed(() => (categoryId.value ? categoryIndex.value.get(categoryId.value) : undefined))

const previewPath = computed(() => {
  const bare = (slug.value.trim() || stemFromFile(file.value?.name ?? '')).replace(/\.md$/i, '')
  if (!bare || !selectedCategory.value?.dirSlug) return ''
  const rel = `${selectedCategory.value.dirSlug}/${bare}`
  return `${wikiDirForSpace(props.spaceCode)}/${rel}.md`
})

const imageWarn = ref(false)

const conflictOptions = computed(() => [
  { value: 'FAIL' as const, label: t('knowledge.ingest.wikiImport.conflictFail') },
  { value: 'OVERWRITE' as const, label: t('knowledge.ingest.wikiImport.conflictOverwrite') },
])

function stemFromFile(name: string) {
  return name.replace(/\.md$/i, '')
}

async function loadCategories() {
  if (!props.spaceId) {
    categories.value = []
    categoryId.value = ''
    return
  }
  categoriesLoading.value = true
  try {
    const res = await getKbCategoryTreeApi(props.spaceId)
    if (res.code === API_SUCCESS_CODE && res.data) categories.value = res.data
    else categories.value = []
  } catch {
    categories.value = []
  } finally {
    categoriesLoading.value = false
  }
}

watch(
  () => props.spaceId,
  () => {
    categoryId.value = ''
    result.value = null
    nextSteps.value = []
    assetsZip.value = null
    void loadCategories()
  },
  { immediate: true },
)

watch(file, async (f) => {
  imageWarn.value = false
  if (!f) return
  if (!slugTouched.value) slug.value = stemFromFile(f.name)
  if (!f.name.toLowerCase().endsWith('.md')) {
    showToast('error', t('knowledge.ingest.wikiImport.badFileType'))
    file.value = null
    return
  }
  try {
    const text = await f.text()
    imageWarn.value = /!\[[^\]]*\]\([^h][^)]*\)/.test(text)
  } catch {
    imageWarn.value = false
  }
})

watch(
  () => props.canSync,
  (ok) => {
    if (ok === false) syncAfter.value = false
  },
  { immediate: true },
)

const canSubmit = computed(
  () =>
    props.canImport
    && Boolean(props.spaceId)
    && Boolean(categoryId.value)
    && Boolean(file.value)
    && !importing.value,
)

async function submitImport() {
  if (!canSubmit.value || !props.spaceId || !file.value) return
  importing.value = true
  result.value = null
  nextSteps.value = []
  try {
    const res = await importWikiPageApi({
      spaceId: props.spaceId,
      categoryId: categoryId.value,
      file: file.value,
      assetsZip: assetsZip.value ?? undefined,
      slug: slug.value.trim() || undefined,
      title: title.value.trim() || undefined,
      onConflict: onConflict.value,
      lintPreview: lintPreview.value,
      sync: syncAfter.value && props.canSync !== false,
    })
    if (res.code !== API_SUCCESS_CODE || !res.data) {
      const msg = res.msg || t('knowledge.ingest.opFailed')
      if (onConflict.value === 'FAIL' && isWikiImportConflictMessage(msg)) {
        showToast('error', t('knowledge.ingest.wikiImport.conflictExists'))
      } else {
        showToast('error', msg)
      }
      return
    }
    result.value = res.data
    nextSteps.value = res.data.nextSteps ?? []
    showToast('success', t('knowledge.ingest.wikiImport.success', { slug: res.data.slug }))
    if (res.data.sync?.triggered && !res.data.sync.success) {
      showToast('error', res.data.sync.message || t('knowledge.ingest.wikiImport.syncFailed'))
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : t('knowledge.ingest.opFailed')
    if (onConflict.value === 'FAIL' && isWikiImportConflictMessage(msg)) {
      showToast('error', t('knowledge.ingest.wikiImport.conflictExists'))
    } else {
      showToast('error', msg)
    }
  } finally {
    importing.value = false
  }
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const f = input.files?.[0]
  file.value = f ?? null
  slugTouched.value = false
  input.value = ''
}

function onAssetsZipChange(event: Event) {
  const input = event.target as HTMLInputElement
  const f = input.files?.[0]
  input.value = ''
  if (!f) return
  if (!f.name.toLowerCase().endsWith('.zip')) {
    showToast('error', t('knowledge.ingest.wikiImport.badAssetsZipType'))
    return
  }
  assetsZip.value = f
}

function clearAssetsZip() {
  assetsZip.value = null
}

function clearMarkdownFile() {
  file.value = null
  slugTouched.value = false
}
</script>

<template>
  <div class="card p-5">
    <p
      v-if="!canImport"
      class="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
    >
      {{ t('knowledge.ingest.wikiImport.noPermission') }}
    </p>

    <div class="kb-wiki-import-layout">
      <form class="kb-wiki-import-form" @submit.prevent="submitImport">
        <div class="kb-wiki-import-sheet">
          <div class="kb-wiki-import-group">
            <FormField :label="t('knowledge.ingest.planCategory')" horizontal>
              <KbCategorySelect
                v-model="categoryId"
                :options="flatCategories"
                :loading="categoriesLoading"
                :disabled="!canImport"
                :allow-empty="false"
                :empty-label="t('knowledge.ingest.wikiImport.pickCategory')"
              />
            </FormField>

            <div class="kb-wiki-import-file-grid">
              <label
                class="kb-wiki-import-file-card"
                :class="{ 'kb-wiki-import-file-card--filled': file, 'pointer-events-none opacity-50': !canImport }"
              >
                <input type="file" class="sr-only" accept=".md" :disabled="!canImport" @change="onFileChange" />
                <span class="kb-wiki-import-file-card-icon">
                  <FileText class="h-5 w-5" />
                </span>
                <span class="kb-wiki-import-file-card-label">{{ t('knowledge.ingest.wikiImport.file') }}</span>
                <span class="kb-wiki-import-file-card-name">
                  {{ file ? file.name : t('knowledge.ingest.wikiImport.pickFile') }}
                </span>
                <button
                  v-if="file"
                  type="button"
                  class="kb-wiki-import-file-clear"
                  :disabled="!canImport"
                  @click.stop.prevent="clearMarkdownFile"
                >
                  <X class="h-3.5 w-3.5" />
                </button>
              </label>

              <label
                class="kb-wiki-import-file-card"
                :class="{ 'kb-wiki-import-file-card--filled': assetsZip, 'pointer-events-none opacity-50': !canImport }"
              >
                <input
                  type="file"
                  class="sr-only"
                  accept=".zip,application/zip"
                  :disabled="!canImport"
                  @change="onAssetsZipChange"
                />
                <span class="kb-wiki-import-file-card-icon">
                  <FileArchive class="h-5 w-5" />
                </span>
                <span class="kb-wiki-import-file-card-label">{{ t('knowledge.ingest.wikiImport.assetsZip') }}</span>
                <span class="kb-wiki-import-file-card-name">
                  {{ assetsZip ? assetsZip.name : t('knowledge.ingest.wikiImport.pickAssetsZip') }}
                </span>
                <button
                  v-if="assetsZip"
                  type="button"
                  class="kb-wiki-import-file-clear"
                  :disabled="!canImport"
                  @click.stop.prevent="clearAssetsZip"
                >
                  <X class="h-3.5 w-3.5" />
                </button>
              </label>
            </div>
            <p class="kb-wiki-import-hint">{{ t('knowledge.ingest.wikiImport.assetsZipHint') }}</p>
          </div>

          <div class="kb-wiki-import-group">
            <FormField :label="t('knowledge.ingest.planSlug')" horizontal>
              <input
                v-model="slug"
                type="text"
                class="field-input"
                :placeholder="t('knowledge.ingest.planSlugPlaceholder')"
                :disabled="!canImport"
                @input="slugTouched = true"
              />
            </FormField>
            <p class="kb-wiki-import-slug-hint">{{ t('knowledge.ingest.planSlugHint') }}</p>
            <FormField :label="t('knowledge.ingest.planTitle')" horizontal>
              <input v-model="title" type="text" class="field-input" :disabled="!canImport" />
            </FormField>

            <p v-if="previewPath" class="kb-wiki-import-path">
              {{ t('knowledge.ingest.wikiImport.previewPath', { path: previewPath }) }}
            </p>

            <p
              v-if="imageWarn && !assetsZip"
              class="kb-wiki-import-warn"
            >
              {{ t('knowledge.ingest.wikiImport.imageWarn') }}
            </p>
          </div>

          <div class="kb-wiki-import-group">
            <p class="kb-wiki-import-group-label">{{ t('knowledge.ingest.wikiImport.onConflict') }}</p>
            <div class="kb-wiki-import-options-grid">
              <label
                v-for="opt in conflictOptions"
                :key="opt.value"
                class="kb-wiki-import-conflict-tile"
                :class="onConflict === opt.value && 'kb-wiki-import-conflict-tile--active'"
              >
                <input
                  v-model="onConflict"
                  type="radio"
                  class="sr-only"
                  :value="opt.value"
                  :disabled="!canImport"
                />
                <span class="kb-wiki-import-conflict-tile__label">{{ opt.label }}</span>
              </label>
              <AppCheckbox v-model="syncAfter" variant="option" :disabled="!canImport || canSync === false">
                {{ t('knowledge.ingest.wikiImport.syncDefault') }}
              </AppCheckbox>
              <AppCheckbox v-model="lintPreview" variant="option" :disabled="!canImport">
                {{ t('knowledge.ingest.wikiImport.lintPreview') }}
              </AppCheckbox>
            </div>
            <p v-if="canImport && canSync === false" class="kb-wiki-import-hint">
              {{ t('knowledge.ingest.wikiImport.syncNoPermission') }}
            </p>
          </div>

          <div class="kb-wiki-import-footer">
            <button type="submit" class="btn-primary text-sm" :disabled="!canSubmit">
              <Loader2 v-if="importing" class="h-4 w-4 animate-spin" />
              <Upload v-else class="h-4 w-4" />
              {{ importing ? t('knowledge.ingest.wikiImport.importing') : t('knowledge.ingest.wikiImport.import') }}
            </button>
          </div>
        </div>
      </form>

      <aside class="kb-wiki-import-aside">
        <div
          v-if="result"
          class="rounded-lg border border-emerald-100 bg-emerald-50/50 p-3 text-xs dark:border-emerald-500/20 dark:bg-emerald-500/10"
        >
          <p class="font-semibold text-emerald-800 dark:text-emerald-200">{{ t('knowledge.ingest.wikiImport.resultTitle') }}</p>
          <p class="mt-1 text-gray-700 dark:text-gray-200">slug: {{ result.slug }}</p>
          <p class="text-gray-600 dark:text-gray-300">{{ result.relativePath }}</p>
          <p v-if="(result.lintWarnings ?? []).length" class="mt-2 text-amber-700 dark:text-amber-300">
            {{ t('knowledge.ingest.wikiImport.lintWarnings', { count: (result.lintWarnings ?? []).length }) }}
          </p>
          <p v-if="result.assetsImported?.length" class="mt-2 text-gray-600 dark:text-gray-300">
            {{ t('knowledge.ingest.wikiImport.assetsImported', { count: result.assetsImported.length }) }}
          </p>
        </div>
        <p v-else class="kb-wiki-import-aside-empty">{{ t('knowledge.ingest.wikiImport.resultEmpty') }}</p>
        <KbWorkflowNextSteps v-if="nextSteps.length" :steps="nextSteps" />
      </aside>
    </div>
  </div>
</template>
