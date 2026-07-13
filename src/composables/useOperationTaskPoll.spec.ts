import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { backgroundSessions } from '@/composables/operationTaskHub'
import { useOperationTaskPoll } from '@/composables/useOperationTaskPoll'
import { API_SUCCESS_CODE } from '@/types/api'

vi.mock('@/api/operation', () => ({
  getTaskApi: vi.fn(),
  cancelOperationTaskApi: vi.fn(),
}))

vi.mock('@/composables/useToast', () => ({
  showToast: vi.fn(),
}))

vi.mock('@/i18n', () => ({
  i18n: {
    global: {
      t: (key: string) => key,
    },
  },
}))

import { getTaskApi } from '@/api/operation'

describe('useOperationTaskPoll', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(getTaskApi).mockReset()
    backgroundSessions.value = []
  })

  afterEach(() => {
    vi.useRealTimers()
    backgroundSessions.value = []
  })

  it('appends incremental log chunks and stops when finished', async () => {
    vi.mocked(getTaskApi)
      .mockResolvedValueOnce({
        code: API_SUCCESS_CODE,
        data: {
          id: 1,
          status: 'running',
          progress: 40,
          logChunk: 'line1\n',
          nextLogOffset: 6,
          finished: false,
        },
        msg: 'ok',
      })
      .mockResolvedValueOnce({
        code: API_SUCCESS_CODE,
        data: {
          id: 1,
          status: 'success',
          progress: 100,
          logChunk: 'line2\n',
          nextLogOffset: 12,
          finished: true,
        },
        msg: 'ok',
      })

    const { openTask, logText, task, polling, drawerOpen } = useOperationTaskPoll()
    openTask(1)
    await flushPromises()

    expect(logText.value).toBe('line1\n')
    expect(task.value?.status).toBe('running')
    expect(polling.value).toBe(true)
    expect(drawerOpen.value).toBe(true)

    await vi.advanceTimersByTimeAsync(1500)
    await flushPromises()
    expect(logText.value).toBe('line1\nline2\n')
    expect(task.value?.status).toBe('success')
    expect(polling.value).toBe(false)
  })

  it('resets state when drawer closes without background', async () => {
    vi.mocked(getTaskApi).mockResolvedValue({
      code: API_SUCCESS_CODE,
      data: {
        id: 2,
        status: 'running',
        progress: 10,
        logChunk: 'boot\n',
        nextLogOffset: 5,
        finished: false,
      },
      msg: 'ok',
    })

    const { openTask, closeDrawer, logText, taskId, drawerOpen } = useOperationTaskPoll()
    openTask(2)
    await flushPromises()
    expect(logText.value).toBe('boot\n')

    closeDrawer()
    expect(drawerOpen.value).toBe(false)
    expect(taskId.value).toBeNull()
    expect(logText.value).toBe('')
  })

  it('keeps polling after sendToBackground', async () => {
    vi.mocked(getTaskApi).mockResolvedValue({
      code: API_SUCCESS_CODE,
      data: {
        id: 3,
        status: 'running',
        progress: 20,
        logChunk: 'uploading\n',
        nextLogOffset: 10,
        finished: false,
      },
      msg: 'ok',
    })

    const { openTask, sendToBackground, closeDrawer, drawerOpen, polling, taskId, inBackground } = useOperationTaskPoll()
    openTask(3)
    await flushPromises()

    sendToBackground()
    expect(drawerOpen.value).toBe(false)
    expect(inBackground.value).toBe(true)
    expect(polling.value).toBe(true)
    expect(taskId.value).toBe(3)
    expect(backgroundSessions.value).toHaveLength(1)

    closeDrawer()
    expect(polling.value).toBe(true)
    expect(taskId.value).toBe(3)
  })
})

async function flushPromises() {
  await Promise.resolve()
  await Promise.resolve()
}
