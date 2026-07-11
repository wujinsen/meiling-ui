import { request } from '@/api/http'
import { API_SUCCESS_CODE } from '@/types/api'
import type {
  KbWikiAiReviseRequest,
  KbWikiAiReviseResult,
  KbWikiEnrichRequest,
  KbWikiEnrichResult,
  KbWikiGovernAiBatchFixResult,
  KbWikiGovernAutoFixRequest,
  KbWikiGovernAutoFixResult,
  KbWikiGovernFixRequest,
  KbWikiGovernOptions,
  KbWikiGovernScriptFixResult,
  KbWikiLintPreview,
  KbWikiLintPreviewRequest,
  KbWikiPage,
  KbWikiSaveRequest,
  KbWikiSaveResult,
  KbWikiSpaceLintRequest,
  KbWikiSpaceLintResult,
  KbWikiLintIssue,
  KbWorkflowHintVo,
  WikiGovernMergeHintItem,
} from '@/types/knowledge'
import type {
  WikiImportBatchForm,
  WikiImportBatchResultVo,
  WikiImportForm,
  WikiImportResultVo,
} from '@/types/kbImport'
import {
  KB_BASE,
  USE_MOCK,
  USE_MOCK_KB_IMPORT,
  buildQuery,
  delay,
  jsonEntityBody,
  normalizeWorkflowHints,
  ok,
} from './core'
import { findKnowledgeMockPage, hasKnowledgeMockPage } from './mockRegistry'

// 8. Wiki 在线编辑 /kb/wiki/page（T14a）
// ---------------------------------------------------------------------------

/** Mock：以 slug 为键存草稿，离线演示读写闭环 */
const mockWikiFiles = new Map<string, string>()

function mockHash(text: string) {
  let h = 5381
  for (let i = 0; i < text.length; i += 1) {
    h = ((h << 5) + h + text.charCodeAt(i)) >>> 0
  }
  return `mock-${text.length}-${h.toString(16)}`
}

/** GET /kb/wiki/page —— 读 wiki 文件全文（需空间 editor） */
export async function getKbWikiPageApi(slug: string, spaceId?: number | string) {
  if (USE_MOCK) {
    await delay(160)
    const stored = mockWikiFiles.get(slug)
    const fromPage = findKnowledgeMockPage(slug)
    const content = stored
      ?? (fromPage ? `---\ntitle: ${fromPage.title}\nslug: ${fromPage.slug}\n---\n\n${fromPage.content ?? ''}` : '')
    return ok<KbWikiPage>({
      slug,
      spaceId,
      spaceCode: 'enterprise-kb',
      relativePath: `wiki/${slug}.md`,
      content,
      contentHash: mockHash(content),
      exists: stored != null || fromPage != null,
    })
  }
  return request<KbWikiPage>(`${KB_BASE}/wiki/page${buildQuery({ slug, spaceId })}`, { method: 'GET' })
}

/** PUT /kb/wiki/page —— 写 wiki 文件（需空间 editor，保存后需 Sync 才进库） */
export async function saveKbWikiPageApi(payload: KbWikiSaveRequest) {
  if (USE_MOCK) {
    await delay(240)
    const existed = mockWikiFiles.has(payload.slug) || hasKnowledgeMockPage(payload.slug)
    mockWikiFiles.set(payload.slug, payload.content)
    return ok<KbWikiSaveResult>({
      slug: payload.slug,
      spaceId: payload.spaceId,
      relativePath: `wiki/${payload.slug}.md`,
      created: !existed,
      contentHash: mockHash(payload.content),
      savedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
    })
  }
  return request<KbWikiSaveResult>(`${KB_BASE}/wiki/page`, {
    method: 'PUT',
    body: jsonEntityBody(payload as Record<string, unknown>),
  })
}

/** POST /kb/wiki/ai-revise —— AI 改稿建议（不写盘） */
export async function aiReviseKbWikiApi(payload: KbWikiAiReviseRequest) {
  if (USE_MOCK) {
    await delay(900)
    const base = payload.baselineContent ?? mockWikiFiles.get(payload.slug)
      ?? findKnowledgeMockPage(payload.slug)?.content
      ?? ''
    const suggested = `${base}\n\n<!-- AI mock: ${payload.instruction} -->`
    return ok<KbWikiAiReviseResult>({
      suggestedContent: suggested.startsWith('---') ? suggested : `---\ntitle: mock\nslug: ${payload.slug}\n---\n\n${suggested}`,
      provider: 'mock',
      model: 'mock',
      notes: 'Mock 模式演示',
    })
  }
  return request<KbWikiAiReviseResult>(`${KB_BASE}/wiki/ai-revise`, {
    method: 'POST',
    body: jsonEntityBody(payload as Record<string, unknown>),
    timeoutMs: 120_000,
  })
}

/** POST /kb/wiki/page/lint-preview —— 保存前 lint 预检 */
export async function previewKbWikiLintApi(payload: KbWikiLintPreviewRequest) {
  if (USE_MOCK) {
    await delay(120)
    const issues: KbWikiLintPreview['issues'] = []
    if (!payload.content.includes('[[')) {
      /* no wikilinks */
    } else if (payload.content.includes('[[不存在的页]]')) {
      issues.push({ type: 'broken_link', message: '断链：[[不存在的页]]' })
    }
    return ok<KbWikiLintPreview>({ issueCount: issues.length, issues })
  }
  return request<KbWikiLintPreview>(`${KB_BASE}/wiki/page/lint-preview`, {
    method: 'POST',
    body: jsonEntityBody(payload as Record<string, unknown>),
  })
}

/** POST /kb/wiki/lint-space —— 空间级文件 Lint（文件真值，T16a） */
export async function lintWikiSpaceApi(payload: KbWikiSpaceLintRequest) {
  if (USE_MOCK) {
    await delay(600)
    return ok<KbWikiSpaceLintResult>({
      spaceCode: payload.spaceCode ?? 'enterprise-kb',
      wikiDir: 'wiki',
      stats: {
        pages: 42,
        issues: 5,
        errors: 2,
        warnings: 2,
        infos: 1,
        by_kind: {
          broken_link: 1,
          orphan: 1,
          missing_source: 2,
          missing_dates: 1,
        },
      },
      issues: [
        {
          level: 'error',
          kind: 'broken_link',
          page: 'guides/本地启动指南',
          detail: '→ [[不存在的页]]',
          suggest: '建该页或改链',
        },
        {
          level: 'error',
          kind: 'orphan',
          page: 'concepts/孤儿概念',
          detail: '无入链',
          suggest: '在相关页添加 [[concepts/孤儿概念]]',
        },
        {
          level: 'warn',
          kind: 'missing_source',
          page: 'guides/本地启动指南',
          detail: 'frontmatter 缺 sources',
          suggest: '补全 sources 数组',
        },
        {
          level: 'warn',
          kind: 'missing_source',
          page: 'services/用户中心',
          detail: 'sources 为空',
          suggest: '添加 raw/prd 引用',
        },
        {
          level: 'info',
          kind: 'missing_dates',
          page: 'guides/增量ingest指南',
          detail: '缺 updated 字段',
          suggest: '补 frontmatter updated',
        },
      ],
      exitCode: 1,
      outputTail: '[FAIL] 体检未通过（errors=2 warnings=2）',
    })
  }
  return request<KbWikiSpaceLintResult>(`${KB_BASE}/wiki/lint-space`, {
    method: 'POST',
    body: jsonEntityBody(payload as Record<string, unknown>),
    timeoutMs: 130_000,
  })
}

/** GET /kb/wiki/govern/options —— Wiki 治理 kb.llm 模型列表 */
export async function getKbWikiGovernOptionsApi() {
  if (USE_MOCK) {
    await delay(80)
    return ok<KbWikiGovernOptions>({
      llmAvailable: true,
      provider: 'mock',
      defaultModel: 'glm-4-flash',
      models: [
        { id: 'glm-4-flash', displayName: 'glm-4-flash' },
        { id: 'deepseek-chat', displayName: 'deepseek-chat' },
      ],
      scriptFixableKinds: ['missing_dates', 'slug_mismatch', 'missing_source'],
      aiFixableKinds: ['broken_link', 'orphan', 'missing_concept', 'outdated', 'no_summary'],
      manualOnlyKinds: ['dup_slug'],
    })
  }
  return request<KbWikiGovernOptions>(`${KB_BASE}/wiki/govern/options`)
}

/** POST /kb/wiki/govern/script-fix —— 脚本修复 metadata */
export async function wikiGovernScriptFixApi(payload: KbWikiGovernFixRequest) {
  if (USE_MOCK) {
    await delay(400)
    return ok<KbWikiGovernScriptFixResult>({
      fixedPages: payload.issues.length,
      skippedPages: 0,
      failedPages: 0,
      pages: payload.issues.map((i) => ({ slug: i.page, status: 'ok', kinds: [i.kind] })),
    })
  }
  return request<KbWikiGovernScriptFixResult>(`${KB_BASE}/wiki/govern/script-fix`, {
    method: 'POST',
    body: jsonEntityBody(payload as Record<string, unknown>),
    timeoutMs: 180_000,
  })
}

/** POST /kb/wiki/govern/ai-batch-fix —— AI 批量修复 */
export async function wikiGovernAiBatchFixApi(payload: KbWikiGovernFixRequest & { model?: string }) {
  if (USE_MOCK) {
    await delay(800)
    return ok<KbWikiGovernAiBatchFixResult>({
      fixedPages: payload.issues.length,
      skippedPages: 0,
      failedPages: 0,
      model: payload.model,
      pages: payload.issues.map((i) => ({ slug: i.page, status: 'ok', kinds: [i.kind] })),
    })
  }
  return request<KbWikiGovernAiBatchFixResult>(`${KB_BASE}/wiki/govern/ai-batch-fix`, {
    method: 'POST',
    body: jsonEntityBody(payload as Record<string, unknown>),
    timeoutMs: 300_000,
  })
}

/** POST /kb/wiki/govern/auto-fix —— 一键修复（脚本 + AI + 复检 + 可选 Sync） */
export async function wikiGovernAutoFixApi(payload: KbWikiGovernAutoFixRequest) {
  if (USE_MOCK) {
    await delay(1000)
    const before = payload.issues.length
    return ok<KbWikiGovernAutoFixResult>({
      issuesBefore: before,
      issuesAfter: 0,
      scriptFix: {
        fixedPages: 1,
        skippedPages: 0,
        failedPages: 0,
        pages: [],
      },
      aiFix: {
        fixedPages: Math.max(0, before - 1),
        skippedPages: 0,
        failedPages: 0,
        pages: [],
      },
    })
  }
  return request<KbWikiGovernAutoFixResult>(`${KB_BASE}/wiki/govern/auto-fix`, {
    method: 'POST',
    body: jsonEntityBody(payload as Record<string, unknown>),
    timeoutMs: 300_000,
  })
}

/** POST /kb/wiki/govern/merge-hint —— 重复页合并 Cursor 指令 */
export async function wikiGovernMergeHintApi(payload: { spaceId: number | string; issues: KbWikiLintIssue[] }) {
  if (USE_MOCK) {
    await delay(200)
    return ok<{ items: WikiGovernMergeHintItem[] }>({
      items: payload.issues.map((i) => ({
        kind: i.kind,
        page: i.page,
        detail: i.detail,
        cursorPrompt: `Merge duplicate wiki page: ${i.page}`,
        manualSteps: ['Review both pages', 'Keep canonical slug', 'Remove duplicate file'],
      })),
    })
  }
  return request<{ items: WikiGovernMergeHintItem[] }>(`${KB_BASE}/wiki/govern/merge-hint`, {
    method: 'POST',
    body: jsonEntityBody(payload as Record<string, unknown>),
  })
}

/** POST /kb/wiki/enrich —— 已有页 enrich + 治理 log/index/edges */
export async function enrichKbWikiApi(payload: KbWikiEnrichRequest) {
  if (USE_MOCK) {
    await delay(400)
    const dryRun = payload.dryRun ?? false
    if (payload.items?.length) {
      return ok<KbWikiEnrichResult>({
        batchNo: payload.batchNo ?? 'mock',
        topic: payload.topic ?? 'enrich',
        dryRun,
        items: payload.items.map((item) => ({
          slug: item.slug,
          patch: item.patch ?? '## Mock enrich',
          applied: !dryRun,
        })),
        logAppended: !dryRun,
        indexUpdated: !dryRun,
        edgesAppended: payload.edges?.length ?? 0,
      })
    }
    const slug = payload.slug ?? 'guides/mock'
    return ok<KbWikiEnrichResult>({
      batchNo: payload.batchNo ?? 'mock',
      topic: payload.topic ?? 'enrich',
      dryRun,
      items: [{ slug, patch: payload.patch ?? '## Mock', applied: !dryRun }],
      logAppended: !dryRun,
      indexUpdated: !dryRun,
      edgesAppended: payload.edges?.length ?? 0,
    })
  }
  return request<KbWikiEnrichResult>(`${KB_BASE}/wiki/enrich`, {
    method: 'POST',
    body: jsonEntityBody(payload as Record<string, unknown>),
    timeoutMs: payload.rawPaths?.length || payload.items?.some((i) => i.rawPaths?.length) ? 180_000 : 60_000,
  })
}

/* ------------------------------------------------------------------ */

/** POST /kb/wiki/page/import —— T20b Wiki 成品导入 */
export async function importWikiPageApi(payload: WikiImportForm) {
  if (USE_MOCK_KB_IMPORT) {
    await delay(300)
    const stem = payload.slug?.trim() || payload.file.name.replace(/\.md$/i, '')
    const slug = `ops/${stem}`
    return ok<WikiImportResultVo>({
      slug,
      spaceId: payload.spaceId,
      relativePath: `wiki-moli/${slug}.md`,
      created: true,
      contentHash: 'mock-hash',
      lintWarnings: payload.lintPreview ? [] : [],
      sync: { triggered: payload.sync !== false, success: true, documentId: '900123' },
      nextSteps: normalizeWorkflowHints([
        {
          code: 'wiki_govern_lint',
          label: '建议运行 Wiki 治理 Lint',
          routePath: 'knowledge/wiki-govern/index',
          routeQuery: { spaceId: String(payload.spaceId) },
        },
      ]),
    })
  }
  const form = new FormData()
  form.append('spaceId', String(payload.spaceId))
  form.append('categoryId', String(payload.categoryId))
  form.append('file', payload.file)
  if (payload.assetsZip) form.append('assetsZip', payload.assetsZip)
  if (payload.slug?.trim()) form.append('slug', payload.slug.trim())
  if (payload.title?.trim()) form.append('title', payload.title.trim())
  form.append('onConflict', payload.onConflict ?? 'FAIL')
  form.append('lintPreview', String(payload.lintPreview === true))
  form.append('sync', String(payload.sync !== false))
  const syncRequested = payload.sync !== false
  const res = await request<WikiImportResultVo & { nextSteps?: Array<Record<string, unknown>> }>(
    `${KB_BASE}/wiki/page/import`,
    {
      method: 'POST',
      body: form,
      timeoutMs: syncRequested ? 320_000 : 60_000,
    },
  )
  if (res.code === API_SUCCESS_CODE && res.data) {
    res.data = {
      ...res.data,
      lintWarnings: res.data.lintWarnings ?? [],
      sync: res.data.sync ?? { triggered: syncRequested, success: false },
      nextSteps: normalizeWorkflowHints(res.data.nextSteps as Array<Record<string, unknown>> | undefined),
    }
  }
  return res
}

/** POST /kb/wiki/page/import/batch —— T20c 批量成品导入（整批一次 Sync） */
export async function importWikiBatchApi(payload: WikiImportBatchForm) {
  if (USE_MOCK_KB_IMPORT) {
    await delay(400)
    const imported = payload.files.map((f, i) => {
      const stem = f.name.replace(/\.md$/i, '')
      const slug = `ops/${stem}`
      return {
        slug,
        spaceId: payload.spaceId,
        relativePath: `wiki-moli/${slug}.md`,
        created: true,
        contentHash: `mock-${i}`,
        lintWarnings: [] as string[],
        sync: { triggered: false, success: false },
        nextSteps: [] as KbWorkflowHintVo[],
      } satisfies WikiImportResultVo
    })
    const syncRequested = payload.sync !== false
    return ok<WikiImportBatchResultVo>({
      imported,
      failed: [],
      sync: { triggered: syncRequested, success: syncRequested, documentId: '900123' },
    })
  }
  const form = new FormData()
  form.append('spaceId', String(payload.spaceId))
  form.append('categoryId', String(payload.categoryId))
  payload.files.forEach((f) => form.append('file', f))
  form.append('onConflict', payload.onConflict ?? 'FAIL')
  form.append('lintPreview', String(payload.lintPreview === true))
  const syncRequested = payload.sync !== false
  form.append('sync', String(syncRequested))
  const res = await request<WikiImportBatchResultVo & { imported?: Array<WikiImportResultVo & { nextSteps?: unknown[] }> }>(
    `${KB_BASE}/wiki/page/import/batch`,
    {
      method: 'POST',
      body: form,
      timeoutMs: syncRequested ? 320_000 : 120_000,
    },
  )
  if (res.code === API_SUCCESS_CODE && res.data) {
    res.data = {
      imported: (res.data.imported ?? []).map((item) => ({
        ...item,
        lintWarnings: item.lintWarnings ?? [],
        sync: item.sync ?? { triggered: false, success: false },
        nextSteps: normalizeWorkflowHints(item.nextSteps as Array<Record<string, unknown>> | undefined),
      })),
      failed: res.data.failed ?? [],
      sync: res.data.sync ?? { triggered: syncRequested, success: false },
    }
  }
  return res
}

// ---------------------------------------------------------------------------
