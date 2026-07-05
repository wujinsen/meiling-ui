<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { fetchKbAssetBlob, resolveKbAssetUrl, type KbAssetUrlContext } from '@/utils/kbAssetUrl'

const props = defineProps<{
  src: string
  alt?: string
  title?: string
  spaceId: string
  documentSlug?: string
  apiBase?: string
}>()

const { t } = useI18n()

const blobUrl = ref('')
const failed = ref(false)
let ownedBlobUrl: string | null = null

function ctx(): KbAssetUrlContext {
  return {
    spaceId: props.spaceId,
    documentSlug: props.documentSlug ?? '',
    apiBase: props.apiBase,
  }
}

async function load() {
  failed.value = false
  blobUrl.value = ''
  if (ownedBlobUrl) {
    URL.revokeObjectURL(ownedBlobUrl)
    ownedBlobUrl = null
  }

  const resolved = resolveKbAssetUrl(props.src, ctx())
  if (!resolved) {
    if (/^https?:\/\//i.test(props.src.trim())) {
      blobUrl.value = props.src.trim()
    } else {
      failed.value = true
    }
    return
  }

  try {
    const url = await fetchKbAssetBlob(resolved)
    ownedBlobUrl = url
    blobUrl.value = url
  } catch {
    failed.value = true
  }
}

watch(
  () => [props.src, props.spaceId, props.documentSlug, props.apiBase] as const,
  () => void load(),
  { immediate: true },
)

onBeforeUnmount(() => {
  if (ownedBlobUrl) {
    URL.revokeObjectURL(ownedBlobUrl)
    ownedBlobUrl = null
  }
})
</script>

<template>
  <img
    v-if="blobUrl && !failed"
    :src="blobUrl"
    :alt="alt"
    :title="title"
    class="kb-md-img kb-md-img-loaded"
    loading="lazy"
    decoding="async"
  />
  <span v-else-if="failed" class="kb-md-image--error">[{{ t('knowledge.markdownImage.loadFailed') }}]</span>
</template>
