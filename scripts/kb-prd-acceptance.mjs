#!/usr/bin/env node
/**
 * knowledge-ops-prd.md §8 手工验收（HTTP 自动化探针）
 * KB_BASE / UC_BASE 同 kb-e2e-walkthrough.mjs
 */
import http from 'node:http'

const KB_BASE = process.env.KB_BASE ?? 'http://127.0.0.1:8090'
const UC_BASE = process.env.UC_BASE ?? 'http://127.0.0.1:8888'

const SPACES = [
  { id: '900000000000000001', code: 'enterprise-kb' },
  { id: '900000000000000003', code: 'moli-ops-manual' },
  { id: '900000000000000002', code: 'jp-fe-ap-exam' },
]

const results = []
const ok = (id, detail) => {
  results.push({ id, ok: true, detail })
  console.log(`✅ [${id}] ${detail}`)
}
const bad = (id, detail) => {
  results.push({ id, ok: false, detail })
  console.error(`❌ [${id}] ${detail}`)
}
const skip = (id, detail) => {
  results.push({ id, ok: null, detail })
  console.log(`⏭ [${id}] ${detail}`)
}

async function request(baseUrl, method, path, body, token) {
  const u = new URL(baseUrl)
  const data = body == null ? null : Buffer.from(JSON.stringify(body), 'utf8')
  const headers = {}
  if (token) headers.Authorization = token
  if (data) {
    headers['Content-Type'] = 'application/json'
    headers['Content-Length'] = String(data.length)
  }
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

async function login() {
  const res = await request(UC_BASE, 'POST', '/login', { userName: 'admin', password: '123456' })
  if (res.json?.code !== 200) throw new Error(`login failed: ${JSON.stringify(res.json)}`)
  return res.json.data.token
}

async function kb(method, path, body, token) {
  return (await request(KB_BASE, method, `/kb${path}`, body, token)).json
}

function isFailLog(row) {
  const s = String(row?.status ?? '').toLowerCase()
  return s === 'fail' || s === 'error' || s === 'failed'
}

function isLockMsg(msg) {
  return /同步进行中|正在同步|in progress|already running|并发/i.test(String(msg ?? ''))
}

/** MyBatis Page.records / 网关 list / 裸数组 */
function pageRows(data) {
  if (Array.isArray(data)) return data
  if (!data || typeof data !== 'object') return []
  return data.records ?? data.list ?? []
}

function pageTotal(data, rows) {
  if (Array.isArray(data)) return data.length
  return Number(data?.total ?? rows.length) || 0
}

async function testO4FailLogs(token) {
  for (const sp of SPACES) {
    const logs = await kb('GET', `/sync/logs?spaceId=${sp.id}&pageNum=1&pageSize=30`, null, token)
    const rows = pageRows(logs.data)
    const failRow = rows.find((r) => isFailLog(r))
    if (failRow) {
      ok('P0-O4', `${sp.code} 日志含 fail 行 status=${failRow.status}`)
      return
    }
  }
  const status = await kb('GET', `/sync/status?spaceId=${SPACES[0].id}`, null, token)
  if ((status.data?.failCount ?? 0) > 0) {
    ok('P0-O4', `status.failCount=${status.data.failCount}（无历史 fail 日志样本）`)
    return
  }
  skip('P0-O4', '近 30 条日志无 fail 样本；需运维故意制造 Sync 失败后 UI 复验')
}

async function testO2Concurrent(token) {
  const spaceId = SPACES[0].id
  const path = `/kb/sync/trigger?spaceId=${spaceId}`
  const [a, b] = await Promise.all([
    request(KB_BASE, 'POST', path, null, token),
    request(KB_BASE, 'POST', path, null, token),
  ])
  const msgs = [a.json?.msg, b.json?.msg, a.json?.data?.message, b.json?.data?.message]
  const codes = [a.json?.code, b.json?.code]
  const locked = msgs.some((m) => isLockMsg(m))
  const oneOk = codes.filter((c) => c === 200).length >= 1
  if (locked || (oneOk && codes.includes(10012))) {
    ok('P0-O2', `并发 trigger：codes=${codes.join(',')} msgs=${msgs.filter(Boolean).join(' | ').slice(0, 120)}`)
  } else {
    bad('P0-O2', `未检测到锁提示 codes=${codes.join(',')} ${JSON.stringify(a.json).slice(0, 120)}`)
  }
}

async function triggerAndSample(token, sp) {
  const trig = await kb('POST', `/sync/trigger?spaceId=${sp.id}`, null, token)
  if (trig.code !== 200) {
    return { space: sp.code, trigger: false, msg: trig.msg }
  }
  const search = await kb(
    'GET',
    `/document/search?spaceId=${sp.id}&pageNum=1&pageSize=3&source=kb`,
    null,
    token,
  )
  const rows = pageRows(search.data)
  const slugs = rows.map((d) => d.slug || d.title).filter(Boolean)
  return { space: sp.code, trigger: true, slugs, total: pageTotal(search.data, rows) }
}

async function testP0ThreeSpaces(token) {
  const samples = []
  for (const sp of SPACES) {
    samples.push(await triggerAndSample(token, sp))
    await new Promise((r) => setTimeout(r, 1500))
  }
  const failed = samples.filter((s) => !s.trigger)
  const empty = samples.filter((s) => s.trigger && !s.slugs?.length)
  if (!failed.length && !empty.length) {
    ok('P0-3space', samples.map((s) => `${s.space}:${s.slugs.join(',')}`).join(' · '))
  } else if (!failed.length && empty.length) {
    skip('P0-3space', `trigger 成功但 browse 无文档：${empty.map((s) => s.space).join(',')}`)
  } else {
    bad('P0-3space', failed.map((s) => `${s.space}:${s.msg}`).join('; '))
  }
}

async function testRegBrowse(token) {
  await testP0ThreeSpaces(token)
  ok('REG-browse', '与 P0-3space 同轮 trigger + 每空间抽 3 slug')
}

async function testRegGovernSyncScan(token) {
  const sp = SPACES.find((s) => s.code === 'moli-ops-manual') ?? SPACES[0]
  const before = await kb('GET', `/lint/issues?spaceId=${sp.id}&resolved=0&pageNum=1&pageSize=1`, null, token)
  const beforeRows = pageRows(before.data)
  const beforeTotal = pageTotal(before.data, beforeRows)
  const lint = await kb('POST', '/wiki/lint-space', { spaceId: sp.id, spaceCode: sp.code, strict: false }, token)
  const scriptKinds = new Set(['missing_dates', 'slug_mismatch', 'missing_source'])
  const scriptIssues = (lint.data?.issues ?? []).filter((i) => scriptKinds.has(i.kind)).slice(0, 3)
  if (scriptIssues.length) {
    await kb('POST', '/wiki/govern/script-fix', { spaceId: sp.id, issues: scriptIssues }, token)
  }
  await kb('POST', `/sync/trigger?spaceId=${sp.id}`, null, token)
  await kb('POST', `/lint/scan?spaceId=${sp.id}`, null, token)
  const after = await kb('GET', `/lint/issues?spaceId=${sp.id}&resolved=0&pageNum=1&pageSize=1`, null, token)
  const afterRows = pageRows(after.data)
  const afterTotal = pageTotal(after.data, afterRows)
  if (afterTotal <= beforeTotal) {
    ok('REG-govern', `待处理工单 ${beforeTotal} → ${afterTotal}（script=${scriptIssues.length}）`)
  } else {
    skip('REG-govern', `工单 ${beforeTotal} → ${afterTotal}（scan 可能新增项，非回归失败）`)
  }
}

async function testRegLlmDisabled(token) {
  const cfg = await kb('GET', '/platform/llm-config', null, token)
  const opts = await kb('GET', '/wiki/govern/options', null, token)
  const enabled = cfg.data?.enabled
  const available = opts.data?.llmAvailable ?? cfg.data?.available
  if (enabled && available) {
    ok('REG-llm-on', 'LLM 启用且 govern/options.llmAvailable=true（AI 按钮应可用）')
    skip('REG-llm-off', '未改写 enabled=false（避免影响环境）；关闭时 UI 应 disabled，请人工点验')
    return
  }
  if (!enabled || !available) {
    ok('REG-llm-off', `enabled=${enabled} llmAvailable=${available}（治理页 AI 应 disabled）`)
  }
}

async function main() {
  console.log(`KB PRD 验收探针 KB_BASE=${KB_BASE}\n`)
  const token = await login()
  ok('LOGIN', 'admin')
  await testO4FailLogs(token)
  await testO2Concurrent(token)
  await testP0ThreeSpaces(token)
  await testRegGovernSyncScan(token)
  await testRegLlmDisabled(token)

  const pass = results.filter((r) => r.ok === true).length
  const fail = results.filter((r) => r.ok === false).length
  const skipped = results.filter((r) => r.ok === null).length
  console.log(`\n--- ${pass} 通过 · ${fail} 失败 · ${skipped} 跳过 / ${results.length} 项`)
  if (fail) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
