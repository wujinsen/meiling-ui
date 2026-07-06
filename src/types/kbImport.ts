import type { KbWorkflowHintVo } from '@/types/knowledge'

export type RawUploadConflict = 'SKIP' | 'OVERWRITE' | 'RENAME'

export type RawUploadItemVo = {
  path: string
  size: number
  overwritten?: boolean
}

export type RawUploadSkippedVo = {
  path: string
  reason: 'ALREADY_EXISTS' | string
}

export type RawUploadRenamedVo = {
  path: string
  originalName: string
}

export type RawUploadResultVo = {
  uploaded: RawUploadItemVo[]
  skipped: RawUploadSkippedVo[]
  renamed: RawUploadRenamedVo[]
}

export type WikiImportConflict = 'FAIL' | 'OVERWRITE'

export type WikiImportSyncVo = {
  triggered: boolean
  success: boolean
  documentId?: number | string
  message?: string
}

export type WikiImportResultVo = {
  slug: string
  spaceId: number | string
  relativePath: string
  created: boolean
  contentHash: string
  lintWarnings: string[]
  assetsImported?: string[]
  sync: WikiImportSyncVo
  nextSteps: KbWorkflowHintVo[]
}

export type WikiImportForm = {
  spaceId: number | string
  categoryId: number | string
  file: File
  assetsZip?: File
  slug?: string
  title?: string
  onConflict?: WikiImportConflict
  lintPreview?: boolean
  sync?: boolean
}

export type IngestRawHighlightPayload = {
  highlightRawPaths: string[]
  expandPrefix?: string
}
