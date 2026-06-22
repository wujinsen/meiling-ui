<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Download, Loader2, Paperclip, Trash2, Upload } from 'lucide-vue-next'
import {
  deleteKbAttachmentApi,
  downloadKbAttachmentApi,
  listKbAttachmentsApi,
  uploadKbAttachmentApi,
} from '@/api/knowledge'
import { API_SUCCESS_CODE } from '@/types/api'
import { showToast } from '@/composables/useToast'
import type { KbAttachment } from '@/types/knowledge'

const props = defineProps<{
  documentId?: number | string
  canEdit?: boolean
}>()

const { t } = useI18n()

const loading = ref(false)
const uploading = ref(false)
const items = ref<KbAttachment[]>([])
const fileInput = ref<HTMLInputElement | null>(null)

function formatSize(bytes?: number) {
  if (bytes == null) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
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

async function onPickFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || !props.documentId) return
  uploading.value = true
  try {
    const res = await uploadKbAttachmentApi(props.documentId, file)
    if (res.code === API_SUCCESS_CODE) {
      showToast('success', t('knowledge.attachments.uploadOk'))
      await load()
    } else {
      throw new Error(res.msg || t('knowledge.attachments.uploadFailed'))
    }
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('knowledge.attachments.uploadFailed'))
  } finally {
    uploading.value = false
  }
}

async function onDownload(item: KbAttachment) {
  try {
    await downloadKbAttachmentApi(item.id, item.fileName)
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('knowledge.attachments.downloadFailed'))
  }
}

async function onDelete(item: KbAttachment) {
  try {
    const res = await deleteKbAttachmentApi(item.id)
    if (res.code !== API_SUCCESS_CODE) throw new Error(res.msg || t('knowledge.attachments.deleteFailed'))
    showToast('success', t('knowledge.attachments.deleteOk'))
    await load()
  } catch (e) {
    showToast('error', e instanceof Error ? e.message : t('knowledge.attachments.deleteFailed'))
  }
}

onMounted(() => load())
watch(() => props.documentId, () => load())
</script>

<template>
  <section v-if="documentId" class="mt-6 border-t border-gray-100 pt-4 dark:border-white/5">
    <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
      <h3 class="flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-200">
        <Paperclip class="h-4 w-4" /> {{ t('knowledge.attachments.title') }}
      </h3>
      <div v-if="canEdit" class="flex items-center gap-2">
        <input ref="fileInput" type="file" class="hidden" @change="onPickFile" />
        <button type="button" class="btn-ghost text-xs" :disabled="uploading" @click="fileInput?.click()">
          <Loader2 v-if="uploading" class="h-3.5 w-3.5 animate-spin" />
          <Upload v-else class="h-3.5 w-3.5" />
          {{ t('knowledge.attachments.upload') }}
        </button>
      </div>
    </div>

    <p v-if="loading" class="text-sm text-gray-400">{{ t('common.loading') }}</p>
    <p v-else-if="!items.length" class="text-sm text-gray-400">{{ t('knowledge.attachments.empty') }}</p>
    <ul v-else class="space-y-1.5">
      <li
        v-for="item in items"
        :key="item.id"
        class="flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm dark:bg-white/5"
      >
        <div class="min-w-0">
          <p class="truncate font-medium text-gray-800 dark:text-gray-100">{{ item.fileName }}</p>
          <p class="text-xs text-gray-400">{{ formatSize(item.fileSize) }}</p>
        </div>
        <div class="flex shrink-0 items-center gap-1">
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
  </section>
</template>
