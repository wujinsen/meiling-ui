/** 单附件大小上限，需与 knowledge-server `spring.servlet.multipart.max-file-size` 一致 */
const maxMb = Number(import.meta.env.VITE_KB_ATTACHMENT_MAX_MB ?? 50)
export const KB_ATTACHMENT_MAX_BYTES = (Number.isFinite(maxMb) && maxMb > 0 ? maxMb : 50) * 1024 * 1024

/** Wiki inline 插图上传上限，需与 `kb.wiki.asset-max-bytes` 一致（默认 5MB） */
const wikiAssetMb = Number(import.meta.env.VITE_KB_WIKI_ASSET_MAX_MB ?? 5)
export const KB_WIKI_ASSET_MAX_BYTES = (Number.isFinite(wikiAssetMb) && wikiAssetMb > 0 ? wikiAssetMb : 5) * 1024 * 1024

/** 大文件上传超时：按体积估算，上限 10 分钟 */
export function kbAttachmentUploadTimeoutMs(fileSize: number) {
  const mb = fileSize / (1024 * 1024)
  return Math.min(600_000, Math.max(120_000, Math.ceil(Math.max(mb, 1)) * 60_000))
}

export function kbWikiAssetUploadTimeoutMs(fileSize: number) {
  const mb = fileSize / (1024 * 1024)
  return Math.min(120_000, Math.max(30_000, Math.ceil(Math.max(mb, 0.5)) * 15_000))
}

export function formatKbAttachmentMaxSize() {
  const mb = KB_ATTACHMENT_MAX_BYTES / (1024 * 1024)
  return `${mb} MB`
}

export function formatKbWikiAssetMaxSize() {
  const mb = KB_WIKI_ASSET_MAX_BYTES / (1024 * 1024)
  return `${mb} MB`
}
