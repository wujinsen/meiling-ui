<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronDown } from 'lucide-vue-next'
import { useEscapeClose } from '@/composables/useEscapeClose'
import { useKbSpace } from '@/composables/useKbSpace'
import { toEntityId } from '@/utils/id'

/** 单选：'all' 或空间 ID */
const singleValue = defineModel<string>({ default: 'all' })

const { t } = useI18n()
const { spaces, loading, loadError, ensureSpacesLoaded } = useKbSpace()

const open = ref(false)
const rootRef = ref<HTMLElement | null>(null)

useEscapeClose(open, () => {
  open.value = false
})

function spaceIdValue(id: number | string) {
  return toEntityId(id) ?? String(id)
}

function spaceLabel(s: { spaceName?: string; visibility?: number }) {
  const privateMark = s.visibility === 0 ? ` · ${t('knowledge.space.private')}` : ''
  return `${s.spaceName ?? ''}${privateMark}`
}

function spaceNameById(id: string) {
  const space = spaces.value.find((s) => spaceIdValue(s.id) === id)
  return space ? spaceLabel(space) : id
}

const triggerLabel = computed(() => {
  if (singleValue.value === 'all') return t('knowledge.space.allAccessible')
  return spaceNameById(singleValue.value)
})

function isAllActive() {
  return singleValue.value === 'all'
}

function isSpaceActive(id: string) {
  return singleValue.value === id
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

function selectSpace(id: string) {
  singleValue.value = id
  closePanel()
}

function onDocumentClick(event: MouseEvent) {
  if (!open.value || !rootRef.value) return
  if (!rootRef.value.contains(event.target as Node)) closePanel()
}

onMounted(() => {
  ensureSpacesLoaded()
  document.addEventListener('click', onDocumentClick)
})
onUnmounted(() => document.removeEventListener('click', onDocumentClick))
</script>

<template>
  <div v-if="loading && !spaces.length" class="text-xs text-gray-400">
    {{ t('knowledge.space.loading') }}
  </div>
  <p v-else-if="loadError" class="text-xs text-rose-500">{{ loadError }}</p>
  <p v-else-if="!spaces.length" class="text-xs text-gray-400">{{ t('knowledge.accessDenied.emptyTitle') }}</p>
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
        type="button"
        class="kb-space-dropdown-item"
        :class="isAllActive() && 'kb-space-dropdown-item-active'"
        @click="selectAll"
      >
        {{ t('knowledge.space.allAccessible') }}
      </button>
      <div class="kb-space-dropdown-divider" />
      <button
        v-for="s in spaces"
        :key="String(s.id)"
        type="button"
        class="kb-space-dropdown-item"
        :class="isSpaceActive(spaceIdValue(s.id)) && 'kb-space-dropdown-item-active'"
        @click="selectSpace(spaceIdValue(s.id))"
      >
        <span class="truncate">{{ spaceLabel(s) }}</span>
      </button>
    </div>
  </div>
</template>
