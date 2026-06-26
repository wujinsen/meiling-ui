<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Loader2 } from 'lucide-vue-next'
import { getKbDocumentApi } from '@/api/knowledge'
import { showToast } from '@/composables/useToast'
import { API_SUCCESS_CODE } from '@/types/api'
import { kbWikiEditPath } from '@/router/knowledgeSupplementRoutes'
import { toEntityId } from '@/utils/id'

/** 旧路由 /documents/edit/:id → 按 slug 重定向到 Wiki 编辑（不再使用 MySQL 正文编辑） */
const route = useRoute()
const router = useRouter()
const { t } = useI18n()

const loading = ref(true)

const documentId = computed(() => {
  const raw = route.params.id
  const id = Array.isArray(raw) ? raw[0] : raw
  return toEntityId(id) ?? ''
})

onMounted(async () => {
  if (!documentId.value) {
    void router.replace('/knowledge/documents')
    return
  }
  try {
    const res = await getKbDocumentApi(documentId.value)
    if (res.code === API_SUCCESS_CODE && res.data?.slug) {
      void router.replace(kbWikiEditPath(res.data.slug, res.data.spaceId))
      return
    }
    showToast('error', t('knowledge.docManage.wikiEditOnly'))
    void router.replace('/knowledge/documents')
  } catch {
    showToast('error', t('knowledge.docManage.wikiEditOnly'))
    void router.replace('/knowledge/documents')
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="flex min-h-[40vh] items-center justify-center text-sm text-gray-400">
    <Loader2 v-if="loading" class="h-5 w-5 animate-spin" />
    <span v-else>{{ t('common.loading') }}</span>
  </div>
</template>
