<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ExternalLink } from 'lucide-vue-next'
import AppModal from '@/components/ui/AppModal.vue'
import { getKbDocumentApi, getKbPageApi } from '@/api/knowledge'
import { useKbMarkdownRender } from '@/composables/useKbMarkdownRender'
import { API_SUCCESS_CODE } from '@/types/api'
import { renderMarkdown } from '@/utils/markdown'
import type { KbPage } from '@/types/knowledge'

const props = defineProps<{
  open: boolean
  title?: string
  slug?: string
  docId?: number | string
  spaceId?: number | string
}>()

const emit = defineEmits<{
  close: []
  'open-slug': [slug: string, spaceId?: number | string]
}>()

const { t } = useI18n()

const loading = ref(false)
const page = ref<KbPage | null>(null)
const markdownRootRef = ref<HTMLElement | null>(null)

const previewHtml = computed(() => renderMarkdown(page.value?.content))

const markdownAssetCtx = computed(() => ({
  documentSlug: page.value?.slug ?? props.slug,
  spaceId: page.value?.spaceId ?? props.spaceId,
}))

useKbMarkdownRender(markdownRootRef, markdownAssetCtx, previewHtml)

async function load() {
  if (!props.open) return
  loading.value = true
  page.value = null
  try {
    if (props.slug) {
      const res = await getKbPageApi(props.slug, props.spaceId)
      if (res.code === API_SUCCESS_CODE) page.value = res.data ?? null
      return
    }
    if (props.docId != null) {
      const res = await getKbDocumentApi(props.docId)
      if (res.code === API_SUCCESS_CODE && res.data) {
        const d = res.data
        page.value = {
          docId: d.id,
          spaceId: d.spaceId,
          slug: d.slug ?? '',
          title: d.title,
          summary: d.summary,
          content: d.content,
          kbType: d.kbType,
          domain: d.domain,
          status: d.status,
        }
      }
    }
  } finally {
    loading.value = false
  }
}

function onContentClick(event: MouseEvent) {
  const target = (event.target as HTMLElement)?.closest('[data-slug]') as HTMLElement | null
  if (target?.dataset.slug) {
    event.preventDefault()
    emit('open-slug', target.dataset.slug, page.value?.spaceId)
  }
}

watch(
  () => [props.open, props.slug, props.docId, props.spaceId] as const,
  () => load(),
  { immediate: true },
)
</script>

<template>
  <AppModal
    :open="open"
    :title="page?.title || title || t('knowledge.browse.detailEmpty')"
    wide
    @close="emit('close')"
  >
    <p v-if="loading" class="py-10 text-center text-sm text-gray-400">{{ t('common.loading') }}</p>
    <div v-else-if="page">
      <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p class="font-mono text-xs text-gray-400">{{ page.slug }}</p>
        <button
          v-if="page.slug"
          type="button"
          class="btn-ghost text-xs"
          @click="emit('open-slug', page.slug, page.spaceId)"
        >
          <ExternalLink class="h-3.5 w-3.5" /> {{ t('knowledge.preview.openInBrowse') }}
        </button>
      </div>
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div ref="markdownRootRef" class="kb-markdown max-h-[70vh] overflow-y-auto" @click="onContentClick" v-html="previewHtml" />
    </div>
    <p v-else class="py-10 text-center text-sm text-gray-400">{{ t('knowledge.browse.pageNotFound') }}</p>
  </AppModal>
</template>
