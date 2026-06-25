<script setup lang="ts">
import { computed } from 'vue'
import KbDocumentEditPanel from '@/components/knowledge/KbDocumentEditPanel.vue'
import { useEscapeClose } from '@/composables/useEscapeClose'

const props = defineProps<{
  open: boolean
  documentId?: string | null
}>()

const emit = defineEmits<{
  close: []
  saved: []
  deleted: []
}>()

const activeId = computed(() => (props.open && props.documentId ? String(props.documentId) : ''))

useEscapeClose(
  computed(() => props.open),
  () => emit('close'),
)
</script>

<template>
  <Teleport to="body">
    <Transition name="kb-doc-drawer">
      <div v-if="open && activeId" class="kb-doc-drawer-backdrop" @click.self="emit('close')">
        <aside class="kb-doc-drawer" role="dialog" aria-modal="true" @click.stop>
          <KbDocumentEditPanel
            variant="drawer"
            :document-id="activeId"
            @close="emit('close')"
            @saved="emit('saved')"
            @deleted="emit('deleted')"
          />
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>
