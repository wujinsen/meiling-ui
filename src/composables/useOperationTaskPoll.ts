import { onUnmounted, ref } from 'vue'
import { getTaskApi } from '@/api/operation'
import { API_SUCCESS_CODE } from '@/types/api'
import type { OperationTask } from '@/types/operation'

const POLL_MS = 1500

type OpenTaskOptions = {
  onFinished?: (task: import('@/types/operation').OperationTask) => void | Promise<void>
}

/**
 * 运维异步任务轮询（SVR-14）：进度条 + 增量日志。
 */
export function useOperationTaskPoll() {
  const drawerOpen = ref(false)
  const taskId = ref<number | string | null>(null)
  const task = ref<OperationTask | null>(null)
  const logText = ref('')
  const polling = ref(false)
  let logOffset = 0
  let timer: ReturnType<typeof setInterval> | null = null
  let onFinished: OpenTaskOptions['onFinished']

  function stopPoll() {
    if (timer != null) {
      clearInterval(timer)
      timer = null
    }
    polling.value = false
  }

  async function pollOnce() {
    if (taskId.value == null) return
    try {
      const result = await getTaskApi(taskId.value, logOffset)
      if (result.code !== API_SUCCESS_CODE || !result.data) return
      task.value = result.data
      if (result.data.logChunk) {
        logText.value += result.data.logChunk
      }
      if (result.data.nextLogOffset != null) {
        logOffset = result.data.nextLogOffset
      }
      if (result.data.finished) {
        stopPoll()
        if (onFinished) {
          const cb = onFinished
          onFinished = undefined
          await cb(result.data)
        }
      }
    } catch {
      stopPoll()
      onFinished = undefined
    }
  }

  function openTask(id: number | string, options?: OpenTaskOptions) {
    stopPoll()
    onFinished = options?.onFinished
    taskId.value = id
    logOffset = 0
    logText.value = ''
    task.value = null
    drawerOpen.value = true
    polling.value = true
    void pollOnce()
    timer = setInterval(() => void pollOnce(), POLL_MS)
  }

  function closeDrawer() {
    stopPoll()
    onFinished = undefined
    drawerOpen.value = false
    taskId.value = null
    task.value = null
    logText.value = ''
  }

  onUnmounted(stopPoll)

  return {
    drawerOpen,
    taskId,
    task,
    logText,
    polling,
    openTask,
    closeDrawer,
    stopPoll,
  }
}
