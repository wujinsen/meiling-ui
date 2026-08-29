#!/usr/bin/env node
/**
 * T16f script-fix 现场补测：植入 metadata issue → lint → script-fix → relint
 */
import http from 'node:http'

const KB_BASE = process.env.KB_BASE ?? 'http://127.0.0.1:28104'
const UC_BASE = process.env.UC_BASE ?? 'http://127.0.0.1:28101'

const SCRIPT_KINDS = new Set(['missing_dates', 'slug_mismatch', 'missing_source'])

async function request(baseUrl, method, path, body, token, headersExtra = {}) {
  const u = new URL(baseUrl)
  const data =
    body == null ? null : Buffer.isBuffer(body) ? body : Buffer.from(JSON.stringify(body), 'utf8')
  const headers = { ...headersExtra }
  if (token) headers.Authorization = token
  if (data && !Buffer.isBuffer(body)) headers['Content-Type'] = 'application/json'
  if (data) headers['Content-Length'] = String(data.length)
  const fullPath = `${u.pathname.replace(/\/$/, '')}${path}`
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: u.hostname, port: Number(u.port || 80), path: fullPath, method, headers },
      (res) => {
        const chunks = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8')
          let json
          try {
            json = JSON.parse(text)
          } catch {
            json = { raw: text.slice(0, 800) }
          }
          resolve({ status: res.statusCode, json })
        })
      },
    )
    req.on('error', reject)
    req.setTimeout(120_000, () => req.destroy(new Error('timeout')))
    if (data) req.write(data)
    req.end()
  })
}

async function login() {
  const res = await request(UC_BASE, 'POST', '/login', { userName: 'admin', password: '123456' })
  if (res.json?.code !== 200) throw new Error(`login failed: ${JSON.stringify(res.json)}`)
  return res.json.data.token
}

async function kb(method, path, body, token, headersExtra) {
  return (await request(KB_BASE, method, `/kb${path}`, body, token, headersExtra)).json
}

const results = []
const ok = (step, detail) => {
  results.push({ step, ok: true, detail })
  console.log(`✅ ${step}${detail ? ` — ${detail}` : ''}`)
}
const bad = (step, detail) => {
  results.push({ step, ok: false, detail })
  console.error(`❌ ${step}${detail ? ` — ${detail}` : ''}`)
}

async function main() {
  console.log(`T16f script-fix 补测  KB_BASE=${KB_BASE}\n`)
  const token = await login()
  ok('登录', 'admin')

  const opts = await kb('GET', '/wiki/govern/options', null, token)
  const scriptKinds = new Set(opts.data?.scriptFixableKinds ?? [...SCRIPT_KINDS])
  ok('govern/options', `scriptFixableKinds=${[...scriptKinds].join(',')}`)

  const spaces = await kb('GET', '/space/mine', null, token)
  const space = spaces.data?.find((s) => s.spaceCode === 'enterprise-kb' && s.canEdit) || spaces.data?.find((s) => s.canEdit)
  if (!space) throw new Error('no editable space')
  ok('空间', `${space.spaceCode} id=${space.id}`)

  const ts = Date.now()
  const fileBase = `e2e-script-fix-${ts}`
  const slug = `database/${fileBase}`
  // import 会规范化 frontmatter；须 PUT 直写磁盘以保留 metadata 缺陷
  const md = `---\ntitle: Script Fix E2E\ntype: concept\nslug: intentional-wrong-slug\nsources: []\n---\n\n# Script fix probe ${ts}\n`
  const save = await kb('PUT', '/wiki/page', { spaceId: space.id, slug, content: md }, token)
  if (save.code !== 200) {
    bad('PUT 植入 metadata 页', save.msg || JSON.stringify(save))
    process.exit(1)
  }
  ok('PUT 植入 metadata 页', slug)

  const lint1 = await kb('POST', '/wiki/lint-space', { spaceId: space.id, spaceCode: space.spaceCode, strict: false }, token)
  if (lint1.code !== 200) {
    bad('lint-space', lint1.msg)
    process.exit(1)
  }
  const allIssues = lint1.data?.issues ?? []
  const scriptIssues = allIssues.filter((i) => scriptKinds.has(i.kind) && String(i.page).includes(fileBase))
  if (!scriptIssues.length) {
    const related = allIssues.filter((i) => String(i.page).includes(fileBase))
    bad('lint 命中 script kind', related.map((i) => `${i.kind}:${i.page}`).join('; ') || 'no issues on page')
    process.exit(1)
  }
  ok('lint 命中 script kind', scriptIssues.map((i) => i.kind).join(', '))

  const fix = await kb('POST', '/wiki/govern/script-fix', { spaceId: space.id, issues: scriptIssues }, token)
  if (fix.code !== 200 || !fix.data) {
    bad('script-fix', fix.msg || JSON.stringify(fix))
    process.exit(1)
  }
  const { fixedPages, skippedPages, failedPages, pages } = fix.data
  if (fixedPages > 0) {
    ok('script-fix 写盘', `fixed=${fixedPages} skipped=${skippedPages} failed=${failedPages}`)
  } else {
    bad('script-fix 写盘', `fixed=0 pages=${JSON.stringify(pages?.slice(0, 2))}`)
    process.exit(1)
  }

  const lint2 = await kb('POST', '/wiki/lint-space', { spaceId: space.id, spaceCode: space.spaceCode, strict: false }, token)
  const remain = (lint2.data?.issues ?? []).filter(
    (i) => scriptKinds.has(i.kind) && String(i.page).includes(fileBase),
  )
  if (remain.length < scriptIssues.length) {
    ok('relint 复检', `script issues ${scriptIssues.length} → ${remain.length}`)
  } else {
    bad('relint 复检', `仍剩 ${remain.length} 项: ${remain.map((i) => i.kind).join(',')}`)
  }

  const failed = results.filter((r) => !r.ok)
  console.log(`\n--- ${results.length - failed.length}/${results.length} 通过`)
  if (failed.length) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
