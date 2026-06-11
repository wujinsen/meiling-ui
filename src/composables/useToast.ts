import { ref } from 'vue'

export type ToastType = 'success' | 'error'

export interface ToastItem {
  id: number
  type: ToastType
  text: string
  fading: boolean
  /** 入场序号，用于图标弹跳重置 */
  enterKey: number
}

const toasts = ref<ToastItem[]>([])
let nextId = 1

const TOAST_HOLD_MS = 1500
const TOAST_FADE_MS = 450
const MAX_TOASTS = 5

type ToastTimers = {
  hold?: ReturnType<typeof setTimeout>
  remove?: ReturnType<typeof setTimeout>
}

const timers = new Map<number, ToastTimers>()

function clearItemTimers(id: number) {
  const t = timers.get(id)
  if (t?.hold) clearTimeout(t.hold)
  if (t?.remove) clearTimeout(t.remove)
  timers.delete(id)
}

function clearAllTimers() {
  for (const id of timers.keys()) clearItemTimers(id)
}

function startHideSequence(item: ToastItem) {
  clearItemTimers(item.id)
  const hold = setTimeout(() => {
    const row = toasts.value.find((t) => t.id === item.id)
    if (!row) return
    row.fading = true
    const remove = setTimeout(() => {
      toasts.value = toasts.value.filter((t) => t.id !== item.id)
      clearItemTimers(item.id)
    }, TOAST_FADE_MS)
    timers.set(item.id, { remove })
  }, TOAST_HOLD_MS)
  timers.set(item.id, { hold })
}

function resetToastItem(item: ToastItem) {
  item.fading = false
  item.enterKey += 1
  startHideSequence(item)
}

export function showToast(type: ToastType, text: string) {
  const existing = toasts.value.find((t) => t.type === type && t.text === text)
  if (existing) {
    resetToastItem(existing)
    return
  }

  const item: ToastItem = {
    id: nextId++,
    type,
    text,
    fading: false,
    enterKey: 0,
  }
  toasts.value = [...toasts.value, item].slice(-MAX_TOASTS)
  startHideSequence(item)
}

export function resetToast() {
  clearAllTimers()
  toasts.value = []
}

export function useToastState() {
  return { toasts }
}

/** @deprecated 直接使用 showToast；保留兼容旧调用 */
export function useToast() {
  return { toast: toasts, showToast }
}

export function formatDateTime(value?: string | number) {
  if (value == null || value === '') return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString()
}
