<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronDown, Search } from 'lucide-vue-next'
import { useEscapeClose } from '@/composables/useEscapeClose'

export type AppSelectOption = {
  value: string | number
  label: string
  /** 副标题（环境 / IP 等），下拉与已选展示 */
  hint?: string
  disabled?: boolean
}

const props = withDefaults(
  defineProps<{
    options: AppSelectOption[]
    disabled?: boolean
    placeholder?: string
    /** 占满父级宽度（表单默认）；false 时保持内容宽度 */
    block?: boolean
    /** 下拉面板最小宽度（px），默认按最长选项估算 */
    panelMinWidth?: number
    /** 选项较多时启用面板内搜索（也可显式 true） */
    searchable?: boolean
    searchPlaceholder?: string
  }>(),
  { disabled: false, block: true },
)

const model = defineModel<string | number | '' | undefined>()

const { t } = useI18n()

const open = ref(false)
const searchKeyword = ref('')
const searchInputRef = ref<HTMLInputElement | null>(null)
const rootRef = ref<HTMLElement | null>(null)
const panelRef = ref<HTMLElement | null>(null)
const panelStyle = ref<Record<string, string>>({})

useEscapeClose(open, () => {
  open.value = false
})

const searchEnabled = computed(
  () => props.searchable ?? props.options.length > 20,
)

const visibleOptions = computed(() => {
  const q = searchKeyword.value.trim().toLowerCase()
  if (!q) return props.options
  return props.options.filter((opt) => {
    const hay = `${opt.label} ${opt.hint ?? ''}`.toLowerCase()
    return hay.includes(q)
  })
})

function sameValue(a: string | number | '' | undefined, b: string | number) {
  return String(a ?? '') === String(b)
}

const selectedOption = computed(() =>
  props.options.find((opt) => sameValue(model.value, opt.value)),
)

const triggerText = computed(() => {
  if (selectedOption.value) {
    const { label, hint } = selectedOption.value
    return hint ? `${label} · ${hint}` : label
  }
  if (props.placeholder) return props.placeholder
  const first = props.options[0]
  if (!first) return ''
  return first.hint ? `${first.label} · ${first.hint}` : first.label
})

function isActive(value: string | number) {
  return sameValue(model.value, value)
}

function closePanel() {
  open.value = false
  searchKeyword.value = ''
}

function estimatePanelWidth(triggerWidth: number) {
  if (props.panelMinWidth) return Math.max(triggerWidth, props.panelMinWidth)
  const longestLabel = props.options.reduce((max, opt) => {
    const text = opt.hint ? `${opt.label} · ${opt.hint}` : opt.label
    return Math.max(max, text.length)
  }, 0)
  const contentWidth = longestLabel * 15 + 48
  return Math.max(triggerWidth, contentWidth, 168)
}

function updatePanelPosition() {
  const trigger = rootRef.value?.querySelector('.kb-space-dropdown-trigger') as HTMLElement | null
  if (!trigger) return
  const rect = trigger.getBoundingClientRect()
  const panelWidth = estimatePanelWidth(rect.width)
  panelStyle.value = {
    top: `${rect.bottom + 6}px`,
    left: `${rect.left}px`,
    width: `${panelWidth}px`,
    minWidth: `${panelWidth}px`,
  }
}

function toggleOpen() {
  if (props.disabled) return
  open.value = !open.value
  if (open.value) {
    void nextTick(() => {
      updatePanelPosition()
      if (searchEnabled.value) searchInputRef.value?.focus()
    })
  }
}

function selectOption(opt: AppSelectOption) {
  if (opt.disabled) return
  model.value = opt.value
  closePanel()
}

function onDocumentClick(event: MouseEvent) {
  if (!open.value) return
  const target = event.target as Node
  if (rootRef.value?.contains(target) || panelRef.value?.contains(target)) return
  closePanel()
}

let scrollBound = false

function bindPositionListeners() {
  if (scrollBound) return
  scrollBound = true
  window.addEventListener('scroll', updatePanelPosition, true)
  window.addEventListener('resize', updatePanelPosition)
}

function unbindPositionListeners() {
  if (!scrollBound) return
  scrollBound = false
  window.removeEventListener('scroll', updatePanelPosition, true)
  window.removeEventListener('resize', updatePanelPosition)
}

watch(open, (isOpen) => {
  if (isOpen) {
    bindPositionListeners()
    void nextTick(updatePanelPosition)
  } else {
    unbindPositionListeners()
    searchKeyword.value = ''
  }
})

onMounted(() => document.addEventListener('click', onDocumentClick))
onUnmounted(() => {
  document.removeEventListener('click', onDocumentClick)
  unbindPositionListeners()
})
</script>

<template>
  <div
    ref="rootRef"
    class="kb-space-dropdown"
    :class="!block && 'kb-space-dropdown--inline'"
  >
    <button
      type="button"
      class="field-input kb-space-dropdown-trigger"
      :class="open && 'kb-space-dropdown-trigger-open'"
      :disabled="disabled"
      :aria-expanded="open"
      @click.stop="toggleOpen"
    >
      <span
        class="kb-space-dropdown-value truncate"
        :class="!selectedOption && placeholder && 'text-gray-400 dark:text-gray-500'"
      >
        {{ triggerText }}
      </span>
      <ChevronDown
        class="h-4 w-4 shrink-0 text-gray-400 transition"
        :class="open && 'rotate-180'"
      />
    </button>
    <Teleport to="body">
      <div
        v-if="open"
        ref="panelRef"
        class="kb-space-dropdown-panel kb-space-dropdown-panel--portal"
        :class="searchEnabled && 'kb-space-dropdown-panel--searchable'"
        :style="panelStyle"
        @click.stop
      >
        <div v-if="searchEnabled" class="kb-space-dropdown-panel__search">
          <Search class="kb-space-dropdown-panel__search-icon" />
          <input
            ref="searchInputRef"
            v-model="searchKeyword"
            type="search"
            class="field-input kb-space-dropdown-panel__search-input"
            :placeholder="searchPlaceholder || t('operation.common.search')"
            @click.stop
          />
        </div>
        <div class="kb-space-dropdown-panel__list">
          <button
            v-for="opt in visibleOptions"
            :key="String(opt.value)"
            type="button"
            class="kb-space-dropdown-item"
            :class="isActive(opt.value) && 'kb-space-dropdown-item-active'"
            :disabled="opt.disabled"
            @click="selectOption(opt)"
          >
            <span class="kb-space-dropdown-item__main">
              <span class="truncate">{{ opt.label }}</span>
              <span v-if="opt.hint" class="kb-space-dropdown-item__hint">{{ opt.hint }}</span>
            </span>
          </button>
          <p v-if="!visibleOptions.length" class="kb-space-dropdown-panel__empty">
            {{ t('operation.common.empty') }}
          </p>
        </div>
      </div>
    </Teleport>
  </div>
</template>
