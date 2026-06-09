<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useReducedMotion } from '@vueuse/motion'
import { usePerspective } from '@/composables/usePerspective'

const SENSITIVITY = 0.35

const reduced = useReducedMotion()
const { isPerspective, tiltStyle, setTilt, rotateX, rotateY } = usePerspective()

const stageRef = ref<HTMLElement | null>(null)
const entered = ref(false)
const ready = ref(false)
const dragging = ref(false)

const dragStart = { x: 0, y: 0, rx: 0, ry: 0 }

const show3d = computed(() => isPerspective.value && !reduced.value)

const windowClass = computed(() => ({
  'perspective-window--entered': entered.value,
  'perspective-window--ready': ready.value,
  'perspective-window--dragging': dragging.value,
}))

function isInteractive(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return !!target.closest(
    'button, a, input, textarea, select, option, label, [role="button"], [contenteditable], .no-tilt-drag'
  )
}

function playEnter() {
  ready.value = false
  entered.value = false
  requestAnimationFrame(() => {
    entered.value = true
  })
}

function onAnimationEnd(e: AnimationEvent) {
  if (e.animationName !== 'perspective-enter') return
  ready.value = true
}

function onDragMove(e: PointerEvent) {
  if (!dragging.value) return
  const dx = e.clientX - dragStart.x
  const dy = e.clientY - dragStart.y
  setTilt(dragStart.rx - dy * SENSITIVITY, dragStart.ry + dx * SENSITIVITY, false)
}

function endDrag() {
  if (!dragging.value) return
  dragging.value = false
  document.body.classList.remove('perspective-dragging')
  document.removeEventListener('pointermove', onDragMove)
  document.removeEventListener('pointerup', endDrag)
  document.removeEventListener('pointercancel', endDrag)
  setTilt(rotateX.value, rotateY.value, true)
}

function startDrag(e: PointerEvent) {
  if (e.button !== 0) return
  e.preventDefault()
  dragging.value = true
  dragStart.x = e.clientX
  dragStart.y = e.clientY
  dragStart.rx = rotateX.value
  dragStart.ry = rotateY.value
  document.body.classList.add('perspective-dragging')
  document.addEventListener('pointermove', onDragMove)
  document.addEventListener('pointerup', endDrag)
  document.addEventListener('pointercancel', endDrag)
}

function onWindowPointerDown(e: PointerEvent) {
  if (isInteractive(e.target)) return
  startDrag(e)
}

function onStagePointerDown(e: PointerEvent) {
  if (e.target !== stageRef.value) return
  startDrag(e)
}

onMounted(() => {
  if (show3d.value) playEnter()
})

watch(show3d, (on) => {
  if (on) playEnter()
})

onUnmounted(() => {
  endDrag()
})
</script>

<template>
  <div v-if="!show3d" class="app-flat min-h-screen w-full">
    <slot />
  </div>
  <div
    v-else
    ref="stageRef"
    class="perspective-stage"
    @pointerdown="onStagePointerDown"
  >
    <div
      class="perspective-window"
      :class="windowClass"
      :style="tiltStyle"
      @pointerdown="onWindowPointerDown"
      @animationend="onAnimationEnd"
    >
      <slot />
    </div>
  </div>
</template>
