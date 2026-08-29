#!/usr/bin/env node
/**
 * T16f + T20f 端到端联调（knowledge-server :28104 + user-center :28101）
 *
 * KB_E2E_LLM_API_KEY — 有效 LLM Key（默认用 dev yml 智谱占位，可能已失效）
 * KB_LLM_CONFIG_SECRET — 可选，配置后平台 LLM 可入库
 */
import http from 'node:http'
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const KB_BASE = process.env.KB_BASE ?? 'http://127.0.0.1:28104'
const UC_BASE = process.env.UC_BASE ?? 'http://127.0.0.1:28101'
const USER = process.env.KB_E2E_USER ?? 'admin'
const PASS = process.env.KB_E2E_PASS ?? '123456'
const DEFAULT_GLM_KEY = 'e3cce3056c10404cb27bd7bc9bfe6cfa.h8eD7w474NtdLzM0'
const LLM_KEY = process.env.KB_E2E_LLM_API_KEY ?? DEFAULT_GLM_KEY
const LLM_PROVIDER = process.env.KB_E2E_PROVIDER ?? 'glm'
const SKIP_LLM_CFG = process.env.KB_E2E_SKIP_LLM_CONFIGURE === '1'

const PROVIDER_PRESETS = {
  glm: { baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash' },
  deepseek: { baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
}

const results = []
const pass = (step, detail) => {
  results.push({ step, ok: true, detail })
  console.log(`✅ ${step}${detail ? ` — ${detail}` : ''}`)
}
const fail = (step, detail) => {
  results.push({ step, ok: false, detail })
  console.error(`❌ ${step}${detail ? ` — ${detail}` : ''}`)
}

function parseBase(url) {
  const u = new URL(url)
  return {
    host: u.hostname,
    port: Number(u.port || 80),
    pathPrefix: u.pathname.replace(/\/$/, ''),
  }
}

async function request(baseUrl, method, path, body, token, headersExtra = {}) {
  const { host, port, pathPrefix } = parseBase(baseUrl)
  const fullPath = `${pathPrefix}${path}`
  const data =
    body == null ? null : Buffer.isBuffer(body) ? body : Buffer.from(JSON.stringify(body), 'utf8')
  const headers = { ...headersExtra }
  if (token) headers.Authorization = token
  if (data && !Buffer.isBuffer(body)) headers['Content-Type'] = 'application/json'
  if (data) headers['Content-Length'] = String(data.length)

  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: host, port, path: fullPath, method, headers }, (res) => {
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => {
        const raw = Buffer.concat(chunks)
        const text = raw.toString('utf8')
        let json
        try {
          json = JSON.parse(text)
        } catch {
          json = { raw: text.slice(0, 500) }
        }
        resolve({ status: res.statusCode, json })
      })
    })
    req.on('error', reject)
    req.setTimeout(320_000, () => req.destroy(new Error(`timeout ${method} ${fullPath}`)))
    if (data) req.write(data)
    req.end()
  })
}

function multipartBody(fields, files) {
  const boundary = `----kbE2e${Date.now()}`
  const parts = []
  const push = (s) => parts.push(Buffer.from(s, 'utf8'))
  for (const [k, v] of Object.entries(fields)) {
    push(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`)
  }
  for (const f of files) {
    push(
      `--${boundary}\r\nContent-Disposition: form-data; name="${f.name}"; filename="${f.filename}"\r\nContent-Type: ${f.contentType}\r\n\r\n`,
    )
    parts.push(f.buffer)
    push('\r\n')
  }
  push(`--${boundary}--\r\n`)
  return {
    body: Buffer.concat(parts),
    contentType: `multipart/form-data; boundary=${boundary}`,
  }
}

async function login() {
  const res = await request(UC_BASE, 'POST', '/login', { userName: USER, password: PASS })
  if (res.json?.code !== 200 || !res.json?.data?.token) throw new Error(`login failed: ${JSON.stringify(res.json)}`)
  return res.json.data.token
}

async function kb(method, path, body, token, headersExtra) {
  return (await request(KB_BASE, method, `/kb${path}`, body, token, headersExtra)).json
}

async function waitForKb(maxMs = 180_000) {
  const t0 = Date.now()
  while (Date.now() - t0 < maxMs) {
    try {
      const res = await request(KB_BASE, 'GET', '/kb/wiki/govern/options')
      if (res.status === 200 || res.json?.code != null) return true
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 3000))
  }
  return false
}

async function configureLlm(token) {
  if (SKIP_LLM_CFG) {
    pass('LLM 配置', '跳过')
    return
  }
  const preset = PROVIDER_PRESETS[LLM_PROVIDER] ?? PROVIDER_PRESETS.glm
  const test = await kb('POST', '/platform/llm-config/test', {
    message: 'ping',
    enabled: true,
    provider: LLM_PROVIDER,
    baseUrl: preset.baseUrl,
    apiKey: LLM_KEY,
    model: preset.model,
  }, token)
  if (test.code !== 200 || !test.data?.success) {
    fail('LLM 测试连接', test.data?.error || test.msg || JSON.stringify(test))
    throw new Error('设置 KB_E2E_LLM_API_KEY 后重试')
  }
  pass('LLM 测试连接', `${test.data.latencyMs}ms`)

  const save = await kb('PUT', '/platform/llm-config', {
    enabled: true,
    provider: LLM_PROVIDER,
    baseUrl: preset.baseUrl,
    model: preset.model,
    temperature: 0.3,
    timeoutSeconds: 90,
    apiKey: LLM_KEY,
  }, token)
  if (save.code === 200) {
    pass('LLM 保存', `source=${save.data?.source} provider=${save.data?.provider}`)
  } else if (String(save.msg || '').includes('CONFIG_SECRET')) {
    fail('LLM 保存', '需重启 knowledge-server 并设置 KB_LLM_CONFIG_SECRET')
    throw new Error('LLM save blocked')
  } else {
    fail('LLM 保存', save.msg)
    throw new Error('LLM save failed')
  }
}

function findFirstCategoryId(tree) {
  const walk = (nodes) => {
    for (const n of nodes ?? []) {
      if (n.id != null) return n.id
      const c = walk(n.children)
      if (c != null) return c
    }
    return null
  }
  return Array.isArray(tree) ? walk(tree) : tree?.id ?? null
}

async function runT16f(token, space, opts) {
  if (opts.code !== 200 || !opts.data?.llmAvailable) {
    fail('T16f govern/options', `llmAvailable=${opts.data?.llmAvailable}`)
    return
  }
  pass('T16f govern/options', opts.data.defaultModel)

  const lint = await kb('POST', '/wiki/lint-space', {
    spaceId: space.id,
    spaceCode: space.spaceCode,
    strict: false,
  }, token)
  if (lint.code !== 200) {
    fail('T16f lint-space', lint.msg)
    return
  }
  const issues = lint.data?.issues ?? []
  pass('T16f lint-space', `${issues.length} issues`)

  const aiIssue = issues.find((i) => opts.data.aiFixableKinds?.includes(i.kind))
  if (aiIssue) {
    const ai = await kb('POST', '/wiki/govern/ai-batch-fix', {
      spaceId: space.id,
      issues: [aiIssue],
      model: opts.data.defaultModel,
    }, token)
    if (ai.code === 200 && ai.data?.fixedPages > 0) {
      pass('T16f ai-batch-fix', `fixed=${ai.data.fixedPages}`)
    } else {
      fail('T16f ai-batch-fix', ai.data?.pages?.[0]?.message?.slice(0, 150) || ai.msg)
    }
  }

  const merge = await kb('POST', '/wiki/govern/merge-hint', {
    spaceId: space.id,
    issues: [{ level: 'error', kind: 'dup_slug', page: 'e2e-dup', detail: 'e2e' }],
  }, token)
  if (merge.code === 200 && merge.data?.items?.[0]?.cursorPrompt) pass('T16f merge-hint', 'ok')
  else fail('T16f merge-hint', merge.msg)

  if (aiIssue) {
    const auto = await kb('POST', '/wiki/govern/auto-fix', {
      spaceId: space.id,
      issues: [aiIssue],
      model: opts.data.defaultModel,
      scriptFix: false,
      aiFix: true,
      relintAfter: true,
      syncAfter: true,
    }, token)
    if (auto.code === 200) {
      pass('T16f auto-fix+sync', `sync=${auto.data?.sync?.success} after=${auto.data?.issuesAfter}`)
    } else fail('T16f auto-fix', auto.msg)
  }
}

async function runT20f(token, space) {
  const prefix = `test-walkthrough-${Date.now()}`
  const tmp = mkdtempSync(join(tmpdir(), 'kb-e2e-'))
  const f1 = join(tmp, 'note-a.md')
  const f2 = join(tmp, 'note-b.md')
  writeFileSync(f1, `---\ntitle: E2E A\n---\n\n# E2E A\n`, 'utf8')
  writeFileSync(f2, `---\ntitle: E2E B\n---\n\n# E2E B\n`, 'utf8')

  const mp = multipartBody(
    { spaceId: String(space.id), prefix, onConflict: 'SKIP' },
    [
      { name: 'file', filename: 'note-a.md', contentType: 'text/markdown', buffer: Buffer.from(readFileSync(f1)) },
      { name: 'file', filename: 'note-b.md', contentType: 'text/markdown', buffer: Buffer.from(readFileSync(f2)) },
    ],
  )
  const upload = (await request(KB_BASE, 'POST', '/kb/ingest/raw-upload', mp.body, token, { 'Content-Type': mp.contentType })).json
  if (upload.code !== 200 || !upload.data?.uploaded?.length) {
    fail('T20f Tab1 raw-upload', upload.msg || JSON.stringify(upload))
    return
  }
  pass('T20f Tab1 raw-upload', `files=${upload.data.uploaded.length}`)

  const express = await kb('POST', '/ingest/jobs/express?useLlmPlan=false&useLlmGenerate=true', {
    spaceId: space.id,
    topic: `E2E walkthrough ${Date.now()}`,
    rawPaths: upload.data.uploaded.map((u) => u.path),
  }, token)
  if (express.code !== 200 || !express.data?.job?.id) {
    fail('T20f Tab2 express', express.msg || JSON.stringify(express))
    return
  }
  pass('T20f Tab2 express', `job=${express.data.job.id}`)

  const publish = await kb('POST', `/ingest/jobs/${express.data.job.id}/publish?sync=true&approveAll=true`, null, token)
  if (publish.code !== 200) {
    fail('T20f publish', publish.msg)
    return
  }
  const keys = (publish.data?.nextSteps ?? []).map((h) => h.key).join(', ')
  if (keys) pass('T20f publish nextSteps', keys)
  else fail('T20f publish nextSteps', 'empty')

  const cats = await kb('GET', `/category/tree?spaceId=${space.id}`, null, token)
  const categoryId = findFirstCategoryId(cats.data)
  if (!categoryId) {
    fail('T20f Tab3', 'no category')
    return
  }
  const impMp = multipartBody(
    {
      spaceId: String(space.id),
      categoryId: String(categoryId),
      onConflict: 'FAIL',
      lintPreview: 'false',
      sync: 'true',
    },
    [{
      name: 'file',
      filename: 'e2e-import.md',
      contentType: 'text/markdown',
      buffer: Buffer.from(`---\ntitle: E2E Import\n---\n\n# E2E ${Date.now()}\n`, 'utf8'),
    }],
  )
  const imp = (await request(KB_BASE, 'POST', '/kb/wiki/page/import', impMp.body, token, { 'Content-Type': impMp.contentType })).json
  if (imp.code !== 200 || !imp.data?.slug) {
    fail('T20f Tab3 import', imp.msg || JSON.stringify(imp))
    return
  }
  pass('T20f Tab3 import', `slug=${imp.data.slug}`)
  if (imp.data.nextSteps?.length) pass('T20f Tab3 nextSteps', imp.data.nextSteps.map((h) => h.key).join(', '))
}

async function main() {
  console.log('KB E2E walkthrough\n')
  process.stdout.write('等待 knowledge-server… ')
  if (!(await waitForKb())) {
    console.log('超时')
    process.exit(1)
  }
  console.log('ok')

  const token = await login()
  pass('登录', USER)
  await configureLlm(token)

  const opts = await kb('GET', '/wiki/govern/options', null, token)
  const spaces = await kb('GET', '/space/mine', null, token)
  const ingestSpace = spaces.data?.find((s) => s.spaceCode === 'enterprise-kb' && s.canEdit) || spaces.data?.find((s) => s.canEdit)
  const governSpace = spaces.data?.find((s) => s.spaceCode === 'moli-ops-manual') || ingestSpace
  if (!ingestSpace) throw new Error('no space')
  pass('空间', `${ingestSpace.spaceCode} / ${governSpace.spaceCode}`)

  await runT16f(token, governSpace, opts)
  await runT20f(token, ingestSpace)

  const failed = results.filter((r) => !r.ok)
  console.log(`\n--- ${results.length - failed.length}/${results.length} 通过`)
  if (failed.length) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
