import { computed, ref, shallowRef } from 'vue'
import { cancelOperationTaskApi, getTaskApi } from '@/api/operation'
import { showToast } from '@/composables/useToast'
import { resolveOperationErrorMessage } from '@/constants/operationErrors'
import { i18n } from '@/i18n'
import { API_SUCCESS_CODE } from '@/types/api'
import type { OperationTask } from '@/types/operation'

const POLL_MS = 1500

type OpenTaskOptions = {
  onFinished?: (task: OperationTask) => void | Promise<void>
}

function t(key: string, params?: Record<string, unknown>) {
  return i18n.global.t(key, params ?? {})
}

function taskTypeLabel(task: OperationTask | null) {
  const type = task?.taskType
  if (!type) return t('operation.task.drawerTitle')
  const key = `operation.task.type.${type}` as const
  const label = t(key)
  return label === key ? type : label
}

function finishToast(task: OperationTask) {
  const name = taskTypeLabel(task)
  const status = task.status
  if (status === 'success') {
    showToast('success', t('operation.task.backgroundFinishedSuccess', { name }))
    return
  }
  if (status === 'cancelled') {
    showToast('success', t('operation.task.backgroundFinishedCancelled', { name }))
    return
  }
  if (status === 'failed') {
    const msg = task.message?.trim()
    showToast('error', msg || t('operation.task.backgroundFinishedFailed', { name }))
  }
}

export class OperationTaskSession {
  readonly sessionId = Symbol('operation-task-session')

  taskId = ref<number | string | null>(null)
  task = ref<OperationTask | null>(null)
  logText = ref('')
  polling = ref(false)
  cancelling = ref(false)
  drawerOpen = ref(false)
  inBackground = ref(false)
  expandedInFloater = ref(false)

  private logOffset = 0
  private timer: ReturnType<typeof setInterval> | null = null
  private onFinished?: OpenTaskOptions['onFinished']
  private keepAliveInHub = false

  private stopPoll() {
    if (this.timer != null) {
      clearInterval(this.timer)
      this.timer = null
    }
    this.polling.value = false
  }

  private ensurePollLoop() {
    if (this.timer != null || this.taskId.value == null) return
    this.polling.value = true
    this.timer = setInterval(() => void this.pollOnce(), POLL_MS)
  }

  private resetState() {
    this.taskId.value = null
    this.task.value = null
    this.logText.value = ''
    this.logOffset = 0
    this.inBackground.value = false
    this.expandedInFloater.value = false
    this.onFinished = undefined
  }

  private unregisterFromHub() {
    if (!this.keepAliveInHub) return
    this.keepAliveInHub = false
    backgroundSessions.value = backgroundSessions.value.filter((s) => s !== this)
  }

  dispose() {
    this.stopPoll()
    this.unregisterFromHub()
    this.drawerOpen.value = false
    this.resetState()
  }

  async pollOnce() {
    if (this.taskId.value == null) return
    try {
      const result = await getTaskApi(this.taskId.value, this.logOffset)
      if (result.code !== API_SUCCESS_CODE || !result.data) return
      this.task.value = result.data
      if (result.data.logChunk) {
        this.logText.value += result.data.logChunk
      }
      if (result.data.nextLogOffset != null) {
        this.logOffset = result.data.nextLogOffset
      }
      if (result.data.finished) {
        this.stopPoll()
        if (this.inBackground.value) {
          finishToast(result.data)
        }
        if (this.onFinished) {
          const cb = this.onFinished
          this.onFinished = undefined
          await cb(result.data)
        }
      }
    } catch {
      this.stopPoll()
      this.onFinished = undefined
    }
  }

  openTask(id: number | string, options?: OpenTaskOptions) {
    this.stopPoll()
    this.unregisterFromHub()
    this.onFinished = options?.onFinished
    this.taskId.value = id
    this.logOffset = 0
    this.logText.value = ''
    this.task.value = null
    this.inBackground.value = false
    this.expandedInFloater.value = false
    this.drawerOpen.value = true
    this.polling.value = true
    void this.pollOnce()
    this.timer = setInterval(() => void this.pollOnce(), POLL_MS)
  }

  async cancelTask() {
    if (this.taskId.value == null || this.task.value?.finished) return
    const status = this.task.value?.status
    if (status !== 'pending' && status !== 'running') return
    this.cancelling.value = true
    try {
      const result = await cancelOperationTaskApi(this.taskId.value)
      if (result.code !== API_SUCCESS_CODE) {
        throw new Error(resolveOperationErrorMessage(t, result.code, result.msg, t('operation.task.cancelFailed')))
      }
      if (result.data) {
        this.task.value = result.data
        if (result.data.logChunk) {
          this.logText.value += result.data.logChunk
        }
        if (result.data.nextLogOffset != null) {
          this.logOffset = result.data.nextLogOffset
        }
      }
      if (!this.task.value?.finished) {
        this.ensurePollLoop()
        void this.pollOnce()
      }
      showToast('success', t('operation.task.cancelRequested'))
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : t('operation.task.cancelFailed'))
    } finally {
      this.cancelling.value = false
    }
  }

  closeDrawer() {
    if (this.inBackground.value) {
      this.drawerOpen.value = false
      return
    }
    this.dispose()
  }

  sendToBackground() {
    if (this.taskId.value == null || this.task.value?.finished) return
    this.drawerOpen.value = false
    this.inBackground.value = true
    this.keepAliveInHub = true
    if (!backgroundSessions.value.includes(this)) {
      backgroundSessions.value = [...backgroundSessions.value, this]
    }
    if (!backgroundSessions.value.some((s) => s.expandedInFloater.value)) {
      this.expandedInFloater.value = true
    }
    floaterExpanded.value = true
    showToast('success', t('operation.task.backgroundStarted'))
  }

  reopenDrawer() {
    if (this.taskId.value == null) return
    this.drawerOpen.value = true
    this.inBackground.value = false
    this.expandedInFloater.value = false
    this.unregisterFromHub()
    if (!this.task.value?.finished && !this.timer) {
      this.ensurePollLoop()
      void this.pollOnce()
    }
  }

  dismissFromFloater() {
    if (this.polling.value && !this.task.value?.finished) return
    this.dispose()
  }

  onComponentUnmount() {
    if (this.keepAliveInHub && this.polling.value) {
      this.drawerOpen.value = false
      return
    }
    this.dispose()
  }

  isRunning(): boolean {
    return this.polling.value && !this.task.value?.finished
  }
}

export const backgroundSessions = shallowRef<OperationTaskSession[]>([])
export const floaterExpanded = ref(true)

export const runningBackgroundCount = computed(
  () => backgroundSessions.value.filter((s) => s.isRunning()).length,
)

export const hasBackgroundSessions = computed(() => backgroundSessions.value.length > 0)

export function useOperationTaskHub() {
  function toggleFloater() {
    floaterExpanded.value = !floaterExpanded.value
  }

  function openFloater() {
    floaterExpanded.value = true
  }

  function toggleSessionExpand(session: OperationTaskSession) {
    const next = !session.expandedInFloater.value
    for (const s of backgroundSessions.value) {
      s.expandedInFloater.value = false
    }
    session.expandedInFloater.value = next
  }

  return {
    backgroundSessions,
    floaterExpanded,
    runningBackgroundCount,
    hasBackgroundSessions,
    toggleFloater,
    openFloater,
    toggleSessionExpand,
  }
}

export function createOperationTaskPoll() {
  const session = new OperationTaskSession()

  return {
    drawerOpen: session.drawerOpen,
    taskId: session.taskId,
    task: session.task,
    logText: session.logText,
    polling: session.polling,
    cancelling: session.cancelling,
    inBackground: session.inBackground,
    openTask: session.openTask.bind(session),
    cancelTask: session.cancelTask.bind(session),
    closeDrawer: session.closeDrawer.bind(session),
    sendToBackground: session.sendToBackground.bind(session),
    reopenDrawer: session.reopenDrawer.bind(session),
    stopPoll: session.dispose.bind(session),
    _session: session,
  }
}

export function bindOperationTaskPollLifecycle(
  session: OperationTaskSession,
  onUnmount: (fn: () => void) => void,
) {
  onUnmount(() => session.onComponentUnmount())
}
