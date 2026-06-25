<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import KbDocumentEditPanel from '@/components/knowledge/KbDocumentEditPanel.vue'
import { toEntityId } from '@/utils/id'

const route = useRoute()

const documentId = computed(() => {
  const raw = route.params.id
  const id = Array.isArray(raw) ? raw[0] : raw
  return toEntityId(id) ?? ''
})
</script>

<template>
  <div class="page-stack kb-doc-edit-page-wrap kb-doc-manage-fill">
    <KbDocumentEditPanel v-if="documentId" variant="page" :document-id="documentId" />
  </div>
</template>
