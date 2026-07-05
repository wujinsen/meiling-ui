<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ImagePlus, Loader2 } from 'lucide-vue-next'
import { uploadKbWikiAssetApi } from '@/api/knowledge'
import { API_SUCCESS_CODE } from '@/types/api'
import { showToast } from '@/composables/useToast'
import {
  KB_WIKI_ASSET_MAX_BYTES,
  formatKbWikiAssetMaxSize,
} from '@/constants/knowledge'

const props = withDefaults(
  defineProps<{
    slug: string
    spaceId?: string
    canEdit?: boolean
    /** wiki .md 文件是否已在服务器存在（须先保存） */
    pageExists?: boolean
  }>(),
  {
    canEdit: false,
    pageExists: false,
  },
)

const emit = defineEmits<{
  insert: [markdown: string]
}>()

const { t } = useI18n()
const fileInput = ref<HTMLInputElement | null>(null)
const uploading = ref(false)

const disabled = () => !props.canEdit || !props.pageExists || !props.spaceId || !props.slug || uploading.value

function openPicker() {
  if (disabled()) return
  fileInput.value?.click()
}

async function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const files = input.files
  if (!files?.length || !props.spaceId || !props.slug) {
    input.value = ''
    return
  }

  uploading.value = true
  try {
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) {
        showToast('error', t('knowledge.wikiImage.notImage', { name: file.name }))
        continue
      }
      if (file.size > KB_WIKI_ASSET_MAX_BYTES) {
        showToast(
          'error',
          t('knowledge.wikiImage.fileTooLarge', {
            name: file.name,
            max: formatKbWikiAssetMaxSize(),
          }),
        )
        continue
      }

      const res = await uploadKbWikiAssetApi(props.spaceId, props.slug, file)
      if (res.code === API_SUCCESS_CODE && res.data?.markdown) {
        emit('insert', `${res.data.markdown}\n`)
        showToast('success', t('knowledge.wikiImage.uploadOk', { name: file.name }))
      } else {
        showToast('error', res.msg || t('knowledge.wikiImage.uploadFailed'))
      }
    }
  } catch {
    showToast('error', t('knowledge.wikiImage.uploadFailed'))
  } finally {
    uploading.value = false
    input.value = ''
  }
}
</script>

<template>
  <div class="inline-flex items-center gap-2">
    <input
      ref="fileInput"
      type="file"
      accept="image/png,image/jpeg,image/gif,image/webp"
      class="hidden"
      multiple
      @change="onFileChange"
    />
    <button
      type="button"
      class="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10"
      :disabled="disabled()"
      :title="pageExists ? t('knowledge.wikiImage.hint', { max: formatKbWikiAssetMaxSize() }) : t('knowledge.wikiImage.saveFirst')"
      @click="openPicker"
    >
      <Loader2 v-if="uploading" class="h-3.5 w-3.5 animate-spin" />
      <ImagePlus v-else class="h-3.5 w-3.5" />
      {{ t('knowledge.wikiImage.insert') }}
    </button>
  </div>
</template>
