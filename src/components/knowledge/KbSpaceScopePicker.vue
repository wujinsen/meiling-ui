<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Check, ChevronDown } from 'lucide-vue-next'
import { useEscapeClose } from '@/composables/useEscapeClose'
import { useKbSpaceScope } from '@/composables/useKbSpaceScope'
import { useKbSpace } from '@/composables/useKbSpace'
import { toEntityId } from '@/utils/id'

const props = withDefaults(
  defineProps<{
    writableOnly?: boolean
  }>(),
  { writableOnly: false },
)

const { t } = useI18n()
const { spaces, loading, loadError } = useKbSpace()
const {
  scopeSpaceIds,
  isAllSpaces,
  selectAllSpaces,
  toggleSpaceId,
  isSpaceSelected,
  ensureScopeReady,
} = useKbSpaceScope()

const displaySpaces = computed(() =>
  props.writableOnly ? spaces.value.filter((s) => s.canEdit === true) : spaces.value,
)

const open = ref(false)
const rootRef = ref<HTMLElement | null>(null)

useEscapeClose(open, () => {
  open.value = false
})

const triggerLabel = computed(() => {
  if (isAllSpaces.value) return t('knowledge.space.allAccessible')
  if (scopeSpaceIds.value.length === 1) {
    const id = scopeSpaceIds.value[0]
    const space = displaySpaces.value.find((s) => toEntityId(s.id) === id)
      ?? spaces.value.find((s) => toEntityId(s.id) === id)
    return space?.spaceName ?? id
  }
  return t('knowledge.space.selectedCount', { count: scopeSpaceIds.value.length })
})

function closePanel() {
  open.value = false
}

function toggleOpen() {
  open.value = !open.value
}

function onSelectAll() {
  selectAllSpaces()
  closePanel()
}

function onToggleSpace(id: string) {
  if (isAllSpaces.value) {
    toggleSpaceId(id)
    return
  }
  toggleSpaceId(id)
  if (scopeSpaceIds.value.length === 0) {
    selectAllSpaces()
  }
}

function onDocumentClick(event: MouseEvent) {
  if (!open.value || !rootRef.value) return
  if (!rootRef.value.contains(event.target as Node)) closePanel()
}

onMounted(() => {
  void ensureScopeReady()
  document.addEventListener('click', onDocumentClick)
})

onUnmounted(() => document.removeEventListener('click', onDocumentClick))
</script>

<template>
  <div v-if="loading && !spaces.length" class="text-xs text-gray-400">
    {{ t('knowledge.space.loading') }}
  </div>
  <p v-else-if="loadError" class="text-xs text-rose-500">{{ loadError }}</p>
  <p v-else-if="!displaySpaces.length" class="text-xs text-gray-400">
    {{ t('knowledge.accessDenied.emptyTitle') }}
  </p>
  <div v-else ref="rootRef" class="kb-space-dropdown">
    <button
      type="button"
      class="field-input kb-space-dropdown-trigger"
      :class="open && 'kb-space-dropdown-trigger-open'"
      :aria-expanded="open"
      @click.stop="toggleOpen"
    >
      <span class="kb-space-dropdown-value truncate">{{ triggerLabel }}</span>
      <ChevronDown class="h-4 w-4 shrink-0 text-gray-400 transition" :class="open && 'rotate-180'" />
    </button>
    <div v-if="open" class="kb-space-dropdown-panel kb-space-scope-panel" @click.stop>
      <button
        type="button"
        class="kb-space-dropdown-item kb-space-scope-item"
        :class="isAllSpaces && 'kb-space-dropdown-item-active'"
        @click="onSelectAll"
      >
        <span class="truncate">{{ t('knowledge.space.allAccessible') }}</span>
        <Check v-if="isAllSpaces" class="h-4 w-4 shrink-0 text-brand-600" />
      </button>
      <div class="kb-space-dropdown-divider" />
      <p class="px-3 py-1 text-[11px] text-gray-400">{{ t('knowledge.space.multiSelectHint') }}</p>
      <button
        v-for="s in displaySpaces"
        :key="toEntityId(s.id) ?? String(s.id)"
        type="button"
        class="kb-space-dropdown-item kb-space-scope-item"
        :class="isSpaceSelected(String(s.id)) && 'kb-space-dropdown-item-active'"
        @click="onToggleSpace(String(s.id))"
      >
        <span class="truncate">{{ s.spaceName }}</span>
        <Check
          v-if="isSpaceSelected(String(s.id))"
          class="h-4 w-4 shrink-0 text-brand-600"
        />
      </button>
    </div>
  </div>
</template>

<style scoped>
.kb-space-scope-panel {
  max-height: min(20rem, calc(100vh - 12rem));
  overflow-y: auto;
}

.kb-space-scope-item {
  @apply flex items-center justify-between gap-2;
}
</style>
