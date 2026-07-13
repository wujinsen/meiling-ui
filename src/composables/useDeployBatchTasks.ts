import { onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { getTaskApi } from '@/api/operation'
import { resolveOperationErrorMessage } from '@/constants/operationErrors'
import { API_SUCCESS_CODE, type MoliResult } from '@/types/api'
import type { OperationTask } from '@/types/operation'

const POLL_MS = 1500

export type BatchTarget = {
  serverId: string
  serverName: string
}

export type BatchItemStatus = 'creating' | 'createFailed' | 'running' | 'success' | 'failed'

export type BatchTaskItem = {
  serverId: string
  serverName: string
  taskId: number | string | null
  task: OperationTask | null
  logText: string
  logOffset: number
  status: BatchItemStatus
  error: string
}

type CreateTaskFn = (serverId: string) => Promise<MoliResult<number>>

/**
 * 部署中心多服务器扇出（DC-2）：每台服务器独立创建任务并共享一个轮询循环。
 * 设计见 docs/design/deploy-center-project-first.md §2.2 / §3.1。
 */
export function useDeployBatchTasks() {
  const { t } = useI18n()
  const panelOpen = ref(false)
  const batchTitle = ref('')
  const items = ref<BatchTaskItem[]>([])

  let timer: ReturnType<typeof setInterval> | null = null
  let createFn: CreateTaskFn | null = null

  function stopPoll() {
    if (timer != null) {
      clearInterval(timer)
      timer = null
    }
  }

  function hasUnfinished() {
    return items.value.some((it) => it.status === 'creating' || it.status === 'running')
  }

  async function pollItem(item: BatchTaskItem) {
    if (item.taskId == null || item.status !== 'running') return
    try {
      const result = await getTaskApi(item.taskId, item.logOffset)
      if (result.code !== API_SUCCESS_CODE || !result.data) return
      item.task = result.data
      if (result.data.logChunk) item.logText += result.data.logChunk
      if (result.data.nextLogOffset != null) item.logOffset = result.data.nextLogOffset
      if (result.data.finished) {
        item.status = result.data.status === 'success' ? 'success' : 'failed'
      }
    } catch {
      // 单次轮询失败不终止任务，下一轮重试
    }
  }

  async function pollAll() {
    await Promise.all(items.value.map((it) => pollItem(it)))
    if (!hasUnfinished()) stopPoll()
  }

  function ensurePolling() {
    if (timer == null && hasUnfinished()) {
      timer = setInterval(() => void pollAll(), POLL_MS)
    }
  }

  async function createItemTask(item: BatchTaskItem) {
    if (!createFn) return
    item.status = 'creating'
    item.error = ''
    try {
      const result = await createFn(item.serverId)
      if (result.code !== API_SUCCESS_CODE || result.data == null) {
        throw new Error(
          resolveOperationErrorMessage(t, result.code, result.msg, t('operation.task.batch.createFailed')),
        )
      }
      item.taskId = result.data
      item.status = 'running'
      void pollItem(item)
      ensurePolling()
    } catch (e) {
      item.status = 'createFailed'
      item.error = e instanceof Error ? e.message : ''
    }
  }

  function runBatch(title: string, targets: BatchTarget[], createTask: CreateTaskFn) {
    stopPoll()
    createFn = createTask
    batchTitle.value = title
    items.value = targets.map((tg) => ({
      serverId: tg.serverId,
      serverName: tg.serverName,
      taskId: null,
      task: null,
      logText: '',
      logOffset: 0,
      status: 'creating' as BatchItemStatus,
      error: '',
    }))
    panelOpen.value = true
    for (const item of items.value) {
      void createItemTask(item)
    }
  }

  function retryItem(serverId: string) {
    const item = items.value.find((it) => it.serverId === serverId)
    if (item && item.status === 'createFailed') {
      void createItemTask(item)
    }
  }

  function closePanel() {
    stopPoll()
    panelOpen.value = false
    items.value = []
    createFn = null
  }

  onUnmounted(stopPoll)

  return {
    panelOpen,
    batchTitle,
    items,
    runBatch,
    retryItem,
    closePanel,
  }
}
