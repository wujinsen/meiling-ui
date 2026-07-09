import type { KbSyncLog, KbSyncStatus } from '@/types/knowledge'

export type KbSyncBatchStatus = 'idle' | 'running' | 'success' | 'fail'

export function isKbSyncLogFailed(status?: string | null): boolean {
  const s = status?.trim().toLowerCase()
  return s === 'fail' || s === 'error' || s === 'failed'
}

export function isKbSyncRunningLockedMessage(msg?: string | null): boolean {
  if (!msg) return false
  return /同步进行中|in progress|already running|并发/i.test(msg)
}

/** 从 status + 日志推导 O1 展示态（兼容 KBOPS-1 前后端字段） */
export function deriveKbSyncBatchStatus(
  status: KbSyncStatus | null,
  logs: KbSyncLog[],
  localRunning: boolean,
): KbSyncBatchStatus {
  if (localRunning || status?.running) return 'running'
  if (!status?.batchNo) return 'idle'
  if ((status.failCount ?? 0) > 0) return 'fail'
  const batchFails = logs.filter(
    (row) => row.batchNo === status.batchNo && isKbSyncLogFailed(row.status),
  )
  if (batchFails.length > 0) return 'fail'
  return 'success'
}

export function pickKbSyncLastMessage(
  status: KbSyncStatus | null,
  logs: KbSyncLog[],
): string | undefined {
  if (status?.lastMessage?.trim()) return status.lastMessage.trim()
  const batchNo = status?.batchNo
  const failRow = logs.find(
    (row) =>
      isKbSyncLogFailed(row.status)
      && row.message?.trim()
      && (!batchNo || row.batchNo === batchNo),
  )
  return failRow?.message?.trim()
}
