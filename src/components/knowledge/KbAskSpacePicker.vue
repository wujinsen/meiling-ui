<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Check, ChevronDown, Globe2, Layers, Lock, Search, X } from 'lucide-vue-next'
import { useEscapeClose } from '@/composables/useEscapeClose'
import {
  persistKbAskScope,
  readKbAskScopeIds,
  readKbAskScopeMode,
  type KbAskScopeMode,
} from '@/composables/useKbAskScope'
import { useKbSpace } from '@/composables/useKbSpace'
import type { KbAccessibleSpace } from '@/types/knowledge'
import { toEntityId } from '@/utils/id'

const mode = defineModel<KbAskScopeMode>('mode', { default: 'all' })
const selectedIds = defineModel<string[]>('selectedIds', { default: () => [] })

const { t } = useI18n()
const { spaces, loading, loadError, ensureSpacesLoaded, selectedSpaceId } = useKbSpace()

const open = ref(false)
const filter = ref('')
const rootRef = ref<HTMLElement | null>(null)

useEscapeClose(open, () => {
  open.value = false
  filter.value = ''
})

const modeOptions = computed(() => [
  { value: 'all' as const, label: t('knowledge.ask.scopeAll') },
  { value: 'custom' as const, label: t('knowledge.ask.scopeCustom') },
])

function spaceIdValue(id: number | string) {
  return toEntityId(id) ?? String(id)
}

function spaceLabel(s: KbAccessibleSpace) {
  return s.spaceName ?? spaceIdValue(s.id)
}

const spaceMap = computed(() => {
  const map = new Map<string, KbAccessibleSpace>()
  for (const s of spaces.value) map.set(spaceIdValue(s.id), s)
  return map
})

const filteredSpaces = computed(() => {
  const kw = filter.value.trim().toLowerCase()
  if (!kw) return spaces.value
  return spaces.value.filter((s) => {
    const name = (s.spaceName ?? '').toLowerCase()
    const code = (s.spaceCode ?? '').toLowerCase()
    return name.includes(kw) || code.includes(kw)
  })
})

const triggerLabel = computed(() => {
  if (mode.value === 'all') return t('knowledge.ask.scopeAll')
  const n = selectedIds.value.length
  if (!n) return t('knowledge.ask.scopePickPlaceholder')
  if (n === 1) {
    const s = spaceMap.value.get(selectedIds.value[0])
    return s ? spaceLabel(s) : t('knowledge.ask.scopeMulti', { count: 1 })
  }
  return t('knowledge.ask.scopeMulti', { count: n })
})

const scopeEmpty = computed(() => mode.value === 'custom' && selectedIds.value.length === 0)

function isSelected(id: string) {
  return selectedIds.value.includes(id)
}

function toggleSpace(id: string) {
  if (isSelected(id)) {
    selectedIds.value = selectedIds.value.filter((x) => x !== id)
  } else {
    selectedIds.value = [...selectedIds.value, id]
  }
}

function selectAll() {
  selectedIds.value = spaces.value.map((s) => spaceIdValue(s.id))
}

function clearAll() {
  selectedIds.value = []
}

function removeChip(id: string) {
  selectedIds.value = selectedIds.value.filter((x) => x !== id)
}

function setMode(next: KbAskScopeMode) {
  if (mode.value === next) return
  mode.value = next
  if (next === 'custom' && !selectedIds.value.length && spaces.value.length) {
    selectedIds.value = spaces.value.map((s) => spaceIdValue(s.id))
  }
  if (next === 'all') closePanel()
}

function toggleOpen() {
  if (mode.value !== 'custom' || loading.value) return
  open.value = !open.value
  if (!open.value) filter.value = ''
}

function closePanel() {
  open.value = false
  filter.value = ''
}

function onDocumentClick(event: MouseEvent) {
  if (!open.value || !rootRef.value) return
  if (!rootRef.value.contains(event.target as Node)) closePanel()
}

function initFromStorage() {
  const storedMode = readKbAskScopeMode()
  const storedIds = readKbAskScopeIds()
  const validIds = storedIds.filter((id) => spaces.value.some((s) => spaceIdValue(s.id) === id))

  if (storedMode === 'custom' && validIds.length) {
    mode.value = 'custom'
    selectedIds.value = validIds
    return
  }

  const globalId = selectedSpaceId.value
  if (globalId && spaces.value.some((s) => spaceIdValue(s.id) === globalId)) {
    mode.value = 'custom'
    selectedIds.value = [globalId]
    return
  }

  mode.value = 'all'
  selectedIds.value = []
}

watch([mode, selectedIds], () => {
  persistKbAskScope(mode.value, selectedIds.value)
}, { deep: true })

watch(
  () => spaces.value.map((s) => spaceIdValue(s.id)).join(','),
  () => {
    selectedIds.value = selectedIds.value.filter((id) => spaceMap.value.has(id))
    if (mode.value === 'custom' && !selectedIds.value.length && spaces.value.length) {
      selectedIds.value = spaces.value.map((s) => spaceIdValue(s.id))
    }
  },
)

onMounted(() => {
  void ensureSpacesLoaded().then(initFromStorage)
  document.addEventListener('click', onDocumentClick)
})
onUnmounted(() => document.removeEventListener('click', onDocumentClick))

defineExpose({ scopeEmpty })
</script>

<template>
  <div v-if="loading && !spaces.length" class="text-xs text-gray-400">
    {{ t('knowledge.space.loading') }}
  </div>
  <p v-else-if="loadError" class="text-xs text-rose-500">{{ loadError }}</p>
  <div
    v-else-if="spaces.length > 1"
    ref="rootRef"
    class="kb-ask-scope no-tilt-drag"
    :class="scopeEmpty && 'kb-ask-scope-warn'"
  >
    <div class="kb-ask-scope-head">
      <div class="kb-ask-scope-title">
        <Layers class="h-3.5 w-3.5 shrink-0 text-brand-500 dark:text-brand-400" />
        <span>{{ t('knowledge.ask.scopeLabel') }}</span>
      </div>
      <div class="kb-ask-scope-modes" role="radiogroup">
        <button
          v-for="opt in modeOptions"
          :key="opt.value"
          type="button"
          role="radio"
          :aria-checked="mode === opt.value"
          class="kb-ask-scope-mode"
          :class="mode === opt.value && 'kb-ask-scope-mode-active'"
          @click="setMode(opt.value)"
        >
          <Globe2 v-if="opt.value === 'all'" class="h-3.5 w-3.5 shrink-0 opacity-70" />
          {{ opt.label }}
        </button>
      </div>
    </div>

    <p v-if="mode === 'all'" class="kb-ask-scope-hint">
      {{ t('knowledge.ask.scopeAllHint') }}
    </p>

    <template v-else>
      <button
        type="button"
        class="kb-ask-scope-trigger"
        :class="open && 'kb-ask-scope-trigger-open'"
        :aria-expanded="open"
        @click.stop="toggleOpen"
      >
        <span class="min-w-0 flex-1 truncate text-left">{{ triggerLabel }}</span>
        <ChevronDown class="h-4 w-4 shrink-0 text-gray-400 transition" :class="open && 'rotate-180'" />
      </button>

      <p v-if="scopeEmpty" class="kb-ask-scope-warn-text">{{ t('knowledge.ask.crossSpaceEmpty') }}</p>

      <div v-if="selectedIds.length" class="kb-ask-scope-chips">
        <span
          v-for="id in selectedIds"
          :key="id"
          class="kb-ask-scope-chip"
        >
          <Lock v-if="spaceMap.get(id)?.visibility === 0" class="h-3 w-3 shrink-0 opacity-60" />
          <span class="max-w-[8rem] truncate">{{ spaceMap.get(id) ? spaceLabel(spaceMap.get(id)!) : id }}</span>
          <button type="button" class="kb-ask-scope-chip-remove" @click.stop="removeChip(id)">
            <X class="h-3 w-3" />
          </button>
        </span>
      </div>

      <div v-if="open" class="kb-ask-scope-panel" @click.stop>
        <div class="kb-ask-scope-search">
          <Search class="h-4 w-4 shrink-0 text-gray-400" />
          <input
            v-model="filter"
            type="search"
            class="kb-ask-scope-search-input"
            :placeholder="t('knowledge.ask.scopeSearch')"
          />
        </div>
        <div class="kb-ask-scope-actions">
          <button type="button" class="kb-ask-scope-action" @click="selectAll">
            {{ t('knowledge.ask.selectAllSpaces') }}
          </button>
          <button type="button" class="kb-ask-scope-action" :disabled="!selectedIds.length" @click="clearAll">
            {{ t('knowledge.ask.scopeClear') }}
          </button>
        </div>
        <ul class="kb-ask-scope-list">
          <li v-for="s in filteredSpaces" :key="String(s.id)">
            <button
              type="button"
              class="kb-ask-scope-item"
              :class="isSelected(spaceIdValue(s.id)) && 'kb-ask-scope-item-active'"
              @click="toggleSpace(spaceIdValue(s.id))"
            >
              <span
                class="kb-ask-scope-check"
                :class="isSelected(spaceIdValue(s.id)) && 'kb-ask-scope-check-on'"
              >
                <Check v-if="isSelected(spaceIdValue(s.id))" class="h-3 w-3" />
              </span>
              <span class="min-w-0 flex-1 text-left">
                <span class="block truncate font-medium">{{ spaceLabel(s) }}</span>
                <span v-if="s.spaceCode" class="block truncate text-[11px] text-gray-400">{{ s.spaceCode }}</span>
              </span>
              <Lock v-if="s.visibility === 0" class="h-3.5 w-3.5 shrink-0 text-amber-500/80" />
            </button>
          </li>
          <li v-if="!filteredSpaces.length" class="px-3 py-4 text-center text-xs text-gray-400">
            {{ t('knowledge.ask.scopeSearchEmpty') }}
          </li>
        </ul>
      </div>
    </template>
  </div>
</template>
