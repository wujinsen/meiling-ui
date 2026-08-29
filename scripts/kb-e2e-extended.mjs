#!/usr/bin/env node
/** T16f AI 写盘 · Tab3 409 冲突 · zhangsan Tab1 权限 */
import http from 'node:http'

const KB_BASE = process.env.KB_BASE ?? 'http://127.0.0.1:8091'
const UC_BASE = process.env.UC_BASE ?? 'http://127.0.0.1:28101'

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
            json = { raw: text.slice(0, 500) }
          }
          resolve({ status: res.statusCode, json })
        })
      },
    )
    req.on('error', reject)
    req.setTimeout(180_000, () => req.destroy(new Error('timeout')))
    if (data) req.write(data)
    req.end()
  })
}

function multipart(fields, files) {
  const boundary = `----ext${Date.now()}`
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
  return { body: Buffer.concat(parts), contentType: `multipart/form-data; boundary=${boundary}` }
}

async function login(user, pass) {
  const res = await request(UC_BASE, 'POST', '/login', { userName: user, password: pass })
  if (res.json?.code !== 200) throw new Error(`login ${user} failed`)
  return res.json.data.token
}

async function kb(method, path, body, token, headersExtra) {
  return (await request(KB_BASE, method, `/kb${path}`, body, token, headersExtra)).json
}

function findCategoryId(tree) {
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

const results = []
const ok = (name, detail) => {
  results.push([name, true, detail])
  console.log(`✅ ${name}${detail ? ` — ${detail}` : ''}`)
}
const bad = (name, detail) => {
  results.push([name, false, detail])
  console.error(`❌ ${name}${detail ? ` — ${detail}` : ''}`)
}

async function testT16fAi(token, space) {
  const slug = `e2e-broken-${Date.now()}`
  const md = `---\ntitle: E2E Broken Link\n---\n\nBroken [[nonexistent-target-${Date.now()}]] here.\n`
  const cats = await kb('GET', `/category/tree?spaceId=${space.id}`, null, token)
  const categoryId = findCategoryId(cats.data)
  if (!categoryId) {
    bad('T16f AI 准备', 'no category')
    return
  }
  const impMp = multipart(
    { spaceId: String(space.id), categoryId: String(categoryId), onConflict: 'FAIL', sync: 'false', lintPreview: 'false' },
    [{ name: 'file', filename: `${slug}.md`, contentType: 'text/markdown', buffer: Buffer.from(md, 'utf8') }],
  )
  const imp = await request(KB_BASE, 'POST', '/kb/wiki/page/import', impMp.body, token, { 'Content-Type': impMp.contentType })
  if (imp.json?.code !== 200) {
    bad('T16f 植入 broken_link', imp.json?.msg || JSON.stringify(imp.json))
    return
  }
  ok('T16f 植入 broken_link', imp.json.data.slug)

  const lint = await kb('POST', '/wiki/lint-space', { spaceId: space.id, spaceCode: space.spaceCode, strict: false }, token)
  const broken = (lint.data?.issues ?? []).find((i) => i.kind === 'broken_link' && String(i.page).includes('e2e-broken'))
  if (!broken) {
    bad('T16f lint broken_link', `issues=${lint.data?.issues?.length}`)
    return
  }
  ok('T16f lint 命中', broken.page)

  const opts = await kb('GET', '/wiki/govern/options', null, token)
  const ai = await kb(
    'POST',
    '/wiki/govern/ai-batch-fix',
    { spaceId: space.id, issues: [broken], model: opts.data?.defaultModel },
    token,
  )
  if (ai.code === 200 && ai.data?.fixedPages > 0) {
    ok('T16f ai-batch-fix 写盘', `fixed=${ai.data.fixedPages}`)
  } else {
    bad('T16f ai-batch-fix', ai.data?.pages?.[0]?.message?.slice(0, 150) || ai.msg)
  }
}

async function testTab3Conflict(token, space) {
  const md = `---\ntitle: Dup Test\n---\n\n# dup\n`
  const cats = await kb('GET', `/category/tree?spaceId=${space.id}`, null, token)
  const categoryId = findCategoryId(cats.data)
  if (!categoryId) {
    bad('Tab3 首次 import', 'no category')
    return
  }
  const fields = {
    spaceId: String(space.id),
    categoryId: String(categoryId),
    onConflict: 'FAIL',
    sync: 'false',
    lintPreview: 'false',
  }
  const dupName = `e2e-dup-${Date.now()}.md`
  const file = { name: 'file', filename: dupName, contentType: 'text/markdown', buffer: Buffer.from(md, 'utf8') }
  const mp1 = multipart(fields, [file])
  const r1 = await request(KB_BASE, 'POST', '/kb/wiki/page/import', mp1.body, token, { 'Content-Type': mp1.contentType })
  if (r1.json?.code !== 200) {
    bad('Tab3 首次 import', r1.json?.msg)
    return
  }
  ok('Tab3 首次 import', r1.json.data.slug)

  const mp2 = multipart(fields, [file])
  const r2 = await request(KB_BASE, 'POST', '/kb/wiki/page/import', mp2.body, token, { 'Content-Type': mp2.contentType })
  const code = r2.json?.code
  if (code === 409 || code === 10012 || String(r2.json?.msg || '').includes('冲突') || String(r2.json?.msg || '').includes('已存在')) {
    ok('Tab3 onConflict=FAIL', `code=${code} msg=${(r2.json?.msg || '').slice(0, 80)}`)
  } else {
    bad('Tab3 onConflict=FAIL', JSON.stringify(r2.json).slice(0, 200))
  }
}

async function testZhangsanRawUpload() {
  const token = await login('zhangsan', '123456')
  const caps = await request(UC_BASE, 'GET', '/auth/capabilities', null, token)
  const perms = caps.json?.data?.permissions ?? []
  const hasRaw = perms.includes('kb:ingest:rawUpload') || perms.includes('*:*:*') || caps.json?.data?.fullPermission
  if (hasRaw) {
    bad('zhangsan 无 rawUpload 权限', `has perm=${hasRaw}`)
    return
  }
  ok('zhangsan 无 kb:ingest:rawUpload', 'capabilities 符合预期')

  const mp = multipart(
    { spaceId: '900000000000000001', prefix: 'zhangsan-test', onConflict: 'SKIP' },
    [{ name: 'file', filename: 'x.md', contentType: 'text/markdown', buffer: Buffer.from('# x\n', 'utf8') }],
  )
  const res = await request(KB_BASE, 'POST', '/kb/ingest/raw-upload', mp.body, token, { 'Content-Type': mp.contentType })
  if (res.json?.code !== 200) {
    ok('zhangsan raw-upload 拒绝', `code=${res.json?.code} msg=${(res.json?.msg || '').slice(0, 60)}`)
  } else {
    bad('zhangsan raw-upload 拒绝', 'unexpected success')
  }
}

async function main() {
  console.log(`KB extended E2E  KB_BASE=${KB_BASE}\n`)
  const token = await login('admin', '123456')
  const spaces = await kb('GET', '/space/mine', null, token)
  const space = spaces.data?.find((s) => s.spaceCode === 'enterprise-kb') || spaces.data?.[0]

  await testT16fAi(token, space)
  await testTab3Conflict(token, space)
  await testZhangsanRawUpload()

  const failed = results.filter((r) => !r[1])
  console.log(`\n--- ${results.length - failed.length}/${results.length} 通过`)
  if (failed.length) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
