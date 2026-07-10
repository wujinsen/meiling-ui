import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useOperationTaskPoll } from '@/composables/useOperationTaskPoll'
import { API_SUCCESS_CODE } from '@/types/api'

vi.mock('@/api/operation', () => ({
  getTaskApi: vi.fn(),
}))

import { getTaskApi } from '@/api/operation'

describe('useOperationTaskPoll', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(getTaskApi).mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
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

  it('resets state when drawer closes', async () => {
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
})

async function flushPromises() {
  await Promise.resolve()
  await Promise.resolve()
}
