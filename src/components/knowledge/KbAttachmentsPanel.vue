<script setup lang="ts">

import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

import { useI18n } from 'vue-i18n'

import { Download, File, Loader2, Paperclip, Trash2, Upload } from 'lucide-vue-next'

import {

  deleteKbAttachmentApi,

  downloadKbAttachmentApi,

  listKbAttachmentsApi,

  uploadKbAttachmentApi,

} from '@/api/knowledge'

import { API_SUCCESS_CODE } from '@/types/api'

import { showToast } from '@/composables/useToast'

import { useEscapeClose } from '@/composables/useEscapeClose'

import { formatKbAttachmentMaxSize, KB_ATTACHMENT_MAX_BYTES } from '@/constants/knowledge'

import type { KbAttachment } from '@/types/knowledge'



const props = defineProps<{

  documentId?: number | string

  canEdit?: boolean

}>()



const { t } = useI18n()



const open = ref(false)

const dragOver = ref(false)

const rootRef = ref<HTMLElement | null>(null)

const loading = ref(false)

const uploading = ref(false)

const uploadProgress = ref<{ current: number; total: number; name: string } | null>(null)

const items = ref<KbAttachment[]>([])

const fileInput = ref<HTMLInputElement | null>(null)



useEscapeClose(open, () => {

  open.value = false

})



const hasDocument = computed(() => props.documentId != null && props.documentId !== '')

const countLabel = computed(() => (items.value.length > 0 ? String(items.value.length) : ''))

const maxSizeLabel = computed(() => formatKbAttachmentMaxSize())



function formatSize(bytes?: number) {

  if (bytes == null) return '-'

  if (bytes < 1024) return `${bytes} B`

  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`

}



function closePanel() {

  open.value = false

  dragOver.value = false

}



function togglePanel() {

  if (!hasDocument.value) {

    showToast('error', t('knowledge.attachments.noDocHint'))

    return

  }

  open.value = !open.value

}



function onUploadClick() {

  if (!hasDocument.value) {

    showToast('error', t('knowledge.attachments.noDocHint'))

    return

  }

  if (!props.canEdit) {

    showToast('error', t('knowledge.attachments.readOnlyHint'))

    return

  }

  fileInput.value?.click()

}



async function load() {

  if (!props.documentId) {

    items.value = []

    return

  }

  loading.value = true

  try {

    const res = await listKbAttachmentsApi(props.documentId)

    if (res.code === API_SUCCESS_CODE) items.value = res.data ?? []

  } finally {

    loading.value = false

  }

}



function validateFile(file: File) {

  if (file.size <= 0) {

    return t('knowledge.attachments.fileEmpty', { name: file.name })

  }

  if (file.size > KB_ATTACHMENT_MAX_BYTES) {

    return t('knowledge.attachments.fileTooLarge', { name: file.name, max: maxSizeLabel.value })

  }

  return null

}



async function uploadFile(file: File) {

  if (!props.documentId || !props.canEdit) return false

  const res = await uploadKbAttachmentApi(props.documentId, file)

  if (res.code === API_SUCCESS_CODE) return true

  throw new Error(res.msg || t('knowledge.attachments.uploadFailed'))

}



async function uploadFiles(files: File[]) {

  if (!props.documentId || !props.canEdit || !files.length) return



  const valid: File[] = []

  for (const file of files) {

    const err = validateFile(file)

    if (err) showToast('error', err)

    else valid.push(file)

  }

  if (!valid.length) return



  uploading.value = true

  uploadProgress.value = { current: 0, total: valid.length, name: valid[0].name }

  let successCount = 0



  try {

    for (let i = 0; i < valid.length; i++) {

      const file = valid[i]

      uploadProgress.value = { current: i + 1, total: valid.length, name: file.name }

      try {

        if (await uploadFile(file)) successCount++

      } catch (e) {

        showToast(

          'error',

          e instanceof Error ? e.message : t('knowledge.attachments.uploadFailed'),

        )

      }

    }



    if (successCount > 0) {

      showToast(

        'success',

        successCount === 1

          ? t('knowledge.attachments.uploadOk')

          : t('knowledge.attachments.uploadBatchOk', { count: successCount }),

      )

      await load()

      open.value = true

    }

  } finally {

    uploading.value = false

    uploadProgress.value = null

    dragOver.value = false

  }

}



async function onPickFile(event: Event) {

  const input = event.target as HTMLInputElement

  const files = Array.from(input.files ?? [])

  input.value = ''

  await uploadFiles(files)

}



function onDropzoneKeydown(event: KeyboardEvent) {

  if (event.key === 'Enter' || event.key === ' ') {

    event.preventDefault()

    onUploadClick()

  }

}



function onDragOver(event: DragEvent) {

  if (!props.canEdit) return

  event.preventDefault()

  dragOver.value = true

}



function onDragLeave() {

  dragOver.value = false

}



async function onDrop(event: DragEvent) {

  dragOver.value = false

  if (!props.canEdit) {

    showToast('error', t('knowledge.attachments.readOnlyHint'))

    return

  }

  event.preventDefault()

  const files = Array.from(event.dataTransfer?.files ?? [])

  await uploadFiles(files)

}



async function onDownload(item: KbAttachment) {

  try {

    await downloadKbAttachmentApi(item.id, item.fileName)

  } catch (e) {

    showToast('error', e instanceof Error ? e.message : t('knowledge.attachments.downloadFailed'))

  }

}



async function onDelete(item: KbAttachment) {

  if (!props.canEdit) {

    showToast('error', t('knowledge.attachments.readOnlyHint'))

    return

  }

  try {

    const res = await deleteKbAttachmentApi(item.id)

    if (res.code !== API_SUCCESS_CODE) throw new Error(res.msg || t('knowledge.attachments.deleteFailed'))

    showToast('success', t('knowledge.attachments.deleteOk'))

    await load()

  } catch (e) {

    showToast('error', e instanceof Error ? e.message : t('knowledge.attachments.deleteFailed'))

  }

}



function onDocumentClick(event: MouseEvent) {

  if (!open.value || !rootRef.value) return

  if (!rootRef.value.contains(event.target as Node)) closePanel()

}



watch(

  () => props.documentId,

  () => {

    closePanel()

    void load()

  },

)



onMounted(() => {

  void load()

  document.addEventListener('click', onDocumentClick)

})

onUnmounted(() => document.removeEventListener('click', onDocumentClick))

</script>



<template>

  <div ref="rootRef" class="kb-attachments-toolbar">

    <input ref="fileInput" type="file" class="hidden" multiple @change="onPickFile" />



    <button

      type="button"

      class="field-input kb-attachments-trigger"

      :class="[open && 'kb-space-dropdown-trigger-open', !hasDocument && 'kb-attachments-trigger-disabled']"

      :aria-expanded="open"

      :title="!hasDocument ? t('knowledge.attachments.noDocHint') : undefined"

      @click.stop="togglePanel"

    >

      <Paperclip class="h-4 w-4 shrink-0 text-gray-400" />

      <span class="kb-attachments-trigger-label">{{ t('knowledge.attachments.title') }}</span>

      <span v-if="countLabel" class="badge shrink-0 bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300">{{ countLabel }}</span>

    </button>



    <div v-if="open && hasDocument" class="kb-attachments-panel" @click.stop>

      <div class="kb-attachments-panel-head">

        <span class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('knowledge.attachments.title') }}</span>

        <span v-if="countLabel" class="text-xs text-gray-400">{{ t('knowledge.attachments.count', { count: items.length }) }}</span>

      </div>



      <div

        v-if="canEdit"

        class="kb-attachments-dropzone"

        :class="[dragOver && 'kb-attachments-dropzone-active', uploading && 'pointer-events-none opacity-70']"

        role="button"

        tabindex="0"

        @click="onUploadClick"

        @keydown="onDropzoneKeydown"

        @dragover="onDragOver"

        @dragleave="onDragLeave"

        @drop="onDrop"

      >

        <Loader2 v-if="uploading" class="h-5 w-5 animate-spin text-brand-500" />

        <Upload v-else class="h-5 w-5 text-brand-500" />

        <p class="text-sm font-medium text-gray-700 dark:text-gray-200">{{ t('knowledge.attachments.dropHint') }}</p>

        <p class="text-xs text-gray-400">{{ t('knowledge.attachments.dropSub', { max: maxSizeLabel }) }}</p>

        <p v-if="uploadProgress" class="text-xs text-brand-600 dark:text-brand-300">

          {{

            t('knowledge.attachments.uploadingProgress', {

              current: uploadProgress.current,

              total: uploadProgress.total,

              name: uploadProgress.name,

            })

          }}

        </p>

      </div>

      <p v-else class="kb-attachments-readonly-hint">{{ t('knowledge.attachments.readOnlyHint') }}</p>



      <p v-if="loading" class="px-4 py-3 text-sm text-gray-400">{{ t('common.loading') }}</p>

      <p v-else-if="!items.length" class="px-4 py-3 text-sm text-gray-400">{{ t('knowledge.attachments.empty') }}</p>

      <ul v-else class="kb-attachments-list">

        <li v-for="item in items" :key="item.id" class="kb-attachments-item">

          <File class="h-4 w-4 shrink-0 text-gray-400" />

          <div class="min-w-0 flex-1">

            <p class="truncate text-sm font-medium text-gray-800 dark:text-gray-100">{{ item.fileName }}</p>

            <p class="text-xs text-gray-400">{{ formatSize(item.fileSize) }}</p>

          </div>

          <div class="flex shrink-0 items-center gap-0.5">

            <button type="button" class="btn-ghost p-1.5" :title="t('knowledge.attachments.download')" @click="onDownload(item)">

              <Download class="h-4 w-4" />

            </button>

            <button

              v-if="canEdit"

              type="button"

              class="btn-ghost p-1.5 text-rose-500"

              :title="t('knowledge.attachments.delete')"

              @click="onDelete(item)"

            >

              <Trash2 class="h-4 w-4" />

            </button>

          </div>

        </li>

      </ul>

    </div>

  </div>

</template>


