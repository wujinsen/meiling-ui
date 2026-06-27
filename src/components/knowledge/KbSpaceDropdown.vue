<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronDown } from 'lucide-vue-next'
import { useEscapeClose } from '@/composables/useEscapeClose'
import { useKbSpace } from '@/composables/useKbSpace'
import type { KbAccessibleSpace } from '@/types/knowledge'
import { toEntityId } from '@/utils/id'

const props = withDefaults(
  defineProps<{
    /** 隐藏「全部可读空间」选项（文档管理等必须单选空间） */
    hideAllOption?: boolean
    /** 仅展示可编辑空间（新建文档等场景） */
    writableOnly?: boolean
    /**
     * @deprecated 等价于 hideAllOption + writableOnly
     */
    editableOnly?: boolean
    /** v-model 绑定 spaceCode（默认）或 spaceId */
    valueField?: 'code' | 'id'
  }>(),
  { hideAllOption: false, writableOnly: false, editableOnly: false, valueField: 'code' },
)

/** 单选：'all' 或空间 code/id */
const singleValue = defineModel<string>({ default: 'all' })

const { t } = useI18n()
const { spaces, loading, loadError, ensureSpacesLoaded } = useKbSpace()

const hideAll = computed(() => props.hideAllOption || props.editableOnly)
const writableOnly = computed(() => props.writableOnly || props.editableOnly)

const displaySpaces = computed(() =>
  writableOnly.value ? spaces.value.filter((s) => s.canEdit === true) : spaces.value,
)

const open = ref(false)
const rootRef = ref<HTMLElement | null>(null)

useEscapeClose(open, () => {
  open.value = false
})

function spaceIdValue(id: number | string) {
  return toEntityId(id) ?? String(id)
}

function spaceOptionValue(s: KbAccessibleSpace) {
  return props.valueField === 'id' ? spaceIdValue(s.id) : s.spaceCode
}

function spaceLabel(s: { spaceName?: string; visibility?: number; canEdit?: boolean }) {
  const privateMark = s.visibility === 0 ? ` · ${t('knowledge.space.private')}` : ''
  const readOnlyMark = hideAll.value && s.canEdit !== true ? ` · ${t('knowledge.space.readOnly')}` : ''
  return `${s.spaceName ?? ''}${privateMark}${readOnlyMark}`
}

function findSpaceByValue(value: string) {
  if (props.valueField === 'id') {
    return displaySpaces.value.find((s) => spaceIdValue(s.id) === value)
      ?? spaces.value.find((s) => spaceIdValue(s.id) === value)
  }
  return displaySpaces.value.find((s) => s.spaceCode === value)
    ?? spaces.value.find((s) => s.spaceCode === value)
}

function spaceNameByValue(value: string) {
  const space = findSpaceByValue(value)
  return space ? spaceLabel(space) : value
}

const triggerLabel = computed(() => {
  if (!hideAll.value && singleValue.value === 'all') return t('knowledge.space.allAccessible')
  return spaceNameByValue(singleValue.value)
})

function isAllActive() {
  return singleValue.value === 'all'
}

function isSpaceActive(value: string) {
  return singleValue.value === value
}

function closePanel() {
  open.value = false
}

function toggleOpen() {
  open.value = !open.value
}

function selectAll() {
  singleValue.value = 'all'
  closePanel()
}

function selectSpace(value: string) {
  singleValue.value = value
  closePanel()
}

function ensureValidSelection() {
  if (!hideAll.value || !displaySpaces.value.length) return
  const cur = singleValue.value
  const ok = displaySpaces.value.some((s) => spaceOptionValue(s) === cur)
  if (!ok || cur === 'all') singleValue.value = spaceOptionValue(displaySpaces.value[0])
}

function onDocumentClick(event: MouseEvent) {
  if (!open.value || !rootRef.value) return
  if (!rootRef.value.contains(event.target as Node)) closePanel()
}

onMounted(() => {
  void ensureSpacesLoaded().then(() => ensureValidSelection())
  document.addEventListener('click', onDocumentClick)
})

watch(
  () => [displaySpaces.value.map((s) => spaceOptionValue(s)).join(','), props.valueField] as const,
  () => ensureValidSelection(),
)
onUnmounted(() => document.removeEventListener('click', onDocumentClick))
</script>

<template>
  <div v-if="loading && !spaces.length" class="text-xs text-gray-400">
    {{ t('knowledge.space.loading') }}
  </div>
  <p v-else-if="loadError" class="text-xs text-rose-500">{{ loadError }}</p>
  <p v-else-if="!displaySpaces.length" class="text-xs text-gray-400">
    {{ writableOnly ? t('knowledge.docManage.noEditableSpace') : t('knowledge.accessDenied.emptyTitle') }}
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
      <ChevronDown
        class="h-4 w-4 shrink-0 text-gray-400 transition"
        :class="open && 'rotate-180'"
      />
    </button>
    <div v-if="open" class="kb-space-dropdown-panel" @click.stop>
      <button
        v-if="!hideAll"
        type="button"
        class="kb-space-dropdown-item"
        :class="isAllActive() && 'kb-space-dropdown-item-active'"
        @click="selectAll"
      >
        {{ t('knowledge.space.allAccessible') }}
      </button>
      <div v-if="!hideAll" class="kb-space-dropdown-divider" />
      <button
        v-for="s in displaySpaces"
        :key="spaceOptionValue(s)"
        type="button"
        class="kb-space-dropdown-item"
        :class="isSpaceActive(spaceOptionValue(s)) && 'kb-space-dropdown-item-active'"
        @click="selectSpace(spaceOptionValue(s))"
      >
        <span class="truncate">{{ spaceLabel(s) }}</span>
      </button>
    </div>
  </div>
</template>
