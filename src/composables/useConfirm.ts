import { reactive } from 'vue'

export interface ConfirmOptions {
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
}

const state = reactive({
  open: false,
  options: {
    message: '',
    danger: true,
  } as ConfirmOptions,
  resolver: null as ((value: boolean) => void) | null,
})

export function confirm(options: ConfirmOptions | string): Promise<boolean> {
  const opts: ConfirmOptions =
    typeof options === 'string'
      ? { message: options, danger: true }
      : { danger: true, ...options }

  return new Promise((resolve) => {
    state.options = opts
    state.resolver = resolve
    state.open = true
  })
}

export function useConfirmState() {
  function settle(result: boolean) {
    state.resolver?.(result)
    state.resolver = null
    state.open = false
  }

  return { state, settle }
}
