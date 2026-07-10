<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { ChevronDown } from 'lucide-vue-next'
import { useEscapeClose } from '@/composables/useEscapeClose'

export type AppSelectOption = {
  value: string | number
  label: string
  disabled?: boolean
}

const props = withDefaults(
  defineProps<{
    options: AppSelectOption[]
    disabled?: boolean
    placeholder?: string
    /** 占满父级宽度（表单默认）；false 时保持内容宽度 */
    block?: boolean
  }>(),
  { disabled: false, block: true },
)

const model = defineModel<string | number | '' | undefined>()

const open = ref(false)
const rootRef = ref<HTMLElement | null>(null)
const panelRef = ref<HTMLElement | null>(null)
const panelStyle = ref<Record<string, string>>({})

useEscapeClose(open, () => {
  open.value = false
})

function sameValue(a: string | number | '' | undefined, b: string | number) {
  return String(a ?? '') === String(b)
}

const selectedOption = computed(() =>
  props.options.find((opt) => sameValue(model.value, opt.value)),
)

const triggerLabel = computed(() => {
  if (selectedOption.value) return selectedOption.value.label
  if (props.placeholder) return props.placeholder
  return props.options[0]?.label ?? ''
})

function isActive(value: string | number) {
  return sameValue(model.value, value)
}

function closePanel() {
  open.value = false
}

function updatePanelPosition() {
  const trigger = rootRef.value?.querySelector('.kb-space-dropdown-trigger') as HTMLElement | null
  if (!trigger) return
  const rect = trigger.getBoundingClientRect()
  panelStyle.value = {
    top: `${rect.bottom + 6}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    minWidth: `${rect.width}px`,
    maxWidth: `${rect.width}px`,
  }
}

function toggleOpen() {
  if (props.disabled) return
  open.value = !open.value
  if (open.value) void nextTick(updatePanelPosition)
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
        {{ triggerLabel }}
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
        :style="panelStyle"
        @click.stop
      >
        <button
          v-for="opt in options"
          :key="String(opt.value)"
          type="button"
          class="kb-space-dropdown-item"
          :class="isActive(opt.value) && 'kb-space-dropdown-item-active'"
          :disabled="opt.disabled"
          @click="selectOption(opt)"
        >
          <span class="truncate">{{ opt.label }}</span>
        </button>
      </div>
    </Teleport>
  </div>
</template>
