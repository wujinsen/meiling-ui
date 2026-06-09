import { computed, ref } from 'vue'

const STORAGE_KEY = 'meiling-perspective'
const TILT_STORAGE_KEY = 'meiling-perspective-tilt'

export const DEFAULT_TILT = { rx: 6, ry: -14 }
const MAX_TILT = 45

const enabled = ref(false)
const rotateX = ref(DEFAULT_TILT.rx)
const rotateY = ref(DEFAULT_TILT.ry)

function clampTilt(value: number) {
  return Math.max(-MAX_TILT, Math.min(MAX_TILT, value))
}

function persistTilt() {
  localStorage.setItem(
    TILT_STORAGE_KEY,
    JSON.stringify({ rx: rotateX.value, ry: rotateY.value })
  )
}

function loadTilt() {
  try {
    const raw = localStorage.getItem(TILT_STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as { rx?: number; ry?: number }
    if (typeof parsed.rx === 'number') rotateX.value = clampTilt(parsed.rx)
    if (typeof parsed.ry === 'number') rotateY.value = clampTilt(parsed.ry)
  } catch {
    /* ignore */
  }
}

function applyPerspective(on: boolean) {
  enabled.value = on
  document.documentElement.classList.toggle('perspective-active', on)
  localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off')
}

export function initPerspective() {
  loadTilt()
  const saved = localStorage.getItem(STORAGE_KEY)
  applyPerspective(saved === 'on')
}

export function usePerspective() {
  const setTilt = (rx: number, ry: number, persist = true) => {
    rotateX.value = clampTilt(rx)
    rotateY.value = clampTilt(ry)
    if (persist) persistTilt()
  }

  const resetTilt = () => {
    setTilt(DEFAULT_TILT.rx, DEFAULT_TILT.ry)
  }

  const togglePerspective = () => {
    applyPerspective(!enabled.value)
  }

  return {
    isPerspective: computed(() => enabled.value),
    rotateX: computed(() => rotateX.value),
    rotateY: computed(() => rotateY.value),
    tiltStyle: computed(() => ({
      '--tilt-rx': `${rotateX.value}deg`,
      '--tilt-ry': `${rotateY.value}deg`,
    })),
    setTilt,
    resetTilt,
    togglePerspective,
    setPerspective: applyPerspective,
  }
}
