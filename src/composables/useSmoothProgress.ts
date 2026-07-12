import { onUnmounted, ref, watch, type Ref } from 'vue'

type SmoothProgressOptions = {
  /** 运行中每秒前进的百分点（匀速） */
  speedPerSecond?: number
  /** 后端尚未回报前进度时的占位上限 */
  indeterminateCap?: number
}

/**
 * 匀速进度：后端值为上限，显示值以固定速率逼近；到 100% 立即收尾。
 */
export function useSmoothProgress(
  target: Ref<number>,
  running: Ref<boolean>,
  active: Ref<boolean>,
  options: SmoothProgressOptions = {},
) {
  const speedPerSecond = options.speedPerSecond ?? 9
  const indeterminateCap = options.indeterminateCap ?? 18

  const display = ref(0)
  const reportedMax = ref(0)

  let rafId: number | null = null
  let lastTs = 0

  function stop() {
    if (rafId != null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    lastTs = 0
  }

  function reset() {
    stop()
    display.value = 0
    reportedMax.value = 0
  }

  function finishNow() {
    display.value = 100
    stop()
  }

  function isComplete() {
    return reportedMax.value >= 100 || target.value >= 100
  }

  function resolveGoal() {
    if (reportedMax.value > 0) return reportedMax.value
    return indeterminateCap
  }

  function tick(ts: number) {
    if (!active.value) {
      stop()
      return
    }

    if (isComplete()) {
      finishNow()
      return
    }

    const dt = lastTs ? Math.min((ts - lastTs) / 1000, 0.1) : 0
    lastTs = ts

    const goal = resolveGoal()
    const cur = display.value

    if (cur < goal - 0.02) {
      display.value = Math.min(goal, cur + speedPerSecond * dt)
    }

    const done = !running.value && Math.abs(display.value - goal) < 0.02
    if (!done) {
      rafId = requestAnimationFrame(tick)
    } else {
      stop()
    }
  }

  function start() {
    if (!active.value) return
    if (isComplete()) {
      finishNow()
      return
    }
    if (rafId == null) {
      lastTs = 0
      rafId = requestAnimationFrame(tick)
    }
  }

  watch(target, (v) => {
    const n = Math.min(100, Math.max(0, v))
    if (n > reportedMax.value) reportedMax.value = n
    if (n >= 100) {
      finishNow()
      return
    }
    start()
  })

  watch(running, start)
  watch(active, (on) => {
    if (on) start()
    else stop()
  })

  onUnmounted(stop)

  return { display, reset, start }
}
