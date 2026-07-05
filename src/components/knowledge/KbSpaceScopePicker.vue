<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Check, ChevronDown, Layers } from 'lucide-vue-next'
import { useEscapeClose } from '@/composables/useEscapeClose'
import { useKbSpaceScope } from '@/composables/useKbSpaceScope'
import { useKbSpace } from '@/composables/useKbSpace'
import { toEntityId } from '@/utils/id'

const props = withDefaults(
  defineProps<{
    writableOnly?: boolean
    /** 显示「知识空间」标签 */
    showLabel?: boolean
    /** 侧栏内紧凑布局 */
    compact?: boolean
    /** 占满父容器宽度 */
    block?: boolean
  }>(),
  { writableOnly: false, showLabel: false, compact: false, block: false },
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

function spaceLabel(s: { spaceName?: string; spaceCode?: string; visibility?: number }) {
  const privateMark = s.visibility === 0 ? ` · ${t('knowledge.space.private')}` : ''
  return `${s.spaceName ?? s.spaceCode ?? ''}${privateMark}`
}

const triggerLabel = computed(() => {
  if (isAllSpaces.value) return t('knowledge.space.allAccessible')
  if (scopeSpaceIds.value.length === 1) {
    const id = scopeSpaceIds.value[0]
    const space = displaySpaces.value.find((s) => toEntityId(s.id) === id)
      ?? spaces.value.find((s) => toEntityId(s.id) === id)
    return space ? spaceLabel(space) : id
  }
  return t('knowledge.space.selectedCount', { count: scopeSpaceIds.value.length })
})

const selectionBadge = computed(() => {
  if (isAllSpaces.value) return null
  return scopeSpaceIds.value.length
})

function closePanel() {
  open.value = false
}

function toggleOpen() {
  open.value = !open.value
}

function onSelectAll() {
  selectAllSpaces()
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
  <div
    v-if="loading && !spaces.length"
    class="text-xs text-gray-400"
  >
    {{ t('knowledge.space.loading') }}
  </div>
  <p v-else-if="loadError" class="text-xs text-rose-500">{{ loadError }}</p>
  <p v-else-if="!displaySpaces.length" class="text-xs text-gray-400">
    {{ t('knowledge.accessDenied.emptyTitle') }}
  </p>
  <div
    v-else
    class="kb-space-scope-picker"
    :class="[
      compact && 'kb-space-scope-picker--compact',
      block && 'kb-space-scope-picker--block',
      open && 'kb-space-scope-picker--open',
    ]"
  >
    <span v-if="showLabel" class="kb-space-scope-picker-label">{{ t('knowledge.space.label') }}</span>
    <div ref="rootRef" class="kb-space-dropdown">
      <button
        type="button"
        class="kb-space-scope-trigger"
        :class="open && 'kb-space-scope-trigger-open'"
        :aria-expanded="open"
        @click.stop="toggleOpen"
      >
        <span class="kb-space-scope-trigger-icon" aria-hidden="true">
          <Layers class="h-4 w-4" />
        </span>
        <span class="kb-space-scope-trigger-body">
          <span class="kb-space-scope-trigger-value truncate">{{ triggerLabel }}</span>
        </span>
        <span v-if="selectionBadge != null" class="kb-space-scope-badge">{{ selectionBadge }}</span>
        <ChevronDown
          class="kb-space-scope-chevron h-4 w-4 shrink-0 text-gray-400 transition"
          :class="open && 'rotate-180'"
        />
      </button>
      <div v-if="open" class="kb-space-dropdown-panel kb-space-scope-panel" @click.stop>
        <button
          type="button"
          class="kb-space-dropdown-item kb-space-scope-item"
          :class="isAllSpaces && 'kb-space-dropdown-item-active'"
          @click="onSelectAll"
        >
          <span
            class="kb-space-scope-check"
            :class="isAllSpaces && 'kb-space-scope-check--on'"
          >
            <Check v-if="isAllSpaces" class="h-3 w-3" />
          </span>
          <span class="min-w-0 flex-1 truncate">{{ t('knowledge.space.allAccessible') }}</span>
        </button>
        <div class="kb-space-dropdown-divider" />
        <p class="kb-space-scope-hint">{{ t('knowledge.space.multiSelectHint') }}</p>
        <button
          v-for="s in displaySpaces"
          :key="toEntityId(s.id) ?? String(s.id)"
          type="button"
          class="kb-space-dropdown-item kb-space-scope-item"
          :class="isSpaceSelected(String(s.id)) && 'kb-space-dropdown-item-active'"
          @click="onToggleSpace(String(s.id))"
        >
          <span
            class="kb-space-scope-check"
            :class="isSpaceSelected(String(s.id)) && 'kb-space-scope-check--on'"
          >
            <Check v-if="isSpaceSelected(String(s.id))" class="h-3 w-3" />
          </span>
          <span class="min-w-0 flex-1 text-left">
            <span class="block truncate">{{ s.spaceName }}</span>
            <span v-if="s.spaceCode" class="block truncate text-[11px] font-normal text-gray-400">{{ s.spaceCode }}</span>
          </span>
        </button>
      </div>
    </div>
  </div>
</template>
