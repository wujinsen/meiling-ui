import { onUnmounted, watch, type MaybeRefOrGetter, toValue } from 'vue'

const stack: Array<() => void> = []

function handleEscape(e: KeyboardEvent) {
  if (e.key !== 'Escape' || stack.length === 0) return
  e.preventDefault()
  stack[stack.length - 1]()
}

let listenerAttached = false

function attachListener() {
  if (listenerAttached) return
  listenerAttached = true
  window.addEventListener('keydown', handleEscape)
}

function pushCloser(closer: () => void) {
  attachListener()
  stack.push(closer)
  return () => {
    const idx = stack.lastIndexOf(closer)
    if (idx !== -1) stack.splice(idx, 1)
  }
}

/** 弹层打开时按 Esc 关闭；多层弹层时优先关闭最上层 */
export function useEscapeClose(active: MaybeRefOrGetter<boolean>, close: () => void) {
  let pop: (() => void) | null = null

  watch(
    () => toValue(active),
    (isActive) => {
      pop?.()
      pop = null
      if (isActive) {
        pop = pushCloser(close)
      }
    },
    { immediate: true },
  )

  onUnmounted(() => {
    pop?.()
  })
}
