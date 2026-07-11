<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ArrowRight, FileArchive, Loader2, Upload } from 'lucide-vue-next'
import FormField from '@/components/ui/FormField.vue'
import SegmentControl from '@/components/ui/SegmentControl.vue'
import { getRawPrefixSuggestionsApi, uploadRawApi, uploadRawZipApi, validateRawUploadFiles } from '@/api/knowledge'
import { showToast } from '@/composables/useToast'
import { API_SUCCESS_CODE } from '@/types/api'
import {
  collectRawHighlightPaths,
  validateRawUploadPrefix,
  validateRawUploadZip,
} from '@/utils/kbImport'
import type { IngestRawHighlightPayload, RawUploadConflict, RawUploadResultVo } from '@/types/kbImport'

type UploadMode = 'files' | 'zip'

const props = defineProps<{
  spaceId?: string
  canUpload: boolean
  blockedReason?: string
}>()

const emit = defineEmits<{
  'switch-tab': [tab: 'ingest', payload: IngestRawHighlightPayload]
}>()

const { t } = useI18n()

const uploadMode = ref<UploadMode>('files')
const prefix = ref('')
const prefixSuggestions = ref<string[]>([])
const prefixLoading = ref(false)
const onConflict = ref<RawUploadConflict>('SKIP')
const files = ref<File[]>([])
const zipFile = ref<File | null>(null)
const uploading = ref(false)
const result = ref<RawUploadResultVo | null>(null)
const dragOver = ref(false)

const uploadModeOptions = computed(() => [
  { value: 'files' as const, label: t('knowledge.ingest.rawUpload.modeFiles') },
  { value: 'zip' as const, label: t('knowledge.ingest.rawUpload.modeZip') },
])

const conflictOptions = computed(() => [
  { value: 'SKIP' as const, label: t('knowledge.ingest.rawUpload.conflictSkip') },
  { value: 'OVERWRITE' as const, label: t('knowledge.ingest.rawUpload.conflictOverwrite') },
  { value: 'RENAME' as const, label: t('knowledge.ingest.rawUpload.conflictRename') },
])

const canSubmit = computed(() => {
  if (!props.canUpload || !props.spaceId || !prefix.value.trim() || uploading.value) return false
  if (uploadMode.value === 'zip') return Boolean(zipFile.value)
  return files.value.length > 0
})

const highlightPaths = computed(() => (result.value ? collectRawHighlightPaths(result.value) : []))

async function loadPrefixSuggestions() {
  if (!props.canUpload) {
    prefixSuggestions.value = []
    return
  }
  prefixLoading.value = true
  try {
    prefixSuggestions.value = await getRawPrefixSuggestionsApi()
  } catch {
    prefixSuggestions.value = []
  } finally {
    prefixLoading.value = false
  }
}

watch(
  () => props.canUpload,
  () => void loadPrefixSuggestions(),
)

onMounted(() => {
  void loadPrefixSuggestions()
})

function addFiles(list: FileList | File[]) {
  const next = [...files.value]
  for (const f of list) {
    if (!next.some((x) => x.name === f.name && x.size === f.size)) next.push(f)
  }
  files.value = next.slice(0, 20)
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files?.length) addFiles(input.files)
  input.value = ''
}

function onZipChange(event: Event) {
  const input = event.target as HTMLInputElement
  const f = input.files?.[0] ?? null
  input.value = ''
  if (!f) return
  const err = validateRawUploadZip(f)
  if (err) {
    showToast('error', t(`knowledge.ingest.rawUpload.error.${err}`))
    return
  }
  zipFile.value = f
}

function onDrop(event: DragEvent) {
  dragOver.value = false
  if (!props.canUpload) return
  const list = event.dataTransfer?.files
  if (!list?.length) return
  if (uploadMode.value === 'zip') {
    const f = list[0]
    if (!f) return
    const err = validateRawUploadZip(f)
    if (err) {
      showToast('error', t(`knowledge.ingest.rawUpload.error.${err}`))
      return
    }
    zipFile.value = f
    return
  }
  addFiles(list)
}

function removeFile(index: number) {
  const next = [...files.value]
  next.splice(index, 1)
  files.value = next
}

function clearZip() {
  zipFile.value = null
}

async function submitUpload() {
  if (!canSubmit.value || !props.spaceId) return
  const prefixErr = validateRawUploadPrefix(prefix.value)
  if (prefixErr) {
    showToast('error', t(`knowledge.ingest.rawUpload.error.${prefixErr}`))
    return
  }
  uploading.value = true
  result.value = null
  try {
    let res
    if (uploadMode.value === 'zip') {
      const zipErr = validateRawUploadZip(zipFile.value)
      if (zipErr) {
        showToast('error', t(`knowledge.ingest.rawUpload.error.${zipErr}`))
        return
      }
      res = await uploadRawZipApi(props.spaceId, prefix.value.trim(), zipFile.value!, onConflict.value)
    } else {
      const err = validateRawUploadFiles(files.value)
      if (err) {
        showToast('error', t(`knowledge.ingest.rawUpload.error.${err}`))
        return
      }
      res = await uploadRawApi(props.spaceId, prefix.value.trim(), files.value, onConflict.value)
    }
    if (res.code !== API_SUCCESS_CODE || !res.data) {
      showToast('error', res.msg || t('knowledge.ingest.opFailed'))
      return
    }
    result.value = res.data
    const n = res.data.uploaded.length
    if (n) showToast('success', t('knowledge.ingest.rawUpload.success', { count: n }))
    else showToast('success', t('knowledge.ingest.rawUpload.noneUploaded'))
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('knowledge.ingest.opFailed'))
  } finally {
    uploading.value = false
  }
}

function goIngest() {
  if (!highlightPaths.value.length) return
  const expandPrefix = prefix.value.trim().replace(/^\/+|\/+$/g, '')
  emit('switch-tab', 'ingest', {
    highlightRawPaths: highlightPaths.value,
    expandPrefix: expandPrefix || undefined,
  })
}
</script>

<template>
  <div class="card p-5">
    <p v-if="blockedReason" class="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
      {{ blockedReason }}
    </p>

    <div class="grid gap-4 lg:grid-cols-2">
      <div class="grid gap-3">
        <SegmentControl v-model="uploadMode" :options="uploadModeOptions" :disabled="!canUpload" />

        <FormField :label="t('knowledge.ingest.rawUpload.prefix')" horizontal>
          <input
            v-model="prefix"
            type="text"
            class="field-input"
            list="kb-raw-prefix-suggestions"
            :placeholder="t('knowledge.ingest.rawUpload.prefixPlaceholder')"
            :disabled="!canUpload"
          />
          <datalist id="kb-raw-prefix-suggestions">
            <option v-for="p in prefixSuggestions" :key="p" :value="p" />
          </datalist>
        </FormField>
        <p class="text-xs text-gray-400">
          {{ prefixLoading ? t('knowledge.ingest.rawUpload.prefixLoading') : t('knowledge.ingest.rawUpload.prefixHint') }}
        </p>

        <div class="kb-raw-upload-conflict-block">
          <p class="kb-raw-upload-conflict-label">{{ t('knowledge.ingest.rawUpload.conflict') }}</p>
          <div class="kb-raw-upload-conflict-grid">
            <label
              v-for="opt in conflictOptions"
              :key="opt.value"
              class="kb-raw-upload-conflict-tile"
              :class="onConflict === opt.value && 'kb-raw-upload-conflict-tile--active'"
            >
              <input v-model="onConflict" type="radio" class="sr-only" :value="opt.value" :disabled="!canUpload" />
              <span class="kb-raw-upload-conflict-tile__label">{{ opt.label }}</span>
            </label>
          </div>
        </div>

        <div
          v-if="uploadMode === 'files'"
          class="app-upload-dropzone"
          :class="[
            dragOver && 'app-upload-dropzone--active',
            !canUpload && 'app-upload-dropzone--disabled',
          ]"
          @dragover.prevent="dragOver = canUpload"
          @dragleave.prevent="dragOver = false"
          @drop.prevent="onDrop"
        >
          <Upload class="app-upload-dropzone-icon" />
          <p class="app-upload-dropzone-hint">{{ t('knowledge.ingest.rawUpload.dropHint') }}</p>
          <p class="text-xs text-gray-400">{{ t('knowledge.ingest.rawUpload.fileLimit') }}</p>
          <label class="btn-upload-pick" :class="!canUpload && 'is-disabled'">
            {{ t('knowledge.ingest.rawUpload.pickFiles') }}
            <input type="file" class="sr-only" multiple accept=".md,.markdown,.txt" :disabled="!canUpload" @change="onFileChange" />
          </label>
        </div>

        <div
          v-else
          class="app-upload-dropzone"
          :class="[
            dragOver && 'app-upload-dropzone--active',
            !canUpload && 'app-upload-dropzone--disabled',
          ]"
          @dragover.prevent="dragOver = canUpload"
          @dragleave.prevent="dragOver = false"
          @drop.prevent="onDrop"
        >
          <FileArchive class="app-upload-dropzone-icon" />
          <p class="app-upload-dropzone-hint">{{ t('knowledge.ingest.rawUpload.zipDropHint') }}</p>
          <p class="text-xs text-gray-400">{{ t('knowledge.ingest.rawUpload.zipLimit') }}</p>
          <label class="btn-upload-pick" :class="!canUpload && 'is-disabled'">
            {{ t('knowledge.ingest.rawUpload.pickZip') }}
            <input type="file" class="sr-only" accept=".zip,application/zip" :disabled="!canUpload" @change="onZipChange" />
          </label>
        </div>

        <ul v-if="uploadMode === 'files' && files.length" class="space-y-1 rounded-lg border border-gray-100 p-2 text-xs dark:border-white/5">
          <li v-for="(f, i) in files" :key="`${f.name}-${f.size}`" class="flex items-center justify-between gap-2">
            <span class="truncate text-gray-700 dark:text-gray-200">{{ f.name }}</span>
            <button type="button" class="btn-ghost shrink-0 px-1 py-0 text-rose-600" :disabled="!canUpload" @click="removeFile(i)">×</button>
          </li>
        </ul>

        <div v-else-if="uploadMode === 'zip' && zipFile" class="flex items-center justify-between gap-2 rounded-lg border border-gray-100 p-2 text-xs dark:border-white/5">
          <span class="truncate text-gray-700 dark:text-gray-200">{{ zipFile.name }}</span>
          <button type="button" class="btn-ghost shrink-0 px-1 py-0 text-rose-600" :disabled="!canUpload" @click="clearZip">×</button>
        </div>

        <button type="button" class="btn-primary text-sm" :disabled="!canSubmit" @click="submitUpload">
          <Loader2 v-if="uploading" class="h-4 w-4 animate-spin" />
          <Upload v-else class="h-4 w-4" />
          {{ uploading ? t('knowledge.ingest.rawUpload.uploading') : t('knowledge.ingest.rawUpload.upload') }}
        </button>
      </div>

      <div>
        <h4 class="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-100">{{ t('knowledge.ingest.rawUpload.resultTitle') }}</h4>
        <p v-if="!result" class="text-xs text-gray-400">{{ t('knowledge.ingest.rawUpload.resultEmpty') }}</p>
        <template v-else>
          <div v-if="result.uploaded.length" class="mb-3">
            <p class="text-xs font-medium text-emerald-700 dark:text-emerald-300">{{ t('knowledge.ingest.rawUpload.uploaded') }}</p>
            <ul class="mt-1 max-h-40 overflow-y-auto rounded border border-emerald-100 text-xs dark:border-emerald-500/20">
              <li v-for="u in result.uploaded" :key="u.path" class="border-b border-emerald-50 px-2 py-1 last:border-0 dark:border-emerald-500/10">
                {{ u.path }} <span class="text-gray-400">({{ u.size }} B)</span>
              </li>
            </ul>
          </div>
          <div v-if="result.skipped.length" class="mb-3">
            <p class="text-xs font-medium text-amber-700 dark:text-amber-300">{{ t('knowledge.ingest.rawUpload.skipped') }}</p>
            <ul class="mt-1 text-xs text-gray-600 dark:text-gray-300">
              <li v-for="s in result.skipped" :key="s.path">{{ s.path }} — {{ s.reason }}</li>
            </ul>
          </div>
          <div v-if="result.renamed.length" class="mb-3">
            <p class="text-xs font-medium text-sky-700 dark:text-sky-300">{{ t('knowledge.ingest.rawUpload.renamed') }}</p>
            <ul class="mt-1 text-xs text-gray-600 dark:text-gray-300">
              <li v-for="r in result.renamed" :key="r.path">{{ r.originalName }} → {{ r.path }}</li>
            </ul>
          </div>
          <button
            v-if="highlightPaths.length"
            type="button"
            class="btn-primary mt-2 inline-flex items-center gap-1.5 text-sm"
            @click="goIngest"
          >
            {{ t('knowledge.ingest.rawUpload.goIngest') }}
            <ArrowRight class="h-4 w-4" />
          </button>
        </template>
      </div>
    </div>
  </div>
</template>
