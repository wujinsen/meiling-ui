import { ref, onMounted, nextTick } from 'vue'

/** 延迟到首帧绘制后再加载图表数据，确保 ECharts 入场动画可见 */
export function useChartReady() {
  const ready = ref(false)

  onMounted(() => {
    nextTick(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          ready.value = true
        })
      })
    })
  })

  return ready
}
