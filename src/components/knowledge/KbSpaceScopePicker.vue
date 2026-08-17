<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Check, ChevronDown, Layers } from 'lucide-vue-next'
import { useEscapeClose } from '@/composables/useEscapeClose'
import { useKbSpaceScope } from '@/composables/useKbSpaceScope'
import { useKbSpace } from '@/composables/useKbSpace'
import { toEntityId } from '@/utils/id'

const props = withDefaults(
  defineProps<{
    writableOnly?: boolean
    /** @deprecated 使用 writableOnly */
    editableOnly?: boolean
    /** 单选模式（关系图谱 / 健康体检等），绑定 useKbSpace.selectedSpaceCode */
    singleSelect?: boolean
    /** 单选时隐藏「全部可读空间」（Wiki Sync 等必须指定空间） */
    hideAllOption?: boolean
    /** 显示「知识空间」标签 */
    showLabel?: boolean
    /** 侧栏内紧凑布局 */
    compact?: boolean
    /** 占满父容器宽度 */
    block?: boolean
  }>(),
  {
    writableOnly: false,
    editableOnly: false,
    singleSelect: false,
    hideAllOption: false,
    showLabel: false,
    compact: false,
    block: false,
  },
)

const { t } = useI18n()
const {
  spaces,
  loading,
  loadError,
  selectedSpaceCode,
  setSelectedSpaceCode,
  ensureSpacesLoaded,
} = useKbSpace()
const {
  scopeSpaceIds,
  isAllSpaces,
  selectAllSpaces,
  toggleSpaceId,
  isSpaceSelected,
  ensureScopeReady,
} = useKbSpaceScope()

const writableOnly = computed(() => props.writableOnly || props.editableOnly)
const hideAll = computed(() => props.hideAllOption)

const displaySpaces = computed(() =>
  writableOnly.value ? spaces.value.filter((s) => s.canEdit === true) : spaces.value,
)

const open = ref(false)
const rootRef = ref<HTMLElement | null>(null)

useEscapeClose(open, () => {
  open.value = false
})

function spaceLabel(s: { spaceName?: string; spaceCode?: string; visibility?: number; canEdit?: boolean }) {
  const privateMark = s.visibility === 0 ? ` · ${t('knowledge.space.private')}` : ''
  const readOnlyMark =
    hideAll.value && props.singleSelect && s.canEdit !== true ? ` · ${t('knowledge.space.readOnly')}` : ''
  return `${s.spaceName ?? s.spaceCode ?? ''}${privateMark}${readOnlyMark}`
}

function findSpaceByCode(code: string | null) {
  if (!code) return undefined
  return displaySpaces.value.find((s) => s.spaceCode === code) ?? spaces.value.find((s) => s.spaceCode === code)
}

const triggerLabel = computed(() => {
  if (props.singleSelect) {
    if (!hideAll.value && selectedSpaceCode.value == null) {
      return t('knowledge.space.allAccessible')
    }
    const space = findSpaceByCode(selectedSpaceCode.value)
    return space ? spaceLabel(space) : selectedSpaceCode.value ?? t('knowledge.space.allAccessible')
  }

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
  if (props.singleSelect || isAllSpaces.value) return null
  return scopeSpaceIds.value.length
})

function isSingleAllActive() {
  return !hideAll.value && selectedSpaceCode.value == null
}

function isSingleSpaceActive(code: string) {
  return selectedSpaceCode.value === code
}

function closePanel() {
  open.value = false
}

function toggleOpen() {
  open.value = !open.value
}

function onSelectAll() {
  if (props.singleSelect) {
    setSelectedSpaceCode(null)
    closePanel()
    return
  }
  selectAllSpaces()
}

function onSelectSingleSpace(code: string) {
  setSelectedSpaceCode(code)
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

function ensureValidSingleSelection() {
  if (!props.singleSelect || !hideAll.value || !displaySpaces.value.length) return
  const cur = selectedSpaceCode.value
  const ok = cur != null && displaySpaces.value.some((s) => s.spaceCode === cur)
  if (!ok) setSelectedSpaceCode(displaySpaces.value[0].spaceCode)
}

function onDocumentClick(event: MouseEvent) {
  if (!open.value || !rootRef.value) return
  if (!rootRef.value.contains(event.target as Node)) closePanel()
}

onMounted(() => {
  if (props.singleSelect) {
    void ensureSpacesLoaded().then(() => ensureValidSingleSelection())
  } else {
    void ensureScopeReady()
  }
  document.addEventListener('click', onDocumentClick)
})

watch(
  () => [displaySpaces.value.map((s) => s.spaceCode).join(','), props.singleSelect, hideAll.value] as const,
  () => {
    if (props.singleSelect) ensureValidSingleSelection()
  },
)

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
    {{ writableOnly ? t('knowledge.docManage.noEditableSpace') : t('knowledge.accessDenied.emptyTitle') }}
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
        <!-- 单选：与文档浏览同款触发器 + 列表选中条（无多选勾选框） -->
        <template v-if="singleSelect">
          <button
            v-if="!hideAll"
            type="button"
            class="kb-space-dropdown-item"
            :class="isSingleAllActive() && 'kb-space-dropdown-item-active'"
            @click="onSelectAll"
          >
            <span class="truncate">{{ t('knowledge.space.allAccessible') }}</span>
          </button>
          <div v-if="!hideAll" class="kb-space-dropdown-divider" />
          <button
            v-for="s in displaySpaces"
            :key="s.spaceCode"
            type="button"
            class="kb-space-dropdown-item"
            :class="isSingleSpaceActive(s.spaceCode) && 'kb-space-dropdown-item-active'"
            @click="onSelectSingleSpace(s.spaceCode)"
          >
            <span class="truncate">{{ spaceLabel(s) }}</span>
          </button>
        </template>

        <!-- 多选：文档浏览 -->
        <template v-else>
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
        </template>
      </div>
    </div>
  </div>
</template>
