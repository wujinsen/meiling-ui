import { ref, watch, onMounted, onUnmounted, nextTick, type Ref } from 'vue'
import { useReducedMotion } from '@vueuse/motion'

interface ParsedValue {
  prefix: string
  target: number
  suffix: string
  decimals: number
  useGrouping: boolean
}

function parseValue(value: string): ParsedValue | null {
  const match = value.match(/^([^0-9\-+]*)([\-+]?[0-9,]+(?:\.[0-9]+)?)(.*)$/)
  if (!match) return null

  const [, prefix, numStr, suffix] = match
  const clean = numStr.replace(/,/g, '')
  const target = Number(clean)
  if (Number.isNaN(target)) return null

  const decimals = clean.includes('.') ? clean.split('.')[1].length : 0

  return {
    prefix: prefix ?? '',
    target,
    suffix: suffix ?? '',
    decimals,
    useGrouping: numStr.includes(','),
  }
}

function formatNumber(parsed: ParsedValue, current: number) {
  let num = current.toFixed(parsed.decimals)
  if (parsed.useGrouping) {
    const [intPart, decPart] = num.split('.')
    const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    num = decPart !== undefined ? `${grouped}.${decPart}` : grouped
  }
  return `${parsed.prefix}${num}${parsed.suffix}`
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3)
}

/** 等两帧再开动画，确保浏览器先画出起始状态 */
function afterPaint(cb: () => void) {
  requestAnimationFrame(() => requestAnimationFrame(cb))
}

export function useCountUp(
  source: Ref<string> | (() => string),
  options: { duration?: number } = {}
) {
  const display = ref(typeof source === 'function' ? source() : source.value)
  const reduced = useReducedMotion()
  const duration = options.duration ?? 1400

  let frame = 0
  let started = false

  function getValue() {
    return typeof source === 'function' ? source() : source.value
  }

  function runAnimation(value: string) {
    const parsed = parseValue(value)
    if (!parsed) {
      display.value = value
      return
    }

    if (reduced.value) {
      display.value = value
      return
    }

    cancelAnimationFrame(frame)
    const start = performance.now()

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1)
      const current = parsed.target * easeOutCubic(progress)
      display.value = formatNumber(parsed, current)
      if (progress < 1) frame = requestAnimationFrame(tick)
      else display.value = value
    }

    frame = requestAnimationFrame(tick)
  }

  function startOnce() {
    if (started) return
    started = true
    runAnimation(getValue())
  }

  function prepareAndStart() {
    const value = getValue()
    const parsed = parseValue(value)

    if (!parsed || reduced.value) {
      display.value = value
      return
    }

    display.value = formatNumber(parsed, 0)
    afterPaint(() => startOnce())
  }

  onMounted(() => {
    nextTick(() => prepareAndStart())
  })

  watch(
    () => getValue(),
    (val) => {
      if (started) runAnimation(val)
      else display.value = val
    }
  )

  onUnmounted(() => cancelAnimationFrame(frame))

  return display
}
