<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, useSlots } from 'vue'

const props = withDefaults(
  defineProps<{
    text?: string
    disabled?: boolean
    /** 仅在触发元素内容溢出（被截断）时显示 */
    onlyOverflow?: boolean
    placement?: 'top' | 'bottom'
  }>(),
  {
    onlyOverflow: true,
    placement: 'top',
  },
)

const slots = useSlots()
const open = ref(false)
const triggerRef = ref<HTMLElement | null>(null)
const position = ref({ top: 0, left: 0 })

const hasContent = computed(() => Boolean(props.text?.trim() || slots.content))

function getOverflowEl(): HTMLElement | null {
  const trigger = triggerRef.value
  if (!trigger) return null
  const child = trigger.firstElementChild
  if (child instanceof HTMLElement) return child
  return trigger
}

function isOverflowing(el: HTMLElement) {
  return el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1
}

function updatePosition() {
  const el = triggerRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  position.value = {
    top: props.placement === 'bottom' ? rect.bottom : rect.top,
    left: rect.left + rect.width / 2,
  }
}

function show() {
  if (props.disabled || !hasContent.value) return
  if (props.onlyOverflow) {
    const el = getOverflowEl()
    if (!el || !isOverflowing(el)) return
  }
  updatePosition()
  open.value = true
}

function hide() {
  open.value = false
}

function onScroll() {
  if (open.value) hide()
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, true)
  window.addEventListener('resize', onScroll)
})

onUnmounted(() => {
  window.removeEventListener('scroll', onScroll, true)
  window.removeEventListener('resize', onScroll)
})
</script>

<template>
  <span
    ref="triggerRef"
    class="app-tooltip-trigger"
    @mouseenter="show"
    @mouseleave="hide"
    @focus="show"
    @blur="hide"
  >
    <slot />
  </span>

  <Teleport to="body">
    <Transition name="app-tooltip-fade">
      <div
        v-if="open"
        class="app-tooltip-pop"
        :class="placement === 'bottom' ? 'app-tooltip-pop--bottom' : 'app-tooltip-pop--top'"
        :style="{ top: `${position.top}px`, left: `${position.left}px` }"
        role="tooltip"
      >
        <slot name="content">
          <p class="app-tooltip-text">{{ text }}</p>
        </slot>
      </div>
    </Transition>
  </Teleport>
</template>
