import { ref } from 'vue'

export type ToastType = 'success' | 'error'

export interface ToastItem {
  type: ToastType
  text: string
}

const toast = ref<ToastItem | null>(null)
let hideTimer: ReturnType<typeof setTimeout> | null = null

const TOAST_DURATION = 2800

export function showToast(type: ToastType, text: string) {
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
  toast.value = { type, text }
  hideTimer = setTimeout(() => {
    toast.value = null
    hideTimer = null
  }, TOAST_DURATION)
}

export function resetToast() {
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
  toast.value = null
}

export function useToastState() {
  return { toast }
}

/** @deprecated 直接使用 showToast；保留兼容旧调用 */
export function useToast() {
  return { toast, showToast }
}

export function formatDateTime(value?: string | number) {
  if (value == null || value === '') return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString()
}
